import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../../lib/api-handler';
import { requireAdmin } from '../../../../lib/auth';
import { extractAndNormalizeEntities } from '../../../../lib/entity-extractor';

const RETAILER_ENTITIES = new Set([
  'home depot', 'lowes', 'x5 group', 'lenta', 'ikea', 'rexel', 'magnit',
  'walmart', 'costco', 'target', 'carrefour', 'aldi', 'lidl', 'tesco',
  'leroy merlin', 'obimarkets', 'castorama', 'brico'
]);

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
    products = []
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
    const marketRegion = report.market_region || '全球';

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
        `INSERT INTO report_entities (report_id, entity_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (report_id, entity_id) DO UPDATE SET role = EXCLUDED.role`,
        [reportId, ent.id, ent.role]
      );
    }

    // 5. 更新 reports 主体公司关联
    const primaryEnt = resolvedEntities.find(e => e.role === 'primary');
    const primaryEntityId = primaryEnt ? primaryEnt.id : null;
    await dbClient.query(
      'UPDATE reports SET primary_entity_id = $1 WHERE id = $2',
      [primaryEntityId, reportId]
    );

    // 6. 重算该报告相关的 relations 图谱连线
    await dbClient.query('DELETE FROM relations WHERE report_id_a = $1 OR report_id_b = $1', [reportId]);

    // 读取全库其它报告实体数据
    const otherReportsRes = await dbClient.query(
      `SELECT r.id AS b_report_id, r.category AS b_category, r.primary_entity_id AS b_primary_id,
              e.canonical_name AS b_primary_name
       FROM reports r
       LEFT JOIN entities e ON r.primary_entity_id = e.id
       WHERE r.id != $1`,
      [reportId]
    );

    const otherReportIds = otherReportsRes.rows.map(r => r.b_report_id);
    const otherRepEntMap = new Map<string, Map<string, { role: string; canonical_name: string }>>();

    if (otherReportIds.length > 0) {
      const otherEntsRes = await dbClient.query(
        `SELECT re.report_id, re.entity_id, re.role, e.canonical_name
         FROM report_entities re
         JOIN entities e ON re.entity_id = e.id
         WHERE re.report_id = ANY($1)`,
        [otherReportIds]
      );

      for (const row of otherEntsRes.rows) {
        if (!otherRepEntMap.has(row.report_id)) {
          otherRepEntMap.set(row.report_id, new Map());
        }
        otherRepEntMap.get(row.report_id)!.set(row.entity_id, {
          role: row.role,
          canonical_name: row.canonical_name
        });
      }
    }

    const currentEntMap = new Map<string, { role: string; canonical_name: string }>();
    for (const ent of resolvedEntities) {
      currentEntMap.set(ent.id, {
        role: ent.role,
        canonical_name: ent.canonical_name
      });
    }

    const primaryEntNameA = primaryEnt ? primaryEnt.canonical_name.toLowerCase().trim() : '';

    for (const otherRep of otherReportsRes.rows) {
      const bReportId = otherRep.b_report_id;
      const bCategory = otherRep.b_category;
      const bPrimaryId = otherRep.b_primary_id;
      const bPrimaryName = otherRep.b_primary_name ? otherRep.b_primary_name.toLowerCase().trim() : '';
      const entMapB = otherRepEntMap.get(bReportId) || new Map();
      let finalRelType: string | null = null;
      let finalRelKey: string = '';
      let sourceReportId = reportId;
      let targetReportId = bReportId;

      // 优先级 1: 竞争关系 (competitor)
      const aHasBAsComp = bPrimaryId && currentEntMap.has(bPrimaryId) && currentEntMap.get(bPrimaryId)!.role === 'competitor';
      const bHasAAsComp = primaryEntityId && entMapB.has(primaryEntityId) && entMapB.get(primaryEntityId)!.role === 'competitor';

      const isRetailerA = RETAILER_ENTITIES.has(primaryEntNameA);
      const isRetailerB = RETAILER_ENTITIES.has(bPrimaryName);
      const isRetailerInvolved = isRetailerA || isRetailerB;

      if ((aHasBAsComp || bHasAAsComp) && !isRetailerInvolved) {
        finalRelType = 'competitor';
        finalRelKey = aHasBAsComp
          ? (otherRep.b_primary_name || '同业竞争')
          : (primaryEnt ? primaryEnt.canonical_name : '同业竞争');
        if (reportId > bReportId) {
          sourceReportId = bReportId;
          targetReportId = reportId;
        }
      }

      // 优先级 2: 供销关系 (supplier)
      if (!finalRelType) {
        const aHasBAsSupplier = bPrimaryId && currentEntMap.has(bPrimaryId) && currentEntMap.get(bPrimaryId)!.role === 'supplier';
        const bHasAAsCustomerOrChannel = primaryEntityId && entMapB.has(primaryEntityId) &&
          ['customer', 'channel'].includes(entMapB.get(primaryEntityId)!.role);

        const bHasAAsSupplier = primaryEntityId && entMapB.has(primaryEntityId) && entMapB.get(primaryEntityId)!.role === 'supplier';
        const aHasBAsCustomerOrChannel = bPrimaryId && currentEntMap.has(bPrimaryId) &&
          ['customer', 'channel'].includes(currentEntMap.get(bPrimaryId)!.role);

        if (aHasBAsSupplier || bHasAAsCustomerOrChannel) {
          // B 是供应商，A 是客户/渠道 => 流向是 B (供应商) -> A (渠道)
          finalRelType = 'supplier';
          finalRelKey = otherRep.b_primary_name || '供销渠道';
          sourceReportId = bReportId;
          targetReportId = reportId;
        } else if (bHasAAsSupplier || aHasBAsCustomerOrChannel) {
          // A 是供应商，B 是客户/渠道 => 流向是 A (供应商) -> B (渠道)
          finalRelType = 'supplier';
          finalRelKey = primaryEnt ? primaryEnt.canonical_name : '供销渠道';
          sourceReportId = reportId;
          targetReportId = bReportId;
        }
      }

      // 优先级 3: 经营关系 (operation)
      if (!finalRelType) {
        const isOneProductOneCompany = (category === 'product' && bCategory === 'customer') ||
                                       (category === 'customer' && bCategory === 'product');
        if (isOneProductOneCompany) {
          for (const [entIdA, dataA] of currentEntMap.entries()) {
            if (dataA.role === 'product' && entMapB.has(entIdA)) {
              finalRelType = 'operation';
              finalRelKey = dataA.canonical_name;
              if (category === 'customer') {
                sourceReportId = reportId;
                targetReportId = bReportId;
              } else {
                sourceReportId = bReportId;
                targetReportId = reportId;
              }
              break;
            }
          }
        }
      }

      // 优先级 4: 提及关系 (mention)
      if (!finalRelType) {
        const aHasBAsSister = bPrimaryId && currentEntMap.has(bPrimaryId) && currentEntMap.get(bPrimaryId)!.role === 'sister_parent';
        const bHasAAsSister = primaryEntityId && entMapB.has(primaryEntityId) && entMapB.get(primaryEntityId)!.role === 'sister_parent';

        if (aHasBAsSister || bHasAAsSister) {
          finalRelType = 'mention';
          finalRelKey = '关联/姐妹公司';
          if (reportId > bReportId) {
            sourceReportId = bReportId;
            targetReportId = reportId;
          }
        } else {
          for (const [entIdA, dataA] of currentEntMap.entries()) {
            if (dataA.role === 'product' && entMapB.has(entIdA) && entMapB.get(entIdA)!.role === 'product') {
              finalRelType = 'mention';
              finalRelKey = dataA.canonical_name;
              if (reportId > bReportId) {
                sourceReportId = bReportId;
                targetReportId = reportId;
              }
              break;
            }
          }
        }
      }

      if (finalRelType) {
        await dbClient.query(
          `INSERT INTO relations (report_id_a, report_id_b, relation_key, market_region, relation_type)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (report_id_a, report_id_b, relation_key) DO UPDATE SET relation_type = EXCLUDED.relation_type`,
           [sourceReportId, targetReportId, finalRelKey, marketRegion, finalRelType]
        );
      }
    }

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
