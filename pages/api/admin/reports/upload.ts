import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../../lib/api-handler';
import { parseMetadata, runDehydration, extractAndNormalizeEntities } from '../../../../lib/entity-extractor';

// Re-export for compatibility with tests
export { parseMetadata, runDehydration, extractAndNormalizeEntities } from '../../../../lib/entity-extractor';

async function uploadHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  const { rawHtml, manualTags, category, summary, overwriteReportId } = req.body;

  // 真实的 Supabase Storage 图片上传
  const supabaseUpload = async (buffer: Buffer, mime: string) => {
    const ext = mime.split('/')[1] || 'png';
    const fileName = `img_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL or Anon Key is missing in environment variables');
    }

    // 1. 调用 REST API 写入 Supabase Storage
    const uploadUrl = `${supabaseUrl}/storage/v1/object/report-images/${fileName}`;
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': mime,
        'x-upsert': 'true'
      },
      body: buffer as any
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Failed to upload image to Supabase Storage: ${errText}`);
    }

    // 2. 返回公共 CDN 访问链接
    return `${supabaseUrl}/storage/v1/object/public/report-images/${fileName}`;
  };

  // 1. 脱水处理
  const { cleanHtml, imageCount } = await runDehydration(rawHtml, supabaseUpload);

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

  // 4. 确定分类和摘要
  const finalCategory = category || meta.category;
  const finalSummary = summary !== undefined ? summary.trim() : meta.summary;

  // 3. 提取并归一化实体
  const resolvedEntities = await extractAndNormalizeEntities(
    rawHtml,
    meta.title,
    dbClient,
    manualTags,
    meta.primary_subject,
    finalCategory
  );

  // 找到主体公司的实体 ID
  const primaryEnt = resolvedEntities.find(e => e.role === 'primary');
  const primaryEntityId = primaryEnt ? primaryEnt.id : null;

  let newReportId = overwriteReportId;

  if (overwriteReportId) {
    // 覆盖更新模式：更新报告内容，同时更新主体实体关联
    await dbClient.query(
      `UPDATE reports 
       SET title = $1, category = $2, market_region = $3, summary = $4, content_html = $5, primary_entity_id = $6
       WHERE id = $7`,
      [meta.title, finalCategory, finalMarketRegion, finalSummary, cleanHtml, primaryEntityId, overwriteReportId]
    );

    // 清理旧的报告与实体的映射，以便重新建立
    await dbClient.query(`DELETE FROM report_entities WHERE report_id = $1`, [overwriteReportId]);
  } else {
    // 新建模式
    const insertReportRes = await dbClient.query(
      `INSERT INTO reports (title, category, market_region, summary, content_html, primary_entity_id) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id`,
      [meta.title, finalCategory, finalMarketRegion, finalSummary, cleanHtml, primaryEntityId]
    );
    newReportId = insertReportRes.rows[0].id;
  }

  // 5. 写入 report_entities 表并携带其扮演的角色 role
  for (const ent of resolvedEntities) {
    await dbClient.query(
      `INSERT INTO report_entities (report_id, entity_id, role) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (report_id, entity_id) DO UPDATE SET role = EXCLUDED.role`,
      [newReportId, ent.id, ent.role]
    );
  }

  // 5.5 自动关系推理逻辑 (1个产品，多个公司 -> 两两建立 competitor 关系)
  if (manualTags?.products) {
    const productNames = manualTags.products.map((p: string) => p.trim()).filter(Boolean);
    
    if (productNames.length === 1) {
      const companyNames: string[] = [];
      if (manualTags.companies && manualTags.companies.length > 0) {
        companyNames.push(manualTags.companies[0]);
      }
      const otherCompanies = [
        ...(manualTags.competitors || []),
        ...(manualTags.suppliers || []),
        ...(manualTags.customers || []),
        ...(manualTags.sisters || [])
      ].map(c => c.trim()).filter(Boolean);
      
      const allCompanyNames = Array.from(new Set([...companyNames, ...otherCompanies]));

      if (allCompanyNames.length > 1) {
        const compRes = await dbClient.query(
          `SELECT id FROM entities WHERE canonical_name = ANY($1) AND entity_type = 'company'`,
          [allCompanyNames]
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
      } else if (row.entity_type === 'company') {
        relType = 'produces';
      }

      await dbClient.query(
        `INSERT INTO relations (report_id_a, report_id_b, relation_key, market_region, relation_type) 
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (report_id_a, report_id_b, relation_key) DO NOTHING`,
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
