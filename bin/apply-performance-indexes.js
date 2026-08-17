#!/usr/bin/env node
/**
 * 生产环境数据库性能索引补全迁移脚本
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ 未找到 DATABASE_URL 环境变量');
  process.exit(1);
}

const pool = new Pool({ connectionString });

const indexes = [
  {
    name: 'idx_relations_report_b',
    sql: 'CREATE INDEX IF NOT EXISTS idx_relations_report_b ON relations(report_id_b);'
  },
  {
    name: 'idx_entity_relations_b',
    sql: 'CREATE INDEX IF NOT EXISTS idx_entity_relations_b ON entity_relations(entity_id_b);'
  },
  {
    name: 'idx_report_entities_entity',
    sql: 'CREATE INDEX IF NOT EXISTS idx_report_entities_entity ON report_entities(entity_id);'
  },
  {
    name: 'idx_reports_created_at',
    sql: 'CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);'
  },
  {
    name: 'idx_news_published',
    sql: 'CREATE INDEX IF NOT EXISTS idx_news_published ON news(status, published_at DESC);'
  },
  {
    name: 'idx_page_views_created_at',
    sql: 'CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON page_views(created_at);'
  },

  {
    name: 'idx_search_logs_created_at',
    sql: 'CREATE INDEX IF NOT EXISTS idx_search_logs_created_at ON search_logs(created_at);'
  },
  {
    name: 'idx_email_verif_expires',
    sql: 'CREATE INDEX IF NOT EXISTS idx_email_verif_expires ON email_verifications(expired_at);'
  }
];

async function main() {
  console.log('🚀 开始应用数据库性能索引优化...');
  const client = await pool.connect();
  try {
    for (const item of indexes) {
      process.stdout.write(`  - 正在创建/确认索引: ${item.name}... `);
      await client.query(item.sql);
      console.log('✅ 完成');
    }
    console.log('🎉 所有性能索引已成功应用！');
  } catch (err) {
    console.error('❌ 创建索引时出错:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
