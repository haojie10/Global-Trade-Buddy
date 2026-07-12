import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../lib/api-handler';
import { runDehydration, extractAndNormalizeEntities } from '../../../lib/entity-extractor';

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

  // 本地/开发环境降级：将图片保存到本地 public/uploads 目录下
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

  const { cleanHtml } = await runDehydration(contentHtml, mockUpload);

  if (type === 'report') {
    // 写入现有报告表
    const insertReportRes = await dbClient.query(
      `INSERT INTO reports (title, category, market_region, summary, content_html)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [title, 'product', market_region_helper(region, country), summary || '', cleanHtml]
    );
    const newReportId = insertReportRes.rows[0].id;
    
    const resolvedEntities = await extractAndNormalizeEntities(contentHtml, title, dbClient, tags);
    for (const ent of resolvedEntities) {
      await dbClient.query(
        `INSERT INTO report_entities (report_id, entity_id, role) 
         VALUES ($1, $2, $3) ON CONFLICT (report_id, entity_id) DO NOTHING`,
        [newReportId, ent.id, ent.role]
      );
    }
    await dbClient.query('COMMIT');
    return res.status(200).json({ success: true, id: newReportId, type: 'report' });
  } else {
    // 写入资讯表
    const insertArticleRes = await dbClient.query(
      `INSERT INTO articles (title, summary, content_html, region, country, industry, source)
       VALUES ($1, $2, $3, $4, $5, $6, 'agent') RETURNING id`,
      [title, summary || '', cleanHtml, region || null, country || null, industry || null]
    );
    const newArticleId = insertArticleRes.rows[0].id;

    // 提取实体与归一化
    const resolvedEntities = await extractAndNormalizeEntities(contentHtml, title, dbClient, tags);
    for (const ent of resolvedEntities) {
      await dbClient.query(
        `INSERT INTO article_entities (article_id, entity_id, role)
         VALUES ($1, $2, $3) ON CONFLICT (article_id, entity_id) DO NOTHING`,
        [newArticleId, ent.id, ent.role]
      );
    }
    await dbClient.query('COMMIT');
    return res.status(200).json({ success: true, id: newArticleId, type: 'article' });
  }
}

function market_region_helper(region?: string, country?: string) {
  if (region && country) return `${region}, ${country}`;
  return region || country || '全球';
}

export default withDb(publishHandler, { methods: ['POST'] });
