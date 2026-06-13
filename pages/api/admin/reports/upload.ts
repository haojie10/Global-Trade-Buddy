import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../../lib/db';

// 1. 从 HTML 字符串中提取元数据和专有名词（客户名、品类名等）
export function parseMetadata(html: string) {
  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
  const categoryMatch = html.match(/<meta[^>]*?name="category"[^>]*?content="([^"]*?)"/i);
  const regionMatch = html.match(/<meta[^>]*?name="market_region"[^>]*?content="([^"]*?)"/i);
  const summaryMatch = html.match(/<meta[^>]*?name="summary"[^>]*?content="([^"]*?)"/i);

  const title = titleMatch ? titleMatch[1].trim() : '未命名报告';
  const category = categoryMatch ? categoryMatch[1].trim() : 'customer';
  const market_region = regionMatch ? regionMatch[1].trim() : '全球';
  const summary = summaryMatch ? summaryMatch[1].trim() : '';

  // 简单的专有名词实体抽取（模拟 NER）
  // 匹配常见的中国外贸相关实体，或正文里的 <h1>, <h2> 等大字标题
  const entities: string[] = [];
  
  // 提取 <h1>/<h2> 里的名词
  const headerMatches = html.matchAll(/<h[12]>[^<]*?(A 公司|铝合金轮毂|欧美汽配|刹车片|发动机|螺丝)[^<]*?<\/h[12]>/gi);
  for (const match of Array.from(headerMatches)) {
    const text = match[0].replace(/<[^>]*>/g, '').trim();
    if (text.includes('A 公司')) entities.push('A 公司');
    if (text.includes('铝合金轮毂')) entities.push('铝合金轮毂');
  }

  // 兜底提取：在标题和正文里检索常见关键词
  const commonKeywords = ['A 公司', '铝合金轮毂', '刹车片', '欧美汽配', '汇率风险', '运费波动'];
  commonKeywords.forEach(kw => {
    if (html.includes(kw) && !entities.includes(kw)) {
      entities.push(kw);
    }
  });

  return {
    title,
    category,
    market_region,
    summary,
    entities,
  };
}

// 2. 剥离 Base64 大图并替换为云存储 CDN 地址
type UploadFn = (buffer: Buffer, mimeType: string) => Promise<string>;

export async function runDehydration(html: string, uploadFn: UploadFn) {
  let cleanHtml = html;
  let imageCount = 0;
  
  // 匹配任何 data:image/([a-zA-Z]*);base64, 格式的正则，兼容 src="...", url('...')
  const base64Regex = /data:image\/([a-zA-Z]*);base64,([^"'\)]*)/g;
  let match;
  
  const replacements: { raw: string; url: string }[] = [];
  
  while ((match = base64Regex.exec(html)) !== null) {
    const ext = match[1];
    const base64Data = match[2];
    const buffer = Buffer.from(base64Data, 'base64');
    
    const mimeType = `image/${ext}`;
    const url = await uploadFn(buffer, mimeType);
    
    replacements.push({
      raw: match[0],
      url: url
    });
    imageCount++;
  }
  
  replacements.forEach(rep => {
    cleanHtml = cleanHtml.replace(rep.raw, rep.url);
  });
  
  return {
    cleanHtml,
    imageCount,
  };
}

// 3. 提取并归一化实体
export async function extractAndNormalizeEntities(
  html: string,
  title: string,
  dbClient: any
): Promise<{ id: string; canonical_name: string }[]> {
  // 1. 从 entities 和 entity_aliases 表读取所有已知的实体名和别名
  const entitiesRes = await dbClient.query(`
    SELECT e.id, e.canonical_name, e.entity_type, ea.alias_name
    FROM entities e
    LEFT JOIN entity_aliases ea ON e.id = ea.entity_id
  `);

  const entityMap = new Map<string, { id: string; canonical_name: string; entity_type: string; matches: Set<string> }>();
  for (const row of entitiesRes.rows) {
    let ent = entityMap.get(row.id);
    if (!ent) {
      ent = {
        id: row.id,
        canonical_name: row.canonical_name,
        entity_type: row.entity_type,
        matches: new Set<string>()
      };
      ent.matches.add(row.canonical_name);
      entityMap.set(row.id, ent);
    }
    if (row.alias_name) {
      ent.matches.add(row.alias_name);
    }
  }

  const matchedEntities = new Map<string, { id: string; canonical_name: string }>();
  const searchContent = title + ' ' + html;

  // 2. 检索已知实体和别名
  for (const ent of entityMap.values()) {
    for (const matchStr of ent.matches) {
      if (searchContent.includes(matchStr)) {
        matchedEntities.set(ent.id, { id: ent.id, canonical_name: ent.canonical_name });
        break;
      }
    }
  }

  // 3. 正文匹配兜底逻辑：继续在标题和正文里检索常见关键词，如果 HTML 包含它们且它们不在已提取列表中，将其作为实体提取。
  const commonKeywords = ['A 公司', '铝合金轮毂', '刹车片', '欧美汽配', '汇率风险', '运费波动'];
  const blacklist = ['公司', '工厂', '超市', '产品', '客户', '供应商', '采购商', '贸易'];
  const keywordTypeMap: Record<string, string> = {
    'A 公司': 'company',
    'B 公司': 'company',
    '丰田汽车': 'company',
    '铝合金轮毂': 'product',
    '刹车片': 'product',
    '紧固件': 'product',
    '发光壁挂绿植环': 'product',
    '中东非公路工程车桥': 'product',
    '运费波动': 'product',
    '欧美汽配': 'product',
    '汇率风险': 'product',
    '配件超市': 'channel',
    '一级供应链': 'channel'
  };

  // 获取已提取实体 canonical_name 集合，用于判断是否已匹配
  const extractedNames = new Set<string>();
  for (const ent of matchedEntities.values()) {
    extractedNames.add(ent.canonical_name);
  }

  for (const kw of commonKeywords) {
    if (searchContent.includes(kw) && !extractedNames.has(kw)) {
      const type = keywordTypeMap[kw] || 'product';
      const insertRes = await dbClient.query(
        `INSERT INTO entities (canonical_name, entity_type) 
         VALUES ($1, $2) 
         ON CONFLICT (canonical_name) DO UPDATE SET entity_type = EXCLUDED.entity_type
         RETURNING id`,
        [kw, type]
      );
      const entId = insertRes.rows[0].id;
      matchedEntities.set(entId, { id: entId, canonical_name: kw });
      extractedNames.add(kw);
    }
  }

  // 4. 过滤黑名单词：任何提取出来的实体如果存在于 ['公司', '工厂', '超市', '产品', '客户', '供应商', '采购商', '贸易'] 中，必须被完全丢弃。
  const result: { id: string; canonical_name: string }[] = [];
  for (const ent of matchedEntities.values()) {
    if (blacklist.includes(ent.canonical_name)) {
      continue;
    }
    result.push(ent);
  }

  return result;
}

// 4. API 处理主函数
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { rawHtml } = req.body;
  if (!rawHtml) {
    return res.status(400).json({ error: 'Missing rawHtml parameter' });
  }

  const dbClient = await pool.connect();

  try {
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

    await dbClient.query('BEGIN');

    // 3. 提取并归一化实体
    const resolvedEntities = await extractAndNormalizeEntities(rawHtml, meta.title, dbClient);

    // 4. 写入报告表
    const insertReportRes = await dbClient.query(
      `INSERT INTO reports (title, category, market_region, summary, content_html) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id`,
      [meta.title, meta.category, meta.market_region, meta.summary, cleanHtml]
    );
    const newReportId = insertReportRes.rows[0].id;

    // 5. 写入 report_entities 表
    for (const ent of resolvedEntities) {
      await dbClient.query(
        `INSERT INTO report_entities (report_id, entity_id) 
         VALUES ($1, $2) 
         ON CONFLICT (report_id, entity_id) DO NOTHING`,
        [newReportId, ent.id]
      );
    }

    // 6. 在 relations 表中建边并携带 market_region 属性
    if (resolvedEntities.length > 0) {
      const entityIds = resolvedEntities.map(e => e.id);
      const sharedReportsRes = await dbClient.query(
        `SELECT DISTINCT re.report_id, e.canonical_name
         FROM report_entities re
         JOIN entities e ON re.entity_id = e.id
         WHERE re.entity_id = ANY($1) AND re.report_id != $2`,
        [entityIds, newReportId]
      );

      for (const row of sharedReportsRes.rows) {
        await dbClient.query(
          `INSERT INTO relations (report_id_a, report_id_b, relation_key, market_region, relation_type) 
           VALUES ($1, $2, $3, $4, $5)`,
          [newReportId, row.report_id, row.canonical_name, meta.market_region, 'produces']
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
  } catch (err: any) {
    await dbClient.query('ROLLBACK');
    return res.status(500).json({ error: err.message });
  } finally {
    dbClient.release();
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
};
