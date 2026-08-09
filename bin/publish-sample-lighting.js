const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const articles = [
  {
    title: '昕诺飞(Signify)公布最新财报与战略转向：传统OEM灯具承压，全力加码智能互联照明Interact与Hue生态',
    source_url: 'https://simplywall.st/stocks/nl/capital-goods/ams-light/signify-shares/news/signify-enxtamlight-following-weak-earnings-and-the-case-for/amp',
    imageUrl: 'https://serpapi.com/searches/6a77f2d95abea583c57fdd01/images/Uj4ADnS0nJgdw4VcONdmvtEe8CsTONuYnieNUhrop2I.jpeg',
    recap: '【深度事实解析】全球照明行业龙头昕诺飞（Signify，原飞利浦照明）于2026年8月上旬公布了其最新的季度财务业绩与供应链战略调整路线图。财报数据显示，公司该季度实现总销售额13.32亿欧元，净利润录得1800万欧元，并同步完成了总计795.86万股（耗资1.66亿欧元）的股票回购计划。昕诺飞管理层与欧洲照明协会的最新评估指出，传统通用照明和纯硬件OEM代工板块面临持续的价格侵蚀与全球消费需求分化压力。为此，昕诺飞正加速推进业务结构重组，将战略重心与资本开支全面向高毛利的智能互联平台 Interact 以及消费级 Hue 生态系统倾斜。通过将LED灯具与物联网传感器、云端数据控制和能耗管理系统深度融合，昕诺飞正试图摆脱单纯靠出货量竞争的被动局面，转向以软件订阅、高附加值商用照明解决方案为主导的经常性收入模式。这一战略转型标志着欧美主流照明品牌对上游供应链的采购需求正在从‘单一灯珠与外壳’向‘模块化智能控制器与低功耗通信协议兼容件’快速演进。',
    highlights: [
      '昕诺飞季度销售额达 13.32 亿欧元，完成 1.66 亿欧元股票回购',
      '传统通用照明与基础 OEM 订单承压，利润重心向物联网智能互联平台迁移',
      'Interact 与 Philips Hue 智能生态系统的连接设备数量与经常性收入占比持续攀升',
      '欧美渠道商正在大幅下调低毛利传统 LED 基础款采购比例，优先扶持智能调光与传感类 SKU'
    ],
    takeaways: '【中国外贸工厂供应链实操启示】对于中国广大 LED 商业与家居照明出口制造工厂而言，纯硬件代工和打价格战的空间已被极限压缩。建议出口企业：第一，迅速推进产品向 Matter、Zigbee 3.0、DALI-2 等国际智能照明协议的深度兼容，提升控制器与驱动电源的集成度；第二，关注欧洲 ERP 能效新规与生态设计指令，优化散热结构降低 BOM 整体功耗；第三，由单纯卖灯具向提供‘照明+传感器+本地网关’套件转型，锁定欧美中高端商超与工程渠道的差异化采购订单。',
    industries: ['照明产品', '电子电气产品', '家居装饰品', '电子消费品及信息产品'],
    countries: ['荷兰', '欧洲']
  },
  {
    title: '北美照明龙头 Acuity Brands 季度展望：智能建筑管理提速，家得宝(Home Depot)等工程渠道商用照明需求激增',
    source_url: 'https://www.tradingkey.com/markets/stocks/ayi/forecast',
    imageUrl: 'https://resource.tradingkey.com/cdn/images/media/tradingkey_meta_og.png',
    recap: '【深度事实解析】作为北美规模最大的建筑与专业照明制造巨头，Acuity Brands（纽交所代码：AYI）近日更新了其季度财务预期与商业照明分销渠道展望。华尔街主流投行与北美电气分销商协会（NAED）分析预测，Acuity Brands 下季度总营收有望攀升至12.5亿美元，当前公司总市值稳居108.2亿美元的高位区间。Acuity Brands 的业绩增长主要得益于全美商业地产、仓储物流中心及智慧校园对高能效 LED 改造项目的强劲需求，以及家得宝（Home Depot）、劳氏（Lowe\'s）和专业电气分销商（如 CED、Graybar）对其 Pro 级建筑灯具的采购放量。面对北美电网负荷压力与各州愈发严苛的建筑物能源基准法案（如加州 Title 24 与纽约 Local Law 97），Acuity 正在全线推进‘数字建筑控制网络（Atrius IoT）’与照明硬件的软硬一体化打包。报告指出，具备日照采集（Daylight Harvesting）、自动人感微波探测和应急自检功能的工商业照明灯具在北美市场的在架渗透率较去年同期提升了近 22%，已成为拉动整个北美商业照明采购周期的核心引擎。',
    highlights: [
      'Acuity Brands 季度营收预期达 12.5 亿美元，评级维持在强烈推荐买入区间',
      '北美商业与建筑照明采购增长强劲，Pro 级工程渠道订单同比提升',
      '加州 Title 24 与纽约 LL97 环保法案强制推动高能效商照改造潮',
      '集成微波人感、光感及蓝牙 Mesh 组网的工矿灯与面板灯成为畅销主力'
    ],
    takeaways: '【中国外贸工厂供应链实操启示】主攻北美工商业与建筑照明的中国出口厂商应重点注意：第一，必须确保产品通过 UL/ETL 与 DLC 5.1 Premium 顶级能效认证，这是进入美国主流分销渠道与申领当地电力公司能源补贴的硬门槛；第二，针对北美严苛的 0-10V 调光及紧急备用电池（Emergency Battery Backup）标准，设计高度模块化的驱动腔体；第三，强化与大型零售商 Pro 部门（如 Home Depot Pro Desk）供应商的配套对接，抢占工矿灯、三防灯与商业条形灯的补库红利。',
    industries: ['照明产品', '建筑及装饰材料', '电子电气产品', '五金', '工具'],
    countries: ['美国', '北美']
  },
  {
    title: '大型工业制造端掀起绿色照明低碳浪潮：耐克森轮胎启动 3.8 万套高能效工业 LED 照明全面替代工程',
    source_url: 'https://www.asiae.co.kr/en/article/2026080609505878937',
    imageUrl: 'https://cwstatic.asiae.co.kr/asiae_v3/com/asiae_en_og.png',
    recap: '【深度事实解析】2026年8月6日，韩国绿色工业节能与智能照明领军企业 Fine Technix 正式宣布签署重大供应链工程合同，负责为耐克森轮胎（Nexen Tire）大型现代化生产基地提供全面的工业 LED 节能照明总承包改造。根据公布的合同条款，该工程总金额达21.8亿韩元，工期持续至2026年10月底，涉及在高温、高尘与全天候连续运转的重工业车间内全面拆除传统高压钠灯与荧光灯具，并定制化安装替换约3.8万套特种高防护等级工业 LED 高湾灯与防爆照明系统。亚洲照明协会与多国工业减碳监管机构指出，受全球碳中和政策及能源效率资源标准（EERS）制度扩围的刚性约束，全球头部制造企业正在将厂区照明智能化节能改造列为降本减碳的‘首选低门槛切入点’。本次项目不仅是单纯的硬件替换，更整合了基于人工智能（AI）的智能光感自适应调光算法和工业能耗监测系统，预计将为轮胎制造基地削减超过 45% 的年照明用电负荷。',
    highlights: [
      '总计 3.8 万套特种高能效工业 LED 灯具一次性批量中标与进场安装',
      '合同金额达 21.8 亿韩元，改造后综合节电率预计突破 45%',
      '全球重工业与仓储物流企业受 EERS 碳核查约束，工业照明更新周期明显缩短',
      '高耐温（Ta 65℃）、高抗震、IP66/IP69K 级防腐蚀工业灯具需求迎来爆发期'
    ],
    takeaways: '【中国外贸工厂供应链实操启示】工业照明属于典型的‘高毛利、高壁垒、低价格敏感度’蓝海细分市场。中国照明制造工厂应重点布局：第一，研发专为极端工业环境设计的压铸铝重型散热器与高品质耐高温隔离驱动，确保在 50℃~65℃ 恶劣工况下持续点亮寿命超 5 万小时；第二，取得 ATEX、IECEx 防爆认证与 IK10 抗冲击等级报告，避开红海家居照明竞争，直攻全球大型工业厂房、冷链仓储及港口码头的高溢价工程标案。',
    industries: ['照明产品', '电子电气产品', '工业自动化及智能制造', '通用机械及机械基础件'],
    countries: ['韩国', '全球']
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
    🔗 权威新闻来源：<a href="${item.source_url}" target="_blank" rel="noopener noreferrer" style="color: var(--color-accent, #ff641e); text-decoration: underline;">点击查阅海外媒体报道原文 ↗</a>
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
