import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../../lib/api-handler';
import { requireAdmin } from '../../../../lib/auth';
import { parseMetadata, runDehydration, extractAndNormalizeEntities } from '../../../../lib/entity-extractor';
import { getStandardCategory } from '../../../../lib/category-mapper';
import { uploadImage, cleanOrphanedImages } from '../../../../lib/storage';
import { RETAILER_ENTITIES } from '../../../../lib/entity-constants';
import { computeRelationsForReport, ReportEntityItem } from '../../../../lib/relation-calculator';
import { filterCountriesOnly } from '../../../../lib/country-helpers';

async function uploadHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  const adminSession = requireAdmin(req);
  if (!adminSession) {
    return res.status(403).json({ error: '权限不足，仅管理员可执行此操作' });
  }

  const { rawHtml, manualTags, category, summary, overwriteReportId, industry_ids, country_ids } = req.body;

  // 1. 脱水处理（图片统一走 lib/storage.ts）
  const { cleanHtml, imageCount } = await runDehydration(rawHtml, uploadImage);

  // 2. 元数据及实体提取
  const meta = parseMetadata(rawHtml);

  // 提取兼顾 HTML head 里的 company_aliases 标记（支持单双引号及多行全容错正则）
  const metaAliasesMatch = rawHtml.match(/<meta[^>]*?name=["']company_aliases["'][^>]*?content=(["'])([\s\S]*?)\1/i) 
    || rawHtml.match(/<meta[^>]*?content=(["'])([\s\S]*?)\1[^>]*?name=["']company_aliases["']/i);
  const metaAliases = metaAliasesMatch ? (metaAliasesMatch[2] || metaAliasesMatch[1] || '').split(/,|，|\/|\||;|；|\n/).map((s: string) => s.trim()).filter(Boolean) : [];

  const formAliases = (manualTags?.companies && Array.isArray(manualTags.companies) && manualTags.companies.length > 1)
    ? manualTags.companies.slice(1).map((s: string) => s.trim()).filter(Boolean)
    : [];

  const finalCompanyAliases = Array.from(new Set([
    ...formAliases,
    ...(manualTags?.companyAliases || []),
    ...metaAliases
  ]));

  const mergedManualTags = {
    ...manualTags,
    companies: manualTags?.companies && manualTags.companies.length > 0 ? [manualTags.companies[0].trim()] : (meta.primary_subject ? [meta.primary_subject] : []),
    companyAliases: finalCompanyAliases
  };

  // 处理手动标记的地区标签（仅保留具体国家，剔除大洲大区词汇）
  let regionsList: string[] = [];
  if (mergedManualTags?.regions) {
    regionsList = mergedManualTags.regions.map((r: string) => r.trim()).filter(Boolean);
  }
  
  // 合并自动提取的地区（如果不是“全球”默认值）
  if (meta.market_region && meta.market_region !== '全球') {
    regionsList.push(meta.market_region);
  }
  
  // 严格过滤大区词汇，仅保留具体国家（如: '英国, 欧洲' -> '英国'）
  const cleanCountriesList = filterCountriesOnly(regionsList);
  const finalMarketRegion = cleanCountriesList.length > 0
    ? cleanCountriesList.join(', ')
    : (regionsList.length > 0 ? regionsList.join(', ') : '全球');

  await dbClient.query('BEGIN');

  // 4. 确定分类和摘要
  const finalCategory = category || meta.category;
  const finalSummary = summary !== undefined ? summary.trim() : meta.summary;

  // 3. 提取并归一化实体
  const resolvedEntities = await extractAndNormalizeEntities(
    rawHtml,
    meta.title,
    dbClient,
    mergedManualTags,
    meta.primary_subject,
    finalCategory
  );

  // 找到主体公司的实体 ID
  const primaryEnt = resolvedEntities.find(e => e.role === 'primary');
  const primaryEntityId = primaryEnt ? primaryEnt.id : null;

  // 处理国家名称列表
  const autoCountries = finalMarketRegion.split(',').map((s: string) => s.trim()).filter(Boolean);
  const mappedCountries = autoCountries.map((ctyName: string) => {
    let lookupName = ctyName;
    if (ctyName.toLowerCase() === 'germany') lookupName = '德国';
    if (ctyName.toLowerCase() === 'austria') lookupName = '奥地利';
    if (ctyName.toLowerCase() === 'usa' || ctyName.toLowerCase() === 'united states') lookupName = '美国';
    if (ctyName.toLowerCase() === 'uk' || ctyName.toLowerCase() === 'united kingdom') lookupName = '英国';
    if (ctyName.toLowerCase() === 'france') lookupName = '法国';
    return lookupName;
  });

  // 4. 智能查重与覆盖判定（主体公司 + 国家 双重联合查重）
  let existingReport;
  if (overwriteReportId) {
    existingReport = await dbClient.query('SELECT id FROM reports WHERE id = $1', [overwriteReportId]);
  } else if (finalCategory === 'customer' && primaryEntityId) {
    // 优先按主体公司 + 目标国家联合查重
    if (mappedCountries.length > 0) {
      existingReport = await dbClient.query(
        `SELECT r.id 
         FROM reports r
         JOIN report_countries rc ON r.id = rc.report_id
         JOIN countries c ON rc.country_id = c.id
         WHERE r.category = 'customer' 
           AND r.primary_entity_id = $1 
           AND c.name = ANY($2::text[])
         ORDER BY r.created_at ASC 
         LIMIT 1`,
        [primaryEntityId, mappedCountries]
      );
    }
    // 兜底按主体公司查重
    if (!existingReport || existingReport.rows.length === 0) {
      existingReport = await dbClient.query(
        'SELECT id FROM reports WHERE category = $1 AND primary_entity_id = $2 ORDER BY created_at ASC LIMIT 1',
        ['customer', primaryEntityId]
      );
    }
  }

  if (!existingReport || existingReport.rows.length === 0) {
    // 兜底按报告标题查重
    existingReport = await dbClient.query(
      'SELECT id FROM reports WHERE title = $1 ORDER BY created_at ASC LIMIT 1',
      [meta.title]
    );
  }

  let newReportId: string;
  // NOTE: 覆盖更新前需保存旧 content_html，事务后用于对比并清理孤儿图片
  let oldContentHtmlForOverwrite: string | null = null;

  if (existingReport && existingReport.rows.length > 0) {
    newReportId = existingReport.rows[0].id;
    // 先查询旧的 content_html
    const oldContentRes = await dbClient.query(
      'SELECT content_html FROM reports WHERE id = $1',
      [newReportId]
    );
    oldContentHtmlForOverwrite = oldContentRes.rows[0]?.content_html || null;

    // 覆盖更新模式：更新报告内容，同时更新主体实体关联
    await dbClient.query(
      `UPDATE reports 
       SET title = $1, category = $2, market_region = $3, summary = $4, content_html = $5, primary_entity_id = $6, created_at = NOW()
       WHERE id = $7`,
      [meta.title, finalCategory, finalMarketRegion, finalSummary, cleanHtml, primaryEntityId, newReportId]
    );

    // 清理旧的报告与实体的映射，以便重新建立
    await dbClient.query(`DELETE FROM report_entities WHERE report_id = $1`, [newReportId]);

    // 自愈修复：自动清理同企业同国家的历史冗余多余报告
    if (finalCategory === 'customer' && primaryEntityId) {
      const dupRes = await dbClient.query(
        'SELECT id FROM reports WHERE category = $1 AND primary_entity_id = $2 AND id != $3',
        ['customer', primaryEntityId, newReportId]
      );
      for (const dupRow of dupRes.rows) {
        const dupId = dupRow.id;
        await dbClient.query('DELETE FROM report_entities WHERE report_id = $1', [dupId]);
        await dbClient.query('DELETE FROM report_industries WHERE report_id = $1', [dupId]);
        await dbClient.query('DELETE FROM report_countries WHERE report_id = $1', [dupId]);
        await dbClient.query('DELETE FROM relations WHERE report_id_a = $1 OR report_id_b = $1', [dupId]);
        await dbClient.query('DELETE FROM reports WHERE id = $1', [dupId]);
        console.log(`Auto healed and removed duplicate report in admin upload: ${dupId}`);
      }
    }
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

  // 4.1 确保主体公司的全部别名严格对齐持久化到 entity_aliases 表中（清理不属于本次的旧别名）
  if (primaryEntityId) {
    const validAliases = mergedManualTags.companyAliases || [];
    if (validAliases.length > 0) {
      await dbClient.query(
        'DELETE FROM entity_aliases WHERE entity_id = $1 AND alias_name != ALL($2)',
        [primaryEntityId, validAliases]
      );
      for (const alias of validAliases) {
        await dbClient.query(
          `INSERT INTO entity_aliases (entity_id, alias_name)
           VALUES ($1, $2)
           ON CONFLICT (alias_name) DO UPDATE SET entity_id = EXCLUDED.entity_id`,
          [primaryEntityId, alias]
        );
      }
    } else {
      await dbClient.query(
        'DELETE FROM entity_aliases WHERE entity_id = $1',
        [primaryEntityId]
      );
    }
  }

  // 保存行业与国家关联
  await dbClient.query('DELETE FROM report_industries WHERE report_id = $1', [newReportId]);
  await dbClient.query('DELETE FROM report_countries WHERE report_id = $1', [newReportId]);

  if (Array.isArray(industry_ids)) {
    for (const indId of industry_ids) {
      if (indId) {
        await dbClient.query(
          'INSERT INTO report_industries (report_id, industry_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [newReportId, indId]
        );
      }
    }
  }

  // 自动从 HTML 的 products 元数据提取行业并建立关联 (将产品名自动映射到 54 个标准大类)
  let autoIndustries: string[] = [];
  if (manualTags?.products && Array.isArray(manualTags.products)) {
    autoIndustries = manualTags.products.map((p: string) => p.trim()).filter(Boolean);
  }

  const ignoredCategories: string[] = [];
  for (const indName of autoIndustries) {
    const mappedCategory = getStandardCategory(indName);
    if (!mappedCategory) {
      ignoredCategories.push(indName);
      continue;
    }
    const indRes = await dbClient.query(
      'INSERT INTO industries (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id',
      [mappedCategory]
    );
    const indId = indRes.rows[0].id;
    await dbClient.query(
      'INSERT INTO report_industries (report_id, industry_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [newReportId, indId]
    );
  }

  if (Array.isArray(country_ids)) {
    for (const ctyId of country_ids) {
      if (ctyId) {
        await dbClient.query(
          'INSERT INTO report_countries (report_id, country_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [newReportId, ctyId]
        );
      }
    }
  }

  // 自动从 HTML 的 market_region 提取国家并建立关联
  if (mappedCountries.length > 0) {
    const ctyRes = await dbClient.query('SELECT id FROM countries WHERE name = ANY($1)', [mappedCountries]);
    for (const row of ctyRes.rows) {
      await dbClient.query(
        'INSERT INTO report_countries (report_id, country_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [newReportId, row.id]
      );
    }
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

  // 6. 调用共享模块重算与该报告相关的图谱关系
  const currentEntMap = new Map<string, ReportEntityItem>();
  for (const ent of resolvedEntities) {
    currentEntMap.set(ent.id, {
      role: ent.role,
      canonical_name: ent.canonical_name
    });
  }

  const primaryEntNameA = primaryEnt ? primaryEnt.canonical_name.toLowerCase().trim() : '';
  const primaryEntityIdA = primaryEnt ? primaryEnt.id : null;

  await computeRelationsForReport(
    newReportId,
    finalCategory,
    meta.market_region || '全球',
    currentEntMap,
    primaryEntNameA,
    primaryEntityIdA,
    dbClient
  );

  await dbClient.query('COMMIT');

  // 事务提交成功后，异步对比并清理覆盖前的孤儿图片（不阻塞响应）
  if (oldContentHtmlForOverwrite !== null) {
    cleanOrphanedImages(oldContentHtmlForOverwrite, cleanHtml).catch((err: any) => {
      console.error('[WARN] upload: 孤儿图片清理失败:', err.message);
    });
  }

  return res.status(200).json({
    success: true,
    reportId: newReportId,
    imageCount,
    title: meta.title,
    ignoredCategories
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
