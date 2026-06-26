import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../../lib/api-handler';

async function checkDuplicateHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  const { 
    companyName, 
    productName, 
    region, 
    channel, 
    title, 
    category = 'customer' 
  } = req.body;

  // 1. 公司报告去重 (category === 'customer')
  if (category === 'customer') {
    if (!companyName || !companyName.trim()) {
      return res.status(400).json({ error: 'companyName is required for customer category' });
    }

    const queryTag = companyName.trim();

    // 模糊匹配最相似的公司实体
    const entityRes = await dbClient.query(
      `SELECT 
         e.id AS entity_id, 
         e.canonical_name,
         GREATEST(
           similarity(e.canonical_name, $1), 
           COALESCE(MAX(similarity(ea.alias_name, $1)), 0)
         ) AS score
       FROM entities e
       LEFT JOIN entity_aliases ea ON e.id = ea.entity_id
       WHERE e.entity_type = 'company'
       GROUP BY e.id, e.canonical_name
       HAVING GREATEST(
         similarity(e.canonical_name, $1), 
         COALESCE(MAX(similarity(ea.alias_name, $1)), 0)
       ) > 0.3
       ORDER BY score DESC
       LIMIT 1`,
      [queryTag]
    );

    if (entityRes.rows.length === 0) {
      return res.status(200).json({ duplicateFound: false });
    }

    const matchedEntity = entityRes.rows[0];
    const entityId = matchedEntity.entity_id;

    // 检查该相似企业是否已有关联报告，必须限制 role = 'primary'
    const reportRes = await dbClient.query(
      `SELECT r.id AS report_id, r.title AS report_title
       FROM report_entities re
       JOIN reports r ON re.report_id = r.id
       WHERE re.entity_id = $1 AND r.category = $2 AND re.role = 'primary'
       LIMIT 1`,
      [entityId, category]
    );

    if (reportRes.rows.length === 0) {
      return res.status(200).json({ duplicateFound: false });
    }

    const matchedReport = reportRes.rows[0];

    return res.status(200).json({
      duplicateFound: true,
      reportId: matchedReport.report_id,
      reportTitle: matchedReport.report_title,
      matchedEntityId: entityId,
      matchedCanonicalName: matchedEntity.canonical_name,
      score: parseFloat(matchedEntity.score)
    });
  }

  // 2. 品类/产品报告去重 (category === 'product')
  if (category === 'product') {
    // 维度一：基于标题相似度（兜底，阈值为0.7）
    if (title && title.trim()) {
      const titleQuery = title.trim();
      const titleRes = await dbClient.query(
        `SELECT id AS report_id, title AS report_title, similarity(title, $1) AS score
         FROM reports
         WHERE category = 'product' AND similarity(title, $1) > 0.7
         ORDER BY score DESC
         LIMIT 1`,
        [titleQuery]
      );
      if (titleRes.rows.length > 0) {
        const matchedReport = titleRes.rows[0];
        return res.status(200).json({
          duplicateFound: true,
          reportId: matchedReport.report_id,
          reportTitle: matchedReport.report_title,
          reason: 'title-similarity',
          score: parseFloat(matchedReport.score)
        });
      }
    }

    // 维度二：基于核心产品 + 目标市场/渠道 的组合去重
    if (productName && productName.trim()) {
      const prodQuery = productName.trim();

      // 先匹配最相似的产品实体
      const prodEntityRes = await dbClient.query(
        `SELECT 
           e.id AS entity_id, 
           e.canonical_name,
           GREATEST(
             similarity(e.canonical_name, $1), 
             COALESCE(MAX(similarity(ea.alias_name, $1)), 0)
           ) AS score
         FROM entities e
         LEFT JOIN entity_aliases ea ON e.id = ea.entity_id
         WHERE e.entity_type = 'product'
         GROUP BY e.id, e.canonical_name
         HAVING GREATEST(
           similarity(e.canonical_name, $1), 
           COALESCE(MAX(similarity(ea.alias_name, $1)), 0)
         ) > 0.3
         ORDER BY score DESC
         LIMIT 1`,
        [prodQuery]
      );

      if (prodEntityRes.rows.length > 0) {
        const matchedProd = prodEntityRes.rows[0];
        const prodEntityId = matchedProd.entity_id;

        // 查找所有关联了此产品的品类报告候选集
        const candidateReports = await dbClient.query(
          `SELECT r.id AS report_id, r.title AS report_title, r.market_region
           FROM report_entities re
           JOIN reports r ON re.report_id = r.id
           WHERE re.entity_id = $1 AND r.category = 'product' AND re.role = 'product'`,
          [prodEntityId]
        );

        for (const rRow of candidateReports.rows) {
          const reportId = rRow.report_id;
          
          // 查询这篇候选报告关联的其他地区和渠道标签
          const tagsRes = await dbClient.query(
            `SELECT e.canonical_name, e.entity_type
             FROM report_entities re
             JOIN entities e ON re.entity_id = e.id
             WHERE re.report_id = $1 AND e.entity_type IN ('region', 'channel')`,
            [reportId]
          );

          const candidateRegions = tagsRes.rows
            .filter(t => t.entity_type === 'region')
            .map(t => t.canonical_name.toLowerCase().trim());
          const candidateChannels = tagsRes.rows
            .filter(t => t.entity_type === 'channel')
            .map(t => t.canonical_name.toLowerCase().trim());
          
          // 候选报告原本的文本地区字段 (以防 region 实体不存在)
          if (rRow.market_region) {
            candidateRegions.push(rRow.market_region.toLowerCase().trim());
          }

          // 本次上传的地区和渠道标签
          const newRegion = region ? region.toLowerCase().trim() : null;
          const newChannel = channel ? channel.toLowerCase().trim() : null;

          // 核心重合逻辑判断
          let isDuplicate = false;

          // 1. 全局报告互撞：如果已有报告和新报告均没有任何市场/渠道标记，视为撞车
          const candidateHasNoMeta = candidateRegions.length === 0 && candidateChannels.length === 0;
          const newHasNoMeta = !newRegion && !newChannel;
          if (candidateHasNoMeta || newHasNoMeta) {
            isDuplicate = true;
          }

          // 2. 市场交集：新指定的市场存在于候选报告的市场中
          if (newRegion && candidateRegions.includes(newRegion)) {
            isDuplicate = true;
          }

          // 3. 渠道交集：新指定的渠道存在于候选报告的渠道中
          if (newChannel && candidateChannels.includes(newChannel)) {
            isDuplicate = true;
          }

          if (isDuplicate) {
            return res.status(200).json({
              duplicateFound: true,
              reportId: reportId,
              reportTitle: rRow.report_title,
              reason: 'product-market-match',
              matchedCanonicalName: matchedProd.canonical_name
            });
          }
        }
      }
    }
  }

  return res.status(200).json({ duplicateFound: false });
}

// 导出包装过的 API，并且直接导出核心 handler 供测试调用
export default async function handler(req: NextApiRequest, res: NextApiResponse, testDbClient?: PoolClient) {
  if (testDbClient) {
    return checkDuplicateHandler(req, res, testDbClient);
  }
  return withDb(checkDuplicateHandler, {
    methods: ['POST']
  })(req, res);
}
