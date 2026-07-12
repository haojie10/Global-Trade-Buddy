const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const STANDARD_INDUSTRIES = [
  "家用电器", "电子消费品及信息产品", "电子电气产品", "照明产品", "新能源汽车及智慧出行",
  "车辆", "汽车配件", "摩托车", "自行车", "动力、电力设备", "通用机械及机械基础件",
  "加工机械设备", "工程机械（室内/室外）", "农业机械（室内/室外）", "工业自动化及智能制造",
  "五金", "工具", "新材料及化工产品", "新能源", "日用陶瓷", "餐厨器皿", "家居用品",
  "玻璃工艺品", "工艺陶瓷", "礼品及赠品", "节日用品", "玩具", "编织及藤铁工艺品",
  "家居装饰品", "园林用品", "石材/铁艺制品（室外）", "建筑及装饰材料", "卫浴设备",
  "家具", "钟表眼镜", "个人护理用具", "宠物用品", "男女装", "童装", "内衣",
  "运动服及休闲服", "裘革皮羽绒及制品", "服装饰物及配件", "纺织原料面料", "家用纺织品",
  "地毯及挂毯", "鞋", "箱包", "办公文具", "体育及旅游休闲用品", "医药保健品及医疗器械",
  "食品", "乡村振兴特色产品", "孕婴童用品"
];

const STANDARD_COUNTRIES = [
  // 亚洲
  { name: '中国', region: '亚洲', code: 'CN' },
  { name: '日本', region: '亚洲', code: 'JP' },
  { name: '韩国', region: '亚洲', code: 'KR' },
  { name: '新加坡', region: '亚洲', code: 'SG' },
  { name: '越南', region: '亚洲', code: 'VN' },
  { name: '泰国', region: '亚洲', code: 'TH' },
  { name: '印度尼西亚', region: '亚洲', code: 'ID' },
  { name: '马来西亚', region: '亚洲', code: 'MY' },
  { name: '菲律宾', region: '亚洲', code: 'PH' },
  { name: '印度', region: '亚洲', code: 'IN' },
  { name: '巴基斯坦', region: '亚洲', code: 'PK' },
  { name: '沙特阿拉伯', region: '亚洲', code: 'SA' },
  { name: '阿联酋', region: '亚洲', code: 'AE' },
  { name: '土耳其', region: '亚洲', code: 'TR' },
  { name: '以色列', region: '亚洲', code: 'IL' },
  { name: '哈萨克斯坦', region: '亚洲', code: 'KZ' },
  { name: '卡塔尔', region: '亚洲', code: 'QA' },
  { name: '科威特', region: '亚洲', code: 'KW' },
  { name: '孟加拉国', region: '亚洲', code: 'BD' },
  { name: '斯里兰卡', region: '亚洲', code: 'LK' },

  // 欧洲
  { name: '德国', region: '欧洲', code: 'DE' },
  { name: '英国', region: '欧洲', code: 'GB' },
  { name: '法国', region: '欧洲', code: 'FR' },
  { name: '意大利', region: '欧洲', code: 'IT' },
  { name: '西班牙', region: '欧洲', code: 'ES' },
  { name: '荷兰', region: '欧洲', code: 'NL' },
  { name: '波兰', region: '欧洲', code: 'PL' },
  { name: '瑞士', region: '欧洲', code: 'CH' },
  { name: '奥地利', region: '欧洲', code: 'AT' },
  { name: '比利时', region: '欧洲', code: 'BE' },
  { name: '瑞典', region: '欧洲', code: 'SE' },
  { name: '挪威', region: '欧洲', code: 'NO' },
  { name: '芬兰', region: '欧洲', code: 'FI' },
  { name: '丹麦', region: '欧洲', code: 'DK' },
  { name: '爱尔兰', region: '欧洲', code: 'IE' },
  { name: '葡萄牙', region: '欧洲', code: 'PT' },
  { name: '希腊', region: '欧洲', code: 'GR' },
  { name: '匈牙利', region: '欧洲', code: 'HU' },
  { name: '捷克', region: '欧洲', code: 'CZ' },
  { name: '罗马尼亚', region: '欧洲', code: 'RO' },
  { name: '俄罗斯', region: '欧洲', code: 'RU' },
  { name: '乌克兰', region: '欧洲', code: 'UA' },
  { name: '克罗地亚', region: '欧洲', code: 'HR' },
  { name: '塞尔维亚', region: '欧洲', code: 'RS' },

  // 北美洲
  { name: '美国', region: '北美洲', code: 'US' },
  { name: '加拿大', region: '北美洲', code: 'CA' },
  { name: '墨西哥', region: '北美洲', code: 'MX' },
  { name: '巴拿马', region: '北美洲', code: 'PA' },
  { name: '古巴', region: '北美洲', code: 'CU' },
  { name: '牙买加', region: '北美洲', code: 'JM' },
  { name: '多米尼加', region: '北美洲', code: 'DO' },
  { name: '哥斯达黎加', region: '北美洲', code: 'CR' },

  // 南美洲
  { name: '巴西', region: '南美洲', code: 'BR' },
  { name: '阿根廷', region: '南美洲', code: 'AR' },
  { name: '哥伦比亚', region: '南美洲', code: 'CO' },
  { name: '智利', region: '南美洲', code: 'CL' },
  { name: '秘鲁', region: '南美洲', code: 'PE' },
  { name: '委内瑞拉', region: '南美洲', code: 'VE' },
  { name: '厄瓜多尔', region: '南美洲', code: 'EC' },
  { name: '乌拉圭', region: '南美洲', code: 'UY' },

  // 大洋洲
  { name: '澳大利亚', region: '大洋洲', code: 'AU' },
  { name: '新西兰', region: '大洋洲', code: 'NZ' },
  { name: '斐济', region: '大洋洲', code: 'FJ' },
  { name: '巴布亚新几内亚', region: '大洋洲', code: 'PG' },

  // 非洲
  { name: '南非', region: '非洲', code: 'ZA' },
  { name: '埃及', region: '非洲', code: 'EG' },
  { name: '尼日利亚', region: '非洲', code: 'NG' },
  { name: '阿尔及利亚', region: '非洲', code: 'DZ' },
  { name: '摩洛哥', region: '非洲', code: 'MA' },
  { name: '肯尼亚', region: '非洲', code: 'KE' },
  { name: '埃塞俄比亚', region: '非洲', code: 'ET' },
  { name: '加纳', region: '非洲', code: 'GH' },
  { name: '突尼斯', region: '非洲', code: 'TN' },
  { name: '坦桑尼亚', region: '非洲', code: 'TZ' },
  { name: '安哥拉', region: '非洲', code: 'AO' },
  { name: '塞内加尔', region: '非洲', code: 'SN' }
];

async function main() {
  console.log('🔄 Starting reset and seeding for industries and countries...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. 重置行业大类（只保留 docs 里的 54 个）
    // 先删掉不在标准列表里的行业名（cascade 会删掉对应的 report_industries 和 news_industries 关联）
    const deleteIndustriesQuery = `
      DELETE FROM industries 
      WHERE name NOT IN (${STANDARD_INDUSTRIES.map((_, i) => `$${i + 1}`).join(', ')})
    `;
    await client.query(deleteIndustriesQuery, STANDARD_INDUSTRIES);
    console.log('✓ Cleared non-standard industries.');

    // 插入 54 个标准大类
    for (const name of STANDARD_INDUSTRIES) {
      await client.query(
        'INSERT INTO industries (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
        [name]
      );
    }
    console.log('✓ Seeded 54 standard industries.');

    // 2. 重置国家与区域分类
    // 删掉不在标准列表里的国家（cascade 会删掉 report_countries 和 news_countries 关联）
    const standardCountryNames = STANDARD_COUNTRIES.map(c => c.name);
    const deleteCountriesQuery = `
      DELETE FROM countries 
      WHERE name NOT IN (${standardCountryNames.map((_, i) => `$${i + 1}`).join(', ')})
    `;
    await client.query(deleteCountriesQuery, standardCountryNames);
    console.log('✓ Cleared non-standard countries.');

    // 插入标准国家列表，并确保 region 分类正确
    for (const c of STANDARD_COUNTRIES) {
      await client.query(
        `INSERT INTO countries (name, region, code) VALUES ($1, $2, $3)
         ON CONFLICT (name) DO UPDATE SET region = EXCLUDED.region, code = EXCLUDED.code`,
        [c.name, c.region, c.code]
      );
    }
    console.log('✓ Seeded and updated all standard countries with 6-region classification.');

    await client.query('COMMIT');
    console.log('✅ Seeding transaction finished.');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error seeding databases:', err);
  } finally {
    client.release();
  }

  // 3. 运行回填逻辑，将现有的报告关联至新映射的行业与国家大类中
  console.log('\n🔄 Running backfill to restore relations with new databases...');
  try {
    const backfillClient = await pool.connect();
    
    // 获取新录入的国家和行业
    const countriesRes = await backfillClient.query('SELECT id, name, region FROM countries');
    const countries = countriesRes.rows;

    const industriesRes = await backfillClient.query('SELECT id, name FROM industries');
    const industries = industriesRes.rows;

    const { getStandardCategory } = require('../lib/category-mapper.js');

    // 获取所有报告
    const reportsRes = await backfillClient.query('SELECT id, title, market_region FROM reports');
    const reports = reportsRes.rows;

    await backfillClient.query('BEGIN');

    for (const rep of reports) {
      const reportId = rep.id;
      const title = rep.title;
      const marketRegion = rep.market_region || '';

      // A. 匹配国家
      const matchedCountryIds = new Set();
      const regions = marketRegion.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      for (const r of regions) {
        let mappedName = r;
        if (r === 'germany') mappedName = '德国';
        if (r === 'austria') mappedName = '奥地利';
        if (r === 'europe') continue;
        if (r === 'global') continue;

        const foundCountry = countries.find(c => c.name.toLowerCase() === mappedName || c.name === mappedName);
        if (foundCountry) {
          matchedCountryIds.add(foundCountry.id);
        }
      }

      for (const c of countries) {
        if (title.includes(c.name) || marketRegion.includes(c.name)) {
          matchedCountryIds.add(c.id);
        }
      }

      // 写入 report_countries 关联
      await backfillClient.query('DELETE FROM report_countries WHERE report_id = $1', [reportId]);
      for (const ctyId of matchedCountryIds) {
        await backfillClient.query(
          'INSERT INTO report_countries (report_id, country_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [reportId, ctyId]
        );
      }

      // B. 匹配行业
      const matchedIndustryIds = new Set();
      const titleWords = title.split(/[\s\-—°,°|（）()\/_]/).map(s => s.trim()).filter(Boolean);
      for (const word of titleWords) {
        const stdCat = getStandardCategory(word);
        if (stdCat) {
          const industryRow = industries.find(i => i.name === stdCat);
          if (industryRow) {
            matchedIndustryIds.add(industryRow.id);
          }
        }
      }

      // DIY 零售商补充
      const upperTitle = title.toUpperCase();
      if (
        upperTitle.includes('BAUHAUS') || 
        upperTitle.includes('TOOM') || 
        upperTitle.includes('OBI') || 
        upperTitle.includes('HAGEBAU') ||
        upperTitle.includes('欧倍德')
      ) {
        const wj = industries.find(i => i.name === '五金');
        const gj = industries.find(i => i.name === '工具');
        if (wj) matchedIndustryIds.add(wj.id);
        if (gj) matchedIndustryIds.add(gj.id);
      }

      // 写入 report_industries 关联
      await backfillClient.query('DELETE FROM report_industries WHERE report_id = $1', [reportId]);
      for (const indId of matchedIndustryIds) {
        await backfillClient.query(
          'INSERT INTO report_industries (report_id, industry_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [reportId, indId]
        );
      }
    }

    await backfillClient.query('COMMIT');
    console.log('✅ Backfill completed successfully!');
    backfillClient.release();
  } catch (err) {
    console.error('❌ Error during backfill:', err);
  } finally {
    await pool.end();
  }
}

main();
