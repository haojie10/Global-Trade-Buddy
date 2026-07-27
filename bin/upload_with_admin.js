const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');

const secret = process.env.SESSION_SECRET || 'dev-only-insecure-secret-do-not-use-in-prod';
const session = { userId: 'admin', role: 'admin' };
const payload = Buffer.from(JSON.stringify(session)).toString('base64');
const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
const cookieValue = `${payload}.${signature}`;

const filePath = process.argv[2] || 'D:/我的APP/品类洞察/makeup-mirror-us-tjmaxx-insight.html';
const absolutePath = path.resolve(filePath);

if (!fs.existsSync(absolutePath)) {
  console.error(`错误: 文件不存在 ${absolutePath}`);
  process.exit(1);
}

const rawHtml = fs.readFileSync(absolutePath, 'utf8');
console.log(`读取报告成功 (${(rawHtml.length / 1024 / 1024).toFixed(2)} MB)`);

const postData = JSON.stringify({ rawHtml });

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/admin/reports/upload',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'Cookie': `gtb_session=${cookieValue}`
  },
};

console.log('正在发送带管理员权限的上传请求...');
const req = http.request(options, (res) => {
  let body = '';
  res.setEncoding('utf8');
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('HTTP 状态码:', res.statusCode);
    console.log('服务器响应:', body);
  });
});

req.on('error', e => console.error('网络连接错误:', e.message));
req.write(postData);
req.end();
