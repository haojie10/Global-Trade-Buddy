import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../lib/api-handler';
import { getSession } from '../../../lib/auth';

const AGENT_API_KEY = process.env.AGENT_API_KEY || 'automation_agent_secret';

async function agentReportsHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  // 1. 安全校验：允许合法 Agent API Key 或已登录管理员/用户
  const apiKeyHeader = req.headers['x-agent-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  const apiKeyQuery = req.query.apiKey as string;
  const isKeyValid = (apiKeyHeader === AGENT_API_KEY) || (apiKeyQuery === AGENT_API_KEY);

  if (!isKeyValid) {
    const session = getSession(req);
    if (!session) {
      return res.status(401).json({ error: '未经授权的访问，请提供有效的 Agent API Key 或登录凭证' });
    }
  }

  const {
    company,
    product,
    region,
    search,
    category,
    all,
    page = '1',
    pageSize = '50'
  } = req.query;

  const baseUrl = process.env.SITE_URL || 'https://marketgraphic.cn';

  // 场景 1: 企业研报专属查重 (通过主体公司名或别名)
  if (company && typeof company === 'string') {
    const companyQuery = company.trim();
    
    // 匹配主体公司实体与报告
    const companyRes = await dbClient.query(`
      SELECT r.id, r.title, r.category, r.market_region, r.created_at, e.canonical_name AS primary_company
      FROM reports r
      JOIN report_entities re ON r.id = re.report_id AND re.role = 'primary'
      JOIN entities e ON re.entity_id = e.id
      LEFT JOIN entity_aliases ea ON e.id = ea.entity_id
      WHERE (
        e.canonical_name ILIKE $1 
        OR ea.alias_name ILIKE $1 
        OR r.title ILIKE $1
      )
      ORDER BY r.created_at DESC
      LIMIT 5
    `, [`%${companyQuery}%`]);

    if (companyRes.rows.length > 0) {
      return res.status(200).json({
        exists: true,
        count: companyRes.rows.length,
        matched: companyRes.rows.map(r => ({
          id: r.id,
          title: r.title,
          category: r.category,
          market_region: r.market_region,
          primary_company: r.primary_company,
          created_at: new Date(r.created_at).toLocaleDateString('zh-CN'),
          url: `${baseUrl}/reports/${r.id}`
        }))
      });
    }

    return res.status(200).json({
      exists: false,
      count: 0,
      matched: []
    });
  }

  // 场景 2: 品类/产品研报查重 (通过产品词 + 区域/国家)
  if (product && typeof product === 'string') {
    const prodQuery = product.trim();
    const regQuery = typeof region === 'string' ? region.trim() : '';

    const whereClauses = ['(r.title ILIKE $1 OR r.category = \'product\')'];
    const queryParams: any[] = [`%${prodQuery}%`];

    if (regQuery) {
      whereClauses.push(`(r.market_region ILIKE $2 OR r.title ILIKE $2)`);
      queryParams.push(`%${regQuery}%`);
    }

    const prodRes = await dbClient.query(`
      SELECT r.id, r.title, r.category, r.market_region, r.created_at
      FROM reports r
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY r.created_at DESC
      LIMIT 5
    `, queryParams);

    if (prodRes.rows.length > 0) {
      return res.status(200).json({
        exists: true,
        count: prodRes.rows.length,
        matched: prodRes.rows.map(r => ({
          id: r.id,
          title: r.title,
          category: r.category,
          market_region: r.market_region,
          created_at: new Date(r.created_at).toLocaleDateString('zh-CN'),
          url: `${baseUrl}/reports/${r.id}`
        }))
      });
    }

    return res.status(200).json({
      exists: false,
      count: 0,
      matched: []
    });
  }

  // 场景 3: 通用关键词模糊搜索
  if (search && typeof search === 'string') {
    const sQuery = search.trim();
    const searchRes = await dbClient.query(`
      SELECT r.id, r.title, r.category, r.market_region, r.created_at
      FROM reports r
      WHERE r.title ILIKE $1 OR r.market_region ILIKE $1
      ORDER BY r.created_at DESC
      LIMIT 10
    `, [`%${sQuery}%`]);

    return res.status(200).json({
      exists: searchRes.rows.length > 0,
      count: searchRes.rows.length,
      matched: searchRes.rows.map(r => ({
        id: r.id,
        title: r.title,
        category: r.category,
        market_region: r.market_region,
        created_at: new Date(r.created_at).toLocaleDateString('zh-CN'),
        url: `${baseUrl}/reports/${r.id}`
      }))
    });
  }

  // 场景 4: 获取平台全部/分页报告摘要清单 (极低 Token 消耗)
  const isAll = all === 'true' || all === '1';
  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const sizeNum = isAll ? 500 : Math.min(200, Math.max(1, parseInt(pageSize as string, 10) || 50));
  const offset = (pageNum - 1) * sizeNum;

  const whereCategory = category && category !== 'All' ? 'WHERE r.category = $3' : '';
  const queryParams: any[] = isAll ? [] : [sizeNum, offset];
  if (whereCategory) queryParams.push(category);

  const countRes = await dbClient.query(`SELECT COUNT(*)::int AS total FROM reports r ${whereCategory ? 'WHERE category = $1' : ''}`, whereCategory ? [category] : []);
  const total = countRes.rows[0]?.total || 0;

  const listQuery = isAll
    ? `SELECT r.id, r.title, r.category, r.market_region, r.created_at
       FROM reports r
       ${whereCategory ? 'WHERE r.category = $1' : ''}
       ORDER BY r.created_at DESC`
    : `SELECT r.id, r.title, r.category, r.market_region, r.created_at
       FROM reports r
       ${whereCategory}
       ORDER BY r.created_at DESC
       LIMIT $1 OFFSET $2`;

  const listRes = await dbClient.query(listQuery, isAll ? (whereCategory ? [category] : []) : queryParams);

  return res.status(200).json({
    total,
    page: pageNum,
    pageSize: sizeNum,
    reports: listRes.rows.map(r => ({
      id: r.id,
      title: r.title,
      category: r.category,
      market_region: r.market_region,
      created_at: new Date(r.created_at).toLocaleDateString('zh-CN'),
      url: `${baseUrl}/reports/${r.id}`
    }))
  });
}

export default withDb(agentReportsHandler, {
  methods: ['GET']
});
