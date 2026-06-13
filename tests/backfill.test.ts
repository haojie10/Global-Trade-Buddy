import { expect, it, describe, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { main as runBackfill } from '../bin/backfill-entities';

describe('Database backfill process', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({
      connectionString: 'postgresql://postgres:postgres@localhost:5432/postgres'
    });
    await client.connect();

    // 检查并安全地插入测试报告数据，如果已经存在则不插入，也不删除任何已有报告
    const moscoCheck = await client.query("SELECT id FROM reports WHERE title LIKE '%Mosco%'");
    let moscoId;
    if (moscoCheck.rows.length === 0) {
      const res = await client.query(
        `INSERT INTO reports (title, category, market_region, summary, content_html) 
         VALUES ('Mosco Shipping and Freight Report', 'product', '全球', 'Summary', '由于运费波动影响，航线有所调整。') 
         RETURNING id`
      );
      moscoId = res.rows[0].id;
    } else {
      moscoId = moscoCheck.rows[0].id;
    }

    const plantCheck = await client.query("SELECT id FROM reports WHERE title LIKE '%绿植%'");
    let plantId;
    if (plantCheck.rows.length === 0) {
      const res = await client.query(
        `INSERT INTO reports (title, category, market_region, summary, content_html) 
         VALUES ('智能绿植装饰市场分析', 'product', '欧盟', 'Summary', '发光壁挂绿植环作为新品类受到关注。') 
         RETURNING id`
      );
      plantId = res.rows[0].id;
    } else {
      plantId = plantCheck.rows[0].id;
    }

    // 安全地检查并插入 relations 关联
    const relationCheck = await client.query("SELECT id FROM relations LIMIT 1");
    if (relationCheck.rows.length === 0 && moscoId && plantId) {
      await client.query(
        `INSERT INTO relations (report_id_a, report_id_b, relation_key) 
         VALUES ($1, $2, '运费波动')`,
        [moscoId, plantId]
      );
    }
  });

  afterAll(async () => {
    await client.end();
  });

  it('should run backfill successfully and associate existing reports with entities', async () => {
    // 清除现有的 report_entities 关联来进行纯净测试（但不要删除 reports 表！）
    await client.query('DELETE FROM report_entities');
    
    // 运行 backfill
    await runBackfill();

    // 检查是否成功关联了实体
    const reportEnts = await client.query('SELECT COUNT(*) FROM report_entities');
    const count = parseInt(reportEnts.rows[0].count);
    expect(count).toBeGreaterThan(0);

    // 检查 Mosco 报告是否正确关联了 '运费波动'
    const moscoRes = await client.query(`
      SELECT e.canonical_name 
      FROM report_entities re
      JOIN entities e ON re.entity_id = e.id
      JOIN reports r ON re.report_id = r.id
      WHERE r.title LIKE '%Mosco%'
    `);
    const moscoEntities = moscoRes.rows.map(row => row.canonical_name);
    expect(moscoEntities).toContain('运费波动');

    // 检查绿植报告是否关联了 '发光壁挂绿植环'
    const plantRes = await client.query(`
      SELECT e.canonical_name 
      FROM report_entities re
      JOIN entities e ON re.entity_id = e.id
      JOIN reports r ON re.report_id = r.id
      WHERE r.title LIKE '%绿植%'
    `);
    const plantEntities = plantRes.rows.map(row => row.canonical_name);
    expect(plantEntities).toContain('发光壁挂绿植环');
  });
});
