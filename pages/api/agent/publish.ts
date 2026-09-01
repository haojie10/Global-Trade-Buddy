import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../lib/api-handler';
import { runDehydration, extractAndNormalizeEntities, parseMetadata } from '../../../lib/entity-extractor';
import { getStandardCategory } from '../../../lib/category-mapper';
import { uploadImage, cleanOrphanedImages } from '../../../lib/storage';
import { RETAILER_ENTITIES } from '../../../lib/entity-constants';
import { filterCountriesOnly } from '../../../lib/country-helpers';
import { computeRelationsForReport, ReportEntityItem } from '../../../lib/relation-calculator';
import { discoverAndQueueCompetitors } from '../../../lib/competitor-discoverer';

async function publishHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  const authHeader = req.headers.authorization;
  const token = (authHeader && authHeader.split(' ')[1]) || (req.headers['x-agent-key'] as string);
  const isProd = process.env.NODE_ENV === 'production';
  const expectedToken = process.env.AGENT_API_KEY;

  if (isProd && !expectedToken) {
    console.error('FATAL: 生产环境未配置 AGENT_API_KEY 环境变量');
    return res.status(500).json({ error: 'Server Configuration Error' });
  }

  const isAuthValid = isProd
    ? (Boolean(token) && token === expectedToken)
    : (token === (expectedToken || 'automation_agent_secret') || token === 'automation_agent_secret');

  if (!isAuthValid) {
    return res.status(401).json({ error: 'Unauthorized: Invalid Agent API Key' });
  }


  const { type, title, summary, contentHtml, region, country, industry, industries, tags } = req.body;

  if (!title || !contentHtml) {
    return res.status(400).json({ error: 'Missing title or contentHtml' });
  }

  await dbClient.query('BEGIN');
  const ignoredCategories: string[] = [];

  const { cleanHtml } = await runDehydration(contentHtml, uploadImage);

  if (type === 'report') {
    // 1. 元数据及实体提取
    const meta = parseMetadata(contentHtml);

    // 2. 自动提取 HTML 的 meta 标签组装为 manualTags（支持多行、单双引号及顺逆序全模式容错）
    const extractMeta = (html: string, name: string): string => {
      const match = html.match(new RegExp(`<meta[^>]*?name=["']${name}["'][^>]*?content=(["'])([\\s\\S]*?)\\1`, 'i'));
      if (match) return match[2].trim();
      const matchRev = html.match(new RegExp(`<meta[^>]*?content=(["'])([\\s\\S]*?)\\1[^>]*?name=["']${name}["']`, 'i'));
      if (matchRev) return matchRev[2].trim();
      return '';
    };

    const metaCompanyName = extractMeta(contentHtml, 'company_name');
    const metaCompanyAliases = extractMeta(contentHtml, 'company_aliases');
    const metaCompanyWebsite = extractMeta(contentHtml, 'company_website');
    const metaCompetitors = extractMeta(contentHtml, 'competitors');
    const metaSuppliers = extractMeta(contentHtml, 'suppliers');
    const metaCustomers = extractMeta(contentHtml, 'customers');
    const metaSisterParents = extractMeta(contentHtml, 'sister_parents');
    const metaProducts = extractMeta(contentHtml, 'products');
    const metaRegions = extractMeta(contentHtml, 'regions');
    const metaChannels = extractMeta(contentHtml, 'channels');
    const metaSummary = extractMeta(contentHtml, 'summary');
    const metaCategory = extractMeta(contentHtml, 'category');
    const metaTargetReportId = extractMeta(contentHtml, 'target_report_id');
    const explicitTargetId = (req.body.target_report_id || req.body.targetReportId || metaTargetReportId || '').trim();

    const aliasesList = metaCompanyAliases
      ? metaCompanyAliases.split(/,|，|\/|\||;|；|\n/).map(s => s.trim()).filter(Boolean)
      : [];

    const manualTags = {
      companies: metaCompanyName ? [metaCompanyName] : [],
      companyAliases: aliasesList,
      companyWebsite: metaCompanyWebsite || undefined,
      competitors: metaCompetitors ? metaCompetitors.split(/,|，/).map(s => s.trim()).filter(Boolean) : [],
      suppliers: metaSuppliers ? metaSuppliers.split(/,|，/).map(s => s.trim()).filter(Boolean) : [],
      customers: metaCustomers ? metaCustomers.split(/,|，/).map(s => s.trim()).filter(Boolean) : [],
      sisters: metaSisterParents ? metaSisterParents.split(/,|，/).map(s => s.trim()).filter(Boolean) : [],
      products: metaProducts ? metaProducts.split(/,|，/).map(s => s.trim()).filter(Boolean) : [],
      regions: metaRegions ? metaRegions.split(/,|，/).map(s => s.trim()).filter(Boolean) : [],
      channels: metaChannels ? metaChannels.split(/,|，/).map(s => s.trim()).filter(Boolean) : []
    };

    const finalCategory = metaCategory || 'customer';
    const finalSummary = metaSummary || summary || '';

    // 处理地区/国家标签（严格过滤大区词汇，仅保留具体国家，如: '英国, 欧洲' -> '英国'）
    let regionsList: string[] = [];
    if (manualTags.regions && manualTags.regions.length > 0) {
      regionsList = [...manualTags.regions];
    }
    if (meta.market_region && meta.market_region !== '全球') {
      regionsList.push(meta.market_region);
    }
    const cleanCountriesList = filterCountriesOnly(regionsList);
    const finalMarketRegion = cleanCountriesList.length > 0
      ? cleanCountriesList.join(', ')
      : (regionsList.length > 0 ? regionsList.join(', ') : '全球');

    // 3. 提取并归一化实体
    const resolvedEntities = await extractAndNormalizeEntities(
      contentHtml,
      meta.title || title,
      dbClient,
      manualTags,
      meta.primary_subject,
      finalCategory
    );

    // 找到主体公司的实体 ID
    const primaryEnt = resolvedEntities.find(e => e.role === 'primary');
    const primaryEntityId = primaryEnt ? primaryEnt.id : null;

    // 处理国家名称列表
    const autoCountries = finalMarketRegion.split(',').map(s => s.trim()).filter(Boolean);
    const mappedCountries = autoCountries.map(ctyName => {
      let lookupName = ctyName;
      if (ctyName.toLowerCase() === 'germany') lookupName = '德国';
      if (ctyName.toLowerCase() === 'austria') lookupName = '奥地利';
      if (ctyName.toLowerCase() === 'usa' || ctyName.toLowerCase() === 'united states') lookupName = '美国';
      if (ctyName.toLowerCase() === 'uk' || ctyName.toLowerCase() === 'united kingdom') lookupName = '英国';
      if (ctyName.toLowerCase() === 'france') lookupName = '法国';
      return lookupName;
    });

    // 4. 元数据去重检查与插入（智能幂等与主体+国家双重覆盖设计）
    let existingReport;

    // 优先：显式指定的 target_report_id
    if (explicitTargetId) {
      const explicitRes = await dbClient.query('SELECT id FROM reports WHERE id = $1', [explicitTargetId]);
      if (explicitRes.rows.length > 0) {
        existingReport = explicitRes;
      }
    }

    if (!existingReport || existingReport.rows.length === 0) {
      if (finalCategory === 'customer' && primaryEntityId) {
        // 企业洞察报告：优先根据【主体公司 ID + 目标国家】联合查重
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
        // 兜底：按主体公司 ID 查重，锁定最早产生的第一版原始 Report ID
        if (!existingReport || existingReport.rows.length === 0) {
          existingReport = await dbClient.query(
            'SELECT id FROM reports WHERE category = $1 AND primary_entity_id = $2 ORDER BY created_at ASC LIMIT 1',
            ['customer', primaryEntityId]
          );
        }
      }
    }

    // 再次兜底：按公司所有别名深度双向匹配已有报告
    if (!existingReport || existingReport.rows.length === 0) {
      const allPossibleNames = [metaCompanyName, ...aliasesList].filter(Boolean);
      if (allPossibleNames.length > 0 && finalCategory === 'customer') {
        existingReport = await dbClient.query(
          `SELECT r.id
           FROM reports r
           JOIN report_entities re ON r.id = re.report_id AND re.role = 'primary'
           JOIN entities e ON re.entity_id = e.id
           LEFT JOIN entity_aliases ea ON e.id = ea.entity_id
           WHERE r.category = 'customer' AND (e.canonical_name = ANY($1::text[]) OR ea.alias_name = ANY($1::text[]))
           ORDER BY r.created_at ASC
           LIMIT 1`,
          [allPossibleNames]
        );
      }
    }

    if (!existingReport || existingReport.rows.length === 0) {
      // 兜底查重：根据报告标题匹配最早产生的记录
      existingReport = await dbClient.query(
        'SELECT id FROM reports WHERE title = $1 ORDER BY created_at ASC LIMIT 1',
        [meta.title || title]
      );
    }

    let newReportId: string;
    // NOTE: 更新模式下，需先保存旧 content_html 用于事务后清理孤儿图片
    let oldContentHtmlForUpdate: string | null = null;
    if (existingReport.rows.length > 0) {
      // 若已存在属于同一企业或同标题的报告，执行更新（Update）覆盖
      newReportId = existingReport.rows[0].id;
      const oldContentRes = await dbClient.query(
        'SELECT content_html FROM reports WHERE id = $1',
        [newReportId]
      );
      oldContentHtmlForUpdate = oldContentRes.rows[0]?.content_html || null;
      await dbClient.query(
        `UPDATE reports 
         SET title = $1, category = $2, market_region = $3, summary = $4, content_html = $5, primary_entity_id = $6, created_at = NOW()
         WHERE id = $7`,
        [meta.title || title, finalCategory, finalMarketRegion, finalSummary, cleanHtml, primaryEntityId, newReportId]
      );

      // 自愈修复：若历史数据库中因旧代码遗留了属于同一企业/同标题的多余重复报告，自动进行物理删除清理
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
          console.log(`Auto healed and removed history redundant report: ${dupId}`);
        }
      }
    } else {
      // 若不存在，执行新建（Insert）
      const insertReportRes = await dbClient.query(
        `INSERT INTO reports (title, category, market_region, summary, content_html, primary_entity_id)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [meta.title || title, finalCategory, finalMarketRegion, finalSummary, cleanHtml, primaryEntityId]
      );
      newReportId = insertReportRes.rows[0].id;
    }

    // 4.1 确保主体公司的全部别名严格对齐持久化到 entity_aliases 表中（先清空旧别名，再重新插入当前别名）
    // 注：全局 entity_aliases 仅作为「名称 -> 实体」匹配字典；展示层以 report_entity_aliases 为准
    if (primaryEntityId) {
      await dbClient.query(
        'DELETE FROM entity_aliases WHERE entity_id = $1',
        [primaryEntityId]
      );
      for (const alias of aliasesList) {
        await dbClient.query(
          `INSERT INTO entity_aliases (entity_id, alias_name)
           VALUES ($1, $2)
           ON CONFLICT (alias_name) DO UPDATE SET entity_id = EXCLUDED.entity_id`,
          [primaryEntityId, alias]
        );
      }

      // 按报告维度持久化别名（所见即所得：本报告展示什么，就存什么）
      await dbClient.query(
        'DELETE FROM report_entity_aliases WHERE report_id = $1 AND entity_id = $2',
        [newReportId, primaryEntityId]
      );
      for (const alias of aliasesList) {
        await dbClient.query(
          `INSERT INTO report_entity_aliases (report_id, entity_id, alias_name)
           VALUES ($1, $2, $3)
           ON CONFLICT (report_id, entity_id, alias_name) DO NOTHING`,
          [newReportId, primaryEntityId, alias]
        );
      }
    }

    // 5. 保存行业与标准品类关联 (写入 report_industries)
    await dbClient.query('DELETE FROM report_industries WHERE report_id = $1', [newReportId]);
    let autoIndustries: string[] = [];
    if (manualTags.products && manualTags.products.length > 0) {
      autoIndustries = [...manualTags.products];
    }
    const mappedNames: string[] = [];
    for (const indName of autoIndustries) {
      const mapped = getStandardCategory(indName);
      if (mapped) {
        mappedNames.push(mapped);
      } else {
        ignoredCategories.push(indName);
      }
    }
    if (mappedNames.length > 0) {
      const indIdsRes = await dbClient.query(
        `INSERT INTO industries (name)
         SELECT unnest($1::text[])
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [mappedNames]
      );
      // 参数化批量插入，替代原先的字符串拼接 SQL（防止注入）
      const industryPlaceholders: string[] = [];
      const industryParams: any[] = [];
      indIdsRes.rows.forEach((r: any, idx: number) => {
        industryPlaceholders.push(`($${idx * 2 + 1}::uuid, $${idx * 2 + 2}::uuid)`);
        industryParams.push(newReportId, r.id);
      });
      await dbClient.query(
        `INSERT INTO report_industries (report_id, industry_id)
         VALUES ${industryPlaceholders.join(',')} ON CONFLICT DO NOTHING`,
        industryParams
      );
    }

    // 6. 保存覆盖国家关联 (写入 report_countries)
    await dbClient.query('DELETE FROM report_countries WHERE report_id = $1', [newReportId]);
    if (mappedCountries.length > 0) {
      const ctyRes = await dbClient.query(
        'SELECT id FROM countries WHERE name = ANY($1)',
        [mappedCountries]
      );

      if (ctyRes.rows.length > 0) {
        // 参数化批量插入，替代原先的字符串拼接 SQL（防止注入）
        const countryPlaceholders: string[] = [];
        const countryParams: any[] = [];
        ctyRes.rows.forEach((r: any, idx: number) => {
          countryPlaceholders.push(`($${idx * 2 + 1}::uuid, $${idx * 2 + 2}::uuid)`);
          countryParams.push(newReportId, r.id);
        });
        await dbClient.query(
          `INSERT INTO report_countries (report_id, country_id)
           VALUES ${countryPlaceholders.join(',')} ON CONFLICT DO NOTHING`,
          countryParams
        );
      }
    }

    // 7. 保存实体关联角色 (写入 report_entities)
    await dbClient.query('DELETE FROM report_entities WHERE report_id = $1', [newReportId]);
    if (resolvedEntities.length > 0) {
      const selectParts: string[] = [];
      const queryParams: any[] = [newReportId];
      let paramIndex = 2;
      for (const ent of resolvedEntities) {
        selectParts.push(`($1::uuid, $${paramIndex}::uuid, $${paramIndex + 1}::varchar)`);
        queryParams.push(ent.id, ent.role);
        paramIndex += 2;
      }
      await dbClient.query(
        `INSERT INTO report_entities (report_id, entity_id, role) 
         VALUES ${selectParts.join(',')} 
         ON CONFLICT (report_id, entity_id) DO UPDATE SET role = EXCLUDED.role`,
        queryParams
      );
    }

    // 8. 自动竞品关系推理逻辑
    if (manualTags.products && manualTags.products.length > 0) {
      const productNames = manualTags.products;
      if (productNames.length === 1) {
        const companyNames: string[] = [];
        if (manualTags.companies && manualTags.companies.length > 0) {
          companyNames.push(manualTags.companies[0]);
        }
        const otherCompanies = [
          ...manualTags.competitors,
          ...manualTags.suppliers,
          ...manualTags.customers,
          ...manualTags.sisters
        ];
        const allCompanyNames = Array.from(new Set([...companyNames, ...otherCompanies]));

        if (allCompanyNames.length > 1) {
          const compRes = await dbClient.query(
            `SELECT id FROM entities WHERE canonical_name = ANY($1) AND entity_type = 'company'`,
            [allCompanyNames]
          );
          const compIds = compRes.rows.map((r: any) => r.id);
          
          const relationValues: string[] = [];
          const queryParams: any[] = [finalMarketRegion || null];
          let paramIndex = 2;
          for (let i = 0; i < compIds.length; i++) {
            for (let j = i + 1; j < compIds.length; j++) {
              relationValues.push(`($${paramIndex}::uuid, $${paramIndex + 1}::uuid, 'competitor', $1::varchar)`);
              queryParams.push(compIds[i], compIds[j]);
              paramIndex += 2;
            }
          }
          if (relationValues.length > 0) {
            await dbClient.query(
              `INSERT INTO entity_relations (entity_id_a, entity_id_b, relation_type, market_region)
               VALUES ${relationValues.join(',')}
               ON CONFLICT (entity_id_a, entity_id_b, relation_type, market_region) DO NOTHING`,
              queryParams
            );
          }
        }
      }
    }

    // 9. 建立报告拓扑关联图谱 (统一调用共享模块 computeRelationsForReport)
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
      finalMarketRegion || '全球',
      currentEntMap,
      primaryEntNameA,
      primaryEntityIdA,
      dbClient
    );

    await dbClient.query('COMMIT');

    // 事务提交成功后，安全触发竞品自动裂变发现（完全独立 try-catch 保护，不阻塞/不影响主流程）
    if (finalCategory === 'customer' && metaCompetitors) {
      try {
        const sourceComp = metaCompanyName || primaryEntNameA || title;
        await discoverAndQueueCompetitors(
          dbClient,
          metaCompetitors,
          sourceComp,
          newReportId,
          finalMarketRegion || '全球'
        );
      } catch (discErr: any) {
        console.error('[WARN] publish: 竞品自动发现处理异常 (已安全隔离):', discErr.message);
      }
    }

    // 事务提交成功后，异步清理更新前的孤儿图片（不阻塞响应）
    if (oldContentHtmlForUpdate !== null) {
      cleanOrphanedImages(oldContentHtmlForUpdate, cleanHtml).catch((err: any) => {
        console.error('[WARN] publish: 孤儿图片清理失败:', err.message);
      });
    }

    return res.status(200).json({ success: true, id: newReportId, type: 'report', ignoredCategories });
  } else {
    // 1. 写入原 articles 表以兼容原有数据分析逻辑
    const insertArticleRes = await dbClient.query(
      `INSERT INTO articles (title, summary, content_html, region, country, industry, source)
       VALUES ($1, $2, $3, $4, $5, $6, 'agent') RETURNING id`,
      [title, summary || '', cleanHtml, region || null, country || null, industry || null]
    );
    const newArticleId = insertArticleRes.rows[0].id;

    // 提取实体与归一化并写入 article_entities
    const resolvedEntities = await extractAndNormalizeEntities(contentHtml, title, dbClient, tags);
    for (const ent of resolvedEntities) {
      await dbClient.query(
        `INSERT INTO article_entities (article_id, entity_id, role)
         VALUES ($1, $2, $3) ON CONFLICT (article_id, entity_id) DO NOTHING`,
        [newArticleId, ent.id, ent.role]
      );
    }

    // 2. 双写快讯资讯表 (news) 以供前台资讯大厅展示
    const publishedAt = new Date();
    let sourceUrl: string | null = null;
    if (contentHtml.includes('href="')) {
      try {
        sourceUrl = contentHtml.split('href="')[1].split('"')[0];
      } catch (err) {}
    }

    const insertNewsRes = await dbClient.query(
      `INSERT INTO news (title, summary, content, source_url, status, published_at)
       VALUES ($1, $2, $3, $4, 'published', $5) RETURNING id`,
      [title, summary || '', cleanHtml, sourceUrl, publishedAt]
    );
    const newNewsId = insertNewsRes.rows[0].id;

    // 关联行业 (news_industries) —— 支持多标签数组，无上限关联全部 54 标准品类
    // industries: 完整多标签数组（优先）；industry: 单品类兜底兼容
    const industryList = Array.isArray(industries) && industries.length > 0
      ? industries
      : (industry ? [industry] : []);
    for (const indName of industryList) {
      const mappedCategory = getStandardCategory(indName);
      if (mappedCategory) {
        const indRes = await dbClient.query(
          'INSERT INTO industries (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id',
          [mappedCategory]
        );
        const indId = indRes.rows[0].id;
        await dbClient.query(
          'INSERT INTO news_industries (news_id, industry_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [newNewsId, indId]
        );
      } else {
        ignoredCategories.push(indName);
      }
    }

    // 关联国家 (news_countries)
    if (country) {
      let lookupName = country;
      if (country.toLowerCase() === 'germany') lookupName = '德国';
      if (country.toLowerCase() === 'austria') lookupName = '奥地利';
      if (country.toLowerCase() === 'usa' || country.toLowerCase() === 'united states') lookupName = '美国';

      const ctyRes = await dbClient.query('SELECT id FROM countries WHERE name = $1 LIMIT 1', [lookupName]);
      if (ctyRes.rows.length > 0) {
        const ctyId = ctyRes.rows[0].id;
        await dbClient.query(
          'INSERT INTO news_countries (news_id, country_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [newNewsId, ctyId]
        );
      }
    }

    await dbClient.query('COMMIT');
    return res.status(200).json({ success: true, id: newNewsId, type: 'article', ignoredCategories });
  }
}

export default withDb(publishHandler, { methods: ['POST'] });

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
};
