const fs = require('fs');
const path = require('path');
const http = require('http');

const reportDir = 'D:\\我的APP\\客户档案\\南欧\\意大利';
const targetUrl = 'http://124.222.201.143:3000/api/agent/publish';
const agentApiKey = 'automation_agent_secret';

function extractMeta(html, name) {
  const match = html.match(new RegExp(`<meta[^>]*?name=["']${name}["'][^>]*?content=["']([^"']*)["']`, 'i')) ||
                html.match(new RegExp(`<meta[^>]*?content=["']([^"']*)["'][^>]*?name=["']${name}["']`, 'i'));
  return match ? match[1].trim() : '';
}

function uploadOne(filePath) {
  return new Promise((resolve) => {
    const fileName = path.basename(filePath);
    const html = fs.readFileSync(filePath, 'utf8');

    const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : fileName.replace('.html', '');

    let category = extractMeta(html, 'category') || 'customer';
    const summary = extractMeta(html, 'summary');
    const regions = extractMeta(html, 'regions') || extractMeta(html, 'region') || '意大利, 欧洲';
    const products = extractMeta(html, 'products') || extractMeta(html, 'product') || '餐厨器皿, 家居用品, 五金, 建筑及装饰材料';
    const companyName = extractMeta(html, 'company_name');

    const payload = JSON.stringify({
      type: 'report',
      title: title,
      category: category,
      summary: summary,
      contentHtml: html,
      region: regions.split(',')[0].trim(),
      country: regions,
      industry: products.split(',')[0].trim(),
      tags: products.split(',').map(s => s.trim()).filter(Boolean)
    });

    const url = new URL(targetUrl);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(payload, 'utf8'),
        'Authorization': `Bearer ${agentApiKey}`
      },
      timeout: 120000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode === 200) {
            console.log(`[OK] (${companyName || title}) Published successfully -> ID: ${json.id}`);
            resolve({ file: fileName, success: true, id: json.id, title, category });
          } else {
            console.error(`[ERR] (${fileName}) Status ${res.statusCode}: ${data.substring(0, 200)}`);
            resolve({ file: fileName, success: false, error: data });
          }
        } catch (e) {
          console.error(`[ERR] (${fileName}) JSON Parse error: ${data.substring(0, 100)}`);
          resolve({ file: fileName, success: false, error: data });
        }
      });
    });

    req.on('error', (e) => {
      console.error(`[ERR] (${fileName}) Network Error: ${e.message}`);
      resolve({ file: fileName, success: false, error: e.message });
    });

    req.write(payload);
    req.end();
  });
}

async function run() {
  const files = fs.readdirSync(reportDir)
    .filter(f => f.endsWith('.html') && fs.statSync(path.join(reportDir, f)).isFile());
    
  console.log(`Found ${files.length} Italy reports to upload in ${reportDir}:\n`);
  files.forEach(f => console.log(`  - ${f}`));
  console.log('');

  const results = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    console.log(`[${i + 1}/${files.length}] Uploading ${f} ...`);
    const res = await uploadOne(path.join(reportDir, f));
    results.push(res);
  }

  console.log('\n========================================');
  console.log('         ITALY UPLOAD SUMMARY           ');
  console.log('========================================');
  const successCount = results.filter(r => r.success).length;
  console.log(`Total: ${results.length}, Success: ${successCount}, Failed: ${results.length - successCount}\n`);

  results.forEach((r, idx) => {
    if (r.success) {
      console.log(`✓ [${idx + 1}] [${r.category}] ${r.file} -> ${r.title} (ID: ${r.id})`);
    } else {
      console.log(`✗ [${idx + 1}] ${r.file} -> FAILED (${r.error})`);
    }
  });
}

run();
