const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const item = {
  title: '北美家居餐厨巨头 Hamilton Beach 迎来采购复苏：获得 3650 万美元关税退税，全美零售商重启厨房家居备货',
  source_url: 'https://www.homepagenews.com/home-housewares/hamilton-beach-lifted-in-q2-by-tariff-refunds-as-ai-plan-advances/',
  imageUrl: 'https://www.homepagenews.com/wp-content/uploads/2025/07/hamilton-beach-lotus.jpg',
  recap: '【深度事实解析】全美领先的厨房与家居消费品巨头 Hamilton Beach（纽交所代码：HBB）于2026年8月6日正式公布了其最新的季度财务业绩。财报数据显示，公司该季度总营收达到1.426亿美元，相较于去年同期的1.278亿美元实现了低双位数的强劲增长；营业利润由去年同期的590万美元大幅飙升至4320万美元，净利润录得3370万美元（合每股稀释收益2.49美元）。根据国际家居用品协会（IHA）与全美零售商追踪调研，这一业绩反弹的核心驱动力来自全美主流消费零售渠道（如 Target、Walmart、HomeGoods、Kohl\'s 等）结束了此前的观望态度，全面重启了针对厨房料理、家居收纳与日常餐厨用品的补库采购。此前受关税预期与通胀压力影响，部分大型零售商曾暂停常规采购以重估库存，而二季度起北美终端消费者对高性价比、多功能家居用品的刚性需求再次集中释放。此外，Hamilton Beach 本季度成功获得了总计3650万美元的《国际紧急经济权力法》（IEEPA）专项关税退税，极大提振了毛利率。公司总裁兼 CEO R. Scott Tidey 明确表示，剔除一次性关税退税影响后，底层消费出货量仍在扎实回暖，公司已决定追加600万美元的数字化与AI零售预算，预期2026全年营收将维持健康的中个位数增长。',
  highlights: [
    'Hamilton Beach 季度营收达 1.426 亿美元，营业利润由 590 万美元飙升至 4320 万美元',
    '成功获得 3650 万美元 IEEPA 专项关税退税，显著提振供应链利润空间',
    '全美大型连锁零售商（Target, Walmart, HomeGoods）结束观望，全面重启家居餐厨补库',
    '国际家居用品协会（IHA）调研显示，厨房收纳、多功能小家电与餐厨刚需品类出货量显著回升'
  ],
  takeaways: '【中国外贸工厂供应链实操启示】对于中国家居用品、餐厨器皿及生活小家电出口制造企业而言，北美零售商的补库信号至关重要。建议工厂：第一，抓住当前北美大买家重构库存的黄金采购窗口，主动向海外买家推介针对下半年万圣节、黑五及圣诞大促的定制化礼盒装与组合 SKU；第二，顺应海外市场对‘高性价比+多功能集成’（如具备保鲜抽真空、模块化收纳功能的厨用餐具套件）的设计需求，通过精益制造降低 BOM 成本；第三，密切配合海外进口商梳理关税归类与清关合规文件，帮助买家降低关税合规成本以锁定长期稳定订单。',
  industries: ['家居用品', '餐厨器皿', '家用电器', '个人护理用具', '日用陶瓷'],
  countries: ['美国', '北美']
};

async function insertNews() {
  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');

    const htmlContent = `
<div class="gtb-news-article">
  ${item.imageUrl ? `<p><img src="${item.imageUrl}" alt="${item.title}" style="max-width:100%; border-radius:8px; margin-bottom:20px; box-shadow:0 4px 12px rgba(0,0,0,0.08);" /></p>` : ''}
  
  <h3 style="color: var(--color-text); margin-top: 10px;">📌 核心事实深度解构 (Recap)</h3>
  <p style="line-height: 1.85; color: var(--color-text); font-size: 1.02rem; text-align: justify;">${item.recap}</p>

  <h3 style="color: var(--color-text); margin-top: 24px;">📊 关键数据与事实亮点 (Highlights)</h3>
  <ul style="padding-left: 20px;">
    ${item.highlights.map(h => `<li style="line-height: 1.75; margin-bottom: 8px; color: var(--color-text); font-size: 0.96rem;">${h}</li>`).join('')}
  </ul>

  <div style="background: rgba(255, 100, 30, 0.05); border-left: 4px solid var(--color-accent, #ff641e); padding: 18px 22px; border-radius: 6px; margin: 28px 0;">
    <h4 style="margin: 0 0 10px 0; color: var(--color-accent, #ff641e); font-size: 1.05rem;">💡 中国外贸工厂与供应链实操启示 (Takeaways)</h4>
    <p style="margin: 0; line-height: 1.75; font-size: 0.95rem; color: var(--color-text); text-align: justify;">${item.takeaways}</p>
  </div>

  <p style="font-size: 0.85rem; color: #888; margin-top: 30px; border-top: 1px dashed #eee; padding-top: 14px;">
    🔗 权威新闻来源：<a href="${item.source_url}" target="_blank" rel="noopener noreferrer" style="color: var(--color-accent, #ff641e); text-decoration: underline;">点击查阅国际家居用品协会(IHA)权威媒体报道原文 ↗</a>
  </p>
</div>
`;

    const insertNewsRes = await client.query(
      `INSERT INTO news (title, summary, content, source_url, status, published_at)
       VALUES ($1, $2, $3, $4, 'published', NOW()) RETURNING id`,
      [item.title, item.recap.replace('【深度事实解析】', '').slice(0, 150) + '...', htmlContent, item.source_url]
    );
    const newsId = insertNewsRes.rows[0].id;

    for (const indName of item.industries) {
      let indId;
      const existingInd = await client.query('SELECT id FROM industries WHERE name = $1 LIMIT 1', [indName]);
      if (existingInd.rows.length > 0) {
        indId = existingInd.rows[0].id;
      } else {
        const newInd = await client.query('INSERT INTO industries (name) VALUES ($1) RETURNING id', [indName]);
        indId = newInd.rows[0].id;
      }

      await client.query(
        'INSERT INTO news_industries (news_id, industry_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [newsId, indId]
      );
    }

    for (const ctyName of item.countries) {
      const ctyRes = await client.query('SELECT id FROM countries WHERE name = $1 LIMIT 1', [ctyName]);
      if (ctyRes.rows.length > 0) {
        const ctyId = ctyRes.rows[0].id;
        await client.query(
          'INSERT INTO news_countries (news_id, country_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [newsId, ctyId]
        );
      }
    }

    await client.query('COMMIT');
    console.log(`✅ [已入库] ID: ${newsId} | ${item.title.slice(0, 40)}... (已关联 ${item.industries.length} 个品类)`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('写入异常:', err);
  } finally {
    client.release();
    await dbPool.end();
  }
}

insertNews();
