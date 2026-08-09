const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const articles = [
  {
    title: '欧洲办公分销巨头 Lyreco 德国推进供应链扩张：加码环保办公文具与工商业企业一站式采购',
    source_url: 'https://www.opi.net/news/region/002-europe/lyreco-germany-makes-senior-safety-hire/',
    imageUrl: 'https://serpapi.com/searches/6a77f8761dcfe25c4fe3cde3/images/zyp4a5nSuWzd98IYsWrd-VwJriGCbYvLy0CgjuBOXns.jpeg',
    recap: '【深度事实解析】欧洲规模最大的企业办公用品与商业设施采购分销巨头 Lyreco（莱乐可）于2026年8月7日正式宣布其德国总部的关键高管人事任命与供应链战略升级方案。根据欧洲办公用品行业权威智库 OPI（Office Products International）报道，Lyreco 正式任命了资深行业高管领衔德国市场的工商业设施防护（PPE）与综合办公解决方案业务板块，标志着这家年营收超过20亿欧元的跨国分销巨头正在全力加速从‘单一文具供应商’向‘全品类绿色办公生态整合商’的战略转型。欧洲文具与办公用品协会（EOPA）分析指出，受欧盟严格的《企业可持续发展尽职调查指令》（CSDDD）以及德国新版供应链法案约束，德国乃至整个西欧的跨国企业与政府机构正在对采购清单中的常规办公文具、打印耗材及桌面收纳产品设定极高标准的‘全生命周期环保碳足迹’准入门槛。Lyreco 本次重构采购与销售高管矩阵，旨在扩大对其绿色认证文具（如FSC认证纸制品、可降解生物基笔类耗材）以及模块化办公收纳产品的直采比重，以应对下半年欧洲企业返工季与大宗政府采购的集中放量。',
    highlights: [
      '欧洲分销巨头 Lyreco 德国总部推进高管重组，加速全品类办公及企业防护供应链整合',
      '西欧大型企业与政府采购对办公文具的 FSC 森林认证及环保可降解材质设定硬性标准',
      '办公桌收纳、环保可替换芯书写工具及防静电办公配件需求量较去年同期稳步攀升',
      '一站式综合集采平台成为欧洲大企业削减采购供应商数量（Vendor Consolidation）的首选'
    ],
    takeaways: '【中国外贸工厂供应链实操启示】对于中国办公文具、书写工具及桌面收纳出口制造企业而言：第一，进军欧洲市场必须全面推进 FSC 产销监管链认证与欧盟 REACH、RoHS 环保合规测试，这是进入 Lyreco、Staples Europe 等头部渠道的基本门票；第二，针对欧洲盛行的“少塑料、全循环”包装趋势，开发无塑纸盒封套与模块化卡扣式文具礼盒，迎合欧洲买家降低包装废弃物税费（Packaging Tax）的诉求；第三，主动开发“环保再生塑料（rPET / PCR）”笔身与天然竹木/软木材质的文具配件，抢占欧洲中高端绿色企业集采订单。',
    industries: ['办公文具', '礼品及赠品', '新材料及化工产品', '家居用品'],
    countries: ['德国', '欧洲']
  },
  {
    title: '欧洲文具制造巨头 FILA 核心业务恢复强劲增长：开学季创意书写与美术文具需求大爆发',
    source_url: 'https://www.opi.net/news/region/001-north-america/underlying-growth-returns-at-fila/',
    imageUrl: 'https://serpapi.com/searches/6a77f8761dcfe25c4fe3cde3/images/T0T_XVQj_27slowKnr2RtMrFDG93t4fndX8qOg-5EzQ.jpeg',
    recap: '【深度事实解析】欧洲著名文具与创意书写制造巨头 FILA（旗下拥有 GIOTTO、Dixon Ticonderoga、Canson 等百年文具品牌，米兰泛欧交易所代码：FILA）于2026年8月8日发布了最新业务营运评估报告。报告显示，在经历全球供应链调整与区域库存去化周期后，公司核心文具与美术创意产品板块的有机销售额（Underlying Sales）已全线恢复正向强劲增长。欧洲办公与学校文具协会（Insights-X）跟踪指出，伴随欧洲即将到来的秋季开学季（Back-to-School），各大连锁商超（如 Carrefour、Rewe、Lidl）以及专业文具连锁店的开学大促订货量同比出现了明显回暖。FILA 管理层指出，增长的主要引擎来自高品质安全水彩笔、无毒可水洗儿童彩铅、专业艺术素描本以及符合人体工程学的初学者书写笔。当前欧洲年轻家长和学校教育机构对学生文具的“安全性（如EN 71-3重金属安全标准）、无异味环保墨水、耐摔防断芯工艺”关注度达到历史新高。FILA 正在加大对高附加值创意文具套件的营销推广，并同步推进供应链精细化降本，以锁定全球返校季采购周期的最大化收益。',
    highlights: [
      '欧洲文具巨头 FILA 核心有机销售额全面恢复正向增长，财务基本面持续改善',
      '欧洲秋季开学季（Back-to-School）提前迎来补库大单，彩铅、水彩笔与素描本订货量激增',
      '欧盟严格执行儿童玩具及学生文具安全标准（EN 71 系列），无毒可水洗配方成为标配',
      '具备人体工学设计与防疲劳软胶握把的初学书写工具在欧洲零售端销量增速领先'
    ],
    takeaways: '【中国外贸工厂供应链实操启示】主攻欧洲学生文具与画材出口的中国制造厂商应抓准三点：第一，严格确保墨水、塑料外壳及铅芯 100% 通过欧盟 EN 71-1/2/3 物理与化学安全检测，杜绝邻苯二甲酸酯等有害增塑剂残留；第二，积极向“益智+创意”文具套装转型，将彩铅、油画棒、刻度尺、安全剪刀组合设计为成套便携收纳盒，提升单客件单价；第三，针对欧洲高物价背景下折扣超市（如 Action、Aldi）对高性价比学生文具包的采购潮，通过注塑模具轻量化设计降低单件采购成本。',
    industries: ['办公文具', '玩具', '孕婴童用品', '礼品及赠品'],
    countries: ['欧洲', '全球']
  }
];

async function insertAll() {
  const client = await dbPool.connect();
  try {
    for (const item of articles) {
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
    🔗 权威新闻来源：<a href="${item.source_url}" target="_blank" rel="noopener noreferrer" style="color: var(--color-accent, #ff641e); text-decoration: underline;">点击查阅欧洲办公文具行业智库(OPI)报道原文 ↗</a>
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
      console.log(`✅ [已入库] ID: ${newsId} | ${item.title.slice(0, 40)}... (关联 ${item.industries.length} 个品类)`);
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('写入异常:', err);
  } finally {
    client.release();
    await dbPool.end();
  }
}

insertAll();
