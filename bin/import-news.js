const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const payloadPath = path.join(
    '/Users/jason/Documents/Antigravity/Project/Globaltradebuddy文档/.agents/skills/industry-news-collector/examples/news-payload.json'
  );
  
  if (!fs.existsSync(payloadPath)) {
    console.error(`❌ Payload file not found at: ${payloadPath}`);
    process.exit(1);
  }

  const newsData = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
  console.log(`Loaded ${newsData.length} news items for import...`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    for (const item of newsData) {
      console.log(`Importing: "${item.title}"`);

      // 1. 插入 news 表
      const newsRes = await client.query(
        `INSERT INTO news (title, summary, content, source_url, status, published_at)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [
          item.title,
          item.summary,
          item.content,
          item.source_url,
          item.status,
          item.status === 'published' ? new Date() : null
        ]
      );
      const newsId = newsRes.rows[0].id;

      // 2. 插入 news_industries 关联
      if (Array.isArray(item.industry_ids)) {
        for (const indId of item.industry_ids) {
          await client.query(
            'INSERT INTO news_industries (news_id, industry_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [newsId, indId]
          );
        }
      }

      // 3. 插入 news_countries 关联
      if (Array.isArray(item.country_ids)) {
        for (const ctyId of item.country_ids) {
          await client.query(
            'INSERT INTO news_countries (news_id, country_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [newsId, ctyId]
          );
        }
      }
    }

    await client.query('COMMIT');
    console.log('\n✅ All 10 news items imported successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error during import:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
