# GlobalTradeBuddy 系统架构与部署规范 (System Architecture Specification)

> **重要声明**：本项目已完成全量架构迭代收敛，现已全量部署于 **腾讯云轻量应用服务器（Single-Server All-in-One）**。
> 本文档供所有开发者与 AI Agent 查阅，以确保全流程遵循确切的架构选型。

---

## 一、 架构演进历史 (Architecture Evolution)

| 阶段 | 方案 | 说明 / 废弃原因 | 状态 |
|------|------|-----------------|------|
| **阶段 1 (初始)** | Vercel + Supabase PostgreSQL & Storage | 国内网络访问时延高，免费额度受限，文件存储链路长 | ⛔ **已彻底废弃** |
| **阶段 2 (过渡)** | 腾讯云 CloudBase (云开发) / EdgeOne | 环境配置复杂，无缝集成 Serverless 函数限制较多 | ⛔ **已彻底废弃** |
| **阶段 3 (最终)** | 腾讯云轻量应用服务器 (Single-Server All-in-One) | 极简、高性能、低时延，数据库与后端运行于同一台服务器，独立 COS 处理静态存储 | ✅ **当前唯一生产架构** |

---

## 二、 当前确切架构配置 (Current Architecture Config)

### 1. 部署与进程守护 (Hosting & Runtime)
- **生产服务器**：腾讯云轻量应用服务器 (IP: `124.222.201.143`)
- **正式生产域名**：`https://marketgraphic.cn` (已配置 SSL 证书 + Nginx 80/443 反向代理至本地 `127.0.0.1:3000`)
- **项目根路径**：`/home/ubuntu/Global-Trade-Buddy`
- **运行环境**：Node.js / Next.js 生产环境 (Pages Router)
- **进程守护**：使用 **PM2** 守护运行生产应用进程（应用标识：`gtb-backend`）
- **构建/部署指令**：
  ```bash
  cd /home/ubuntu/Global-Trade-Buddy
  git pull origin main
  npm install
  npm run build
  pm2 restart gtb-backend
  ```

### 2. 数据库选型 (Database)
- **主数据库**：轻量服务器自建 **PostgreSQL**
- **连接地址**：
  - **服务器内部通信**：`postgresql://postgres:***@127.0.0.1:5432/postgres`
  - **本地开发 / Agent 远程运维**：`postgresql://postgres:***@124.222.201.143:5432/postgres`
- **隔离测试库**：Vitest 自动化测试统一使用本地/测试隔离数据库 `postgres_test`

### 3. 对象存储 (Object Storage)
- **云存储选型**：独立 **腾讯云 COS 对象存储桶**
- **存储桶参数**：
  - `COS_BUCKET`: `marketgraphic-image-1302276463`
  - `COS_REGION`: `ap-shanghai`
  - `文件存储路径`: `report-images/`
- **公共 CDN / 访问域名**：
  `https://marketgraphic-image-1302276463.cos.ap-shanghai.myqcloud.com/report-images/...`

### 4. 自动化备份机制 (Database Backup)
- **定时任务**：每日凌晨 3:00 自动触发 `bin/backup-db-to-cos.js`。
- **备份链路**：导出 PostgreSQL 全量数据库镜像 → gzip 压缩与加密 saving → 上传至腾讯云 COS `database-backups/` 目录。

### 5. 百度 SEO 自动推送机制 (Baidu SEO Auto Push)
- **定时任务**：每日早上 8:30 自动触发 `bin/push-to-baidu.js`。
- **推送策略**：
  1. 核心枢纽页：`/`, `/reports`, `/news`
  2. 优先推送：当日或最新生成的报告和新闻（未推送过的 `baidu_pushed_at IS NULL` 优先）
  3. 智能补充：若当日新增量小于配额，自动按轮询顺序提取历史最久未更新的报告，用满每日 API 配额
  4. 状态同步：百度接口返回成功后，自动更新数据库记录的 `baidu_pushed_at` 时间戳。

---

## 三、 绝对禁止使用服务 (Deprecated Services - DO NOT USE)

在编写新代码、重构接口、新增环境变量或编写配置脚本时，**绝对禁止**引入或使用以下废弃平台与服务：

1. ⛔ **禁止使用 Vercel / CloudBase (云开发) / EdgeOne Pages 部署**
2. ⛔ **禁止使用 Supabase PostgreSQL 数据库**
3. ⛔ **禁止使用 Supabase Storage 或 CloudBase 文件存储桶**

---

## 五、 买手联系人与 CRM 模块架构 (Buyer Contacts Architecture & Roadmap)

### 1. 数据架构与全生命周期
- **原始数据池（本地湖）**：18 届广交会采购商记录 (~173 万行) 保留于本地 SQLite (`contacts.db` 中的 `raw_contacts`)，通过 MD5 行哈希防重。
- **线上生产 CRM 表 (`crm_contacts`)**：全量清洗去重后的 190,689 条全球独立企业买手，统一托管于腾讯云自建 **PostgreSQL** 生产库。
- **关联检索逻辑**：报告详情页基于企业的 **顶级根域名（`website_domain` / `email_domain`）精确匹配**，并辅以纯净公司名精准比对。支持集团下属跨国分支与母公司买手多对多关联呈现。
- **前端展示红线**：严禁在面向终端用户的任何 UI/弹窗中透传或暴露历史会话届数 (`source_session`)。

### 2. 用户贡献与积分奖励激励体系 (待定项 / Roadmap)
为实现平台买手资源的飞轮扩张，规划引入用户共建模式：
- **UGC 提交机制**：用户在报告详情页可自主提交未收录的企业采购联系人（姓名、工作邮箱、职位、LinkedIn等），初始状态默认为 `unverified`（未验证）。
- **核验与防刷流转**：
  1. 系统后台自动执行 MX 记录检查与企业邮箱真实性探针。
  2. 限制单日每个账号的提交上限，排除通用公共邮箱后缀（如 @gmail.com、@qq.com）。
- **积分计算与额度兑换（待定细则）**：
  - **贡献获赠积分**：每提交一条经系统或人工核验通过的有效买手信息，奖励创作者 `X` 积分。
  - **积分消耗与兑换**：用户可使用积累的积分，在平台直接兑换“深度客户洞察报告解锁额度”或“高级买手联系方式批量导出额度”。
  - *具体积分数值模型、兑换比例与兑换商城接口将在后续专项阶段细化发布。*

---

## 六、 项目核心文件索引 (Key Repository Indices)

- `GEMINI.md`: AI Agent 核心规范与 Superpowers 技能说明
- `ARCHITECTURE.md`: 本系统架构选型与配置说明文档
- `bin/backup-db-to-cos.js`: 数据库每日备份至 COS 脚本
- `lib/db.ts`: PostgreSQL 数据库连接池配置
- `lib/storage.ts`: 腾讯云 COS 上传与文件存储封装
- `lib/crm-service.ts`: 采购商联系人检索与核验服务 (PostgreSQL / SQLite 自适应)
- `pages/api/reports/[id]/contacts.ts`: 报告关联联系人 API (安全过滤，绝不泄露届数)
- `pages/api/contacts/verify-single.ts`: 单点实时 DNS MX 邮箱活性验证接口

