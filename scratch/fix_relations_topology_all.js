process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Shj553551@124.222.201.143:5432/postgres';

const GENERIC_KEYWORDS = new Set([
  '工具', '五金', '食品', '代理商', '分销商', '渠道商', '供应商', '客户',
  '紧固件', '建筑及装饰材料', '家居用品', '家具'
]);

// 知名专业渠道商/超市集合
const RETAILER_KEYWORDS = [
  'screwfix', 'toolstation', 'city electrical factors', 'rexel', 'edmundson',
  'b&m', 'the range', 'rossmann', 'walmart', 'target', 'costco', 'home depot',
  'lowe', 'bunnings', 'kingfisher', 'castorama', 'obi', 'bauhaus', 'tesco',
  'asda', 'sainsbury', 'lidl', 'aldi', 'carrefour', 'auchan', 'tj maxx',
  'tjmaxx', 'tk maxx', 'dollar general', 'dollar tree', 'family dollar',
  'canadian tire', 'dunelm', 'action', 'kruidvat', 'zeeman', 'pepco'
];

function isChannelCompany(name) {
  if (!name) return false;
  const lower = name.toLowerCase();
  return RETAILER_KEYWORDS.some(k => lower.includes(k));
}

async function fixRelationsAll() {
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 30000
  });

  try {
    await client.connect();
    console.log("Connected to DB.");

    const { getStandardCategory } = require('d:/我的APP/Globaltradebuddy/lib/category-mapper.ts');

    // 1. 完全清空旧 relations 表
    console.log("Clearing old relations table...");
    await client.query(`TRUNCATE TABLE relations`);

    // 2. 获取全库报告及其主体
    const reportsRes = await client.query(`
      SELECT r.id, r.title, r.category, r.market_region, r.summary, r.primary_entity_id, e.canonical_name AS primary_name, e.entity_type AS primary_entity_type
      FROM reports r
      LEFT JOIN entities e ON r.primary_entity_id = e.id
    `);
    const reports = reportsRes.rows;
    console.log(`Loaded ${reports.length} reports.`);

    // 3. 获取实体提及 Map
    const allEntitiesRes = await client.query(`SELECT id, canonical_name, entity_type FROM entities;`);
    const allEntities = allEntitiesRes.rows;

    const reportMentionedEnts = new Map(); // report_id -> Set<entity_id>
    for (const r of reports) {
      const set = new Set();
      const textToSearch = `${r.title} ${r.summary || ''}`.toLowerCase();
      for (const ent of allEntities) {
        if (ent.canonical_name && ent.canonical_name.length > 2) {
          if (textToSearch.includes(ent.canonical_name.toLowerCase())) {
            set.add(ent.id);
          }
        }
      }
      reportMentionedEnts.set(r.id, set);
    }

    // 4. 获取每个报告关联的行业品类
    const repIndRes = await client.query(`
      SELECT ri.report_id, i.name AS industry_name
      FROM report_industries ri
      JOIN industries i ON ri.industry_id = i.id
    `);
    const repIndMap = new Map();
    for (const row of repIndRes.rows) {
      if (!repIndMap.has(row.report_id)) {
        repIndMap.set(row.report_id, new Set());
      }
      repIndMap.get(row.report_id).add(row.industry_name);
    }

    const rowsToInsert = [];

    // 两两逻辑计算（全量严密 4 色规则）
    for (let i = 0; i < reports.length; i++) {
      for (let j = i + 1; j < reports.length; j++) {
        const rA = reports[i];
        const rB = reports[j];

        const indSetA = repIndMap.get(rA.id) || new Set();
        const indSetB = repIndMap.get(rB.id) || new Set();

        const primaryIdA = rA.primary_entity_id;
        const primaryIdB = rB.primary_entity_id;

        const primaryNameA = rA.primary_name ? rA.primary_name.toLowerCase().trim() : '';
        const primaryNameB = rB.primary_name ? rB.primary_name.toLowerCase().trim() : '';

        const mentA = reportMentionedEnts.get(rA.id) || new Set();
        const mentB = reportMentionedEnts.get(rB.id) || new Set();

        let relType = null;
        let relKey = '';
        let sourceReportId = rA.id;
        let targetReportId = rB.id;

        const isBothCompany = (rA.category === 'customer' && rB.category === 'customer');

        if (isBothCompany) {
          const isChannelA = isChannelCompany(primaryNameA);
          const isChannelB = isChannelCompany(primaryNameB);
          const aMentionsB = primaryIdB && mentA.has(primaryIdB);
          const bMentionsA = primaryIdA && mentB.has(primaryIdA);

          // ---- 1. 供销关系 (Supplier: 品牌商/制造商 vs 渠道商/买方) ----
          if (isChannelA !== isChannelB && (aMentionsB || bMentionsA)) {
            relType = 'supplier';
            if (isChannelB) {
              sourceReportId = rA.id; // 品牌供方
              targetReportId = rB.id; // 渠道买方
              relKey = rB.primary_name || '供销渠道';
            } else {
              sourceReportId = rB.id; // 品牌供方
              targetReportId = rA.id; // 渠道买方
              relKey = rA.primary_name || '供销渠道';
            }
          }

          // ---- 2. 竞争关系 (Competitor: 同级别渠道商 vs 渠道商，或品牌商 vs 品牌商) ----
          if (!relType && (isChannelA === isChannelB)) {
            let sharedInd = false;
            for (const cat of indSetA) {
              if (indSetB.has(cat) && !GENERIC_KEYWORDS.has(cat)) {
                sharedInd = true;
                relKey = cat;
                break;
              }
            }
            if (sharedInd || aMentionsB || bMentionsA) {
              relType = 'competitor';
              if (!relKey) relKey = '同业竞争';
              if (rA.id > rB.id) {
                sourceReportId = rB.id;
                targetReportId = rA.id;
              }
            }
          }
        }

        // ---- 3. 经营关系 (Operation: 公司 vs 品类报告) ----
        if (!relType) {
          const isOneProductOneCompany = (rA.category === 'product' && rB.category === 'customer') || 
                                         (rA.category === 'customer' && rB.category === 'product');
          if (isOneProductOneCompany) {
            const prodReport = rA.category === 'product' ? rA : rB;
            const compIndSet = rA.category === 'customer' ? indSetA : indSetB;
            const prodIndSet = rA.category === 'product' ? indSetA : indSetB;

            let prodStandardCat = null;
            for (const indName of prodIndSet) {
              if (!GENERIC_KEYWORDS.has(indName)) {
                prodStandardCat = indName;
                break;
              }
            }
            if (!prodStandardCat) {
              prodStandardCat = getStandardCategory(prodReport.title);
            }

            if (prodStandardCat && !GENERIC_KEYWORDS.has(prodStandardCat)) {
              if (compIndSet.has(prodStandardCat)) {
                relType = 'operation';
                relKey = prodStandardCat;
                if (rA.category === 'customer') {
                  sourceReportId = rA.id;
                  targetReportId = rB.id;
                } else {
                  sourceReportId = rB.id;
                  targetReportId = rA.id;
                }
              }
            }
          }
        }

        // ---- 4. 提及关系 (Mention: 泛提及/共享行业) ----
        if (!relType) {
          const sharedCats = [];
          for (const catA of indSetA) {
            if (indSetB.has(catA) && !GENERIC_KEYWORDS.has(catA)) {
              sharedCats.push(catA);
            }
          }
          if (sharedCats.length > 0) {
            relType = 'mention';
            relKey = sharedCats[0];
            if (rA.id > rB.id) {
              sourceReportId = rB.id;
              targetReportId = rA.id;
            }
          }
        }

        if (relType) {
          rowsToInsert.push({
            a: sourceReportId,
            b: targetReportId,
            key: relKey,
            region: rA.market_region || rB.market_region || '全球',
            type: relType
          });
        }
      }
    }

    console.log(`Calculated ${rowsToInsert.length} valid relations. Batch inserting into DB...`);

    // 批量分块并发插入
    const chunkSize = 200;
    for (let k = 0; k < rowsToInsert.length; k += chunkSize) {
      const chunk = rowsToInsert.slice(k, k + chunkSize);
      const valueStrings = [];
      const queryParams = [];

      chunk.forEach((item, idx) => {
        const offset = idx * 5;
        valueStrings.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`);
        queryParams.push(item.a, item.b, item.key, item.region, item.type);
      });

      await client.query(
        `INSERT INTO relations (report_id_a, report_id_b, relation_key, market_region, relation_type)
         VALUES ${valueStrings.join(', ')}
         ON CONFLICT (report_id_a, report_id_b, relation_key) DO UPDATE SET relation_type = EXCLUDED.relation_type`,
        queryParams
      );
    }

    console.log("★ SUCCESS! Perfect 4-color topology restored!");

    const summaryRes = await client.query(`
      SELECT relation_type, COUNT(*) 
      FROM relations 
      GROUP BY relation_type
    `);
    console.log("\n=== Complete 4-Color Topology Summary in DB ===");
    console.table(summaryRes.rows);

  } catch (err) {
    console.error("Fix All Topology Error:", err);
  } finally {
    await client.end();
  }
}

fixRelationsAll();
