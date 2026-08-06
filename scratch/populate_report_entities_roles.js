process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Shj553551@124.222.201.143:5432/postgres';

async function populateReportEntities() {
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 30000
  });

  try {
    await client.connect();
    console.log("Connected to DB.");

    // 1. 获取全库报告及其主体实体
    const reportsRes = await client.query(`
      SELECT r.id, r.title, r.summary, r.primary_entity_id, r.category, e.canonical_name AS primary_name, e.entity_type AS primary_entity_type
      FROM reports r
      LEFT JOIN entities e ON r.primary_entity_id = e.id
    `);
    const reports = reportsRes.rows;
    console.log(`Loaded ${reports.length} reports.`);

    // 2. 获取全库实体
    const entitiesRes = await client.query(`SELECT id, canonical_name, entity_type FROM entities`);
    const allEntities = entitiesRes.rows;

    const channelKeywords = [
      'screwfix', 'toolstation', 'city electrical factors', 'rexel', 'edmundson',
      'b&m', 'the range', 'rossmann', 'walmart', 'target', 'costco', 'home depot',
      'lowe', 'bunnings', 'kingfisher', 'castorama', 'obi', 'bauhaus', 'tesco',
      'asda', 'sainsbury', 'lidl', 'aldi', 'carrefour', 'auchan', 'tj maxx',
      'tjmaxx', 'tk maxx', 'dollar general', 'dollar tree', 'family dollar',
      'canadian tire', 'dunelm', 'action', 'kruidvat', 'zeeman', 'pepco'
    ];

    function isChannel(name) {
      if (!name) return false;
      const lower = name.toLowerCase();
      return channelKeywords.some(k => lower.includes(k));
    }

    let insertedCount = 0;

    for (const r of reports) {
      const textToSearch = `${r.title} ${r.summary || ''}`.toLowerCase();

      // 清理原先该报告下 role 为 null 的碎片
      await client.query(`DELETE FROM report_entities WHERE report_id = $1`, [r.id]);

      const seenEnts = new Set();

      // A. 主体实体写入 primary
      if (r.primary_entity_id) {
        await client.query(
          `INSERT INTO report_entities (report_id, entity_id, role) VALUES ($1, $2, 'primary') ON CONFLICT DO NOTHING`,
          [r.id, r.primary_entity_id]
        );
        seenEnts.add(r.primary_entity_id);
        insertedCount++;
      }

      // B. 根据正文/摘要中的实体与实体类型自动匹配 role
      for (const ent of allEntities) {
        if (seenEnts.has(ent.id)) continue;
        if (!ent.canonical_name || ent.canonical_name.length < 3) continue;

        const entNameLower = ent.canonical_name.toLowerCase();
        if (textToSearch.includes(entNameLower)) {
          let role = 'mentioned';
          const eType = ent.entity_type;

          if (eType === 'product') {
            role = 'product';
          } else if (eType === 'channel' || isChannel(ent.canonical_name)) {
            role = 'channel';
          } else if (eType === 'competitor') {
            role = 'competitor';
          } else if (eType === 'company') {
            if (isChannel(r.primary_name)) {
              role = 'supplier'; // 渠道商报告里提到的品牌厂商是其供应商
            } else {
              role = 'competitor'; // 品牌商报告里提到的其他厂商是其竞争对手
            }
          }

          await client.query(
            `INSERT INTO report_entities (report_id, entity_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
            [r.id, ent.id, role]
          );
          seenEnts.add(ent.id);
          insertedCount++;
        }
      }
    }

    console.log(`★ SUCCESS! Populated ${insertedCount} report_entities with explicit roles!`);

    const roleSummary = await client.query(`
      SELECT role, COUNT(*) 
      FROM report_entities 
      GROUP BY role;
    `);
    console.log("\n=== report_entities Roles Summary ===");
    console.table(roleSummary.rows);

  } catch (err) {
    console.error("Populate Error:", err);
  } finally {
    await client.end();
  }
}

populateReportEntities();
