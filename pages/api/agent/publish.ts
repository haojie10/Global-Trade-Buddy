import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../lib/api-handler';
import { runDehydration, extractAndNormalizeEntities, parseMetadata } from '../../../lib/entity-extractor';
import { getStandardCategory } from '../../../lib/category-mapper';

async function publishHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  const expectedToken = process.env.AGENT_API_KEY || 'test_agent_secret';

  if (!token || token !== expectedToken) {
    return res.status(401).json({ error: 'Unauthorized: Invalid Agent API Key' });
  }

  const { type, title, summary, contentHtml, region, country, industry, tags } = req.body;

  if (!title || !contentHtml) {
    return res.status(400).json({ error: 'Missing title or contentHtml' });
  }

  await dbClient.query('BEGIN');

  // 优先上传至 Supabase Storage，若无配置则降级保存到本地 public/uploads 目录下
  const mockUpload = async (buffer: Buffer, mime: string) => {
    const ext = mime.split('/')[1] || 'png';
    const fileName = `img_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      const uploadUrl = `${supabaseUrl}/storage/v1/object/report-images/${fileName}`;
      try {
        const uploadRes = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': mime,
            'x-upsert': 'true'
          },
          body: buffer as any
        });

        if (uploadRes.ok) {
          return `${supabaseUrl}/storage/v1/object/public/report-images/${fileName}`;
        }
      } catch (err) {
        console.error('Failed to upload to Supabase, falling back to local storage:', err);
      }
    }

    const fs = require('fs');
    const path = require('path');
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    fs.writeFileSync(path.join(uploadDir, fileName), buffer);
    return `/uploads/${fileName}`;
  };

  const { cleanHtml } = await runDehydration(contentHtml, mockUpload);

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

    const manualTags = {
      companies: metaCompanyName ? [metaCompanyName] : [],
      companyWebsite: metaCompanyWebsite || undefined,
      competitors: metaCompetitors ? metaCompetitors.split(',').map(s => s.trim()).filter(Boolean) : [],
      suppliers: metaSuppliers ? metaSuppliers.split(',').map(s => s.trim()).filter(Boolean) : [],
      customers: metaCustomers ? metaCustomers.split(',').map(s => s.trim()).filter(Boolean) : [],
      sisters: metaSisterParents ? metaSisterParents.split(',').map(s => s.trim()).filter(Boolean) : [],
      products: metaProducts ? metaProducts.split(',').map(s => s.trim()).filter(Boolean) : [],
      regions: metaRegions ? metaRegions.split(',').map(s => s.trim()).filter(Boolean) : [],
      channels: metaChannels ? metaChannels.split(',').map(s => s.trim()).filter(Boolean) : []
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

    // 4. 插入 reports 主表
    const insertReportRes = await dbClient.query(
      `INSERT INTO reports (title, category, market_region, summary, content_html, primary_entity_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [meta.title || title, finalCategory, finalMarketRegion, finalSummary, cleanHtml, primaryEntityId]
    );
    const newReportId = insertReportRes.rows[0].id;

    // 5. 保存行业与标准品类关联 (写入 report_industries)
    await dbClient.query('DELETE FROM report_industries WHERE report_id = $1', [newReportId]);
    let autoIndustries: string[] = [];
    if (manualTags.products && manualTags.products.length > 0) {
      autoIndustries = [...manualTags.products];
    }
    for (const indName of autoIndustries) {
      const mappedCategory = getStandardCategory(indName) || indName;
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

    // 6. 保存覆盖国家关联 (写入 report_countries)
    await dbClient.query('DELETE FROM report_countries WHERE report_id = $1', [newReportId]);
    const autoCountries = finalMarketRegion.split(',').map(s => s.trim()).filter(Boolean);
    for (const ctyName of autoCountries) {
      let lookupName = ctyName;
      if (ctyName.toLowerCase() === 'germany') lookupName = '德国';
      if (ctyName.toLowerCase() === 'austria') lookupName = '奥地利';
      if (ctyName.toLowerCase() === 'usa' || ctyName.toLowerCase() === 'united states') lookupName = '美国';
      
      const ctyRes = await dbClient.query('SELECT id FROM countries WHERE name = $1 LIMIT 1', [lookupName]);
      if (ctyRes.rows.length > 0) {
        const ctyId = ctyRes.rows[0].id;
        await dbClient.query(
          'INSERT INTO report_countries (report_id, country_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [newReportId, ctyId]
        );
      }
    }

    // 7. 保存实体关联角色 (写入 report_entities)
    for (const ent of resolvedEntities) {
      await dbClient.query(
        `INSERT INTO report_entities (report_id, entity_id, role) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (report_id, entity_id) DO UPDATE SET role = EXCLUDED.role`,
        [newReportId, ent.id, ent.role]
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

    // 9. 建立报告拓扑关联图谱 (写入 relations)
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
    return res.status(200).json({ success: true, id: newReportId, type: 'report' });
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
      const mappedCategory = getStandardCategory(industry) || industry;
      const indRes = await dbClient.query(
        'INSERT INTO industries (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id',
        [mappedCategory]
      );
      const indId = indRes.rows[0].id;
      await dbClient.query(
        'INSERT INTO news_industries (news_id, industry_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [newNewsId, indId]
      );
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
    return res.status(200).json({ success: true, id: newNewsId, type: 'article' });
  }
}

function market_region_helper(region?: string, country?: string) {
  if (region && country) return `${region}, ${country}`;
  return region || country || '全球';
}

export default withDb(publishHandler, { methods: ['POST'] });

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
};
