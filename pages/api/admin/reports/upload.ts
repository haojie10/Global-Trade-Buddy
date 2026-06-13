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

// 3. API 处理主函数
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

    // 3. 写入报告表
    const insertReportRes = await dbClient.query(
      `INSERT INTO reports (title, category, market_region, summary, content_html) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id`,
      [meta.title, meta.category, meta.market_region, meta.summary, cleanHtml]
    );
    const newReportId = insertReportRes.rows[0].id;

    // 4. 自动建立关系图谱 (Relations)
    // 查找其他已经包含这组实体的历史报告
    if (meta.entities.length > 0) {
      // 在 reports 表中查找标题或内容里包含同类关键词的报告，建立连接
      const relatedReportsRes = await dbClient.query(
        `SELECT id, title FROM reports WHERE id != $1`,
        [newReportId]
      );
      
      for (const relReport of relatedReportsRes.rows) {
        // 简易检查是否有重合的实体
        for (const ent of meta.entities) {
          // 如果对方报告中包含该实体，且没建立过连接，则在 relations 表中建边
          if (relReport.title.includes(ent)) {
            await dbClient.query(
              `INSERT INTO relations (report_id_a, report_id_b, relation_key) 
               VALUES ($1, $2, $3)`,
              [newReportId, relReport.id, ent]
            );
          }
        }
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
