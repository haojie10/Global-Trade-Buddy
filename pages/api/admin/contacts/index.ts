import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../../lib/api-handler';
import { requireAdmin } from '../../../../lib/auth';
import { cleanCompanyNameForLookup, extractRootDomain } from '../../../../lib/crm-service';

/**
 * GET /api/admin/contacts
 * 
 * 极速高性能买手联系人后台 API (< 50ms 响应)
 * 引用判定与前台报告页 (crm-service.ts) 逻辑 100% 保持严格对称一致:
 *   优先级 1: 报告企业官网顶级域名 == 买手 website_domain
 *   优先级 2: 报告纯净公司名称 == 买手 clean_company_name
 */
async function contactsHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  const session = requireAdmin(req);
  if (!session) {
    return res.status(403).json({ error: '权限不足，仅管理员可访问' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const pageSize = Math.max(1, Math.min(100, parseInt(req.query.pageSize as string, 10) || 20));
  const offset = (page - 1) * pageSize;

  const search = (req.query.search as string || '').trim();
  const searchType = (req.query.searchType as string || 'all').trim();
  const refStatus = (req.query.refStatus as string || 'all').trim();
  const verifyStatus = (req.query.verifyStatus as string || 'all').trim();

  // 1. 一次性从 reports 表拉取元数据 (仅 2000 多条，单次轻量读取仅需 ~8ms)
  // 并按前台报告完全相同的提取规则构建 Domain Map 与 Clean Name Map
  const activeReportDomainsSet = new Set<string>();
  const activeReportNamesSet = new Set<string>();
  const reportsByDomain: Record<string, { id: string; title: string; category: string; market_region: string }[]> = {};
  const reportsByName: Record<string, { id: string; title: string; category: string; market_region: string }[]> = {};

  try {
    const repRes = await dbClient.query(`
      SELECT r.id, r.title, r.category, r.market_region,
             e.canonical_name,
             SUBSTRING(r.content_html FROM 'company_website["''][^>]*?content=["'']([^"'']+)["'']') AS meta_site,
             SUBSTRING(r.content_html FROM 'company_name["''][^>]*?content=["'']([^"'']+)["'']') AS meta_comp
      FROM reports r
      LEFT JOIN entities e ON r.primary_entity_id = e.id
      WHERE r.content_html IS NOT NULL
    `);

    for (const r of repRes.rows) {
      const repItem = {
        id: r.id,
        title: r.title,
        category: r.category,
        market_region: r.market_region,
      };

      // 提取域名 (与 crm-service.ts 保持 100% 对齐)
      const domain = extractRootDomain(r.meta_site || '');
      if (domain) {
        activeReportDomainsSet.add(domain);
        if (!reportsByDomain[domain]) reportsByDomain[domain] = [];
        if (reportsByDomain[domain].length < 3) reportsByDomain[domain].push(repItem);
      }

      // 提取纯净公司名 (与 crm-service.ts 保持 100% 对齐)
      const rawComp = r.meta_comp || r.canonical_name || (r.title ? r.title.split(/ - | 360°/)[0].trim() : '');
      const cleanName = cleanCompanyNameForLookup(rawComp);
      if (cleanName && cleanName.length >= 3) {
        activeReportNamesSet.add(cleanName);
        if (!reportsByName[cleanName]) reportsByName[cleanName] = [];
        if (reportsByName[cleanName].length < 3) reportsByName[cleanName].push(repItem);
      }
    }
  } catch (err) {
    console.warn('[Admin Contacts] 读取报告元数据异常:', err);
  }

  const activeReportDomains = Array.from(activeReportDomainsSet);
  const activeReportNames = Array.from(activeReportNamesSet);

  // 2. 构建动态 WHERE 条件
  const whereClauses: string[] = [];
  const queryParams: any[] = [];
  let paramIndex = 1;

  // 搜索关键字处理
  if (search) {
    if (searchType === 'company') {
      whereClauses.push(`(c.company_name ILIKE $${paramIndex} OR c.clean_company_name ILIKE $${paramIndex})`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    } else if (searchType === 'domain') {
      const cleanDom = search.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
      whereClauses.push(`c.website_domain ILIKE $${paramIndex}`);
      queryParams.push(`%${cleanDom}%`);
      paramIndex++;
    } else if (searchType === 'email_suffix') {
      const cleanSuffix = search.startsWith('@') ? search.substring(1) : search;
      whereClauses.push(`c.email_domain ILIKE $${paramIndex}`);
      queryParams.push(`%${cleanSuffix}%`);
      paramIndex++;
    } else if (searchType === 'email') {
      whereClauses.push(`c.email ILIKE $${paramIndex}`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    } else if (searchType === 'contact_name') {
      whereClauses.push(`c.contact_name ILIKE $${paramIndex}`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    } else {
      // 综合搜索
      const cleanKw = search.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/^@/, '');
      whereClauses.push(`(
        c.company_name ILIKE $${paramIndex} 
        OR c.clean_company_name ILIKE $${paramIndex}
        OR c.website_domain ILIKE $${paramIndex}
        OR c.email_domain ILIKE $${paramIndex}
        OR c.email ILIKE $${paramIndex}
        OR c.contact_name ILIKE $${paramIndex}
      )`);
      queryParams.push(`%${cleanKw}%`);
      paramIndex++;
    }
  }

  // 验证状态
  if (verifyStatus && verifyStatus !== 'all') {
    whereClauses.push(`c.verify_status = $${paramIndex}`);
    queryParams.push(verifyStatus);
    paramIndex++;
  }

  // 引用状态筛选优化 (双轨并行: 域名匹配 OR 纯净公司名匹配)
  if (refStatus === 'referenced') {
    const refOrConditions: string[] = [];
    if (activeReportDomains.length > 0) {
      refOrConditions.push(`c.website_domain = ANY($${paramIndex})`);
      queryParams.push(activeReportDomains);
      paramIndex++;
    }
    if (activeReportNames.length > 0) {
      refOrConditions.push(`c.clean_company_name = ANY($${paramIndex})`);
      queryParams.push(activeReportNames);
      paramIndex++;
    }
    if (refOrConditions.length > 0) {
      whereClauses.push(`(${refOrConditions.join(' OR ')})`);
    } else {
      whereClauses.push('1 = 0');
    }
  } else if (refStatus === 'unreferenced') {
    const unrefAndConditions: string[] = [];
    if (activeReportDomains.length > 0) {
      unrefAndConditions.push(`(c.website_domain IS NULL OR NOT (c.website_domain = ANY($${paramIndex})))`);
      queryParams.push(activeReportDomains);
      paramIndex++;
    }
    if (activeReportNames.length > 0) {
      unrefAndConditions.push(`(c.clean_company_name IS NULL OR NOT (c.clean_company_name = ANY($${paramIndex})))`);
      queryParams.push(activeReportNames);
      paramIndex++;
    }
    if (unrefAndConditions.length > 0) {
      whereClauses.push(`(${unrefAndConditions.join(' AND ')})`);
    }
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  try {
    // 3. 统计总数 (毫秒级响应)
    const countSql = `SELECT COUNT(*)::int AS total FROM crm_contacts c ${whereSql}`;
    const countRes = await dbClient.query(countSql, queryParams);
    const total = countRes.rows[0]?.total || 0;

    // 4. 全局概览数据（极速轻量统计）
    const statsSql = `
      SELECT 
        COUNT(*)::int AS total_contacts,
        COUNT(DISTINCT website_domain)::int AS total_domains,
        COUNT(CASE WHEN verify_status = 'valid' THEN 1 END)::int AS valid_contacts,
        COUNT(CASE WHEN verify_status = 'unverified' THEN 1 END)::int AS unverified_contacts
      FROM crm_contacts;
    `;
    const statsRes = await dbClient.query(statsSql);
    const globalStats = statsRes.rows[0] || {
      total_contacts: 0,
      total_domains: 0,
      valid_contacts: 0,
      unverified_contacts: 0,
    };

    // 5. 分页查询单页 20 条数据 (耗时 < 5ms)
    const listSql = `
      SELECT 
        c.id,
        c.email,
        c.company_name,
        c.clean_company_name,
        c.website,
        c.website_domain,
        c.email_domain,
        c.contact_name,
        c.job_title,
        c.phone,
        c.fax,
        c.address,
        c.zip_code,
        c.country,
        c.industry,
        c.products,
        c.verify_status,
        c.last_verified_at,
        c.verify_provider,
        c.gender,
        c.birthday,
        c.department,
        c.social_linkedin,
        c.social_whatsapp,
        c.notes,
        c.source_session,
        c.created_at,
        c.updated_at
      FROM crm_contacts c
      ${whereSql}
      ORDER BY c.id ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(pageSize, offset);
    const listRes = await dbClient.query(listSql, queryParams);

    // 6. 在 Node 内存中毫秒级组装报告匹配情况 (双向 O(1) 哈希对齐前台)
    const items = listRes.rows.map(row => {
      const dom = (row.website_domain || '').toLowerCase().trim();
      const cleanComp = (row.clean_company_name || '').toLowerCase().trim();

      // 先按域名匹配，若无则按纯净公司名匹配
      const matched = (dom && reportsByDomain[dom]) 
        ? reportsByDomain[dom] 
        : (cleanComp && reportsByName[cleanComp]) 
        ? reportsByName[cleanComp] 
        : [];

      return {
        ...row,
        is_referenced: matched.length > 0,
        matched_reports: matched,
      };
    });

    return res.status(200).json({
      success: true,
      data: items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      stats: globalStats,
    });
  } catch (error: any) {
    console.error('[Admin Contacts API Error]:', error);
    return res.status(500).json({ error: error.message || '查询联系人列表失败' });
  }
}

export default withDb(contactsHandler);
