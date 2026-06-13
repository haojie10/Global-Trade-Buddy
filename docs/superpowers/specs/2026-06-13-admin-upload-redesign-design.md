# 管理员报告拖拽上传与视觉排版优化设计规格说明书

本设计旨在提升外贸智友（Globaltradebuddy）平台管理员发布报告的使用体验，并保障暗色奢华风格报告模板（如客户洞察、品类分析）在前端解锁后的完美排版与视觉品质。

---

## 1. 核心改进方案

### 1.1 前端 HTML 文件拖拽上传 (Drag & Drop Dropzone)
在管理员上传弹窗中，原有的原始 HTML 代码粘贴文本框（`<textarea>`）将被一个精致、高颜值的拖拽上传卡片替代：
*   **交互与状态**：
    *   **初始状态**：显示虚线边框、云端上传图标，提示“拖拽 HTML 报告至此，或点击浏览文件”。
    *   **悬浮状态 (Drag Over)**：当文件拖入区域时，边框变为渐变色，背景增加微弱的玻璃模糊度 (Backdrop Filter) 与轻微缩放。
    *   **就绪状态 (File Loaded)**：成功导入文件后，显示 HTML 文件图标、文件名（如 `Customer Insight.html`）和文件大小，右侧提供 **✕** 清除按钮。
    *   **上传状态 (Uploading)**：提交时，禁用操作并展示加载动画。
*   **文件单份上传**：保留单份上传逻辑，满足管理员一份一份上传并校对的需求。

### 1.2 前端智能编码自动检测与转换
针对从本地拖入的 HTML 报告文件（可能为 `UTF-16LE` 编码或 `UTF-8` 编码）：
*   在前端读取文件时，通过 `FileReader` 以 `ArrayBuffer` 读取前几个字节检测 BOM 头（`FF FE` 为 UTF-16LE）。
*   根据检测结果使用 `TextDecoder('utf-16le')` 或 `TextDecoder('utf-8')` 解码，自动转为 UTF-8 字符串后再提交给后端 `/api/admin/reports/upload`。防止上传后数据库中的中文出现乱码。

### 1.3 报告排版视觉优化 (自适应暗绿奢华主题与宽屏)
在报告详情页 `pages/reports/[id].tsx` 中：
*   **移除浅色强制覆盖**：移除 `cleanHtmlBody` 中将所有文本设为 Slate 灰（`#334155`）和背景设为透明（`transparent !important`）的粗暴样式覆盖。保留报告模板原生的 CSS 变量和精美卡片背景（如暗绿渐变背景 `--bg-gradient`，KPI 卡片暗背景等）。
*   **容器宽度动态适配**：解锁前，保持 `900px` 窄屏预览及居中的锁定弹窗；解锁后，容器最大宽度动态拓展为 `1400px`，使模板的 4 列网格（`.kpi-grid`）和并排卡片能够舒展展示。
*   **背景衔接**：解锁后，内容展示区域的背景色与报告原生的暗绿渐变色融为一体，保障奢华质感。

---

## 2. 详细设计与代码变更点

### 2.1 管理员上传弹窗 (`pages/index.tsx`)
*   **状态变量**：
    *   `file: File | null` - 当前选中的文件。
    *   `isDragActive: boolean` - 拖拽是否悬停中。
*   **文件读取辅助函数**：
    ```typescript
    const readHtmlFile = (selectedFile: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const uint8Array = new Uint8Array(arrayBuffer);
          let encoding = 'utf-8';
          // 检测 BOM 头 (UTF-16LE: FF FE)
          if (uint8Array[0] === 0xff && uint8Array[1] === 0xfe) {
            encoding = 'utf-16le';
          } else {
            // 兜底检测前 100 字节的 0x00 字节占比（UTF-16 特征）
            let zeroBytes = 0;
            const limit = Math.min(uint8Array.length, 100);
            for (let i = 0; i < limit; i++) {
              if (uint8Array[i] === 0x00) zeroBytes++;
            }
            if (zeroBytes > 10) {
              encoding = 'utf-16le';
            }
          }
          const decoder = new TextDecoder(encoding);
          resolve(decoder.decode(uint8Array));
        };
        reader.onerror = () => reject(new Error('文件读取失败'));
        reader.readAsArrayBuffer(selectedFile);
      });
    };
    ```
*   **拖拽事件绑定**：
    *   `onDragOver` / `onDragEnter`: 设置 `isDragActive` 为 `true`。
    *   `onDragLeave`: 设置 `isDragActive` 为 `false`。
    *   `onDrop`: 获取 `e.dataTransfer.files[0]`，读取并调用 `readHtmlFile`。

### 2.2 报告详情页 (`pages/reports/[id].tsx`)
*   **`cleanHtmlBody` 修改**：
    *   移除 `lightThemeOverrides` 中对文本颜色和背景的 `!important` 覆盖。
    *   为了防止页面加载时闪烁，可以在样式段中保留对 `.report-content-body` 基本字体和边距的重置。
*   **宽屏容器样式**：
    *   详情页容器使用动态样式：`maxWidth: unlocked ? '1400px' : '900px'`。
    *   内容区域在解锁后外围包裹一层背景：`background: unlocked ? 'linear-gradient(135deg, #090e07 0%, #030502 100%)' : 'transparent'`，圆角为 `24px`，内边距 `40px`。

---

## 3. 验证计划

### 3.1 自动测试验证
*   **编码转换逻辑测试**：在 vitest 测试集中，模拟读取 UTF-16LE 文件的 ArrayBuffer，调用 `readHtmlFile` 模拟函数，断言其能正确转换为 UTF-8 字符串。

### 3.2 手动测试验证
1.  **拖拽上传测试**：
    *   打开管理员弹窗，将 `Template/Customer Insight.html` (UTF-16LE) 拖入 Dropzone。
    *   验证文件名和大小正确显示，点击“立即发布”，检查是否上传成功。
    *   验证在主页图谱中生成了新节点。
2.  **视觉渲染测试**：
    *   登录普通用户，查看刚刚上传的报告，应该呈现模糊预览和解锁弹窗（容器为 `900px`）。
    *   点击解锁（扣除额度），解锁后容器平滑变宽至 `1400px`，页面渲染出奢华的暗绿渐变底色。
    *   检查 KPI 卡片、品牌卡片的背景和文字是否清晰（文字为淡色，背景为暗绿/金框），Tab 切换交互是否正常。
