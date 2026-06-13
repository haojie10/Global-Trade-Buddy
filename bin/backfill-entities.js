const { Client } = require('pg');

// 简单归一化规则
const commonKeywords = [
  { name: 'A 公司', type: 'company', match: ['A 公司', 'A Company', '美国A公司', '美国 A 公司'] },
  { name: 'B 公司', type: 'company', match: ['B 公司', 'B Company', '德国 B 公司'] },
  { name: '丰田汽车', type: 'company', match: ['丰田', 'Toyota'] },
  { name: '铝合金轮毂', type: 'product', match: ['铝合金轮毂', '轮毂'] },
  { name: '刹车片', type: 'product', match: ['刹车片'] },
  { name: '紧固件', type: 'product', match: ['紧固件', '螺丝', '螺栓'] },
  { name: '发光壁挂绿植环', type: 'product', match: ['绿植', 'Wall Decor Rings'] },
  { name: '中东非公路工程车桥', type: 'product', match: ['车桥', '工程车桥'] },
  { name: '配件超市', type: 'channel', match: ['汽配连锁超市', '连锁配件超市', '连锁超市'] },
  { name: '一级供应链', type: 'channel', match: ['一级供应链', '供应链体系'] },
  { name: '运费波动', type: 'product', match: ['运费波动'] },
];

const blacklist = ['公司', '工厂', '超市', '产品', '客户', '供应商', '采购商', '贸易'];

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres'
  });
  await client.connect();

  console.log('Starting backfill for existing reports...');
  
  // 1. 获取所有报告
  const reportsRes = await client.query('SELECT id, title, content_html, market_region FROM reports');
  
  for (const report of reportsRes.rows) {
    const text = report.title + ' ' + report.content_html;
    
    // 提取并匹配实体
    for (const kw of commonKeywords) {
      // 检查黑名单
      if (blacklist.includes(kw.name)) continue;

      let hasMatch = false;
      for (const m of kw.match) {
        if (text.includes(m)) {
          hasMatch = true;
          break;
        }
      }

      if (hasMatch) {
        // 获取或创建主实体
        let entRes = await client.query('SELECT id FROM entities WHERE canonical_name = $1', [kw.name]);
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

  // 2. 补偿 relations 表属性
  const relationsRes = await client.query('SELECT id, report_id_a, report_id_b, relation_key FROM relations');
  for (const rel of relationsRes.rows) {
    // 根据 A 报告的 region 回填边属性
    const repARes = await client.query('SELECT market_region FROM reports WHERE id = $1', [rel.report_id_a]);
    if (repARes.rows.length > 0) {
      const region = repARes.rows[0].market_region || '全球';
      await client.query(
        'UPDATE relations SET market_region = $1, relation_type = $2 WHERE id = $3',
        [region, 'produces', rel.id]
      );
    }
  }

  console.log('Backfill completed successfully!');
  await client.end();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
