process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Shj553551@124.222.201.143:5432/postgres';

const GENERIC_KEYWORDS = new Set([
  '工具', '五金', '食品', '代理商', '分销商', '渠道商', '供应商', '客户',
  '紧固件', '建筑及装饰材料', '家居用品', '家具'
]);

// 知名专业渠道商/超市/批发商集合
const CHANNEL_KEYWORDS = [
  'screwfix', 'toolstation', 'city electrical factors', 'rexel', 'edmundson',
  'b&m', 'the range', 'rossmann', 'walmart', 'target', 'costco', 'home depot',
  'lowe', 'bunnings', 'kingfisher', 'castorama', 'obi', 'bauhaus', 'tesco',
  'asda', 'sainsbury', 'lidl', 'aldi', 'carrefour', 'auchan', 'tj maxx',
  'tjmaxx', 'tk maxx', 'dollar general', 'dollar tree', 'family dollar',
  'canadian tire', 'dunelm', 'action', 'kruidvat', 'zeeman', 'pepco', 'cef',
  'myers', 'myer', 'billa', 'lenta', 'migros', 'hipercor', 'poundland',
  'matalan', 'tchibo', 'xxxlutz', 'cencosud', 'jumbo', 'ripley', 'robert dyas'
];

function isChannel(name, title) {
  const text = `${name || ''} ${title || ''}`.toLowerCase();
  return CHANNEL_KEYWORDS.some(k => text.includes(k));
}

function isSameMarket(regionA, regionB) {
  if (!regionA || !regionB) return false;
  const rA = regionA.trim().toLowerCase();
  const rB = regionB.trim().toLowerCase();
  if (rA === '全球' || rB === '全球') return false;
  if (rA === rB) return true;
  if (rA.includes(rB) || rB.includes(rA)) return true;
  return false;
}

async function fixRealBusinessRelations() {
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 30000
  });

  try {
    await client.connect();
    console.log("Connected to DB.");

    const { getStandardCategory } = require('d:/我的APP/Globaltradebuddy/lib/category-mapper.ts');

    // 1. 获取全库报告及其主体
    const reportsRes = await client.query(`
      SELECT r.id, r.title, r.category, r.market_region, r.summary, r.primary_entity_id, e.canonical_name AS primary_name, e.entity_type AS primary_entity_type
      FROM reports r
      LEFT JOIN entities e ON r.primary_entity_id = e.id
    `);
    const reports = reportsRes.rows;
    console.log(`Loaded ${reports.length} reports.`);

    // 2. 获取实体 role
    const repEntsRes = await client.query(`
      SELECT re.report_id, re.entity_id, re.role, e.canonical_name
      FROM report_entities re
      JOIN entities e ON re.entity_id = e.id
    `);
    const repEntMap = new Map();
    for (const row of repEntsRes.rows) {
      if (!repEntMap.has(row.report_id)) {
        repEntMap.set(row.report_id, new Map());
      }
      repEntMap.get(row.report_id).set(row.entity_id, {
        role: row.role,
        canonical_name: row.canonical_name
      });
    }

    // 3. 获取每个报告关联的行业品类
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
    const pairSeen = new Set();

    // 清空旧 relations
    await client.query(`TRUNCATE TABLE relations`);

    for (let i = 0; i < reports.length; i++) {
      for (let j = i + 1; j < reports.length; j++) {
        const rA = reports[i];
        const rB = reports[j];

        const pairKey = [rA.id, rB.id].sort().join(':::');
        if (pairSeen.has(pairKey)) continue;

        const indSetA = repIndMap.get(rA.id) || new Set();
        const indSetB = repIndMap.get(rB.id) || new Set();

        const entMapA = repEntMap.get(rA.id) || new Map();
        const entMapB = repEntMap.get(rB.id) || new Map();

        const primaryIdA = rA.primary_entity_id;
        const primaryIdB = rB.primary_entity_id;

        const primaryNameA = rA.primary_name ? rA.primary_name.toLowerCase().trim() : '';
        const primaryNameB = rB.primary_name ? rB.primary_name.toLowerCase().trim() : '';

        let relType = null;
        let relKey = '';
        let sourceReportId = rA.id;
        let targetReportId = rB.id;

        const isBothCompany = (rA.category === 'customer' && rB.category === 'customer');

        if (isBothCompany) {
          const isChannelA = isChannel(primaryNameA, rA.title);
          const isChannelB = isChannel(primaryNameB, rB.title);

          // 核心前提：必须处于同一个市场（如英国 vs 英国）
          const inSameMarket = isSameMarket(rA.market_region, rB.market_region);

          let sharedCategory = null;
          for (const catA of indSetA) {
            if (indSetB.has(catA) && !GENERIC_KEYWORDS.has(catA)) {
              sharedCategory = catA;
              break;
            }
          }

          if (inSameMarket && sharedCategory) {
            // 真实商业关系判断：
            // 如果一家是品牌厂商，一家是渠道商 -> 建立 🟢 供销关系 (supplier)！
            if (isChannelA !== isChannelB) {
              relType = 'supplier';
              relKey = sharedCategory;
              if (isChannelB) {
                sourceReportId = rA.id; // A是品牌供方 (如 JCC)
                targetReportId = rB.id; // B是渠道买方 (如 Toolstation)
              } else {
                sourceReportId = rB.id; // B是品牌供方 (如 JCC)
                targetReportId = rA.id; // A是渠道买方 (如 Toolstation)
              }
            } else {
              // 如果同为渠道商（Screwfix vs Toolstation）或 同为品牌厂商 -> 建立 🔴 竞争关系 (competitor)！
              relType = 'competitor';
              relKey = sharedCategory;
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

        // ---- 4. 提及关系 (Mention: 同市场/姐妹公司) ----
        if (!relType) {
          const aHasBAsSister = primaryIdB && entMapA.has(primaryIdB) && entMapA.get(primaryIdB).role === 'sister_parent';
          const bHasAAsSister = primaryIdA && entMapB.has(primaryIdA) && entMapB.get(primaryIdA).role === 'sister_parent';
          const isSister = aHasBAsSister || bHasAAsSister;

          let sharedAny = null;
          for (const catA of indSetA) {
            if (indSetB.has(catA)) {
              sharedAny = catA;
              break;
            }
          }

          if (isSister) {
            relType = 'mention';
            relKey = '姐妹/关联公司';
            if (rA.id > rB.id) {
              sourceReportId = rB.id;
              targetReportId = rA.id;
            }
          } else if (sharedAny && isSameMarket(rA.market_region, rB.market_region)) {
            relType = 'mention';
            relKey = sharedAny;
            if (rA.id > rB.id) {
              sourceReportId = rB.id;
              targetReportId = rA.id;
            }
          }
        }

        if (relType) {
          pairSeen.add(pairKey);
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

    console.log(`Calculated ${rowsToInsert.length} REAL BUSINESS relations. Batch inserting...`);

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

    console.log("★ SUCCESS! Perfect Real Business Relations Restored!");

    const summaryRes = await client.query(`
      SELECT relation_type, COUNT(*) 
      FROM relations 
      GROUP BY relation_type
    `);
    console.log("\n=== Final Verified Real Business Summary in DB ===");
    console.table(summaryRes.rows);

    // 专门核验 JCC 与 Toolstation 之间的关系记录
    const checkJccToolstation = await client.query(`
      SELECT r1.title AS supplier_brand, r2.title AS channel_buyer, rel.relation_key, rel.relation_type
      FROM relations rel
      JOIN reports r1 ON rel.report_id_a = r1.id
      JOIN reports r2 ON rel.report_id_b = r2.id
      WHERE (r1.title LIKE '%J C C%' AND r2.title LIKE '%Toolstation%')
         OR (r1.title LIKE '%Toolstation%' AND r2.title LIKE '%J C C%')
    `);
    console.log("\n=== Verification for JCC Lighting vs Toolstation Limited ===");
    console.table(checkJccToolstation.rows);

  } catch (err) {
    console.error("Fix Real Business Error:", err);
  } finally {
    await client.end();
  }
}

fixRealBusinessRelations();
