# 管理员报告拖拽上传与排版优化实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 实现管理员文件拖拽/选择上传 HTML 报告，在前端自动进行 UTF-16LE 编码检测与转码，并在解锁报告页面自适应宽屏及保留报告原生的奢华暗绿金框主题。

**架构：**
1. **新建工具函数库** `lib/encoding.ts` 用于处理 ArrayBuffer 二进制数据的编码自动识别与解码，并编写测试文件进行 Vitest 测试。
2. **在主页 `pages/index.tsx` 中** 替换粘贴 HTML 的文本域，利用 HTML5 Drag & Drop API 与隐藏的 `<input type="file" />` 实现高颜值拖拽区域（Dropzone），在前端将拖入的文件转为 UTF-8 字符串存入原 State 触发上传。
3. **在详情页 `pages/reports/[id].tsx` 中** 修改 HTML 过滤逻辑 `cleanHtmlBody` 移除强制浅色覆盖，并修改页面容器，在解锁状态下将其最大宽度扩展至 `1400px`，并为其包裹圆角、内边距和暗绿渐变色背景。

**技术栈：** Next.js (React), TypeScript, Vitest, HTML5 Drag & Drop API, TextDecoder.

---

## 计划涉及文件清单

### 新建文件
1. `lib/encoding.ts` — 二进制文本编码检测解码工具函数
2. `tests/encoding.test.ts` — 编码工具函数测试用例

### 修改文件
1. `pages/index.tsx` — 管理员上传报告弹窗交互（Dropzone 实现）
2. `pages/reports/[id].tsx` — 报告排版与主题自适应修改

---

## 任务分解与小步骤实现

### 任务 1：编码检测工具函数实现与测试 (TDD)

**文件：**
- 创建：`lib/encoding.ts`
- 测试：`tests/encoding.test.ts`

- [ ] **步骤 1：编写失败的测试**
  在 `tests/encoding.test.ts` 中写入测试，测试 `detectAndDecodeHtml` 对 UTF-8 和 UTF-16LE 数据的正确检测与转换：
  ```typescript
  import { describe, it, expect } from 'vitest';
  import { detectAndDecodeHtml } from '../lib/encoding';

  describe('detectAndDecodeHtml utility', () => {
    it('should correctly decode UTF-8 binary array', () => {
      // "Hello, 世界" 的 UTF-8 编码字节流
      const utf8Bytes = new Uint8Array([72, 101, 108, 108, 111, 44, 32, 228, 184, 150, 231, 149, 140]);
      const result = detectAndDecodeHtml(utf8Bytes.buffer);
      expect(result).toBe('Hello, 世界');
    });

    it('should correctly decode UTF-16LE binary array with BOM', () => {
      // "Hello, 世界" 的 UTF-16LE 带有 BOM (FF FE) 字节流
      const utf16Bytes = new Uint8Array([
        0xff, 0xfe, // BOM
        0x48, 0x00, // H
        0x65, 0x00, // e
        0x6c, 0x00, // l
        0x6c, 0x00, // l
        0x6f, 0x00, // o
        0x2c, 0x00, // ,
        0x20, 0x00, //  
        0x16, 0x4e, // 世
        0x4c, 0x75  // 界
      ]);
      const result = detectAndDecodeHtml(utf16Bytes.buffer);
      expect(result).toBe('Hello, 世界');
    });
  });
  ```

- [ ] **步骤 2：运行测试验证失败**
  运行：`npx vitest run tests/encoding.test.ts`
  预期：测试运行报错，提示 `Cannot find module '../lib/encoding'` 或 `detectAndDecodeHtml` 未定义。

- [ ] **步骤 3：编写最少实现代码**
  在 `lib/encoding.ts` 中实现编码检测函数：
  ```typescript
  export function detectAndDecodeHtml(buffer: ArrayBuffer): string {
    const uint8 = new Uint8Array(buffer);
    let encoding = 'utf-8';

    // 1. 检查 BOM 头 (UTF-16LE: FF FE)
    if (uint8.length >= 2 && uint8[0] === 0xff && uint8[1] === 0xfe) {
      encoding = 'utf-16le';
    } else {
      // 2. 兜底检测前 100 字节的 0x00 字节占比（UTF-16LE 每一个 ASCII 字符后面都有一个 0x00）
      let zeroBytes = 0;
      const limit = Math.min(uint8.length, 100);
      for (let i = 0; i < limit; i++) {
        if (uint8[i] === 0x00) {
          zeroBytes++;
        }
      }
      if (zeroBytes > 10) {
        encoding = 'utf-16le';
      }
    }

    const decoder = new TextDecoder(encoding);
    return decoder.decode(uint8);
  }
  ```

- [ ] **步骤 4：运行测试验证通过**
  运行：`npx vitest run tests/encoding.test.ts`
  预期：测试全部通过。

- [ ] **步骤 5：Commit 编码工具代码**
  运行：
  ```bash
  git add lib/encoding.ts tests/encoding.test.ts
  git commit -m "feat: add encoding detection utility and unit tests"
  ```

---

### 任务 2：主页 Dropzone 文件拖拽/点击上传功能实现

**文件：**
- 修改：`pages/index.tsx`

- [ ] **步骤 1：引入编码检测工具**
  在 `pages/index.tsx` 头部引入 `detectAndDecodeHtml` 工具函数。
  ```typescript
  import { detectAndDecodeHtml } from '../lib/encoding';
  ```

- [ ] **步骤 2：在 `pages/index.tsx` 中定义 Dropzone 状态和事件处理程序**
  在 `IndexPage`（或 `Home` 组件，即默认导出的函数组件）中，定位到 `// 管理员上传报告弹窗状态` 附近（约 46-49 行），新增文件和拖拽激活状态：
  ```typescript
  // 管理员上传报告弹窗状态
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [rawHtmlContent, setRawHtmlContent] = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);
  
  // 新增拖拽及文件状态
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  ```
  在关闭弹窗和成功上传时，将 `selectedFile` 和 `isDragActive` 重置：
  ```typescript
  // 在 handleUploadReport 成功分支中：
  setSelectedFile(null);
  setIsDragActive(false);

  // 在弹窗 Close 按钮中：
  onClick={() => { setShowUploadModal(false); setSelectedFile(null); setIsDragActive(false); setRawHtmlContent(''); }}
  ```

- [ ] **步骤 3：编写文件载入并解析的函数**
  在组件中增加对文件读取的处理：
  ```typescript
  const handleFileChange = (file: File) => {
    if (!file) return;
    if (!file.name.endsWith('.html') && !file.name.endsWith('.htm')) {
      alert('只支持上传 .html 格式的文件');
      return;
    }
    setSelectedFile(file);
    
    // 读取文件内容
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      try {
        const decodedText = detectAndDecodeHtml(buffer);
        setRawHtmlContent(decodedText);
      } catch (err) {
        alert('读取或解析文件失败，请检查编码格式');
      }
    };
    reader.onerror = () => {
      alert('读取文件出错');
    };
    reader.readAsArrayBuffer(file);
  };
  ```

- [ ] **步骤 4：更新拖拽区 UI 与 DOM 渲染**
  替换 `pages/index.tsx` 中的整个 `<textarea>` 为全新的 Dropzone 卡片。
  定位到原文本框（约 1046-1063 行）：
  ```typescript
  {/* 将原 textarea 替换为以下 Dropzone */}
  <div 
    onClick={() => fileInputRef.current?.click()}
    onDragOver={(e) => {
      e.preventDefault();
      setIsDragActive(true);
    }}
    onDragLeave={() => setIsDragActive(false)}
    onDrop={(e) => {
      e.preventDefault();
      setIsDragActive(false);
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileChange(e.dataTransfer.files[0]);
      }
    }}
    style={{
      width: '100%',
      height: '240px',
      background: selectedFile 
        ? 'linear-gradient(135deg, rgba(37, 99, 235, 0.03) 0%, rgba(37, 99, 235, 0.08) 100%)' 
        : isDragActive 
          ? 'linear-gradient(135deg, rgba(37, 99, 235, 0.05) 0%, rgba(37, 99, 235, 0.12) 100%)'
          : 'rgba(255, 255, 255, 0.65)',
      border: selectedFile 
        ? '2px solid #2563eb' 
        : isDragActive 
          ? '2px dashed #2563eb' 
          : '2px dashed rgba(15, 23, 42, 0.15)',
      borderRadius: '20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
      cursor: 'pointer',
      transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      padding: '20px',
      boxShadow: isDragActive ? '0 12px 30px rgba(37, 99, 235, 0.08)' : 'none',
    }}
    onMouseOver={(e) => {
      if (!selectedFile && !isDragActive) {
        e.currentTarget.style.borderColor = 'rgba(37, 99, 235, 0.5)';
        e.currentTarget.style.boxShadow = '0 8px 20px rgba(15, 23, 42, 0.02)';
      }
    }}
    onMouseOut={(e) => {
      if (!selectedFile && !isDragActive) {
        e.currentTarget.style.borderColor = 'rgba(15, 23, 42, 0.15)';
        e.currentTarget.style.boxShadow = 'none';
      }
    }}
  >
    <input 
      type="file" 
      ref={fileInputRef}
      onChange={(e) => {
        if (e.target.files && e.target.files[0]) {
          handleFileChange(e.target.files[0]);
        }
      }}
      accept=".html,.htm"
      style={{ display: 'none' }}
    />
    {selectedFile ? (
      <>
        <div style={{ fontSize: '3rem' }}>📄</div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: '0 0 4px 0', fontWeight: 600, fontSize: '0.95rem', color: '#0f172a' }}>
            {selectedFile.name}
          </p>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
            文件大小: {(selectedFile.size / 1024).toFixed(1)} KB
          </p>
        </div>
        <button 
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedFile(null);
            setRawHtmlContent('');
          }}
          style={{
            marginTop: '8px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#ef4444',
            borderRadius: '12px',
            padding: '6px 16px',
            fontSize: '0.8rem',
            cursor: 'pointer',
            fontWeight: 500,
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
          }}
        >
          ✕ 清除重选
        </button>
      </>
    ) : (
      <>
        <div style={{ 
          fontSize: '3rem', 
          transform: isDragActive ? 'translateY(-5px)' : 'none',
          transition: 'transform 0.2s'
        }}>
          ☁️
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: '0 0 4px 0', fontWeight: 500, color: '#0f172a', fontSize: '0.95rem' }}>
            {isDragActive ? '释放以导入此报告' : '将 HTML 报告文件拖到这里'}
          </p>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
            支持 Drag & Drop，或点击本卡片浏览文件
          </p>
        </div>
      </>
    )}
  </div>
  ```

- [ ] **步骤 5：确保上传按钮的状态依赖于 `rawHtmlContent` 是否准备就绪**
  检查上传按钮的 `disabled` 属性（约 1067 行），不仅禁用在 `uploadLoading` 状态，还要在 `!rawHtmlContent` 时禁用：
  ```typescript
  disabled={uploadLoading || !rawHtmlContent}
  ```

- [ ] **步骤 6：运行并编译 Next.js 确保没有 TypeScript 语法报错**
  运行：`npx tsc --noEmit`
  预期：无 TypeScript 报错。

- [ ] **步骤 7：Commit 主页 Dropzone 代码**
  运行：
  ```bash
  git add pages/index.tsx
  git commit -m "feat: implement drag-and-drop file upload (Dropzone) in admin upload modal"
  ```

---

### 任务 3：解锁报告详情页排版自适应与主题美化

**文件：**
- 修改：`pages/reports/[id].tsx`

- [ ] **步骤 1：修改 `cleanHtmlBody` 函数移除强制浅色背景覆盖**
  定位到 `cleanHtmlBody` 中的 `lightThemeOverrides` 定义（约 79-104 行），改为移除文本和背景的强制透明及颜色覆盖，仅保留安全限制和基本的 HTML 重置，防止污染主站：
  ```typescript
  // 4. 强制注入的基础重置样式（不再强制覆盖前景色和背景色，允许模板原生的暗色主题和卡片显示）
  const lightThemeOverrides = `
    <style>
      .report-content-body {
        width: 100%;
        font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      }
      .report-content-body img {
        max-width: 100%;
        height: auto;
        border-radius: 12px;
        margin: 16px 0;
      }
      .report-content-body table {
        width: 100%;
        border-collapse: collapse;
        margin: 20px 0;
      }
    </style>
  `;
  ```

- [ ] **步骤 2：调整详情页的 Container 宽度和外框背景（解锁后扩展为 1400px 暗色模式）**
  定位到 `ReportDetailPage` 中详情页主居中容器（约 163 行）：
  ```typescript
  {/* 将原有的 maxWidth: '900px' 改为基于 unlocked 动态计算的宽度 */}
  <div style={{ 
    maxWidth: unlocked ? '1400px' : '900px', 
    margin: '0 auto', 
    padding: '40px 20px', 
    position: 'relative', 
    zIndex: 5,
    transition: 'max-width 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
  }}>
  ```

- [ ] **步骤 3：在解锁后，为 `.report-content-body` 内容区包裹专属的高级暗色背景层**
  定位到渲染 HTML 内容的容器（约 221-228 行）：
  ```typescript
  {/* 替换为自适应暗绿奢华背景容器 */}
  {unlocked ? (
    <div style={{
      background: 'linear-gradient(135deg, #090e07 0%, #030502 100%)',
      borderRadius: '24px',
      padding: '40px',
      boxShadow: '0 20px 50px rgba(9, 14, 7, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
      border: '1px solid rgba(143, 168, 116, 0.12)',
      marginTop: '20px',
      transition: 'all 0.5s ease',
      overflow: 'hidden'
    }}>
      <div 
        className="report-content-body"
        style={{ fontSize: '1rem', color: '#f2f5f0', lineHeight: 1.8 }}
        dangerouslySetInnerHTML={{ __html: cleanHtmlBody(content || '') }} 
      />
    </div>
  ) : (
    // 保留未解锁的高斯模糊与引导解锁卡片渲染结构不变
  ```

- [ ] **步骤 4：运行 TypeScript 类型检查确保没有错误**
  运行：`npx tsc --noEmit`
  预期：PASS。

- [ ] **步骤 5：Commit 详情页视觉修改**
  运行：
  ```bash
  git add pages/reports/[id].tsx
  git commit -m "style: optimize report detail page width and adapt to report template's luxury dark forest theme"
  ```

---

## 4. 整体集成验证与测试

- [ ] **步骤 1：运行现有管道的测试**
  运行：`npm run test`
  预期：Vitest 现有测试及我们新增的编码测试全部通过。

- [ ] **步骤 2：启动本地开发服务器**
  运行：`npm run dev`（让服务器在 3000 端口启动）
  预期：成功启动，无报错。

- [ ] **步骤 3：手动验证管理员上传与视觉展现**
  1. 登录管理员账号，点击“📤 发布外贸数据报告”按钮。
  2. 拖拽 `Template/Customer Insight.html` (UTF-16LE 编码) 进入拖拽区域。
  3. 确认文件名正确显示，点击“立即发布报告”发布。
  4. 解锁新上传的报告，验证页面平滑伸展至 1400px，显示暗黑奢华渐变背景，KPI 卡片和结构显示完美无遮挡，排版精细优雅。
