require('dotenv').config();
const COS = require('cos-nodejs-sdk-v5');

async function testCOS() {
  console.log('Testing COS connection...');
  const secretId = process.env.COS_SECRET_ID || process.env.TCB_SECRET_ID;
  const secretKey = process.env.COS_SECRET_KEY || process.env.TCB_SECRET_KEY;
  const Bucket = process.env.COS_BUCKET;
  const Region = process.env.COS_REGION;

  console.log(`Bucket: ${Bucket}`);
  console.log(`Region: ${Region}`);
  console.log(`SecretId configured: ${Boolean(secretId)}`);

  if (!secretId || !secretKey || !Bucket || !Region) {
    console.error('❌ Missing COS environment variables');
    process.exit(1);
  }

  const cos = new COS({ SecretId: secretId, SecretKey: secretKey });

  // 尝试列出文件测试权限
  cos.getBucket({
    Bucket,
    Region,
    Prefix: 'report-images/',
    MaxKeys: 5,
  }, (err, data) => {
    if (err) {
      console.error('❌ COS Connection Failed:', err);
    } else {
      console.log('✅ COS Connection Successful!');
      console.log(`Found ${data.Contents ? data.Contents.length : 0} items in report-images/`);
    }
  });
}

testCOS();
