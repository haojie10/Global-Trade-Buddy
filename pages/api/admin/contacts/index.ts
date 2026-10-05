import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../../lib/api-handler';
import { requireAdmin } from '../../../../lib/auth';

/**
 * GET /api/admin/contacts
 * 
 * 查询参数:
 * - page: 页码 (默认 1)
 * - pageSize: 每页大小 (默认 20)
 * - search: 通用搜索关键字
 * - searchType: 'all' | 'company' | 'domain' | 'email_suffix' | 'email' | 'contact_name'
 * - refStatus: 'all' | 'referenced' | 'unreferenced' (是否被报告引用)
 * - verifyStatus: 'all' | 'unverified' | 'valid' | 'invalid' | 'catch_all'
 * - country: 国家筛选
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
  const country = (req.query.country as string || '').trim();

  // 1. 构建动态 WHERE 条件
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
      whereClauses.push(`(c.website_domain ILIKE $${paramIndex} OR c.website ILIKE $${paramIndex})`);
      queryParams.push(`%${search}%`);
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
      // 综合搜索 (模糊匹配公司名、域名、邮箱后缀、邮箱、姓名)
      const cleanSuffix = search.startsWith('@') ? search.substring(1) : search;
      whereClauses.push(`(
        c.company_name ILIKE $${paramIndex} 
        OR c.clean_company_name ILIKE $${paramIndex}
        OR c.website_domain ILIKE $${paramIndex}
        OR c.email_domain ILIKE $${paramIndex}
        OR c.email ILIKE $${paramIndex}
        OR c.contact_name ILIKE $${paramIndex}
      )`);
      queryParams.push(`%${cleanSuffix}%`);
      paramIndex++;
    }
  }

  // 验证状态
  if (verifyStatus && verifyStatus !== 'all') {
    whereClauses.push(`c.verify_status = $${paramIndex}`);
    queryParams.push(verifyStatus);
    paramIndex++;
  }

  // 国家筛选
  if (country && country !== 'all') {
    whereClauses.push(`c.country ILIKE $${paramIndex}`);
    queryParams.push(`%${country}%`);
    paramIndex++;
  }

  // 是否被报告引用判定 (利用关联子查询)
  // 如果 reports 的 content_html 含有 website_domain，或者 clean_company_name 匹配 report title
  const hasRefCondition = `(
    (c.website_domain IS NOT NULL AND c.website_domain != '' AND EXISTS (
      SELECT 1 FROM reports r WHERE r.content_html ILIKE '%' || c.website_domain || '%'
    ))
    OR
    (c.clean_company_name IS NOT NULL AND LENGTH(c.clean_company_name) >= 3 AND EXISTS (
      SELECT 1 FROM reports r WHERE r.title ILIKE '%' || c.clean_company_name || '%'
    ))
  )`;

  if (refStatus === 'referenced') {
    whereClauses.push(hasRefCondition);
  } else if (refStatus === 'unreferenced') {
    whereClauses.push(`NOT ${hasRefCondition}`);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  try {
    // 2. 总数统计查询
    const countSql = `SELECT COUNT(*)::int AS total FROM crm_contacts c ${whereSql}`;
    const countRes = await dbClient.query(countSql, queryParams);
    const total = countRes.rows[0]?.total || 0;

    // 3. 统计全局关键指标 (总量、已验证数、总独立企业数)
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

    // 4. 分页列表查询并附带引用报告详情 (LATERAL / 关联聚合)
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
        c.updated_at,
        (
          SELECT json_agg(json_build_object(
            'id', matched_r.id, 
            'title', matched_r.title, 
            'category', matched_r.category,
            'market_region', matched_r.market_region
          ))
          FROM (
            SELECT r.id, r.title, r.category, r.market_region
            FROM reports r
            WHERE (
              c.website_domain IS NOT NULL AND c.website_domain != '' AND r.content_html ILIKE '%' || c.website_domain || '%'
            ) OR (
              c.clean_company_name IS NOT NULL AND LENGTH(c.clean_company_name) >= 3 AND r.title ILIKE '%' || c.clean_company_name || '%'
            )
            LIMIT 5
          ) matched_r
        ) AS matched_reports
      FROM crm_contacts c
      ${whereSql}
      ORDER BY c.id ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(pageSize, offset);
    const listRes = await dbClient.query(listSql, queryParams);

    const items = listRes.rows.map(row => ({
      ...row,
      is_referenced: Array.isArray(row.matched_reports) && row.matched_reports.length > 0,
      matched_reports: row.matched_reports || [],
    }));

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
