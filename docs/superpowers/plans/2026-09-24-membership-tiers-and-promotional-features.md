# 推广期会员权益体系与首页营销落地实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 构建完整的推广期会员权益体系（Free 赠送 10 次在线解锁 + 5 份 HTML 下载；Pro 每月 50 次在线解锁 + 10 份 HTML 下载并按订阅日周期刷新；Pro 专属邀请奖励 +10 解锁 +2 下载），实现 HTML 报告离线下载 API 及防盗机制，并在首页全方位展示推广期权益亮点与会员对比。

**架构：** 在 PostgreSQL 中扩充下载额度与 Pro 周期字段；通过 Next.js API 路由提供离线报告打包与附件下载接口；更新邀请返佣、登录会话解析及 Pro 周期自动重置逻辑；在首页导航栏、Hero 推广横幅、权益对比矩阵及报告详情页全面渗透推广期福利。

**技术栈：** Next.js (Pages Router), TypeScript, PostgreSQL (`pg`), Vitest, CSS / React Components

---

## 文件结构规划

### 数据库与类型
- 创建：`supabase/migrations/20260924000000_membership_tiers_and_downloads.sql` — 为 users 表添加 `download_quota`、`pro_subscribed_at`、`pro_cycle_expires_at` 等字段
- 修改：`tests/helpers/db-test-helper.ts` — 更新测试用户初始化数据，包含下载额度

### 服务端与 API
- 修改：`lib/ssr-auth.ts` — 扩展 `SsrAuthResult`，解析 `downloadQuota`、`memberType` 并自动执行到期日重置逻辑
- 修改：`pages/api/auth/signup.ts` — 新用户注册写入初始默认 `free_quota = 10`、`download_quota = 5`、`member_type = 'free'`
- 创建：`pages/api/user/report-download.ts` — HTML 离线报告下载接口（校验登录状态、报告解锁状态、扣减下载额度、生成完整离线 HTML）
- 修改：`pages/api/user/invite.ts` — 区分 Free 与 Pro 邀请人奖励逻辑（Free 邀请得 +3，Pro 邀请得 +10 解锁 + 2 下载）

### 前端组件与页面
- 创建：`components/PromotionalBanner.tsx` — 首页顶部/浮层推广期特权横幅
- 创建：`components/MembershipTiersSection.tsx` — 首页推广期会员权益与额度对比矩阵（Free vs Pro vs Enterprise）
- 修改：`pages/index.tsx` — 接入推广横幅、会员对比矩阵，更新导航栏额度指标（同时显示解锁额度与下载额度）
- 修改：`pages/reports/[id].tsx` — 报告详情页增加“📥 下载离线报告 (HTML)”按钮及余额提示
- 修改：`components/AuthModal.tsx` — 注册弹窗高亮展示推广期新手礼包（10次解锁+5份下载）

### 自动化测试
- 创建：`tests/membership-tiers.test.ts` — 校验新用户额度、下载接口鉴权与额度扣减、Pro 周期刷新
- 创建：`tests/invite-tiers.test.ts` — 校验邀请好友时 Free 与 Pro 邀请人的阶梯奖励

---

## 任务拆解与执行步骤

### 任务 1：数据库 Migration 与测试环境更新

**文件：**
- 创建：`supabase/migrations/20260924000000_membership_tiers_and_downloads.sql`
- 修改：`tests/helpers/db-test-helper.ts`

- [ ] **步骤 1：编写数据库迁移脚本**

创建 `supabase/migrations/20260924000000_membership_tiers_and_downloads.sql`：
```sql
-- 1. 添加下载额度字段（推广期默认免费版赠送 5 份）
ALTER TABLE users ADD COLUMN IF NOT EXISTS download_quota INT DEFAULT 5;

-- 2. 添加 Pro 会员订阅时间与周期重置日
ALTER TABLE users ADD COLUMN IF NOT EXISTS pro_subscribed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pro_cycle_expires_at TIMESTAMP WITH TIME ZONE;

-- 3. 确保 download_quota 不小于 0
ALTER TABLE users DROP CONSTRAINT IF EXISTS check_download_quota;
ALTER TABLE users ADD CONSTRAINT check_download_quota CHECK (download_quota >= 0);

-- 4. 将历史已有用户的 download_quota 补充为 5（推广期普惠）
UPDATE users SET download_quota = 5 WHERE download_quota IS NULL;
```

- [ ] **步骤 2：更新测试辅助工具 `tests/helpers/db-test-helper.ts`**

修改 `createTestUser` 函数，使其包含 `download_quota` 默认值支持：
```typescript
// tests/helpers/db-test-helper.ts 中 update createTestUser
export async function createTestUser(
  client: Client,
  options: {
    phoneNumber?: string;
    email?: string;
    freeQuota?: number;
    downloadQuota?: number;
    role?: string;
    memberType?: string;
    nickname?: string;
    password?: string;
  } = {}
) {
  const {
    phoneNumber = `138${Math.floor(Math.random() * 90000000 + 10000000)}`,
    email = `test_${Date.now()}_${Math.floor(Math.random() * 1000)}@gtb.com`,
    freeQuota = 10,
    downloadQuota = 5,
    role = 'user',
    memberType = 'free',
    nickname = '测试用户',
    password = 'mypassword123',
  } = options;

  const passwordHash = await bcrypt.hash(password, 10);
  const res = await client.query(
    `INSERT INTO users (phone_number, email, role, free_quota, download_quota, member_type, password, nickname)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, phone_number, email, role, free_quota, download_quota, member_type, nickname`,
    [phoneNumber, email, role, freeQuota, downloadQuota, memberType, passwordHash, nickname]
  );
  return res.rows[0];
}
```

- [ ] **步骤 3：运行全量已有测试确认迁移兼容性**

运行：`npm run test`
预期：所有测试通过。

- [ ] **步骤 4：Commit**

```bash
git add supabase/migrations/20260924000000_membership_tiers_and_downloads.sql tests/helpers/db-test-helper.ts
git commit -m "feat(db): add download_quota and pro cycle fields to users table"
```

---

### 任务 2：注册逻辑与 SSR 会话解析升级（含 Pro 周期刷新）

**文件：**
- 修改：`lib/ssr-auth.ts`
- 修改：`pages/api/auth/signup.ts`
- 创建：`tests/membership-tiers.test.ts`

- [ ] **步骤 1：编写会员体系与周期刷新测试**

创建 `tests/membership-tiers.test.ts`：
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { createTestClient, cleanDatabase, createTestUser, mockReqRes } from './helpers/db-test-helper';
import signupHandler from '../pages/api/auth/signup';

describe('Membership Tiers & Signup Quotas Test', () => {
  let dbClient: Client;

  beforeAll(async () => {
    dbClient = createTestClient();
    await dbClient.connect();
    await cleanDatabase(dbClient);

    await dbClient.query(
      `INSERT INTO email_verifications (email, code, expired_at) 
       VALUES ('tier_user@gtb.com', '123456', NOW() + INTERVAL '1 hour')`
    );
  });

  afterAll(async () => {
    await dbClient.end();
  });

  it('should grant 10 unlock quota and 5 download quota upon signup in promotion period', async () => {
    const { req, res, getStatus, getJson } = mockReqRes({
      method: 'POST',
      body: {
        nickname: '推广用户',
        email: 'tier_user@gtb.com',
        password: 'Password123',
        code: '123456',
      }
    });

    await signupHandler(req, res);
    expect(getStatus()).toBe(200);
    const json = getJson();
    expect(json.success).toBe(true);
    expect(json.user.freeQuota).toBe(10);
    expect(json.user.downloadQuota).toBe(5);
    expect(json.user.memberType).toBe('free');
  });
});
```

- [ ] **步骤 2：更新 `pages/api/auth/signup.ts` 写入 `download_quota = 5`**

在 `pages/api/auth/signup.ts` 中：
```typescript
const selectedRole = 'user';
const quota = 10;
const downloadQuota = 5; // 推广期新手下载礼包
const defaultMemberType = 'free';
const defaultStatus = 'active';

const signupRes = await dbClient.query(
  `INSERT INTO users (email, password, role, free_quota, download_quota, nickname, member_type, status) 
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
   RETURNING id, email, role, free_quota, download_quota, nickname, member_type, status`,
  [email, passwordHash, selectedRole, quota, downloadQuota, nickname, defaultMemberType, defaultStatus]
);
```
并在返回的 `user` 对象中包含 `downloadQuota: user.download_quota`。

- [ ] **步骤 3：更新 `lib/ssr-auth.ts` 支持下载额度与 Pro 月度自然刷新**

```typescript
export interface SsrAuthResult {
  userId: string | null;
  userRole: string;
  freeQuota: number;
  downloadQuota: number;
  memberType: string;
  nickname: string;
  email: string;
  session: Session | null;
}
```
在 `resolveSsrAuth` 查询中查出 `download_quota, member_type, pro_subscribed_at, pro_cycle_expires_at`：
- 若 `user.member_type === 'pro'` 且 `user.pro_cycle_expires_at` 小于当前时间，执行原子 SQL：
  `UPDATE users SET free_quota = 50, download_quota = 10, pro_cycle_expires_at = pro_cycle_expires_at + INTERVAL '1 month' WHERE id = $1`
- 并在返回中映射 `downloadQuota: user.download_quota || 0, memberType: user.member_type || 'free'`。

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run tests/membership-tiers.test.ts`
预期：PASS。

- [ ] **步骤 5：Commit**

```bash
git add lib/ssr-auth.ts pages/api/auth/signup.ts tests/membership-tiers.test.ts
git commit -m "feat(auth): initialize 5 download credits on signup and track pro renewal cycles"
```

---

### 任务 3：HTML 报告离线下载 API 与离线独立包生成

**文件：**
- 创建：`pages/api/user/report-download.ts`
- 创建：`tests/report-download.test.ts`

- [ ] **步骤 1：编写报告离线下载接口测试**

创建 `tests/report-download.test.ts`：
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { createTestClient, cleanDatabase, createTestUser, createTestReport, mockReqRes } from './helpers/db-test-helper';
import { encodeSession } from '../lib/auth';
import downloadHandler from '../pages/api/user/report-download';

describe('Report HTML Download API Test', () => {
  let dbClient: Client;
  let testUser: any;
  let sessionCookie: string;
  let unlockedReport: any;
  let lockedReport: any;

  beforeAll(async () => {
    dbClient = createTestClient();
    await dbClient.connect();
    await cleanDatabase(dbClient);

    testUser = await createTestUser(dbClient, { downloadQuota: 2 });
    sessionCookie = `gtb_session=${encodeSession({ userId: testUser.id, role: testUser.role })}`;

    unlockedReport = await createTestReport(dbClient, {
      title: '已解锁的离线测试报告',
      contentHtml: '<div><h1>测试研报</h1><p>核心正文内容</p></div>'
    });

    lockedReport = await createTestReport(dbClient, {
      title: '未解锁的测试报告',
      contentHtml: '<div>机密全文</div>'
    });

    // 为用户解锁第 1 篇
    await dbClient.query('INSERT INTO unlocks (user_id, report_id) VALUES ($1, $2)', [testUser.id, unlockedReport.id]);
  });

  afterAll(async () => {
    await dbClient.end();
  });

  it('should reject download if report is not unlocked', async () => {
    const { req, res, getStatus, getJson } = mockReqRes({
      method: 'GET',
      query: { reportId: lockedReport.id },
      headers: { cookie: sessionCookie }
    });

    await downloadHandler(req, res);
    expect(getStatus()).toBe(403);
    expect(getJson().error).toMatch(/请先在线解锁该报告/);
  });

  it('should successfully download unlocked report and deduct 1 download quota', async () => {
    const { req, res, getStatus } = mockReqRes({
      method: 'GET',
      query: { reportId: unlockedReport.id },
      headers: { cookie: sessionCookie }
    });

    await downloadHandler(req, res);
    expect(getStatus()).toBe(200);

    // 校验剩余额度为 1
    const checkUser = await dbClient.query('SELECT download_quota FROM users WHERE id = $1', [testUser.id]);
    expect(checkUser.rows[0].download_quota).toBe(1);
  });
});
```

- [ ] **步骤 2：实现 `pages/api/user/report-download.ts`**

实现完整下载流程：
1. 校验会话（`getSession(req)`），未登录返回 401。
2. 校验报告是否已解锁：`SELECT 1 FROM unlocks WHERE user_id = $1 AND report_id = $2`。未解锁返回 403。
3. 校验用户 `download_quota > 0`（Admin 免额度）：不足返回 400（"下载额度不足"）。
4. 扣减 `download_quota - 1`。
5. 组装独立的完整 HTML 页面：包含独立外贸专业排版 CSS、报告元数据（标题、地区、发布时间）、防篡改声明及完整的 `content_html`。
6. 设置响应头：
   ```typescript
   res.setHeader('Content-Type', 'text/html; charset=utf-8');
   res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(report.title)}.html"`);
   ```
7. 返回 HTML 文本。

- [ ] **步骤 3：运行测试验证通过**

运行：`npx vitest run tests/report-download.test.ts`
预期：PASS。

- [ ] **步骤 4：Commit**

```bash
git add pages/api/user/report-download.ts tests/report-download.test.ts
git commit -m "feat(api): implement offline html report download with quota deduction"
```

---

### 任务 4：Pro 专属分级邀请奖励机制

**文件：**
- 修改：`pages/api/user/invite.ts`
- 创建：`tests/invite-tiers.test.ts`

- [ ] **步骤 1：编写分级邀请奖励单元测试**

创建 `tests/invite-tiers.test.ts`：
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { createTestClient, cleanDatabase, createTestUser } from './helpers/db-test-helper';
import { processInvitation } from '../pages/api/user/invite';

describe('Tiered Referral Rewards Test', () => {
  let dbClient: Client;

  beforeAll(async () => {
    dbClient = createTestClient();
    await dbClient.connect();
    await cleanDatabase(dbClient);
  });

  afterAll(async () => {
    await dbClient.end();
  });

  it('should give Free inviter +3 unlock quota, and invitee +3 unlock quota', async () => {
    const freeInviter = await createTestUser(dbClient, { memberType: 'free', freeQuota: 10, downloadQuota: 5 });
    const invitee = await createTestUser(dbClient, { memberType: 'free', freeQuota: 10, downloadQuota: 5 });

    await processInvitation(freeInviter.id, invitee.id, dbClient);

    const checkInviter = await dbClient.query('SELECT free_quota, download_quota FROM users WHERE id = $1', [freeInviter.id]);
    expect(checkInviter.rows[0].free_quota).toBe(13);
    expect(checkInviter.rows[0].download_quota).toBe(5);
  });

  it('should give Pro inviter +10 unlock quota and +2 download quota', async () => {
    const proInviter = await createTestUser(dbClient, { memberType: 'pro', freeQuota: 50, downloadQuota: 10 });
    const invitee2 = await createTestUser(dbClient, { memberType: 'free', freeQuota: 10, downloadQuota: 5 });

    await processInvitation(proInviter.id, invitee2.id, dbClient);

    const checkPro = await dbClient.query('SELECT free_quota, download_quota FROM users WHERE id = $1', [proInviter.id]);
    expect(checkPro.rows[0].free_quota).toBe(60);
    expect(checkPro.rows[0].download_quota).toBe(12);
  });
});
```

- [ ] **步骤 2：更新 `pages/api/user/invite.ts` 中的返佣计算**

在 `processInvitation` 中读取 `referrer.member_type`：
```typescript
const isPro = refRes.rows[0].member_type === 'pro';
const inviterBonusUnlock = isPro ? 10 : 3;
const inviterBonusDownload = isPro ? 2 : 0;
const inviteeBonusUnlock = 3;

await dbClient.query(
  'UPDATE users SET free_quota = free_quota + $1, download_quota = download_quota + $2 WHERE id = $3',
  [inviterBonusUnlock, inviterBonusDownload, referrerId]
);

await dbClient.query(
  'UPDATE users SET free_quota = free_quota + $1 WHERE id = $2',
  [inviteeBonusUnlock, inviteeId]
);
```

- [ ] **步骤 3：运行测试验证通过**

运行：`npx vitest run tests/invite-tiers.test.ts`
预期：PASS。

- [ ] **步骤 4：Commit**

```bash
git add pages/api/user/invite.ts tests/invite-tiers.test.ts
git commit -m "feat(referral): support tiered inviter rewards for Free and Pro users"
```

---

### 任务 5：首页推广与会员权益展示模块

**文件：**
- 创建：`components/PromotionalBanner.tsx`
- 创建：`components/MembershipTiersSection.tsx`
- 修改：`pages/index.tsx`
- 修改：`components/AuthModal.tsx`

- [ ] **步骤 1：创建推广期顶部福利横幅 `components/PromotionalBanner.tsx`**

实现亮眼且精致的通栏横幅：
- 文案：“🎉 **新站推广特权**：注册即领 **10 次深度研报解锁 + 5 份离线 HTML 报告下载**！每邀请 1 位好友双方各再送 **+3 次** ｜ [立即领福利 →]”
- 支持点击一键呼出注册弹窗或滚动至权益对比区。

- [ ] **步骤 2：创建会员权益对比矩阵 `components/MembershipTiersSection.tsx`**

设计高转化率的三列对比卡片（Free vs Pro vs Enterprise）：
- **Free 免费版**：¥0 / 永久。突出“10次在线解锁”、“🎁 推广期专属5份HTML离线下载”、“无限制笔记与图谱”。
- **Pro 专业版**（带高亮推荐标签）：突出“50次/月解锁”、“10份/月离线下载”、“邀请立赠10次+2份下载”、“全局拓扑网络穿透”。
- **Enterprise 企业版**：定制咨询 CTA。

- [ ] **步骤 3：嵌入到 `pages/index.tsx` 并更新导航栏指标**

1. 在首页 Hero 区域上方或紧随其后嵌入 `<PromotionalBanner onClaim={() => setShowAuthModal(true)} />`。
2. 在首页报告流下方嵌入 `<MembershipTiersSection onSelectTier={(tier) => ...} />`。
3. 导航栏用户状态栏更新：
   - 访客状态：显示高亮提示气泡“🎁 注册领10报告+5下载”。
   - 登录状态：显示 `⚡ 剩余解锁: X 次 ｜ 📥 剩余下载: Y 次`，如为 Pro 用户显示 `👑 Pro 会员` 徽标。

- [ ] **步骤 4：更新 `components/AuthModal.tsx` 注册说明文案**

在注册模式（`authMode === 'signup'`）表单顶部加入显著提示框：
“🎁 推广期新人特权：完成注册立即发放 **10 份在线研报解锁 + 5 份 HTML 完整报告离线下载** 额度。”

- [ ] **步骤 5：本地编译验证**

运行：`npm run build`
预期：Compiled successfully 且无任何类型错误。

- [ ] **步骤 6：Commit**

```bash
git add components/PromotionalBanner.tsx components/MembershipTiersSection.tsx pages/index.tsx components/AuthModal.tsx
git commit -m "feat(ui): add homepage promotional banner, membership tiers matrix, and auth gift perks"
```

---

### 任务 6：报告详情页下载入口与额度联动

**文件：**
- 修改：`pages/reports/[id].tsx`

- [ ] **步骤 1：在报告操作区增加下载按钮**

在已解锁状态（`isUnlocked === true`）的报告操作条（收藏、笔记旁）增加：
```tsx
<button
  onClick={handleDownloadReport}
  disabled={isDownloading}
  className="sand-btn"
  title={`剩余下载额度: ${downloadQuota} 份`}
  style={{
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    borderRadius: '8px',
    border: '1px solid var(--color-accent)',
    color: 'var(--color-accent)',
    background: 'transparent',
    cursor: 'pointer'
  }}
>
  <span>📥</span>
  <span>{isDownloading ? '正在打包...' : `下载离线报告 (${downloadQuota})`}</span>
</button>
```

- [ ] **步骤 2：实现 `handleDownloadReport` 前端触发逻辑**

1. 检查 `downloadQuota > 0`（若为 0 提示：“您的 HTML 离线下载额度已用尽，邀请好友注册或升级 Pro 可获赠更多额度！”）。
2. 调用 `/api/user/report-download?reportId=${report.id}`。
3. 接收 blob 数据流，创建虚拟链接触发浏览器原生下载保存为 `.html` 文件。
4. 提示：“🎉 离线报告下载成功！消耗 1 次下载额度。”并实时更新前台剩余下载次数。

- [ ] **步骤 3：构建并运行测试**

运行：`npm run build && npm run test`
预期：构建通过，全部测试通过。

- [ ] **步骤 4：Commit**

```bash
git add pages/reports/[id].tsx
git commit -m "feat(ui): add offline html report download button to report detail page"
```

---

### 任务 7：综合集成验证与端到端回归

**文件：**
- 创建：`tests/membership-e2e.test.ts`

- [ ] **步骤 1：编写全链路端到端集成测试**

覆盖完整用户旅程：
1. 注册新用户 -> 获得 10 解锁 + 5 下载。
2. 解锁一篇报告 -> 扣除 1 解锁额度（剩余 9 解锁，5 下载）。
3. 下载已解锁报告 -> 扣除 1 下载额度（剩余 9 解锁，4 下载）。
4. 尝试下载未解锁报告 -> 拦截失败。
5. Pro 用户邀请好友 -> Pro 邀请人获得 +10 解锁 + 2 下载。

- [ ] **步骤 2：运行全量 Vitest 测试套件**

运行：`npm run test`
预期：所有测试全部通过（通过率 100%）。

- [ ] **步骤 3：运行项目构建与类型检查**

运行：`npm run build`
预期：exit 0，Next.js 打包无异常。

- [ ] **步骤 4：最终提交**

```bash
git add tests/membership-e2e.test.ts
git commit -m "test: add comprehensive e2e test suite for membership quotas and downloads"
```

---

## 执行交接

计划已完成并保存到 `docs/superpowers/plans/2026-09-24-membership-tiers-and-promotional-features.md`。两种执行方式：

1. **子代理驱动（推荐）** - 每个任务调度一个新的子代理，任务间进行审查，快速迭代
2. **内联执行** - 在当前会话中使用 executing-plans 执行任务，批量执行并设有检查点

请问您希望选择哪种方式开始执行？
