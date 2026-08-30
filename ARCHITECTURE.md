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

## 四、 项目核心文件索引 (Key Repository Indices)

- `GEMINI.md`: AI Agent 核心规范与 Superpowers 技能说明
- `ARCHITECTURE.md`: 本系统架构选型与配置说明文档
- `bin/backup-db-to-cos.js`: 数据库每日备份至 COS 脚本
- `lib/db.ts`: PostgreSQL 数据库连接池配置
- `lib/storage.ts`: 腾讯云 COS 上传与文件存储封装
