# 用 Demo 页替换现在的主页实现计划

将 `pages/story-demo.tsx` 中的三视频滚动叙事（Scrollytelling）视觉设计和交互逻辑，完整迁移至正式主页 `pages/index.tsx`。

为了保持平台的核心业务功能，我们将保留 `pages/index.tsx` 原有的 SSR（服务端渲染数据库查询、用户会话状态校验）、邀请注册裂变绑定逻辑，以及动态导航栏、管理后台和登录注册弹窗组件的完整交互。

## 业务功能融合细节点

> [!IMPORTANT]
> 1. **状态与 SSR 数据集成**：保留 `getServerSideProps` 获取 `userId`、`userRole`、`freeQuota`、`nickname` 的数据链路。
> 2. **邀请裂变系统**：保留 URL 中 `invite` 参数捕获、本地缓存、以及自动绑定和赠送额度的 `useEffect` 逻辑。
> 3. **第四幕邀请链接卡片**：在第四幕“团队协同与裂变行动”中，融合原先主页的分享邀请链接功能。
>    - 如果用户已登录，直接展示其专属邀请链接输入框与一键复制按钮。
>    - 如果用户未登录，展示注册/登录引导按钮，点击触发登录弹窗。
> 4. **统一导航栏 (Navbar)**：将 Demo 的静态 Header 替换为功能完整的 `<Navbar />`，以保证页面顶部的“每日资讯”、“报告大厅”、“个人图谱”等路由跳转和用户额度显示完好。

---

## Proposed Changes

### Pages & Routing

#### [MODIFY] [index.tsx](file:///Users/jason/Documents/Antigravity/Project/Globaltradebuddy/pages/index.tsx)
- 保留现有的 SSR 数据查询和 Cookie 状态验证逻辑。
- 将 `pages/story-demo.tsx` 中的三视频重叠、rAF 渲染循环、Refs 绑定移植过去。
- 将新主页中的第四幕（团队协同）底部的静态链接，升级为支持动态邀请复制输入框（同原先主页的裂变模块）。
- 保留 `AuthModal`、`AdminPanel` 和相关控制逻辑。

---

## Verification Plan

### Automated Tests
- 本地 TypeScript 语法编译自检：
  `npx tsc --noEmit` (需要 BypassSandbox = true)
- 本地 Next 项目打包打包自检：
  `npm run build` (需要 BypassSandbox = true)

### Manual Verification
1. 访问首页 `http://localhost:3001/`：验证页面是否已成功变为三视频滚动叙事深色主题。
2. 登录状态测试：登录后，滚动到最后一幕，确认是否能看到自己的专属邀请链接，且“复制链接”按钮功能正常。
3. 未登录状态测试：退出登录后访问首页，滚动到最后一幕，点击“免费注册体验”或“登录后生成”，应正确拉起 `AuthModal` 登录弹窗。
4. 路由跳转：点击顶部导航栏的“报告大厅”或“个人图谱”，应能正确切换页面。
