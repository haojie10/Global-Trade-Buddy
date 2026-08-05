import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../../lib/api-handler';
import { requireAdmin } from '../../../../lib/auth';
import { extractAndNormalizeEntities } from '../../../../lib/entity-extractor';
import { computeRelationsForReport, ReportEntityItem } from '../../../../lib/relation-calculator';

async function updateEntitiesHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  const session = requireAdmin(req);
  if (!session) {
    return res.status(403).json({ error: '权限不足，仅管理员可执行此操作' });
  }

  const {
    reportId,
    primaryCompany,
    companies = [],
    competitors = [],
    suppliers = [],
    customers = [],
    channels = [],
    sisters = [],
    products = [],
    marketRegion: inputMarketRegion
  } = req.body;

  if (!reportId) {
    return res.status(400).json({ error: '缺少 reportId 参数' });
  }

  try {
    // 1. 获取报告信息
    const repRes = await dbClient.query(
      'SELECT id, title, category, market_region, content_html FROM reports WHERE id = $1',
      [reportId]
    );

    if (repRes.rows.length === 0) {
      return res.status(404).json({ error: '未找到指定报告' });
    }

    const report = repRes.rows[0];
    const contentHtml = report.content_html || '';
    const title = report.title || '';
    const category = report.category || 'customer';
    const marketRegion = (inputMarketRegion && typeof inputMarketRegion === 'string' && inputMarketRegion.trim())
      ? inputMarketRegion.trim()
      : (report.market_region || '全球');

    // 2. 组装 companies 数组（第一个为主名称，其余为别称）
    let companyList: string[] = [];
    if (Array.isArray(companies) && companies.length > 0) {
      companyList = companies.map((s: string) => s.trim()).filter(Boolean);
    } else if (primaryCompany) {
      companyList = [primaryCompany.trim()];
    }

    // 2. 组装 manualTags
    const manualTags = {
      companies: companyList,
      competitors: Array.isArray(competitors) ? competitors.map((s: string) => s.trim()).filter(Boolean) : [],
      suppliers: Array.isArray(suppliers) ? suppliers.map((s: string) => s.trim()).filter(Boolean) : [],
      customers: Array.isArray(customers) ? customers.map((s: string) => s.trim()).filter(Boolean) : [],
      channels: Array.isArray(channels) ? channels.map((s: string) => s.trim()).filter(Boolean) : [],
      sisters: Array.isArray(sisters) ? sisters.map((s: string) => s.trim()).filter(Boolean) : [],
      products: Array.isArray(products) ? products.map((s: string) => s.trim()).filter(Boolean) : []
    };

    // 3. 规范化提取实体
    const resolvedEntities = await extractAndNormalizeEntities(
      contentHtml,
      title,
      dbClient,
      manualTags,
      undefined,
      category
    );

    await dbClient.query('BEGIN');

    // 4. 更新 report_entities
    await dbClient.query('DELETE FROM report_entities WHERE report_id = $1', [reportId]);
    for (const ent of resolvedEntities) {
      await dbClient.query(
        `INSERT INTO report_entities (report_id, entity_id, role, source)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (report_id, entity_id) DO UPDATE SET role = EXCLUDED.role, source = EXCLUDED.source`,
        [reportId, ent.id, ent.role, ent.source || 'auto']
      );
    }

    // 5. 更新 reports 主体公司关联与覆盖区域
    const primaryEnt = resolvedEntities.find(e => e.role === 'primary');
    const primaryEntityId = primaryEnt ? primaryEnt.id : null;
    await dbClient.query(
      'UPDATE reports SET primary_entity_id = $1, market_region = $2 WHERE id = $3',
      [primaryEntityId, marketRegion, reportId]
    );

    // 5.1 根据 marketRegion 智能识别并自动关联 report_countries 国家标签
    if (marketRegion) {
      const allCountriesRes = await dbClient.query('SELECT id, name, region FROM countries');
      const searchLower = marketRegion.toLowerCase();
      const matchedCtyIds = new Set<string>();

      for (const cty of allCountriesRes.rows) {
        const cName = cty.name.toLowerCase();
        const cRegion = cty.region.toLowerCase();
        if (searchLower.includes(cName) || searchLower.includes(cRegion)) {
          matchedCtyIds.add(cty.id);
        }
      }

      if (matchedCtyIds.size > 0) {
        await dbClient.query('DELETE FROM report_countries WHERE report_id = $1', [reportId]);
        for (const ctyId of Array.from(matchedCtyIds)) {
          await dbClient.query(
            'INSERT INTO report_countries (report_id, country_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [reportId, ctyId]
          );
        }
      }
    }

    // 6. 调用共享模块重算该报告相关的 relations 图谱连线
    const currentEntMap = new Map<string, ReportEntityItem>();
    for (const ent of resolvedEntities) {
      currentEntMap.set(ent.id, {
        role: ent.role,
        canonical_name: ent.canonical_name
      });
    }

    const primaryEntNameA = primaryEnt ? primaryEnt.canonical_name.toLowerCase().trim() : '';

    await computeRelationsForReport(
      reportId,
      category,
      marketRegion,
      currentEntMap,
      primaryEntNameA,
      primaryEntityId,
      dbClient
    );

    await dbClient.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: '关系实体及图谱连线重新计算并更新成功！'
    });
  } catch (err: any) {
    await dbClient.query('ROLLBACK');
    return res.status(500).json({ error: err.message });
  }
}

export default withDb(updateEntitiesHandler, {
  methods: ['POST'],
  requiredBody: ['reportId']
});
