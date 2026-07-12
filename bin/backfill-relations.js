const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('Starting backfill for existing report relations...');
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. 确保一些额外的国家在 countries 表中存在，以匹配现有数据中的奥地利、瑞士、匈牙利
    const extraCountries = [
      { name: '奥地利', region: '欧洲', code: 'AT' },
      { name: '瑞士', region: '欧洲', code: 'CH' },
      { name: '匈牙利', region: '欧洲', code: 'HU' },
      { name: '爱尔兰', region: '欧洲', code: 'IE' }
    ];

    for (const c of extraCountries) {
      await client.query(
        `INSERT INTO countries (name, region, code) VALUES ($1, $2, $3)
         ON CONFLICT (name) DO NOTHING`,
        [c.name, c.region, c.code]
      );
    }
    console.log('✓ Ensured extra countries exist.');

    // 获取所有国家和行业数据以供匹配
    const countriesRes = await client.query('SELECT id, name, region FROM countries');
    const countries = countriesRes.rows;

    const industriesRes = await client.query('SELECT id, name FROM industries');
    const industries = industriesRes.rows;

    // 获取所有报告
    const reportsRes = await client.query('SELECT id, title, market_region FROM reports');
    const reports = reportsRes.rows;

    console.log(`Analyzing ${reports.length} reports...`);

    for (const rep of reports) {
      const reportId = rep.id;
      const title = rep.title;
      const marketRegion = rep.market_region || '';

      console.log(`\nReport: "${title}" (Market: "${marketRegion}")`);

      // 2. 匹配国家
      const matchedCountryIds = new Set();
      
      // 按逗号分割地区，并尝试与数据库里的国家名或英文映射进行匹配
      const regions = marketRegion.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      for (const r of regions) {
        // 直译映射
        let mappedName = r;
        if (r === 'germany') mappedName = '德国';
        if (r === 'austria') mappedName = '奥地利';
        if (r === 'europe') continue; // 欧洲是区域，暂不映射单个国家
        if (r === 'global') continue;

        const foundCountry = countries.find(c => c.name.toLowerCase() === mappedName || c.name === mappedName);
        if (foundCountry) {
          matchedCountryIds.add(foundCountry.id);
        }
      }

      // 如果是欧洲但没有匹配到特定国家，我们可以根据常用欧洲国家匹配，或者直接遍历包含的国家字眼
      // 检查 title/market_region 是否包含特定国家字眼
      for (const c of countries) {
        if (title.includes(c.name) || marketRegion.includes(c.name)) {
          matchedCountryIds.add(c.id);
        }
      }

      // 写入 report_countries 关联
      await client.query('DELETE FROM report_countries WHERE report_id = $1', [reportId]);
      for (const ctyId of matchedCountryIds) {
        await client.query(
          'INSERT INTO report_countries (report_id, country_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [reportId, ctyId]
        );
      }
      console.log(`  -> Matched ${matchedCountryIds.size} countries`);

      // 3. 匹配行业 (根据标题关键字对齐 54 个标准大类)
      const { getStandardCategory } = require('../lib/category-mapper.js');
      const matchedIndustryIds = new Set();
      
      // 拆分标题词汇进行大类映射
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

      // 针对 DIY 零售商渠道商的综合品类补充绑定
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
      await client.query('DELETE FROM report_industries WHERE report_id = $1', [reportId]);
      for (const indId of matchedIndustryIds) {
        await client.query(
          'INSERT INTO report_industries (report_id, industry_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [reportId, indId]
        );
      }
      console.log(`  -> Matched ${matchedIndustryIds.size} industries`);
    }

    await client.query('COMMIT');
    console.log('\n✅ Backfill completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error during backfill:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
