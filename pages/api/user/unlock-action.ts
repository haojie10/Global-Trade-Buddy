import { NextApiRequest, NextApiResponse } from 'next';
import { Client } from 'pg';
import pool from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { userId, reportId } = req.body;
  if (!userId || !reportId) {
    return res.status(400).json({ error: 'Missing userId or reportId' });
  }

  const dbClient = await pool.connect();

  try {
    await dbClient.query('BEGIN');

    // 专属的一键加载种子 Demo 数据的逻辑
    if (reportId === 'seed-action') {
      // 1. 插入三篇测试报告
      const rep1 = await dbClient.query(
        `INSERT INTO reports (title, category, market_region, summary, content_html) 
         VALUES ('美国汽车配件连锁超市 A 公司 360 度调研报告', 'customer', '北美', 'A 公司是全美前三的汽配连锁零售商，本报告详细透析其采购渠道和供应商评级。', '<p>这是全美领先的汽配采购商 A 公司的深度分析，其铝合金轮毂的采购比重在过去两年上涨了15%...</p>') 
         RETURNING id`
      );
      const rep2 = await dbClient.query(
        `INSERT INTO reports (title, category, market_region, summary, content_html) 
         VALUES ('德国工业配件商 B 公司采购及供应链分析', 'customer', '欧盟', 'B 公司主要采购铝合金轮毂与刹车片，其对环保及认证门槛要求较高。', '<p>B 公司对中国铝合金轮毂及机械配件有着高度依赖...</p>') 
         RETURNING id`
      );
      const rep3 = await dbClient.query(
        `INSERT INTO reports (title, category, market_region, summary, content_html) 
         VALUES ('全球铝合金轮毂品类发展趋势与进口买家洞察', 'product', '全球', '深度剖析全球铝合金轮毂的关税、海运影响及各大洲核心买家采购名录。', '<p>本品类报告详细梳理了包括 A 公司、B 公司在内的国际采购大鳄对铝合金轮毂的采购要求...</p>') 
         RETURNING id`
      );
      
      const id1 = rep1.rows[0].id;
      const id2 = rep2.rows[0].id;
      const id3 = rep3.rows[0].id;

      // 2. 建立两两网状关联 (共同包含“铝合金轮毂”关键词)
      await dbClient.query(`INSERT INTO relations (report_id_a, report_id_b, relation_key) VALUES ($1, $2, '铝合金轮毂')`, [id1, id3]);
      await dbClient.query(`INSERT INTO relations (report_id_a, report_id_b, relation_key) VALUES ($1, $2, '铝合金轮毂')`, [id2, id3]);

      // 3. 为当前用户解锁这三篇报告
      await dbClient.query(`INSERT INTO unlocks (user_id, report_id) VALUES ($1, $2), ($1, $3), ($1, $4) ON CONFLICT DO NOTHING`, [userId, id1, id2, id3]);

      await dbClient.query('COMMIT');
      return res.status(200).json({ success: true });
    }

    // 1. 查询用户额度
    const userRes = await dbClient.query(
      'SELECT free_quota FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );

    if (userRes.rows.length === 0) {
      throw new Error('用户不存在');
    }

    const freeQuota = userRes.rows[0].free_quota;

    // 2. 如果额度足够，扣除额度并解锁
    if (freeQuota > 0) {
      // 扣除 1 次额度
      await dbClient.query(
        'UPDATE users SET free_quota = free_quota - 1 WHERE id = $1',
        [userId]
      );

      // 写入解锁记录
      await dbClient.query(
        'INSERT INTO unlocks (user_id, report_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userId, reportId]
      );

      // 获取报告全文
      const reportRes = await dbClient.query(
        'SELECT content_html FROM reports WHERE id = $1',
        [reportId]
      );

      await dbClient.query('COMMIT');

      return res.status(200).json({
        success: true,
        content_html: reportRes.rows[0]?.content_html || ''
      });
    } else {
      await dbClient.query('ROLLBACK');
      return res.status(400).json({ success: false, error: '您的额度不足，请充值或付费解锁' });
    }
  } catch (err: any) {
    await dbClient.query('ROLLBACK');
    return res.status(500).json({ error: err.message });
  } finally {
    dbClient.release();
  }
}
