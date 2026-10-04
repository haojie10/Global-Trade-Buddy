import type { NextApiRequest, NextApiResponse } from 'next';
import { getContactsForReport, extractRootDomain, cleanCompanyNameForLookup } from '../../../../lib/crm-service';
import path from 'path';
import fs from 'fs';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { id, search, domain: queryDomain, company: queryCompany, website: queryWebsite } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: '缺少有效的报告 ID' });
  }

  try {
    let result: { companyName: string; websiteDomain: string; contacts: any[] };

    // 支持沙盒测试页面的检索
    if (id === 'test-demo') {
      const rawDomain = ((queryDomain || queryWebsite || '') as string).trim();
      const rawCompany = ((queryCompany || search || '') as string).trim();

      // 提取纯净根域名
      const domain = extractRootDomain(rawDomain) || (rawDomain.includes('.') ? rawDomain.toLowerCase() : '');
      const cleanComp = cleanCompanyNameForLookup(rawCompany);

      const candidatePaths = [
        process.env.CONTACTS_DB_PATH,
        path.resolve(process.cwd(), '../客户邮箱/contacts.db'),
        path.resolve(process.cwd(), 'data/contacts.db'),
        path.resolve(process.cwd(), 'contacts.db'),
        path.resolve('/Users/jason/Documents/Antigravity/Project/客户邮箱/contacts.db'),
      ].filter(Boolean) as string[];

      let dbPath: string | null = null;
      for (const p of candidatePaths) {
        if (fs.existsSync(p)) {
          dbPath = p;
          break;
        }
      }

      let contacts: any[] = [];

      if (dbPath) {
        const { DatabaseSync } = require('node:sqlite');
        const db = new DatabaseSync(dbPath);

        // 严谨匹配原则 (严格拒绝任意子串通配符，杜绝把 flowers 匹配给 lowe 或把 decometa 匹配给 comet)
        // 1. 第一优先级: 企业官网根域名强等匹配 (Exact Domain Match)
        if (domain) {
          const stmt = db.prepare(`
            SELECT id, email, company_name, clean_company_name, website, website_domain,
                   contact_name, job_title, phone, fax, address, zip_code, country,
                   industry, products, verify_status, last_verified_at,
                   gender, birthday, department, social_linkedin, social_whatsapp, notes,
                   source_session
            FROM crm_contacts 
            WHERE website_domain = ? OR email_domain = ?
            ORDER BY last_verified_at DESC NULLS LAST, id ASC
            LIMIT 50
          `);
          contacts = stmt.all(domain, domain);
        }

        // 2. 第二优先级: 若域名无命中，且有清洗后的公司名，进行公司全名精准强等匹配
        if (contacts.length === 0 && cleanComp && cleanComp.length >= 3) {
          const stmt = db.prepare(`
            SELECT id, email, company_name, clean_company_name, website, website_domain,
                   contact_name, job_title, phone, fax, address, zip_code, country,
                   industry, products, verify_status, last_verified_at,
                   gender, birthday, department, social_linkedin, social_whatsapp, notes,
                   source_session
            FROM crm_contacts 
            WHERE clean_company_name = ?
            ORDER BY last_verified_at DESC NULLS LAST, id ASC
            LIMIT 50
          `);
          contacts = stmt.all(cleanComp);
        }

        db.close();
      }

      result = {
        companyName: rawCompany || rawDomain,
        websiteDomain: domain,
        contacts,
      };
    } else {
      result = await getContactsForReport(id);
    }

    // 格式化输出: 严格遵循业务规范，在用户前端过滤掉广交会参展届数等内部溯源字段
    const sanitizedContacts = result.contacts.map((c: any) => ({
      id: c.id,
      email: c.email,
      company_name: c.company_name,
      contact_name: c.contact_name || '',
      job_title: c.job_title || '',
      phone: c.phone || '',
      fax: c.fax || '',
      address: c.address || '',
      country: c.country || '',
      industry: c.industry || '',
      products: c.products || '',
      website_domain: c.website_domain || '',
      verify_status: c.verify_status || 'unverified',
      last_verified_at: c.last_verified_at || null,
      gender: c.gender || 'unknown',
      birthday: c.birthday || '',
      department: c.department || '',
      social_linkedin: c.social_linkedin || '',
      social_whatsapp: c.social_whatsapp || '',
      notes: c.notes || '',
    }));

    return res.status(200).json({
      success: true,
      companyName: result.companyName,
      websiteDomain: result.websiteDomain,
      count: sanitizedContacts.length,
      contacts: sanitizedContacts,
    });
  } catch (err: any) {
    console.error('[API /api/reports/[id]/contacts] 出错:', err);
    return res.status(500).json({
      error: '获取报告关联联系人失败',
      detail: process.env.NODE_ENV === 'production' ? undefined : err.message,
    });
  }
}
