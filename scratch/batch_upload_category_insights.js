const fs = require('fs');
const path = require('path');
const http = require('http');

const baseDir = 'D:\\我的APP\\品类洞察';
const targetFolders = ['个人护理用品', '家庭收纳', '家用电器', '家用纺织品', '文具'];
const targetUrl = 'http://124.222.201.143:3000/api/agent/publish';
const agentApiKey = 'automation_agent_secret';

function extractMeta(html, name) {
  const match = html.match(new RegExp(`<meta[^>]*?name=["']${name}["'][^>]*?content=["']([^"']*)["']`, 'i')) ||
                html.match(new RegExp(`<meta[^>]*?content=["']([^"']*)["'][^>]*?name=["']${name}["']`, 'i'));
  return match ? match[1].trim() : '';
}

function uploadOne(filePath, folderName) {
  return new Promise((resolve) => {
    const fileName = path.basename(filePath);
    const html = fs.readFileSync(filePath, 'utf8');

    const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : fileName.replace('.html', '');

    let category = extractMeta(html, 'category') || 'product';
    const summary = extractMeta(html, 'summary');
    const regions = extractMeta(html, 'regions') || extractMeta(html, 'region') || '全球';
    const products = extractMeta(html, 'products') || extractMeta(html, 'product') || folderName;

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
      timeout: 180000 // 3 minutes timeout for image upload to COS
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode === 200) {
            console.log(`[OK] (${folderName} / ${title}) -> ID: ${json.id}`);
            resolve({ file: fileName, folder: folderName, success: true, id: json.id, title, category });
          } else {
            console.error(`[ERR] (${fileName}) Status ${res.statusCode}: ${data.substring(0, 200)}`);
            resolve({ file: fileName, folder: folderName, success: false, error: data });
          }
        } catch (e) {
          console.error(`[ERR] (${fileName}) JSON Parse error: ${data.substring(0, 100)}`);
          resolve({ file: fileName, folder: folderName, success: false, error: data });
        }
      });
    });

    req.on('error', (e) => {
      console.error(`[ERR] (${fileName}) Network Error: ${e.message}`);
      resolve({ file: fileName, folder: folderName, success: false, error: e.message });
    });

    req.write(payload);
    req.end();
  });
}

async function run() {
  const allFiles = [];

  for (const folder of targetFolders) {
    const folderPath = path.join(baseDir, folder);
    if (!fs.existsSync(folderPath)) continue;
    const files = fs.readdirSync(folderPath)
      .filter(f => f.endsWith('.html') && fs.statSync(path.join(folderPath, f)).isFile())
      .map(f => ({ filePath: path.join(folderPath, f), fileName: f, folder }));
    allFiles.push(...files);
  }

  console.log(`Found ${allFiles.length} Category Insight reports to upload:\n`);
  targetFolders.forEach(folder => {
    const count = allFiles.filter(f => f.folder === folder).length;
    console.log(`  📁 [${folder}] -> ${count} 篇`);
  });
  console.log('');

  const results = [];
  for (let i = 0; i < allFiles.length; i++) {
    const item = allFiles[i];
    console.log(`[${i + 1}/${allFiles.length}] Uploading [${item.folder}] ${item.fileName} ...`);
    const res = await uploadOne(item.filePath, item.folder);
    results.push(res);
  }

  console.log('\n========================================');
  console.log('    CATEGORY INSIGHT UPLOAD SUMMARY     ');
  console.log('========================================');
  const successCount = results.filter(r => r.success).length;
  console.log(`Total: ${results.length}, Success: ${successCount}, Failed: ${results.length - successCount}\n`);

  results.forEach((r, idx) => {
    if (r.success) {
      console.log(`✓ [${idx + 1}] [${r.folder}] ${r.file} -> ${r.title} (ID: ${r.id})`);
    } else {
      console.log(`✗ [${idx + 1}] [${r.folder}] ${r.file} -> FAILED (${r.error})`);
    }
  });
}

run();
