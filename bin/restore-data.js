const { Client } = require('pg');

async function main() {
  const dbClient = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres',
  });
  await dbClient.connect();

  try {
    console.log('开始恢复种子测试数据...');
    await dbClient.query('BEGIN');

    // 1. 清理全部旧数据
    await dbClient.query('DELETE FROM notes');
    await dbClient.query('DELETE FROM favorites');
    await dbClient.query('DELETE FROM unlocks');
    await dbClient.query('DELETE FROM relations');
    await dbClient.query('DELETE FROM reports');
    await dbClient.query('DELETE FROM users');

    // 2. 插入测试用户 (固定手机号，如果以前有就重置额度为 3)
    const userRes = await dbClient.query(
      `INSERT INTO users (phone_number, free_quota) VALUES ('13800000000', 3) RETURNING id`
    );
    const userId = userRes.rows[0].id;
    console.log(`已重置主测试用户，ID: ${userId}`);

    // 3. 插入 5 篇测试报告
    const r1 = await dbClient.query(`
      INSERT INTO reports (title, category, market_region, summary, content_html) 
      VALUES (
        '美国汽车配件连锁超市 A 公司 360 度调研报告', 
        'customer', 
        '北美', 
        'A 公司是全美前三的汽配连锁零售商，本报告详细透析其采购渠道和供应商评级。', 
        '<div class="report-content-body"><h3>美国A公司深度调研</h3><p>该公司铝合金轮毂的采购比重在过去两年上涨了15%，是本报告的重点分析对象...</p></div>'
      ) RETURNING id
    `);
    const id1 = r1.rows[0].id;

    const r2 = await dbClient.query(`
      INSERT INTO reports (title, category, market_region, summary, content_html) 
      VALUES (
        '德国工业配件商 B 公司采购及供应链分析', 
        'customer', 
        '欧盟', 
        'B 公司主要采购铝合金轮毂与刹车片，其对环保及认证门槛要求较高。', 
        '<div class="report-content-body"><h3>德国B公司供应链报告</h3><p>B 公司对中国优质铝合金轮毂及底盘配件有着长期稳定的年度采购需求...</p></div>'
      ) RETURNING id
    `);
    const id2 = r2.rows[0].id;

    const r3 = await dbClient.query(`
      INSERT INTO reports (title, category, market_region, summary, content_html) 
      VALUES (
        '全球铝合金轮毂品类发展趋势与进口买家洞察', 
        'product', 
        '全球', 
        '深度剖析全球铝合金轮毂的关税、海运影响及各大洲核心买家采购名录。', 
        '<div class="report-content-body"><h3>全球铝合金轮毂发展概览</h3><p>报告详细梳理了包括美国 A 公司、德国 B 公司在内的主要买家及其共同采购关键词“铝合金轮毂”的交易体量...</p></div>'
      ) RETURNING id
    `);
    const id3 = r3.rows[0].id;

    const r4 = await dbClient.query(`
      INSERT INTO reports (title, category, market_region, summary, content_html) 
      VALUES (
        '中东非公路工程车桥品类发展趋势与进口商分析', 
        'product', 
        '中东', 
        '随着中东基建高热度，工程车桥进口需求激增，本篇报告揭晓核心进口商与畅销款车桥技术规格。', 
        '<div class="report-content-body"><h3>中东车桥报告详情</h3><p>本报告已包含沙特、阿联酋等 5 家特大型工程车装配商的独家联络人名录...</p></div>'
      ) RETURNING id
    `);
    const id4 = r4.rows[0].id;

    const r5 = await dbClient.query(`
      INSERT INTO reports (title, category, market_region, summary, content_html) 
      VALUES (
        '日本丰田供应链体系中关键紧固件采购名录', 
        'customer', 
        '东亚', 
        '本篇报告为您详尽梳理日本丰田汽车一级、二级供应链中涉及底盘紧固件的直接与间接供应商。', 
        '<div class="report-content-body"><h3>日本紧固件供应链</h3><p>这是丰田关键零部件采购内部核心架构图，披露了对高强度螺栓的质检标准...</p></div>'
      ) RETURNING id
    `);
    const id5 = r5.rows[0].id;

    console.log('5篇种子报告数据插入成功！');

    // 4. 插入关联关系 (关系网由已解锁的 A超市(1) <-> 轮毂趋势(3) 和 B配件商(2) <-> 轮毂趋势(3) 构成)
    await dbClient.query(`
      INSERT INTO relations (report_id_a, report_id_b, relation_key) 
      VALUES ($1, $2, '铝合金轮毂')
    `, [id1, id3]);

    await dbClient.query(`
      INSERT INTO relations (report_id_a, report_id_b, relation_key) 
      VALUES ($1, $2, '铝合金轮毂')
    `, [id2, id3]);

    console.log('知识图谱网状关联关系绑定成功！');

    // 5. 写入已解锁记录：只解锁 1, 2, 3，剩下 4, 5 未解锁
    await dbClient.query(`
      INSERT INTO unlocks (user_id, report_id) 
      VALUES ($1, $2), ($1, $3), ($1, $4)
    `, [userId, id1, id2, id3]);

    console.log('已解锁报告记录写入成功（3篇解锁，2篇未解锁）！');

    await dbClient.query('COMMIT');
    console.log('🎉 测试种子数据成功恢复！');
  } catch (err) {
    await dbClient.query('ROLLBACK');
    console.error('❌ 恢复种子数据失败:', err);
  } finally {
    await dbClient.end();
  }
}

main();
