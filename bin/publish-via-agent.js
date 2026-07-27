const fs = require('fs');
const path = require('path');
const http = require('http');

const filePath = process.argv[2] || 'D:/我的APP/品类洞察/makeup-mirror-us-tjmaxx-insight.html';
const absolutePath = path.resolve(filePath);

if (!fs.existsSync(absolutePath)) {
  console.error(`错误: 文件不存在 ${absolutePath}`);
  process.exit(1);
}

const contentHtml = fs.readFileSync(absolutePath, 'utf8');
console.log(`读取报告成功 (${(contentHtml.length / 1024 / 1024).toFixed(2)} MB)`);

const postData = JSON.stringify({
  type: 'report',
  title: '化妆镜-LED发光美妆镜-美国市场-TJMaxx渠道调研报告',
  contentHtml
});

const token = process.env.AGENT_API_KEY || 'automation_agent_secret';

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/agent/publish',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'Authorization': `Bearer ${token}`
  },
};

console.log('正在发布报告至 Globaltradebuddy 平台...');
const req = http.request(options, (res) => {
  let body = '';
  res.setEncoding('utf8');
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('HTTP 状态码:', res.statusCode);
    if (res.statusCode === 200) {
      const resp = JSON.parse(body);
      console.log('🎉 报告成功上传并发布至 Globaltradebuddy 平台！');
      console.log(`🔹 报告 ID: ${resp.id}`);
      console.log(`🔹 报告类型: ${resp.type}`);
    } else {
      console.error('❌ 发布失败:', body);
    }
  });
});

req.on('error', e => console.error('网络错误:', e.message));
req.write(postData);
req.end();
