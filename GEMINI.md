@.antigravity/skills/using-superpowers/SKILL.md
@.antigravity/skills/using-superpowers/references/gemini-tools.md

# GlobalTradeBuddy 项目指南与架构规范

> 详细的系统架构说明文档请查阅：[ARCHITECTURE.md](file:///Users/jason/Documents/Antigravity/Project/Globaltradebuddy/ARCHITECTURE.md)

## ⚠️ 系统架构统一约定 (System Architecture Consensus)

> **重要架构声明**：本项目经历了从 **Vercel + Supabase** 到 **腾讯云 CloudBase (云开发)**，最终收敛并全量部署于 **腾讯云轻量应用服务器（Single-Server All-in-One）** 的演进过程。
> 所有 AI Agent 在处理项目任务、编写代码、配置环境变量或运行调试脚本时，必须遵循以下确切的最终架构选型：

1. **部署与运行环境 (Hosting & Runtime)**
   - **生产运行平台**：腾讯云轻量应用服务器（IP: `124.222.201.143`）
   - **正式生产域名**：`https://marketgraphic.cn`（已配置 SSL + Nginx 反向代理至本地 3000 端口）
   - **进程守护**：使用 PM2 守护运行 Next.js 生产应用进程（`gtb-backend`）
   - **废弃平台说明**：⛔ **已彻底废弃 Vercel、CloudBase (云开发) 与 EdgeOne Pages 部署**，请勿针对这些废弃平台编写部署规则或配置文件。

2. **数据库选型 (Database)**
   - **主数据库**：轻量服务器自建 PostgreSQL
   - **连接地址**：
     - 服务器内部通信：`postgresql://postgres:***@127.0.0.1:5432/postgres`
     - 本地开发/Agent 远程运维：`postgresql://postgres:***@124.222.201.143:5432/postgres`
   - **废弃服务说明**：⛔ **已彻底废弃 Supabase PostgreSQL 数据库**。

3. **对象存储 (Object Storage)**
   - **云存储选型**：独立的 **腾讯云 COS 对象存储桶**
   - **存储桶参数**：`COS_BUCKET=marketgraphic-image-1302276463` | `COS_REGION=ap-shanghai`
   - **文件路径**：`report-images/`
   - **访问域名**：`https://marketgraphic-image-1302276463.cos.ap-shanghai.myqcloud.com/report-images/...`
   - **废弃存储说明**：⛔ **已彻底废弃 CloudBase 存储桶与 Supabase Storage**。

4. **数据备份机制 (Backup)**
   - 每日凌晨 3:00 通过 `bin/backup-db-to-cos.js` 自动导出全量数据库镜像并压缩加密保存至 COS `database-backups/` 目录。

---

## Superpowers-ZH 中文增强版 (Antigravity 2.0)

本项目已手动安装 superpowers-zh 技能框架（共 20 个 skills）。

### 核心规则

1. **收到任务时，先检查是否有匹配的 skill** — 哪怕只有 1% 的可能性也要检查
2. **设计先于编码** — 收到功能需求时，先用 brainstorming skill 做需求分析
3. **测试先于实现** — 写代码前先写测试（TDD）
4. **验证先于完成** — 声称完成前必须运行验证命令

### 可用 Skills

Skills 位于 `.antigravity/skills/` 目录，每个 skill 有独立的 `SKILL.md` 文件。

- **brainstorming**: 在任何创造性工作之前必须使用此技能——创建功能、构建组件、添加功能或修改行为。在实现之前先探索用户意图、需求和设计。
- **chinese-code-review**: 中文 review 沟通参考——话术模板、分级标注（必须修复/建议修改/仅供参考）、国内团队常见反模式应对。仅在用户显式 /chinese-code-review 时调用，不要根据上下文自动触发。
- **chinese-commit-conventions**: 中文 commit 与 changelog 配置参考——Conventional Commits 中文适配、commitlint/husky/commitizen 中文模板、conventional-changelog 中文配置。仅在用户显式 /chinese-commit-conventions 时调用，不要根据上下文自动触发。
- **chinese-documentation**: 中文文档排版参考——中英文空格、全半角标点、术语保留、链接格式、中文文案排版指北约定。仅在用户显式 /chinese-documentation 时调用，不要根据上下文自动触发。
- **chinese-git-workflow**: 国内 Git 平台配置参考——Gitee、Coding.net、极狐 GitLab、CNB 的 SSH/HTTPS/凭据/CI 接入差异与镜像同步配置。仅在用户显式 /chinese-git-workflow 时调用，不要根据上下文自动触发。
- **dispatching-parallel-agents**: 当面对 2 个以上可以独立进行、无共享状态或顺序依赖的任务时使用
- **executing-plans**: 当你有一份书面实现计划需要在单独的会话中执行，并设有审查检查点时使用
- **finishing-a-development-branch**: 当实现完成、所有测试通过、需要决定如何集成工作时使用——通过提供合并、PR 或清理等结构化选项来引导开发工作的收尾
- **mcp-builder**: MCP 服务器构建方法论 — 系统化构建生产级 MCP 工具，让 AI 助手连接外部能力
- **receiving-code-review**: 收到代码审查反馈后、实施建议之前使用，尤其当反馈不明确或技术上有疑问时——需要技术严谨性和验证，而非敷衍附和或盲目执行
- **requesting-code-review**: 完成任务、实现重要功能或合并前使用，用于验证工作成果是否符合要求
- **subagent-driven-development**: 当在当前会话中执行包含独立任务的实现计划时使用
- **systematic-debugging**: 遇到任何 bug、测试失败或异常行为时使用，在提出修复方案之前执行
- **test-driven-development**: 在实现任何功能或修复 bug 时使用，在编写实现代码之前
- **using-git-worktrees**: 当需要开始与当前工作区隔离的功能开发或执行实现计划之前使用——创建具有智能目录选择 and 安全验证的隔离 git 工作树
- **using-superpowers**: 在开始任何对话时使用——确立如何查找和使用技能，要求在任何响应（包括澄清性问题）之前调用 Skill 工具
- **verification-before-completion**: 在宣称工作完成、已修复或测试通过之前使用，在提交或创建 PR 之前——必须运行验证命令并确认输出后才能声称成功；始终用证据支撑断言
- **workflow-runner**: 在 Claude Code / OpenClaw / Cursor 中直接运行 agency-orchestrator YAML 工作流——无需 API key，使用当前会话的 LLM 作为执行引擎。当用户提供 .yaml 工作流文件或要求多角色协作完成任务时触发。
- **writing-plans**: 当你有规格说明或需求用于多步骤任务时使用，在动手写代码之前
- **writing-skills**: 当创建新技能、编辑现有技能或在部署前验证技能是否有效时使用

### 如何使用

当任务匹配某个 skill 时，读取对应的 `.antigravity/skills/<skill-name>/SKILL.md` 并严格遵循其流程。
