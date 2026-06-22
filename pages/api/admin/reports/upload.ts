import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../../lib/api-handler';
import { parseMetadata, runDehydration, extractAndNormalizeEntities } from '../../../../lib/entity-extractor';

// Re-export for compatibility with tests
export { parseMetadata, runDehydration, extractAndNormalizeEntities } from '../../../../lib/entity-extractor';

async function uploadHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  const { rawHtml, manualTags, category, summary, overwriteReportId } = req.body;

  // 模拟的 OSS 图片上传，在本地开发环境下将图片真实写入 public/uploads，返回 /uploads/ 相对链接
  const mockUpload = async (buffer: Buffer, mime: string) => {
    const ext = mime.split('/')[1] || 'png';
    const fileName = `img_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
    
    const fs = require('fs');
    const path = require('path');
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    fs.writeFileSync(path.join(uploadDir, fileName), buffer);
    
    return `/uploads/${fileName}`;
  };

  // 1. 脱水处理
  const { cleanHtml, imageCount } = await runDehydration(rawHtml, mockUpload);

  // 2. 元数据及实体提取
  const meta = parseMetadata(rawHtml);

  // 处理手动标记的地区标签
  let regionsList: string[] = [];
  if (manualTags?.regions) {
    regionsList = manualTags.regions.map((r: string) => r.trim()).filter(Boolean);
  }
  
  // 合并自动提取的地区（如果不是“全球”默认值）
  if (meta.market_region && meta.market_region !== '全球') {
    regionsList.push(meta.market_region);
  }
  
  // 如果最终列表为空，则使用自动提取的地区或“全球”
  if (regionsList.length === 0) {
    regionsList = [meta.market_region || '全球'];
  }
  
  const finalMarketRegion = Array.from(new Set(regionsList)).join(', ');

  await dbClient.query('BEGIN');

  // 3. 提取并归一化实体
  const resolvedEntities = await extractAndNormalizeEntities(rawHtml, meta.title, dbClient, manualTags);

  // 4. 写入报告表
  const finalCategory = category || meta.category;
  const finalSummary = summary !== undefined ? summary.trim() : meta.summary;

  let newReportId = overwriteReportId;

  if (overwriteReportId) {
    // 覆盖更新模式：更新报告内容，同时清理旧的关联网络
    await dbClient.query(
      `UPDATE reports 
       SET title = $1, category = $2, market_region = $3, summary = $4, content_html = $5 
       WHERE id = $6`,
      [meta.title, finalCategory, finalMarketRegion, finalSummary, cleanHtml, overwriteReportId]
    );

    // 清理旧的报告与实体的映射和关系边，以便重新建立
    await dbClient.query(`DELETE FROM report_entities WHERE report_id = $1`, [overwriteReportId]);
    await dbClient.query(`DELETE FROM relations WHERE report_id_a = $1 OR report_id_b = $1`, [overwriteReportId]);
  } else {
    // 新建模式
    const insertReportRes = await dbClient.query(
      `INSERT INTO reports (title, category, market_region, summary, content_html) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id`,
      [meta.title, finalCategory, finalMarketRegion, finalSummary, cleanHtml]
    );
    newReportId = insertReportRes.rows[0].id;
  }

  // 5. 写入 report_entities 表
  for (const ent of resolvedEntities) {
    await dbClient.query(
      `INSERT INTO report_entities (report_id, entity_id) 
       VALUES ($1, $2) 
       ON CONFLICT (report_id, entity_id) DO NOTHING`,
      [newReportId, ent.id]
    );
  }

  // 5.5 自动关系推理逻辑 (1个产品，多个公司 -> 两两建立 competitor 关系)
  if (manualTags?.products && manualTags?.companies) {
    const companyNames = manualTags.companies.map((c: string) => c.trim()).filter(Boolean);
    const productNames = manualTags.products.map((p: string) => p.trim()).filter(Boolean);
    
    if (companyNames.length > 1 && productNames.length === 1) {
      const compRes = await dbClient.query(
        `SELECT id FROM entities WHERE canonical_name = ANY($1) AND entity_type = 'company'`,
        [companyNames]
      );
      const compIds = compRes.rows.map((r: any) => r.id);
      
      for (let i = 0; i < compIds.length; i++) {
        for (let j = i + 1; j < compIds.length; j++) {
          await dbClient.query(
            `INSERT INTO entity_relations (entity_id_a, entity_id_b, relation_type, market_region)
             VALUES ($1, $2, 'competitor', $3)
             ON CONFLICT (entity_id_a, entity_id_b, relation_type, market_region) DO NOTHING`,
            [compIds[i], compIds[j], finalMarketRegion || null]
          );
        }
      }
    }
  }

  // 6. 在 relations 表中建边并携带 market_region 属性
  if (resolvedEntities.length > 0) {
    const entityIds = resolvedEntities.map(e => e.id);
    const sharedReportsRes = await dbClient.query(
      `SELECT DISTINCT re.report_id, e.canonical_name, e.entity_type
       FROM report_entities re
       JOIN entities e ON re.entity_id = e.id
       WHERE re.entity_id = ANY($1) AND re.report_id != $2`,
      [entityIds, newReportId]
    );

    for (const row of sharedReportsRes.rows) {
      let relType = 'mention';
      if (row.entity_type === 'product' || row.entity_type === 'channel') {
        relType = 'operation';
      } else if (row.entity_type === 'competitor') {
        relType = 'competitor';
      }

      await dbClient.query(
        `INSERT INTO relations (report_id_a, report_id_b, relation_key, market_region, relation_type) 
         VALUES ($1, $2, $3, $4, $5)`,
        [newReportId, row.report_id, row.canonical_name, finalMarketRegion, relType]
      );
    }
  }

  await dbClient.query('COMMIT');

  return res.status(200).json({
    success: true,
    reportId: newReportId,
    imageCount,
    title: meta.title
  });
}

export default withDb(uploadHandler, {
  methods: ['POST'],
  requiredBody: ['rawHtml']
});

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
};
