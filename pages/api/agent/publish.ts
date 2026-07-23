import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../lib/api-handler';
import { runDehydration, extractAndNormalizeEntities, parseMetadata } from '../../../lib/entity-extractor';
import { getStandardCategory } from '../../../lib/category-mapper';
import { uploadImage, cleanOrphanedImages } from '../../../lib/storage';
import { RETAILER_ENTITIES } from '../../../lib/entity-constants';

async function publishHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  const expectedToken = process.env.AGENT_API_KEY;

  if (!expectedToken) {
    // 未配置 API Key 时一律拒绝（不论环境），防止意外暴露
    console.error('FATAL: AGENT_API_KEY 未配置');
    return res.status(500).json({ error: '服务配置错误' });
  }
  // 使用恒定时间比较防时序攻击
  const tokenBuf = Buffer.from(token || '', 'utf8');
  const expectedBuf = Buffer.from(expectedToken, 'utf8');
  if (tokenBuf.length !== expectedBuf.length || !require('crypto').timingSafeEqual(tokenBuf, expectedBuf)) {
    return res.status(401).json({ error: 'Unauthorized: Invalid Agent API Key' });
  }

  const { type, title, summary, contentHtml, region, country, industry, tags } = req.body;

  if (!title || !contentHtml) {
    return res.status(400).json({ error: 'Missing title or contentHtml' });
  }

  await dbClient.query('BEGIN');
  const ignoredCategories: string[] = [];

  const { cleanHtml } = await runDehydration(contentHtml, uploadImage);

  if (type === 'report') {
    // 1. 元数据及实体提取
    const meta = parseMetadata(contentHtml);

    // 2. 自动提取 HTML 的 meta 标签组装为 manualTags
    const extractMeta = (html: string, name: string): string => {
      const match = html.match(new RegExp(`<meta[^>]*?name=["']${name}["'][^>]*?content=["']([^"']*)["']`, 'i'));
      if (match) return match[1].trim();
      const matchRev = html.match(new RegExp(`<meta[^>]*?content=["']([^"']*)["'][^>]*?name=["']${name}["']`, 'i'));
      if (matchRev) return matchRev[1].trim();
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

    const aliasesList = metaCompanyAliases
      ? metaCompanyAliases.split(/,|，|\/|\||;|；/).map(s => s.trim()).filter(Boolean)
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

    // 处理地区/国家标签
    let regionsList: string[] = [];
    if (manualTags.regions && manualTags.regions.length > 0) {
      regionsList = [...manualTags.regions];
    }
    if (meta.market_region && meta.market_region !== '全球') {
      regionsList.push(meta.market_region);
    }
    if (regionsList.length === 0) {
      regionsList = [meta.market_region || '全球'];
    }
    const finalMarketRegion = Array.from(new Set(regionsList)).join(', ');

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

    // 4. 元数据去重检查与插入（幂等性设计）
    const existingReport = await dbClient.query(
      'SELECT id FROM reports WHERE title = $1',
      [meta.title || title]
    );

    let newReportId: string;
    // NOTE: 更新模式下，需先保存旧 content_html 用于事务后清理孤儿图片
    let oldContentHtmlForUpdate: string | null = null;
    if (existingReport.rows.length > 0) {
      // 若相同标题的报告已存在，执行更新（Update）覆盖
      newReportId = existingReport.rows[0].id;
      const oldContentRes = await dbClient.query(
        'SELECT content_html FROM reports WHERE id = $1',
        [newReportId]
      );
      oldContentHtmlForUpdate = oldContentRes.rows[0]?.content_html || null;
      await dbClient.query(
        `UPDATE reports 
         SET category = $1, market_region = $2, summary = $3, content_html = $4, primary_entity_id = $5, created_at = NOW()
         WHERE id = $6`,
        [finalCategory, finalMarketRegion, finalSummary, cleanHtml, primaryEntityId, newReportId]
      );
    } else {
      // 若不存在，执行新建（Insert）
      const insertReportRes = await dbClient.query(
        `INSERT INTO reports (title, category, market_region, summary, content_html, primary_entity_id)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [meta.title || title, finalCategory, finalMarketRegion, finalSummary, cleanHtml, primaryEntityId]
      );
      newReportId = insertReportRes.rows[0].id;
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
    const autoCountries = finalMarketRegion.split(',').map(s => s.trim()).filter(Boolean);
    if (autoCountries.length > 0) {
      const mappedCountries = autoCountries.map(ctyName => {
        let lookupName = ctyName;
        if (ctyName.toLowerCase() === 'germany') lookupName = '德国';
        if (ctyName.toLowerCase() === 'austria') lookupName = '奥地利';
        if (ctyName.toLowerCase() === 'usa' || ctyName.toLowerCase() === 'united states') lookupName = '美国';
        return lookupName;
      });

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

    // 9. 建立报告拓扑关联图谱 (写入 relations)
    // 遵循用户定义逻辑：
    // 1. 竞争: A 显式提及 B 为 competitor (或反之)，且剔除渠道商/超市
    // 2. 供销: A 提及 B 为 supplier (或 B 提及 A 为 customer/channel)
    // 3. 经营: 仅存在于【品类报告】与【公司报告】之间
    // 4. 提及: 姐妹公司 或 共享 GTB 大品类
    // 优先级: 竞争 > 供销 > 经营 > 提及
    
    // 获取当前报告 A 所有的实体及其 role
    const currentRepEntities = await dbClient.query(
      `SELECT re.entity_id, re.role, e.canonical_name, e.entity_type
       FROM report_entities re
       JOIN entities e ON re.entity_id = e.id
       WHERE re.report_id = $1`,
      [newReportId]
    );

    // 查询所有其他报告 B 及其主体实体
    const otherReportsRes = await dbClient.query(
      `SELECT r.id AS b_report_id, r.category AS b_category, r.primary_entity_id AS b_primary_id,
              e.canonical_name AS b_primary_name
       FROM reports r
       LEFT JOIN entities e ON r.primary_entity_id = e.id
       WHERE r.id != $1`,
      [newReportId]
    );

    // 获取所有报告关联的实体角色组合
    const allRepEntitiesRes = await dbClient.query(
      `SELECT re.report_id, re.entity_id, re.role, e.canonical_name, e.entity_type
       FROM report_entities re
       JOIN entities e ON re.entity_id = e.id`
    );

    const otherRepEntMap = new Map<string, Map<string, { role: string; canonical_name: string; entity_type: string }>>();
    for (const row of allRepEntitiesRes.rows) {
      if (!otherRepEntMap.has(row.report_id)) {
        otherRepEntMap.set(row.report_id, new Map());
      }
      otherRepEntMap.get(row.report_id)!.set(row.entity_id, {
        role: row.role,
        canonical_name: row.canonical_name,
        entity_type: row.entity_type
      });
    }

    const currentEntMap = new Map<string, { role: string; canonical_name: string; entity_type: string }>();
    for (const row of currentRepEntities.rows) {
      currentEntMap.set(row.entity_id, {
        role: row.role,
        canonical_name: row.canonical_name,
        entity_type: row.entity_type
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

      let sourceReportId = newReportId;
      let targetReportId = bReportId;

      // ---- 优先级 1: 竞争关系 (Competitor) ----
      const aHasBAsComp = bPrimaryId && currentEntMap.has(bPrimaryId) && currentEntMap.get(bPrimaryId)!.role === 'competitor';
      const bHasAAsComp = primaryEntityId && entMapB.has(primaryEntityId) && entMapB.get(primaryEntityId)!.role === 'competitor';

      const isRetailerA = RETAILER_ENTITIES.has(primaryEntNameA);
      const isRetailerB = RETAILER_ENTITIES.has(bPrimaryName);
      const isCrossRetailerBrand = (isRetailerA !== isRetailerB);

      if ((aHasBAsComp || bHasAAsComp) && !isCrossRetailerBrand) {
        finalRelType = 'competitor';
        finalRelKey = aHasBAsComp 
          ? (otherRep.b_primary_name || '同业竞争') 
          : (primaryEnt ? primaryEnt.canonical_name : '同业竞争');
        if (newReportId > bReportId) {
          sourceReportId = bReportId;
          targetReportId = newReportId;
        }
      }

      // ---- 优先级 2: 供销关系 (Supplier) ----
      // 规则 1：必须 从 供货方(供应商)  ===>  流向  采购方(客户/渠道)
      // 规则 2：仅限【公司报告】与【公司报告】之间！品类报告绝不能作为供销连线实体。
      const isBothCompanyRep = (finalCategory === 'customer' && bCategory === 'customer');

      if (!finalRelType && isBothCompanyRep) {
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
          targetReportId = newReportId;
        } else if (bHasAAsSupplier || aHasBAsCustomerOrChannel) {
          // A 是供应商，B 是客户/渠道 => 流向是 A (供应商) -> B (渠道)
          finalRelType = 'supplier';
          finalRelKey = primaryEnt ? primaryEnt.canonical_name : '供销渠道';
          sourceReportId = newReportId;
          targetReportId = bReportId;
        }
      }

      // ---- 优先级 3: 经营关系 (Operation) ----
      // 仅存在于【品类报告】与【公司报告】之间！
      // 规则：公司报告 (经营主体) ===> 品类报告 (被经营品类)
      if (!finalRelType) {
        const isOneProductOneCompany = (finalCategory === 'product' && bCategory === 'customer') || 
                                       (finalCategory === 'customer' && bCategory === 'product');
        if (isOneProductOneCompany) {
          const prodTitle = finalCategory === 'product' ? cleanTitle : otherRep.b_title;
          let hasProductOverlap = false;
          for (const [entIdA] of currentEntMap.entries()) {
            if (entMapB.has(entIdA)) {
              hasProductOverlap = true;
              break;
            }
          }
          if (hasProductOverlap) {
            const { getStandardCategory } = require('../../lib/category-mapper');
            finalRelType = 'operation';
            finalRelKey = getStandardCategory(prodTitle) || '品类经营';
            if (finalCategory === 'customer') {
              sourceReportId = newReportId;
              targetReportId = bReportId;
            } else {
              sourceReportId = bReportId;
              targetReportId = newReportId;
            }
          }
        }
      }

      // ---- 优先级 4: 提及关系 (Mention) ----
      if (!finalRelType) {
        const aHasBAsSister = bPrimaryId && currentEntMap.has(bPrimaryId) && currentEntMap.get(bPrimaryId)!.role === 'sister_parent';
        const bHasAAsSister = primaryEntityId && entMapB.has(primaryEntityId) && entMapB.get(primaryEntityId)!.role === 'sister_parent';

        if (aHasBAsSister || bHasAAsSister) {
          finalRelType = 'mention';
          finalRelKey = '关联/姐妹公司';
          if (newReportId > bReportId) {
            sourceReportId = bReportId;
            targetReportId = newReportId;
          }
        } else {
          // 共享 GTB 标准大品类 (products)
          for (const [entIdA, dataA] of currentEntMap.entries()) {
            if (dataA.role === 'product' && entMapB.has(entIdA) && entMapB.get(entIdA)!.role === 'product') {
              finalRelType = 'mention';
              finalRelKey = dataA.canonical_name;
              if (newReportId > bReportId) {
                sourceReportId = bReportId;
                targetReportId = newReportId;
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
          [sourceReportId, targetReportId, finalRelKey, finalMarketRegion, finalRelType]
        );
      }
    }

    await dbClient.query('COMMIT');

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

    // 关联行业 (news_industries)
    if (industry) {
      const mappedCategory = getStandardCategory(industry);
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
        ignoredCategories.push(industry);
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
