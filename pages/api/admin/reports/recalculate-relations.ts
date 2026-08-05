import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../../lib/api-handler';
import { requireAdmin } from '../../../../lib/auth';
import { recalculateAllRelations } from '../../../../lib/relation-calculator';

async function recalculateHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  const session = requireAdmin(req);
  if (!session) {
    return res.status(403).json({ error: '权限不足，仅管理员可执行全量重算' });
  }

  const startTime = Date.now();

  try {
    const result = await recalculateAllRelations(dbClient);
    const durationMs = Date.now() - startTime;

    return res.status(200).json({
      success: true,
      message: `🎉 全量图谱连线重算成功！共处理 ${result.totalReports} 篇报告，生成 ${result.totalRelations} 条图谱连线。`,
      totalReports: result.totalReports,
      totalRelations: result.totalRelations,
      durationMs
    });
  } catch (err: any) {
    return res.status(500).json({ error: '全量重算失败: ' + err.message });
  }
}

export default withDb(recalculateHandler, {
  methods: ['POST']
});
