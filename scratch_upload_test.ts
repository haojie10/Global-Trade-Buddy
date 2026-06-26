const { Client } = require('pg');
const fs = require('fs');
const uploadHandler = require('./pages/api/admin/reports/upload').default;
const { getGraphData } = require('./pages/api/user/graph');

const projectEnvPath = './.env';
let connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  try {
    const envFile = fs.readFileSync(projectEnvPath, 'utf8');
    const match = envFile.match(/DATABASE_URL=(.+)/);
    if (match) {
      connectionString = match[1].trim();
    }
  } catch (e) {
    console.error('Error reading .env file:', e);
  }
}

const client = new Client({
  connectionString: connectionString,
});

function createMockReqRes(body: any) {
  const req = {
    method: 'POST',
    body,
  } as any;
  let statusVal = 200;
  let jsonVal: any = null;
  const res = {
    status(code: number) {
      statusVal = code;
      return this;
    },
    json(data: any) {
      jsonVal = data;
      return this;
    },
  } as any;
  return { req, res, getStatus: () => statusVal, getJson: () => jsonVal };
}

async function main() {
  await client.connect();
  try {
    console.log('=== START UPLOAD PIPELINE TEST ===');

    // 1. 模拟上传 BAUHAUS 报告
    console.log('\n1. Uploading BAUHAUS report...');
    const bauhausHtml = `
      <html>
        <head>
          <title>BAUHAUS - 360° 企业战略情报报告</title>
          <meta name="category" content="customer">
          <meta name="market_region" content="欧洲">
          <meta name="summary" content="建材, 五金工具, 园艺">
        </head>
        <body>
          <h1>BAUHAUS 的大卖场经营情况</h1>
          <p>BAUHAUS AG 是一家著名的欧洲建材零售巨头。</p>
        </body>
      </html>
    `;
    const bauhausTags = {
      companies: ["BAUHAUS AG", "BAUHAUS", "包豪斯", "德国包豪斯"],
      products: ["建材", "五金工具", "园艺"],
      channels: ["OBI", "Hornbach", "toom Baumarkt"],
      sisters: []
    };
    
    const { req: req1, res: res1, getJson: getJson1 } = createMockReqRes({
      rawHtml: bauhausHtml,
      manualTags: bauhausTags,
      category: 'customer'
    });

    await uploadHandler(req1, res1);
    const bReportRes = getJson1();
    console.log('  Upload Res:', bReportRes);

    // 2. 模拟上传 Brilliant AG 报告
    console.log('\n2. Uploading Brilliant report...');
    const brilliantHtml = `
      <html>
        <head>
          <title>Brilliant AG - 360° 企业战略情报报告</title>
          <meta name="category" content="customer">
          <meta name="market_region" content="德国, 欧洲">
          <meta name="summary" content="住宅照明, 室内照明, 吸顶灯">
        </head>
        <body>
          <h1>Brilliant AG 的销售渠道分析</h1>
          <p>Brilliant AG 的产品在 Bauhaus，OBI 以及 Hornbach 卖。</p>
        </body>
      </html>
    `;
    const brilliantTags = {
      companies: ["Brilliant AG", "Brilliant", "Brillanteuchten AG"],
      competitors: ["Paulmann", "EGLO", "Trio Leuchten"],
      products: ["住宅照明", "室内照明", "吸顶灯"],
      regions: ["德国", "欧洲"],
      channels: ["Bauhaus", "OBI", "Hornbach"],
      sisters: ["NLC Group of Companies Limited", "Relight", "Lightbox"]
    };

    const { req: req2, res: res2, getJson: getJson2 } = createMockReqRes({
      rawHtml: brilliantHtml,
      manualTags: brilliantTags,
      category: 'customer'
    });

    await uploadHandler(req2, res2);
    const brReportRes = getJson2();
    console.log('  Upload Res:', brReportRes);

    // 3. 验证数据库中这俩报告的主体和角色
    console.log('\n3. Verification: Querying Database Reports & Entities...');
    const repRes = await client.query(`
      SELECT r.id, r.title, r.primary_entity_id, e.canonical_name as primary_name
      FROM reports r
      LEFT JOIN entities e ON r.primary_entity_id = e.id
    `);
    repRes.rows.forEach((r: any) => {
      console.log(`  Report: "${r.title}", Primary ID: ${r.primary_entity_id}, Primary Name: ${r.primary_name}`);
    });

    console.log('\n--- Checking report_entities for Brilliant Report ---');
    const bReport = repRes.rows.find((r: any) => r.title.includes('Brilliant'));
    if (bReport) {
      const entRes = await client.query(`
        SELECT e.canonical_name, re.role 
        FROM report_entities re
        JOIN entities e ON re.entity_id = e.id
        WHERE re.report_id = $1
      `, [bReport.id]);
      entRes.rows.forEach((row: any) => {
        console.log(`    Entity: "${row.canonical_name}", Role: "${row.role}"`);
      });
    }

    // 4. 调用 getGraphData 生成图谱数据，检验连线
    console.log('\n4. Verification: Querying Graph Data Link Relation...');
    // 获取 admin 角色用户
    const userRes = await client.query(`SELECT id, role FROM users WHERE role = 'admin' LIMIT 1`);
    if (userRes.rows.length > 0) {
      const adminUser = userRes.rows[0];
      const graphData = await getGraphData(adminUser.id, adminUser.role, client);

      console.log('--- Graph links found ---');
      graphData.links.forEach((l: any) => {
        const sourceNode = graphData.nodes.find((n: any) => n.id === l.source);
        const targetNode = graphData.nodes.find((n: any) => n.id === l.target);
        console.log(`  Link: [${sourceNode ? sourceNode.title : l.source}] --(${l.relation_key} / ${l.relation_type})--> [${targetNode ? targetNode.title : l.target}]`);
      });
    }

  } catch (err) {
    console.error('Test error:', err);
  } finally {
    await client.end();
  }
}

main();
