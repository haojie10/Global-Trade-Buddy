#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const http = require('http');

const filePath = process.argv[2];
if (!filePath) {
  console.error('错误: 请指定要上传的报告 HTML 文件路径。');
  console.error('使用示例: node upload-report.js <path_to_report.html>');
  process.exit(1);
}

const absolutePath = path.resolve(filePath);
if (!fs.existsSync(absolutePath)) {
  console.error(`错误: 文件不存在: ${absolutePath}`);
  process.exit(1);
}

// 自动检测编码读取文件
function readReportFile(fullPath) {
  const buffer = fs.readFileSync(fullPath);
  
  // 检查 BOM 头 (UTF-16LE 的 BOM 为 FF FE)
  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    console.log('检测到 UTF-16LE (BOM) 编码，正在自动转码为 UTF-8...');
    return buffer.toString('utf16le');
  }
  
  // 如果没有 BOM，但正文里有很多零字节（UTF-16 的特征）
  let zeroBytes = 0;
  for (let i = 0; i < Math.min(buffer.length, 100); i++) {
    if (buffer[i] === 0x00) zeroBytes++;
  }
  
  if (zeroBytes > 10) {
    console.log('检测到 UTF-16LE 编码，正在自动转码为 UTF-8...');
    return buffer.toString('utf16le');
  }
  
  console.log('检测到 UTF-8 编码，读取中...');
  return buffer.toString('utf8');
}

try {
  const rawHtml = readReportFile(absolutePath);
  console.log(`报告文件读取成功，大小: ${(rawHtml.length / 1024 / 1024).toFixed(2)} MB`);

  const postData = JSON.stringify({ rawHtml });

  // 默认调用本地服务，可通过环境变量修改
  const targetUrl = process.env.API_URL || 'http://localhost:3000/api/admin/reports/upload';
  const urlObj = new URL(targetUrl);

  const options = {
    hostname: urlObj.hostname,
    port: urlObj.port || 80,
    path: urlObj.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    },
  };

  console.log(`正在上传至: ${targetUrl}...`);

  const req = http.request(options, (res) => {
    let body = '';
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      body += chunk;
    });
    res.on('end', () => {
      if (res.statusCode === 200) {
        try {
          const response = JSON.parse(body);
          console.log('\n=========================================');
          console.log('🎉 报告发布成功！');
          console.log(`🔹 报告 ID: ${response.reportId}`);
          console.log(`🔹 报告标题: ${response.title}`);
          console.log(`🔹 剥离并上传大图数量: ${response.imageCount} 张`);
          console.log('=========================================');
        } catch (e) {
          console.log(`上传成功，但解析响应失败: ${body}`);
        }
      } else {
        console.error(`❌ 上传失败，服务器返回状态码: ${res.statusCode}`);
        console.error(`错误详情: ${body}`);
      }
    });
  });

  req.on('error', (e) => {
    console.error(`❌ 连接上传 API 失败: ${e.message}`);
    console.error('请确保 Next.js 开发服务器正在本地 3000 端口运行 (npm run dev)');
  });

  req.write(postData);
  req.end();

} catch (err) {
  console.error(`读取或解析报告时发生错误: ${err.message}`);
  process.exit(1);
}
