import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../../lib/api-handler';
import { requireAdmin } from '../../../../lib/auth';
import { computeRelationsForReport, ReportEntityItem } from '../../../../lib/relation-calculator';

async function healEntitiesHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  // 仅允许管理员或带有合法 Agent API Key 的请求
  const authHeader = req.headers.authorization;
  const token = (authHeader && authHeader.split(' ')[1]) || (req.headers['x-agent-key'] as string);
  const expectedToken = process.env.AGENT_API_KEY || 'automation_agent_secret';
  const isAdminOrKey = (token === expectedToken) || Boolean(requireAdmin(req));

  if (!isAdminOrKey) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  await dbClient.query('BEGIN');

  try {
    // 1. 确保独立核心实体存在
    const upsertEntity = async (name: string, type: string) => {
      const res = await dbClient.query(
        `INSERT INTO entities (canonical_name, entity_type)
         VALUES ($1, $2)
         ON CONFLICT (canonical_name) DO UPDATE SET entity_type = EXCLUDED.entity_type
         RETURNING id`,
        [name, type]
      );
      return res.rows[0].id;
    };

    const aldiNordId = await upsertEntity('ALDI Einkauf SE & Co. oHG', 'company');
    const aldiSudId = await upsertEntity('ALDI SÜD', 'company');
    const walmartId = await upsertEntity('Walmart', 'company');
    const dgId = await upsertEntity('Dollar General', 'company');
    const traderJoesId = await upsertEntity("Trader Joe's", 'company');

    // 2. 严格重置并分配各实体的合法别名
    const setAliases = async (entityId: string, aliases: string[]) => {
      for (const a of aliases) {
        await dbClient.query(
          `INSERT INTO entity_aliases (entity_id, alias_name)
           VALUES ($1, $2)
           ON CONFLICT (alias_name) DO UPDATE SET entity_id = EXCLUDED.entity_id`,
          [entityId, a]
        );
      }
    };

    // 2.1 绑定 Walmart 别名
    await setAliases(walmartId, ['沃尔玛', 'Wal-Mart', 'Walmart Inc.']);

    // 2.2 绑定 Dollar General 别名
    await setAliases(dgId, ['达乐', 'DG', 'Dollar General Corporation', 'Yellow Banana']);

    // 2.3 绑定 ALDI SÜD 别名
    await setAliases(aldiSudId, ['ALDI Süd', 'Aldi Süd', 'ALDI South', 'ALDI SOUTH Group', '阿尔迪南', '阿尔迪南区', 'aldi-sued.de', 'Aldi Australia', 'ALDI Australia', 'Aldi Foods Pty Ltd']);

    // 2.4 绑定 ALDI Nord 别名
    const validNordAliases = ['ALDI Nord', '阿尔迪北', '阿尔迪北方', 'ALDI Nord Group', 'Unternehmensgruppe ALDI Nord', 'aldi-nord.de', 'ALDI NORD', 'Aldi Gruppe', 'ALDI', 'Aldi'];
    await setAliases(aldiNordId, validNordAliases);

    // 2.5 清理 ALDI Nord 下所有不属于它的被污染别名
    await dbClient.query(
      `DELETE FROM entity_aliases WHERE entity_id = $1 AND alias_name NOT = ANY($2)`,
      [aldiNordId, validNordAliases]
    );

    // 3. 修复 ALDI Nord 报告的关联实体（恢复 ALDI SÜD 作为姐妹公司）
    const repRes = await dbClient.query(
      "SELECT id, title, market_region FROM reports WHERE title ILIKE '%ALDI Nord%'"
    );

    for (const report of repRes.rows) {
      const reportId = report.id;
      
      // 设置主体公司
      await dbClient.query(
        'UPDATE reports SET primary_entity_id = $1 WHERE id = $2',
        [aldiNordId, reportId]
      );

      await dbClient.query(
        `INSERT INTO report_entities (report_id, entity_id, role, source)
         VALUES ($1, $2, 'primary', 'manual')
         ON CONFLICT (report_id, entity_id) DO UPDATE SET role = 'primary', source = 'manual'`,
        [reportId, aldiNordId]
      );

      // 确保 ALDI SÜD 和 Trader Joe's 作为姐妹公司挂载
      await dbClient.query(
        `INSERT INTO report_entities (report_id, entity_id, role, source)
         VALUES ($1, $2, 'sister_parent', 'manual')
         ON CONFLICT (report_id, entity_id) DO UPDATE SET role = 'sister_parent', source = 'manual'`,
        [reportId, aldiSudId]
      );

      await dbClient.query(
        `INSERT INTO report_entities (report_id, entity_id, role, source)
         VALUES ($1, $2, 'sister_parent', 'manual')
         ON CONFLICT (report_id, entity_id) DO UPDATE SET role = 'sister_parent', source = 'manual'`,
        [reportId, traderJoesId]
      );

      // 重新计算图谱连线
      const entRes = await dbClient.query(
        `SELECT re.entity_id, re.role, e.canonical_name 
         FROM report_entities re
         JOIN entities e ON re.entity_id = e.id
         WHERE re.report_id = $1`,
        [reportId]
      );

      const entMap = new Map<string, ReportEntityItem>();
      for (const ent of entRes.rows) {
        entMap.set(ent.entity_id, {
          role: ent.role,
          canonical_name: ent.canonical_name
        });
      }

      await computeRelationsForReport(
        reportId,
        'customer',
        report.market_region || '全球',
        entMap,
        'aldi einkauf se & co. ohg',
        aldiNordId,
        dbClient
      );
    }

    await dbClient.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: '🎉 实体污染清洗、核心独立实体重建与 ALDI Nord 报告拓扑修复成功！'
    });
  } catch (err: any) {
    await dbClient.query('ROLLBACK');
    return res.status(500).json({ error: err.message });
  }
}

export default withDb(healEntitiesHandler, {
  methods: ['GET', 'POST']
});
