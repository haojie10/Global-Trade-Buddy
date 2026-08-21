/**
 * 腾讯云轻量服务器本地运维脚本：一键清洗被污染的实体与别名
 * 运行方式: node bin/clean-contaminated-entities.js
 */
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function runClean() {
  const client = await pool.connect();
  try {
    console.log('🚀 开始执行实体库污染清洗与拆分修复...');
    await client.query('BEGIN');

    // 1. 确保核心知名实体独立存在
    const upsertEntity = async (canonicalName, entityType) => {
      const res = await client.query(
        `INSERT INTO entities (canonical_name, entity_type)
         VALUES ($1, $2)
         ON CONFLICT (canonical_name) DO UPDATE SET entity_type = EXCLUDED.entity_type
         RETURNING id`,
        [canonicalName, entityType]
      );
      return res.rows[0].id;
    };

    const aldiNordId = await upsertEntity('ALDI Einkauf SE & Co. oHG', 'company');
    const aldiSudId = await upsertEntity('ALDI SÜD', 'company');
    const walmartId = await upsertEntity('Walmart', 'company');
    const dgId = await upsertEntity('Dollar General', 'company');
    const traderJoesId = await upsertEntity("Trader Joe's", 'company');

    console.log('✅ 独立核心实体已就绪:');
    console.log(`   - ALDI Nord: ${aldiNordId}`);
    console.log(`   - ALDI SÜD: ${aldiSudId}`);
    console.log(`   - Walmart: ${walmartId}`);
    console.log(`   - Dollar General: ${dgId}`);

    // 2. 严格对齐并分配各实体的专属合法别名
    const syncAliases = async (entityId, aliases) => {
      // 1. 清理不在列表中的旧别名
      await client.query(
        'DELETE FROM entity_aliases WHERE entity_id = $1 AND alias_name != ALL($2)',
        [entityId, aliases]
      );
      // 2. 插入或更新合法别名
      for (const a of aliases) {
        await client.query(
          `INSERT INTO entity_aliases (entity_id, alias_name)
           VALUES ($1, $2)
           ON CONFLICT (alias_name) DO UPDATE SET entity_id = EXCLUDED.entity_id`,
          [entityId, a]
        );
      }
    };

    await syncAliases(walmartId, ['沃尔玛', 'Wal-Mart', 'Walmart Inc.']);
    await syncAliases(dgId, ['达乐', 'DG', 'Dollar General Corporation', 'Yellow Banana']);
    await syncAliases(aldiSudId, ['ALDI Süd', 'Aldi Süd', 'ALDI South', 'ALDI SOUTH Group', '阿尔迪南', '阿尔迪南区', 'aldi-sued.de', 'Aldi Australia', 'ALDI Australia', 'Aldi Foods Pty Ltd']);

    const validNordAliases = ['ALDI Nord', '阿尔迪北', '阿尔迪北方', 'ALDI Nord Group', 'Unternehmensgruppe ALDI Nord', 'aldi-nord.de', 'ALDI NORD', 'Aldi Gruppe', 'ALDI', 'Aldi'];
    await syncAliases(aldiNordId, validNordAliases);

    console.log('✅ 各主体公司的别名库已严格清洗对齐！');

    // 3. 修复 ALDI Nord 报告的关联实体（主体公司与姐妹公司）
    const repRes = await client.query(
      "SELECT id, title, market_region FROM reports WHERE title ILIKE '%ALDI Nord%'"
    );

    for (const report of repRes.rows) {
      const reportId = report.id;
      console.log(`🔧 正在修复报告: ${report.title} (${reportId})`);
      
      // 更新主体公司
      await client.query('UPDATE reports SET primary_entity_id = $1 WHERE id = $2', [aldiNordId, reportId]);

      // 挂载主体公司
      await client.query(
        `INSERT INTO report_entities (report_id, entity_id, role, source)
         VALUES ($1, $2, 'primary', 'manual')
         ON CONFLICT (report_id, entity_id) DO UPDATE SET role = 'primary', source = 'manual'`,
        [reportId, aldiNordId]
      );

      // 挂载姐妹公司：ALDI SÜD 和 Trader Joe's
      await client.query(
        `INSERT INTO report_entities (report_id, entity_id, role, source)
         VALUES ($1, $2, 'sister_parent', 'manual')
         ON CONFLICT (report_id, entity_id) DO UPDATE SET role = 'sister_parent', source = 'manual'`,
        [reportId, aldiSudId]
      );

      await client.query(
        `INSERT INTO report_entities (report_id, entity_id, role, source)
         VALUES ($1, $2, 'sister_parent', 'manual')
         ON CONFLICT (report_id, entity_id) DO UPDATE SET role = 'sister_parent', source = 'manual'`,
        [reportId, traderJoesId]
      );
    }

    await client.query('COMMIT');
    console.log('\n🎉 [清洗完成] 数据库实体与别名污染已彻底清除，ALDI SÜD 姐妹公司已成功恢复！\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ 执行失败:', err);
  } finally {
    client.release();
    pool.end();
  }
}

runClean();
