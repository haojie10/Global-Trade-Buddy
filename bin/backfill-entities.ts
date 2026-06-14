import { Client } from 'pg';
import { ENTITY_DEFINITIONS, BLACKLIST } from '../lib/entity-constants';

export async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres'
  });
  
  try {
    await client.connect();

    console.log('Starting backfill for existing reports...');
    
    // 1. 获取所有报告
    const reportsRes = await client.query('SELECT id, title, content_html, market_region FROM reports');
    
    for (const report of reportsRes.rows) {
      const text = report.title + ' ' + report.content_html;
      
      // 提取并匹配实体
      for (const kw of ENTITY_DEFINITIONS) {
        // 检查黑名单
        if (BLACKLIST.includes(kw.name)) continue;

        let hasMatch = false;
        for (const m of kw.match) {
          if (text.includes(m)) {
            hasMatch = true;
            break;
          }
        }

        if (hasMatch) {
          // 获取或创建主实体
          const entRes = await client.query('SELECT id FROM entities WHERE canonical_name = $1', [kw.name]);
          let entId;
          if (entRes.rows.length === 0) {
            const insertEnt = await client.query(
              'INSERT INTO entities (canonical_name, entity_type) VALUES ($1, $2) RETURNING id',
              [kw.name, kw.type]
            );
            entId = insertEnt.rows[0].id;
          } else {
            entId = entRes.rows[0].id;
          }

          // 插入报告-实体映射
          await client.query(
            'INSERT INTO report_entities (report_id, entity_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [report.id, entId]
          );
          console.log(`Associated Report "${report.title}" with Entity "${kw.name}"`);
        }
      }
    }

    // 2. 补偿 relations 表属性 - 优化为单条 SQL 批量更新 (防止 N+1 问题)
    await client.query(`
      UPDATE relations 
      SET market_region = COALESCE(reports.market_region, '全球'), 
          relation_type = 'produces'
      FROM reports 
      WHERE relations.report_id_a = reports.id
    `);

    console.log('Backfill completed successfully!');
  } finally {
    await client.end();
  }
}

if (typeof require !== 'undefined' && require.main === module) {
  main().catch(console.error);
}
