import fs from 'fs';
import path from 'path';
import pool from './db';

export interface CrmContactItem {
  id: number | string;
  email: string;
  company_name: string;
  clean_company_name?: string;
  website?: string;
  website_domain?: string;
  contact_name?: string;
  job_title?: string;
  phone?: string;
  fax?: string;
  address?: string;
  zip_code?: string;
  country?: string;
  industry?: string;
  products?: string;
  verify_status: string;
  last_verified_at?: string | null;
  // CRM 画像预设字段 (支持后期补充丰富)
  gender?: string;
  birthday?: string;
  department?: string;
  social_linkedin?: string;
  social_whatsapp?: string;
  notes?: string;
  // source_session 保留在后端，供内部业务使用，前端不予展示
  source_session?: string;
}

// 提取网址根域名
export function extractRootDomain(rawUrl: string): string {
  if (!rawUrl) return '';
  let url = rawUrl.trim().toLowerCase();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'http://' + url;
  }
  try {
    const parsed = new URL(url);
    let host = parsed.hostname;
    if (host.startsWith('www.')) {
      host = host.substring(4);
    }
    return host;
  } catch {
    return '';
  }
}

// 清洗公司名称 (去除常见法律后缀与多余空格)
export function cleanCompanyNameForLookup(rawName: string): string {
  if (!rawName) return '';
  return rawName
    .toLowerCase()
    .replace(/\b(ltd|limited|inc|incorporated|corp|corporation|llc|gmbh|sa|srl|bv|co\.?,\s*ltd\.?|co\.?)\b/gi, '')
    .replace(/[^\w\s\u4e00-\u9fa5]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// 寻找本地 contacts.db 路径
function getSqliteDbPath(): string | null {
  const candidatePaths = [
    process.env.CONTACTS_DB_PATH,
    path.resolve(process.cwd(), '../客户邮箱/contacts.db'),
    path.resolve(process.cwd(), 'data/contacts.db'),
    path.resolve(process.cwd(), 'contacts.db'),
    path.resolve('/home/ubuntu/data/contacts.db'),
  ].filter(Boolean) as string[];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

// SQLite 查询适配器
function querySqlite(dbPath: string, sql: string, params: any[] = []): any[] {
  try {
    // 优先使用 Node.js 内置原生 node:sqlite (Node 22+)
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(dbPath, { readOnly: false });
    const stmt = db.prepare(sql);
    const rows = stmt.all(...params);
    db.close();
    return rows;
  } catch (err) {
    // 若内置模块受阻，通过轻量 Python 适配查询
    const { execFileSync } = require('child_process');
    const pyScript = `
import sqlite3, json, sys
conn = sqlite3.connect(sys.argv[1])
cur = conn.cursor()
sql = sys.argv[2]
params = json.loads(sys.argv[3])
cur.execute(sql, params)
cols = [col[0] for col in cur.description] if cur.description else []
rows = [dict(zip(cols, r)) for r in cur.fetchall()]
conn.close()
print(json.dumps(rows))
`;
    const out = execFileSync('python3', ['-c', pyScript, dbPath, sql, JSON.stringify(params)], {
      encoding: 'utf-8',
      timeout: 5000,
    });
    return JSON.parse(out);
  }
}

// SQLite 更新适配器
function executeSqlite(dbPath: string, sql: string, params: any[] = []): boolean {
  try {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(dbPath, { readOnly: false });
    const stmt = db.prepare(sql);
    stmt.run(...params);
    db.close();
    return true;
  } catch {
    const { execFileSync } = require('child_process');
    const pyScript = `
import sqlite3, json, sys
conn = sqlite3.connect(sys.argv[1])
cur = conn.cursor()
sql = sys.argv[2]
params = json.loads(sys.argv[3])
cur.execute(sql, params)
conn.commit()
conn.close()
`;
    execFileSync('python3', ['-c', pyScript, dbPath, sql, JSON.stringify(params)], {
      encoding: 'utf-8',
      timeout: 5000,
    });
    return true;
  }
}

/**
 * 根据报告 ID 检索关联联系人
 */
export async function getContactsForReport(reportId: string, dbClient?: any): Promise<{
  companyName: string;
  websiteDomain: string;
  contacts: CrmContactItem[];
}> {
  const client = dbClient || (await pool.connect());
  let releaseNeeded = !dbClient;

  let reportHtml = '';
  let reportTitle = '';
  let primaryEntityName = '';

  try {
    const res = await client.query(
      `SELECT r.title, r.content_html, e.canonical_name 
       FROM reports r
       LEFT JOIN entities e ON r.primary_entity_id = e.id
       WHERE r.id = $1`,
      [reportId]
    );

    if (res.rows.length > 0) {
      reportHtml = res.rows[0].content_html || '';
      reportTitle = res.rows[0].title || '';
      primaryEntityName = res.rows[0].canonical_name || '';
    }
  } finally {
    if (releaseNeeded && client.release) {
      client.release();
    }
  }

  // 1. 从报告 HTML head 中提取元数据
  let websiteUrl = '';
  let metaCompanyName = '';

  if (reportHtml) {
    const siteMatch = reportHtml.match(/<meta[^>]*?name=["']company_website["'][^>]*?content=["']([^"']*?)["']/i);
    if (siteMatch) websiteUrl = siteMatch[1].trim();

    const compMatch = reportHtml.match(/<meta[^>]*?name=["']company_name["'][^>]*?content=["']([^"']*?)["']/i);
    if (compMatch) metaCompanyName = compMatch[1].trim();
  }

  const websiteDomain = extractRootDomain(websiteUrl);
  const companyName = metaCompanyName || primaryEntityName || reportTitle.split(/ - | 360°/)[0].trim();
  const cleanComp = cleanCompanyNameForLookup(companyName);

  let contacts: CrmContactItem[] = [];

  // 2. 优先尝试本地 SQLite 查询
  const sqlitePath = getSqliteDbPath();
  if (sqlitePath) {
    try {
      if (websiteDomain) {
        // 第一优先级: 根域名精准碰撞
        contacts = querySqlite(
          sqlitePath,
          `SELECT id, email, company_name, clean_company_name, website, website_domain,
                  contact_name, job_title, phone, fax, address, zip_code, country,
                  industry, products, verify_status, last_verified_at,
                  gender, birthday, department, social_linkedin, social_whatsapp, notes,
                  source_session
           FROM crm_contacts 
           WHERE website_domain = ? 
           ORDER BY last_verified_at DESC NULLS LAST, id ASC`,
          [websiteDomain]
        );
      }

      // 第二优先级: 若未按域名匹配到，按清洗后的公司名进行匹配
      if (contacts.length === 0 && cleanComp && cleanComp.length >= 3) {
        contacts = querySqlite(
          sqlitePath,
          `SELECT id, email, company_name, clean_company_name, website, website_domain,
                  contact_name, job_title, phone, fax, address, zip_code, country,
                  industry, products, verify_status, last_verified_at,
                  gender, birthday, department, social_linkedin, social_whatsapp, notes,
                  source_session
           FROM crm_contacts 
           WHERE clean_company_name = ? 
           ORDER BY last_verified_at DESC NULLS LAST, id ASC`,
          [cleanComp]
        );
      }
    } catch (e) {
      console.error('[CRM Service] SQLite 查询出错:', e);
    }
  }

  // 3. 若本地库无结果或生产环境已同步至 PostgreSQL，尝试从 PG 的 crm_contacts 表中查询
  if (contacts.length === 0) {
    try {
      const pgClient = await pool.connect();
      try {
        if (websiteDomain) {
          const pgRes = await pgClient.query(
            `SELECT id, email, company_name, clean_company_name, website, website_domain,
                    contact_name, job_title, phone, fax, address, zip_code, country,
                    industry, products, verify_status, last_verified_at,
                    gender, birthday, department, social_linkedin, social_whatsapp, notes,
                    source_session
             FROM crm_contacts 
             WHERE website_domain = $1 
             ORDER BY last_verified_at DESC NULLS LAST, id ASC`,
            [websiteDomain]
          );
          contacts = pgRes.rows;
        }

        if (contacts.length === 0 && cleanComp && cleanComp.length >= 3) {
          const pgRes = await pgClient.query(
            `SELECT id, email, company_name, clean_company_name, website, website_domain,
                    contact_name, job_title, phone, fax, address, zip_code, country,
                    industry, products, verify_status, last_verified_at,
                    gender, birthday, department, social_linkedin, social_whatsapp, notes,
                    source_session
             FROM crm_contacts 
             WHERE clean_company_name = $1 
             ORDER BY last_verified_at DESC NULLS LAST, id ASC`,
            [cleanComp]
          );
          contacts = pgRes.rows;
        }
      } finally {
        pgClient.release();
      }
    } catch {
      // 容错处理：若 PG 尚未建表或未同步，静默降级
    }
  }

  return {
    companyName,
    websiteDomain,
    contacts,
  };
}

/**
 * 更新联系人验证状态
 */
export async function updateContactVerifyStatus(
  email: string,
  status: 'valid' | 'invalid' | 'catch_all' | 'unverified',
  provider: string = 'dns_mx_handshake'
): Promise<boolean> {
  const normEmail = email.trim().toLowerCase();
  let updated = false;

  // 1. 更新 SQLite
  const sqlitePath = getSqliteDbPath();
  if (sqlitePath) {
    try {
      executeSqlite(
        sqlitePath,
        `UPDATE crm_contacts 
         SET verify_status = ?, last_verified_at = CURRENT_TIMESTAMP, verify_provider = ?
         WHERE lower(email) = ?`,
        [status, provider, normEmail]
      );
      updated = true;
    } catch (e) {
      console.error('[CRM Service] SQLite 状态更新失败:', e);
    }
  }

  // 2. 更新 PG (若有)
  try {
    const pgClient = await pool.connect();
    try {
      await pgClient.query(
        `UPDATE crm_contacts 
         SET verify_status = $1, last_verified_at = NOW(), verify_provider = $2
         WHERE lower(email) = $3`,
        [status, provider, normEmail]
      );
      updated = true;
    } finally {
      pgClient.release();
    }
  } catch {
    // 忽略未同步时的错误
  }

  return updated;
}
