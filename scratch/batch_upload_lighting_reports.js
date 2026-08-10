const fs = require('fs');
const path = require('path');
const http = require('http');

const reportDir = 'D:\\我的APP\\品类洞察\\照明产品';
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

    const category = extractMeta(html, 'category') || 'product';
    const summary = extractMeta(html, 'summary');
    const regions = extractMeta(html, 'regions') || extractMeta(html, 'region') || '英国, 欧洲';
    const products = extractMeta(html, 'products') || extractMeta(html, 'product') || '照明产品';

    console.log(`[INFO] Preparing: ${fileName}`);
    console.log(`       Title: ${title}`);
    console.log(`       Category: ${category}`);
    console.log(`       Regions: ${regions}`);
    console.log(`       Products: ${products}`);

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
            console.log(`[OK] ${title} Published successfully -> ID: ${json.id}\n`);
            resolve({ file: fileName, success: true, id: json.id, title });
          } else {
            console.error(`[ERR] (${fileName}) Status ${res.statusCode}: ${data}\n`);
            resolve({ file: fileName, success: false, error: data });
          }
        } catch (e) {
          console.error(`[ERR] (${fileName}) JSON Parse error: ${data.substring(0, 100)}\n`);
          resolve({ file: fileName, success: false, error: data });
        }
      });
    });

    req.on('error', (e) => {
      console.error(`[ERR] (${fileName}) Network Error: ${e.message}\n`);
      resolve({ file: fileName, success: false, error: e.message });
    });

    req.write(payload);
    req.end();
  });
}

async function run() {
  const files = fs.readdirSync(reportDir).filter(f => f.endsWith('.html'));
  console.log(`Found ${files.length} category insight reports in ${reportDir}\n`);

  const results = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    console.log(`[${i + 1}/${files.length}] Uploading ${f} ...`);
    const res = await uploadOne(path.join(reportDir, f));
    results.push(res);
  }

  console.log('\n========================================');
  console.log('       CATEGORY UPLOAD SUMMARY          ');
  console.log('========================================');
  const successCount = results.filter(r => r.success).length;
  console.log(`Total: ${results.length}, Success: ${successCount}, Failed: ${results.length - successCount}\n`);

  results.forEach((r, idx) => {
    if (r.success) {
      console.log(`✓ [${idx + 1}] ${r.file} -> ${r.title} (ID: ${r.id})`);
    } else {
      console.log(`✗ [${idx + 1}] ${r.file} -> FAILED (${r.error})`);
    }
  });
}

run();
