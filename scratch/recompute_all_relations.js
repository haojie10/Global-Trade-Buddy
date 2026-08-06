process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Shj553551@124.222.201.143:5432/postgres';

const GENERIC_KEYWORDS = new Set([
  '工具', '五金', '食品', '代理商', '分销商', '渠道商', '供应商', '客户',
  '紧固件', '建筑及装饰材料', '家居用品', '家具'
]);

async function recomputeRelations() {
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 15000
  });

  try {
    await client.connect();
    console.log("Connected to DB.");

    const { RETAILER_ENTITIES } = require('d:/我的APP/Globaltradebuddy/lib/entity-constants.ts');
    const { getStandardCategory } = require('d:/我的APP/Globaltradebuddy/lib/category-mapper.ts');

    // 1. 完全清空旧 relations 表
    console.log("Clearing old relations table with legacy 'produces' types...");
    await client.query(`TRUNCATE TABLE relations`);

    // 2. 获取全库报告及其主体
    const reportsRes = await client.query(`
      SELECT r.id, r.title, r.category, r.market_region, r.primary_entity_id, e.canonical_name AS primary_name
      FROM reports r
      LEFT JOIN entities e ON r.primary_entity_id = e.id
    `);
    const reports = reportsRes.rows;
    console.log(`Found ${reports.length} reports in DB.`);

    // 3. 获取每个报告的实体角色 Map
    const repEntsRes = await client.query(`
      SELECT re.report_id, re.entity_id, re.role, e.canonical_name, e.entity_type
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
        canonical_name: row.canonical_name,
        entity_type: row.entity_type
      });
    }

    // 4. 获取每个报告关联的 GTB 标准行业品类列表 (industries)
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

    let insertedCount = 0;

    // 两两计算关系（全量严密规则）
    for (let i = 0; i < reports.length; i++) {
      for (let j = i + 1; j < reports.length; j++) {
        const rA = reports[i];
        const rB = reports[j];

        const entMapA = repEntMap.get(rA.id) || new Map();
        const entMapB = repEntMap.get(rB.id) || new Map();

        const indSetA = repIndMap.get(rA.id) || new Set();
        const indSetB = repIndMap.get(rB.id) || new Set();

        const primaryIdA = rA.primary_entity_id;
        const primaryIdB = rB.primary_entity_id;

        const primaryNameA = rA.primary_name ? rA.primary_name.toLowerCase().trim() : '';
        const primaryNameB = rB.primary_name ? rB.primary_name.toLowerCase().trim() : '';

        let relType = null;
        let relKey = '';
        let sourceReportId = rA.id;
        let targetReportId = rB.id;

        const isBothCompany = (rA.category === 'customer' && rB.category === 'customer');

        // ---- 优先级 1: 竞争关系 (Competitor) ----
        if (isBothCompany) {
          const aHasBAsComp = primaryIdB && entMapA.has(primaryIdB) && entMapA.get(primaryIdB).role === 'competitor';
          const bHasAAsComp = primaryIdA && entMapB.has(primaryIdA) && entMapB.get(primaryIdA).role === 'competitor';

          const isRetailerA = RETAILER_ENTITIES.has(primaryNameA);
          const isRetailerB = RETAILER_ENTITIES.has(primaryNameB);
          const isCrossRetailerBrand = (isRetailerA !== isRetailerB);

          if ((aHasBAsComp || bHasAAsComp) && !isCrossRetailerBrand) {
            relType = 'competitor';
            relKey = aHasBAsComp ? (rB.primary_name || '同业竞争') : (rA.primary_name || '同业竞争');
            if (rA.id > rB.id) {
              sourceReportId = rB.id;
              targetReportId = rA.id;
            }
          }
        }

        // ---- 优先级 2: 供销关系 (Supplier) ----
        if (!relType && isBothCompany) {
          const aHasBAsSupplier = primaryIdB && entMapA.has(primaryIdB) && entMapA.get(primaryIdB).role === 'supplier';
          const bHasAAsCustomerOrChannel = primaryIdA && entMapB.has(primaryIdA) && 
            ['customer', 'channel'].includes(entMapB.get(primaryIdA).role);

          const bHasAAsSupplier = primaryIdA && entMapB.has(primaryIdA) && entMapB.get(primaryIdA).role === 'supplier';
          const aHasBAsCustomerOrChannel = primaryIdB && entMapA.has(primaryIdB) && 
            ['customer', 'channel'].includes(entMapA.get(primaryIdB).role);

          if (aHasBAsSupplier || bHasAAsCustomerOrChannel) {
            relType = 'supplier';
            relKey = rB.primary_name || '供销渠道';
            sourceReportId = rB.id;
            targetReportId = rA.id;
          } else if (bHasAAsSupplier || aHasBAsCustomerOrChannel) {
            relType = 'supplier';
            relKey = rA.primary_name || '供销渠道';
            sourceReportId = rA.id;
            targetReportId = rB.id;
          }
        }

        // ---- 优先级 3: 经营关系 (Operation) ----
        if (!relType) {
          const isOneProductOneCompany = (rA.category === 'product' && rB.category === 'customer') || 
                                         (rA.category === 'customer' && rB.category === 'product');
          if (isOneProductOneCompany) {
            const prodReport = rA.category === 'product' ? rA : rB;

            const compIndSet = rA.category === 'customer' ? indSetA : indSetB;
            const prodIndSet = rA.category === 'product' ? indSetA : indSetB;

            // 优先依据品类报告后台绑定的真实关联行业，若无则解析标题
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
              let companyOperatesCategory = compIndSet.has(prodStandardCat);

              if (companyOperatesCategory) {
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

        // ---- 优先级 4: 提及关系 (Mention) ----
        if (!relType) {
          const aHasBAsSister = primaryIdB && entMapA.has(primaryIdB) && entMapA.get(primaryIdB).role === 'sister_parent';
          const bHasAAsSister = primaryIdA && entMapB.has(primaryIdA) && entMapB.get(primaryIdA).role === 'sister_parent';

          if (aHasBAsSister || bHasAAsSister) {
            relType = 'mention';
            relKey = '关联/姐妹公司';
            if (rA.id > rB.id) {
              sourceReportId = rB.id;
              targetReportId = rA.id;
            }
          } else {
            const sharedCats = new Set();
            for (const catA of indSetA) {
              if (indSetB.has(catA) && !GENERIC_KEYWORDS.has(catA)) {
                sharedCats.add(catA);
              }
            }

            if (sharedCats.size > 0) {
              relType = 'mention';
              relKey = Array.from(sharedCats)[0];
              if (rA.id > rB.id) {
                sourceReportId = rB.id;
                targetReportId = rA.id;
              }
            }
          }
        }

        if (relType) {
          await client.query(
            `INSERT INTO relations (report_id_a, report_id_b, relation_key, market_region, relation_type) 
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (report_id_a, report_id_b, relation_key) DO UPDATE SET relation_type = EXCLUDED.relation_type`,
            [sourceReportId, targetReportId, relKey, rA.market_region || rB.market_region || '全球', relType]
          );
          insertedCount++;
        }
      }
    }

    console.log(`\nSUCCESS! Rebuilt ${insertedCount} relations with RIGOROUS TYPES.`);

    const relTypesRes = await client.query(`
      SELECT relation_type, COUNT(*) 
      FROM relations 
      GROUP BY relation_type;
    `);
    console.log("\n=== New Relations Grouped by Type ===");
    console.table(relTypesRes.rows);

  } catch (err) {
    console.error("Recompute Error:", err);
  } finally {
    await client.end();
  }
}

recomputeRelations();
