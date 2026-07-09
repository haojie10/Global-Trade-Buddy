const { Client } = require('pg');

const ENTITY_DEFINITIONS = [
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
  { name: '欧美汽配', type: 'product', match: ['欧美汽配'] },
  { name: '汇率风险', type: 'product', match: ['汇率风险'] },
];

const BLACKLIST = ['公司', '工厂', '超市', '产品', '客户', '供应商', '采购商', '贸易'];

async function main() {
  // 从 .env 加载环境变量
  require('dotenv').config();

  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    console.log('开始回填数据库报告实体...');
    
    // 1. 获取所有报告
    const reportsRes = await client.query('SELECT id, title, content_html FROM reports');
    
    for (const report of reportsRes.rows) {
      const text = (report.title || '') + ' ' + (report.content_html || '');
      
      // 提取并匹配实体
      for (const kw of ENTITY_DEFINITIONS) {
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
            console.log(`创建新实体: "${kw.name}"`);
          } else {
            entId = entRes.rows[0].id;
          }

          // 插入报告-实体映射
          await client.query(
            'INSERT INTO report_entities (report_id, entity_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
            [report.id, entId, kw.type]
          );
          console.log(`关联报告 "${report.title}" -> 实体 "${kw.name}"`);
        }
      }
    }

    // 2. 补偿 relations 表属性
    await client.query(`
      UPDATE relations 
      SET market_region = COALESCE(reports.market_region, '全球'), 
          relation_type = 'produces'
      FROM reports 
      WHERE relations.report_id_a = reports.id
    `);

    console.log('🎉 实体回填并绑定成功！');
  } catch (err) {
    console.error('❌ 回填失败:', err);
  } finally {
    await client.end();
  }
}

main();
