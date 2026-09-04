import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../../lib/api-handler';
import { requireAdmin } from '../../../../lib/auth';

async function reportsListHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  const session = requireAdmin(req);
  if (!session) {
    return res.status(403).json({ error: '权限不足，仅管理员可访问' });
  }

  const page = Math.max(1, parseInt((req.query.page as string) || '1', 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt((req.query.pageSize as string) || '20', 10) || 20));
  const offset = (page - 1) * pageSize;
  const search = (req.query.search as string || '').trim();
  const category = (req.query.category as string || 'All');

  // 构建搜索条件
  const whereClauses: string[] = [];
  const queryParams: any[] = [];
  let paramIndex = 1;

  if (search) {
    whereClauses.push(`(
      r.title ILIKE $${paramIndex} 
      OR r.market_region ILIKE $${paramIndex}
      OR EXISTS (SELECT 1 FROM report_industries ri JOIN industries ind ON ri.industry_id = ind.id WHERE ri.report_id = r.id AND ind.name ILIKE $${paramIndex})
      OR EXISTS (SELECT 1 FROM report_countries rc JOIN countries c ON rc.country_id = c.id WHERE rc.report_id = r.id AND c.name ILIKE $${paramIndex})
      OR EXISTS (SELECT 1 FROM report_entities re JOIN entities e ON re.entity_id = e.id WHERE re.report_id = r.id AND e.canonical_name ILIKE $${paramIndex})
      OR EXISTS (SELECT 1 FROM report_entities re JOIN entity_aliases ea ON re.entity_id = ea.entity_id WHERE re.report_id = r.id AND ea.alias_name ILIKE $${paramIndex})
    )`);
    queryParams.push(`%${search}%`);
    paramIndex++;
  }

  if (category && category !== 'All') {
    if (category === 'product' || category === 'category') {
      whereClauses.push(`r.category IN ('product', 'category')`);
    } else {
      whereClauses.push(`r.category = $${paramIndex}`);
      queryParams.push(category);
      paramIndex++;
    }
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // 1. 查询总数
  const countRes = await dbClient.query(`SELECT COUNT(*)::int AS total FROM reports r ${whereSql}`, queryParams);
  const total = countRes.rows[0]?.total || 0;

  // 2. 查询当前页的报告
  const listQueryParams = [...queryParams, pageSize, offset];
  const reportsListRes = await dbClient.query(
    `SELECT r.id, r.title, r.category, r.market_region, r.created_at,
            COALESCE((SELECT STRING_AGG(name, ', ') FROM industries JOIN report_industries ON industries.id = report_industries.industry_id WHERE report_id = r.id), '') as industries,
            COALESCE((SELECT STRING_AGG(name, ', ') FROM countries JOIN report_countries ON countries.id = report_countries.country_id WHERE report_id = r.id), '') as countries,
            COALESCE((SELECT ARRAY_AGG(industry_id) FROM report_industries WHERE report_id = r.id), ARRAY[]::uuid[]) as industry_ids,
            COALESCE((SELECT ARRAY_AGG(country_id) FROM report_countries WHERE report_id = r.id), ARRAY[]::uuid[]) as country_ids
     FROM reports r
     ${whereSql}
     ORDER BY r.created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    listQueryParams
  );
  const reportsList = reportsListRes.rows;

  // 3. 关联实体与图谱连线数
  if (reportsList.length > 0) {
    const reportIds = reportsList.map((r: any) => r.id);

    const [entitiesRes, edgesRes] = await Promise.all([
      dbClient.query(
        `SELECT re.report_id, e.id as entity_id, e.canonical_name, e.entity_type, re.role, re.source,
                (SELECT STRING_AGG(rea.alias_name, '|||') FROM report_entity_aliases rea WHERE rea.report_id = re.report_id AND rea.entity_id = e.id) as aliases
         FROM report_entities re
         JOIN entities e ON re.entity_id = e.id
         WHERE re.report_id = ANY($1)`,
        [reportIds]
      ),
      dbClient.query(
        `SELECT report_id, COUNT(*)::int as edge_count FROM (
           SELECT report_id_a as report_id FROM relations WHERE report_id_a = ANY($1)
           UNION ALL
           SELECT report_id_b as report_id FROM relations WHERE report_id_b = ANY($1)
         ) sub GROUP BY report_id`,
        [reportIds]
      )
    ]);

    const entityMap = new Map<string, {
      primary_company: string;
      company_aliases: string[];
      competitors: string[];
      suppliers: string[];
      customers: string[];
      channels: string[];
      sisters: string[];
      products: string[];
      mentioned: string[];
      entitySources: Record<string, 'manual' | 'auto'>;
    }>();

    for (const row of entitiesRes.rows) {
      if (!entityMap.has(row.report_id)) {
        entityMap.set(row.report_id, {
          primary_company: '',
          company_aliases: [],
          competitors: [],
          suppliers: [],
          customers: [],
          channels: [],
          sisters: [],
          products: [],
          mentioned: [],
          entitySources: {}
        });
      }
      const item = entityMap.get(row.report_id)!;
      const role = row.role;
      const name = row.canonical_name;
      const source = row.source || 'auto';

      item.entitySources[name] = source;

      if (role === 'primary') {
        item.primary_company = name;
        if (row.aliases) {
          const aliasList = row.aliases.split('|||').map((s: string) => s.trim()).filter(Boolean);
          item.company_aliases = Array.from(new Set([...item.company_aliases, ...aliasList]));
        }
      } else if (role === 'competitor') {
        if (!item.competitors.includes(name)) item.competitors.push(name);
      } else if (role === 'supplier') {
        if (!item.suppliers.includes(name)) item.suppliers.push(name);
      } else if (role === 'customer') {
        if (!item.customers.includes(name)) item.customers.push(name);
      } else if (role === 'channel') {
        if (!item.channels.includes(name)) item.channels.push(name);
      } else if (role === 'sister_parent') {
        if (!item.sisters.includes(name)) item.sisters.push(name);
      } else if (role === 'product') {
        if (!item.products.includes(name)) item.products.push(name);
      } else if (role === 'mentioned') {
        if (!item.mentioned.includes(name)) item.mentioned.push(name);
      }
    }

    const edgeMap = new Map<string, number>();
    for (const row of edgesRes.rows) {
      edgeMap.set(row.report_id, row.edge_count);
    }

    for (const r of reportsList) {
      const ents = entityMap.get(r.id) || {
        primary_company: '',
        company_aliases: [],
        competitors: [],
        suppliers: [],
        customers: [],
        channels: [],
        sisters: [],
        products: [],
        mentioned: [],
        entitySources: {}
      };
      r.primary_company = ents.primary_company;
      r.company_aliases = ents.company_aliases;
      r.competitors = ents.competitors;
      r.suppliers = ents.suppliers;
      r.customers = ents.customers;
      r.channels = ents.channels;
      r.sisters = ents.sisters;
      r.products = ents.products;
      r.mentioned = ents.mentioned;
      r.entitySources = ents.entitySources;
      r.edge_count = edgeMap.get(r.id) || 0;
    }
  }

  return res.status(200).json({
    reportsList,
    reportsPagination: { page, pageSize, total }
  });
}

export default withDb(reportsListHandler, {
  methods: ['GET']
});
