# 首页重构与文案升级实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 根据 `2026-07-04-homepage-redesign-design.md` 的规范，对 `pages/index.tsx` 的文案进行彻底重构，增加核心价值板块与配图、精简报告大厅（精选6份+平滑展开）、新增底部 Call to Action 注册入口，且不影响原有的流光背景与调色定制器逻辑。

**架构：** 在 `pages/index.tsx` 中新增 `showAllReports` 本地 React 状态，通过条件切片（`reports.slice(0, 6)`）限制首次渲染数量；在页面各模块中嵌入 AI 生成的绝对路径图片；更新并替换 Hero 区及各部分的文案；重构底部的安全卡片为单行小字声明与大区 CTA。

**技术栈：** Next.js (Pages 路由), React, TypeScript, CSS (Vanilla inline styles)

---

### 任务 1：新增状态与导航栏文案升级

**文件：**
- 修改：`pages/index.tsx`

- [ ] **步骤 1：增加展开全部报告的 state 控制**
  在 `HomePage` 组件内部（约第 37 行附近，quota 声明下方）声明展开控制状态：
  ```typescript
  const [showAllReports, setShowAllReports] = useState(false);
  ```

- [ ] **步骤 2：更新导航栏按钮文案**
  将第 188 行附近的按钮文字从“个人知识拓扑网图”替换为“个人市场图谱”。

- [ ] **步骤 3：验证类型无误并 Commit**
  运行：`npx tsc --noEmit`
  预期：无类型编译错误。
  ```bash
  git add pages/index.tsx
  git commit -m "feat: add showAllReports state and update navbar button copy"
  ```


### 任务 2：重构 Hero 区域文案

**文件：**
- 修改：`pages/index.tsx`

- [ ] **步骤 1：修改 Hero 文案与按钮**
  定位并修改第 337-397 行附近的 Hero 区域，保留原有的容器和样式结构，替换为以下文案：
  - 小字标签（原“您的全智能出海展业伴侣”）：`专为出海决策者与外贸精英量身打造的市场资讯分析与认知图谱平台`
  - 主标题：`俯瞰全球市场结构，循线追踪市场盲区`
  - 副标题/描述：`告别碎片资讯与认知局限。外贸智友帮您突破原有认知边界，实现多维度的全球品类洞察。通过网状知识图谱将零碎资讯智能互联，助您在宏观的全球贸易版图中掌握更清晰的市场认知。`
  - 行动按钮文字：`立即探索洞察大厅 ↓`

- [ ] **步骤 2：运行开发服务器并手动确认效果**
  预期：Hero 区域文案和结构升级，背景流光照常运行。
  ```bash
  git add pages/index.tsx
  git commit -m "feat: upgrade Hero copy for market global structure view"
  ```


### 任务 3：增加三大核心认知维度与图谱图片组件

**文件：**
- 修改：`pages/index.tsx`

- [ ] **步骤 1：重构三大核心卡片文案**
  替换原本的“合规与安全防线”下方的三张卡片（第 487-601 行附近），将其移到 Hero 区域正下方（原本的发现大厅上方），并更新文案：
  - 卡片一：`拓宽视野：突破认知盲区`
    描述：`通过解锁品类与渠道洞察报告，智能匹配相近的公司或关联产品。带您探索以前未曾关注的盲区市场，打破原有的信息茧房。`
  - 卡片二：`掌握动向：全球品类洞察`
    描述：`提供多维度的全球品类洞察。深度剖析海外主流零售渠道最新的渗透率与上架准入标准，结合绿色环保、锂电化等前沿变动，精准捕捉市场动向。`
  - 卡片三：`筛选聚焦：纵览市场全局`
    描述：`支持跨行业、跨国家的精细化筛选，满足您对特定国家的关注需求。不仅能进行循线追踪，更能让您聚焦地审视整个市场的全局结构。`

- [ ] **步骤 2：引入市场认知图谱配图**
  在卡片下方或卡片组内部的适当位置，新增展示认知星网图的 DOM 结构，通过 `<img>` 标签直接读取 AI 生成的图片绝对路径：
  ```typescript
  <img src="file:///Users/jason/.gemini/antigravity/brain/03a39455-5f97-4edb-8302-b81a19dc59d2/market_structure_network_1783131730691.jpg" alt="市场认知网络脑图" style={{ width: '100%', borderRadius: '4px', border: '1px solid #222' }} />
  ```

- [ ] **步骤 3：验证页面渲染并 Commit**
  预期：卡片更新，星空网络图渲染正常。
  ```bash
  git add pages/index.tsx
  git commit -m "feat: add three core cognitive capabilities cards and embed market structure network image"
  ```


### 任务 4：重构报告大厅精选展示与平滑展开

**文件：**
- 修改：`pages/index.tsx`

- [ ] **步骤 1：限制 ReportList 数据源**
  定位至第 425-434 行的 `<ReportList ... />` 渲染部分。将 `reports` 参数修改为：
  ```typescript
  reports={showAllReports ? reports : reports.slice(0, 6)}
  ```

- [ ] **步骤 2：嵌入趋势数据图并增加“展开全部”按钮**
  - 在 `ReportList` 的头部或旁边并列排布，添加趋势图：
    ```typescript
    <img src="file:///Users/jason/.gemini/antigravity/brain/03a39455-5f97-4edb-8302-b81a19dc59d2/global_trade_trends_1783131760374.jpg" alt="全球趋势洞察数据" style={{ width: '100%', borderRadius: '4px', border: '1px solid #222' }} />
    ```
  - 在 `ReportList` 组件下方新增“展开全部报告”的按钮：
    ```typescript
    {!showAllReports && reports.length > 6 && (
      <div style={{ textAlign: 'center', marginTop: '30px' }}>
        <button 
          onClick={() => setShowAllReports(true)}
          className="sand-btn"
          style={{ padding: '10px 24px', cursor: 'pointer' }}
        >
          查看全部报告 (包含其余 {reports.length - 6} 份) ➔
        </button>
      </div>
    )}
    ```

- [ ] **步骤 3：验证展开交互并 Commit**
  预期：首次仅显示 6 份报告，点击按钮后，其余报告无缝平滑展开。
  ```bash
  git add pages/index.tsx
  git commit -m "feat: implement slice limit for ReportList with smooth view-all toggle"
  ```


### 任务 5：添加拓展工具卡片（笔记与裂变）

**文件：**
- 修改：`pages/index.tsx`

- [ ] **步骤 1：替换原有安全板块为效率与增长板块**
  删除原有的大块安全保障展示（原本的第 445-603 行），在其位置替换渲染双栏增长小工具卡片：
  - 卡片 1 (私人笔记挂载)：`挂载个人笔记：沉淀专属出海大脑`
    描述：`支持在任何解锁的报告或公司节点下，挂载您专属的随笔与见解。这些笔记将作为私密节点编织进认知图谱，让您的市场知识网络不断迭代成长。`
  - 卡片 2 (同行邀请)：`推荐同行加入：共同免费获取额度`
    描述：`通过分享您的专属邀请链接，推荐同行注册加入。每成功推荐一位用户，您与新注册用户均可获赠额外的免费报告解锁额度，实现双赢。`

- [ ] **步骤 2：Commit**
  ```bash
  git add pages/index.tsx
  git commit -m "feat: replace security block with productivity notebooks and referral tools"
  ```


### 任务 6：添加底部行动呼吁 (Call to Action) 与精简安全免责

**文件：**
- 修改：`pages/index.tsx`

- [ ] **步骤 1：在底部添加 CTA 区域**
  在资讯订阅与 Footer 之间（约第 700 行附近），新增转化注册引导区：
  - 标题：`突破认知边界，即刻开启您的全球市场洞察之旅`
  - 描述：`免费注册账号，即刻获取专属初始额度。俯瞰全球品类动态，通过市场认知图谱实现循线追踪，解锁更清晰的出海决策力。`
  - 表单：提供一个邮箱 input 输入框与一个橙色的提交注册按钮。

- [ ] **步骤 2：精简安全免责声明**
  在 Footer 正上方添加单行暗色小字：
  ```typescript
  <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#555', padding: '15px 0' }}>
    🔒 <b>数据合规背书：</b> 本系统采用本地化 Docker 部署开源数据库，数据均保存在国内。页面底层自动铺设专属防盗数字水印及隐形安全盲水印，严防任何机密泄漏。
  </div>
  ```

- [ ] **步骤 3：检查编译与运行**
  运行：`npx tsc --noEmit && npm run dev`
  手动测试页面，并在浏览器中核对调色定制器（`ThemeCustomizer`）工作完好。

- [ ] **步骤 4：Commit**
  ```bash
  git add pages/index.tsx
  git commit -m "feat: append registration CTA block and downscale security details to single footer note"
  ```
