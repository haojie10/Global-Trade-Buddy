const fs = require('fs');
const path = require('path');

const file1 = path.resolve(__dirname, 'Template/Customer Insight.html');
const file2 = path.resolve(__dirname, 'Template/Product insight.html');

function checkFile(fullPath) {
  if (!fs.existsSync(fullPath)) return;
  const buffer = fs.readFileSync(fullPath);
  let content = '';
  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    content = buffer.toString('utf16le');
  } else {
    content = buffer.toString('utf8');
  }

  console.log(`\n检查文件: ${path.basename(fullPath)}`);
  
  // 查找 switchSection 出现的上下文
  let index = -1;
  while ((index = content.indexOf('switchSection', index + 1)) !== -1) {
    console.log(`\n发现 'switchSection' 于位置 ${index}:`);
    console.log(content.substring(Math.max(0, index - 200), Math.min(content.length, index + 300)));
  }
}

checkFile(file1);
checkFile(file2);
