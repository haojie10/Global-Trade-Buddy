# Globaltradebuddy (外贸智友) 核心设计规格说明书

本项目是一个专为中国外贸业务员设计的高端资讯分析平台，旨在帮助业务员分析客户、探索市场品类，并通过个性化 Obsidian 网状知识库构建其私人的客情与市场情报体系。

---

## 1. 核心产品定位与功能范围

### 1.1 两大报告分析板块
*   **客户 360 度洞察**：分析海外买家采购特征、供应链背景、信用违约风险。
*   **品类洞察**：分析不同产品品类（如汽配、五金）在具体目标市场的渗透率和趋势。

### 1.2 Obsidian 模式个人知识库
*   **星空网状拓扑图**：用户主界面是一个可拖拽、缩放、高亮的星空网状图，仅展示用户**已解锁的报告节点及其关联**。
*   **强关联图片卡片**：在具体报告页面下方，提供与当前报告高频词（如客户名、品类名）强关联的其他报告图片卡片链接，便于业务员顺藤摸瓜地点击阅读，深挖知识链条。

### 1.3 核心便捷工具箱
*   **AI 商品图美化**：业务员在工厂拍摄的样品原图，一键智能抠图并替换为白底图或高级 3D 展厅背景，调节光影。
*   **实时汇率换算**：提供主要外贸结汇币种的实时计算与走势图。
*   **HS Code 智能查询**：查询海关编码对应的通关条件与出口退税率。
*   **时区黄金发送看板**：基于客户国别，动态提醒最适合发送开发信/消息的黄金时间窗。

### 1.4 变现与付费限制
*   采用“免费额度 + 单篇/会员解锁”模式。新注册用户享有基础免费篇数，额度超标后需付费解锁，解锁过的报告永久保存在个人数据库名下。

---

## 2. 拓展功能模块

为了提高用户黏性与裂变能力，平台一并支持以下三个插拔式拓展功能：
1.  **个人笔记挂载**：允许用户在任意已解锁的报告下添加个人的定制化分析笔记，并可作为节点挂载在知识图谱中。
2.  **报告收藏夹**：支持一键收藏感兴趣的报告。
3.  **多级邀请裂变**：用户可通过专属邀请码/链接邀请新业务员注册，成功邀请可自动获得额外的报告解锁额度。

---

## 3. 技术选型与部署架构

### 3.1 基础设施与合规方案
*   **服务器部署**：国内主流云厂商（阿里云 / 腾讯云）的国内节点服务器，以便进行合规的工信部 ICP 备案，并保障国内用户的高速稳定访问。
*   **开源版 Supabase 本地化部署**：采用 Docker Compose 在国内服务器上本地部署开源的 Supabase 堆栈。
    *   *优势*：数据完全留存在国内服务器，完美规避《个人信息保护法》的“数据出境”合规风险，且开发速度与官方托管版一致，零订阅费。

### 3.2 核心技术栈
*   **前端框架**：`Next.js` (React, 服务端渲染 SSR，保障资讯网站的搜索引擎 SEO 优化与收录)。
*   **图谱渲染**：`Force-Graph (D3-force)` (客户端 WebGL 高性能关系图谱渲染)。
*   **云存储**：`腾讯云 COS` / `阿里云 OSS` (托管抽取后的报告高清大图，使用 CDN 加速)。
*   **主数据库**：`PostgreSQL` (存储核心用户、报告、解锁、关联及笔记数据)。
*   **缓存**：`Redis` (记录汇率实时缓存与限流额度)。

---

## 4. 报告上传与“脱水”处理数据流

为应对每天约 20 份、包含大量嵌入图片的 9MB HTML 报告的发布，采用 API 驱动的“动态脱水”管道：

1.  **本地转码与上传**：本地脚本把 Antigravity 生成的 UTF-16LE HTML 转码为 UTF-8，调用服务端的上传 API。
2.  **图片剥离**：服务端自动提取 HTML 中庞大的 Base64 图片，上传至对象存储（OSS/COS），将 HTML 中的 `src` 替换为 CDN 图片链接。HTML 体积瞬间从 9MB 瘦身为约 100KB。
3.  **关键词关联抽取**：服务端分析 HTML 的标题和特定标签，提取关联关键词，在关联网络表中自动建立联系。
4.  **安全拦截**：未解锁的报告内容在后端数据库中被直接过滤，前端仅能获得摘要和模糊的展示。

---

## 5. 数据库表结构草图 (Database Schema)

```sql
-- 1. 用户表
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(20) UNIQUE,
    email VARCHAR(100) UNIQUE,
    free_quota INT DEFAULT 3,
    member_type VARCHAR(10) DEFAULT 'free',
    invited_by UUID REFERENCES users(id), -- 邀请裂变关联
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. 报告表
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    category VARCHAR(20) CHECK (category IN ('customer', 'product')),
    market_region VARCHAR(50),
    summary TEXT,
    content_html TEXT, -- 已经过图片脱水处理的HTML富文本
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. 用户解锁表
CREATE TABLE unlocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, report_id)
);

-- 4. 报告关联网络表
CREATE TABLE relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id_a UUID REFERENCES reports(id) ON DELETE CASCADE,
    report_id_b UUID REFERENCES reports(id) ON DELETE CASCADE,
    relation_key VARCHAR(100), -- 关联的共有实体，如“铝合金轮毂”
    created_at TIMESTAMP DEFAULT NOW()
);

-- 5. 个人笔记表（拓展）
CREATE TABLE notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
    content TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 6. 报告收藏夹表（拓展）
CREATE TABLE favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, report_id)
);
```

---

## 6. 安全防盗与错误处理机制

*   **服务端动态水印**：已解锁的报告渲染时，利用 Canvas 在页面底层铺设包含用户手机号和时间戳的防盗水印，并生成隐形盲水印，防拍照和截图外流。
*   **后端安全拦截**：所有报告的 HTML 全文读取请求必须校验用户 `unlocks` 状态，未解锁用户直接由后端阻断内容，防止客户端越权爬取。
*   **转码灾备与回滚**：上传 HTML 编码出错或 Base64 图片剥离上传 OSS 失败时，整个事务自动回滚，不产生污染数据，并记录报警日志。

---

## 7. 验证计划

### 7.1 自动测试验证
*   **转码与脱水测试**：模拟上传 UTF-16LE 且带有 Base64 图片的 HTML 报告，校验接口是否能成功将其瘦身至 200KB 以下，且 OSS 中成功创建图片。
*   **图谱子网查询测试**：模拟不同的用户解锁场景，验证后端 API 返回的 `relations` 是否仅为当前用户已解锁节点的子图，保障“千人千面”。

### 7.2 手动测试验证
*   **图谱交互测试**：在本地浏览器运行 Demo，验证 Force-Graph 节点拖拽是否流畅，点击能否顺利调起报告详情。
*   **数字水印肉眼校验**：登录不同测试账号，验证报告详情底层的防盗水印是否随登录账号动态变化。
