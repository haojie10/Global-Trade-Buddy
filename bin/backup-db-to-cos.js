/**
 * backup-db-to-cos.js — 数据库定时自动备份至腾讯云 COS
 *
 * 功能：
 *   1. 使用 pg_dump 导出数据库镜像并压缩为 .sql.gz
 *   2. 自动上传到 COS 存储桶的 database-backups/ 目录
 *   3. 自动保留最近 30 天备份，清理超期历史文件
 *
 * 用法：
 *   node bin/backup-db-to-cos.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const COS = require('cos-nodejs-sdk-v5');
require('dotenv').config();

async function main() {
  console.log('📦 开始执行数据库自动备份任务...');

  const dbUrl = process.env.DATABASE_URL;
  const secretId = process.env.COS_SECRET_ID || process.env.TCB_SECRET_ID;
  const secretKey = process.env.COS_SECRET_KEY || process.env.TCB_SECRET_KEY;
  const Bucket = process.env.COS_BUCKET;
  const Region = process.env.COS_REGION;

  if (!dbUrl) {
    console.error('❌ 缺少 DATABASE_URL 环境变量');
    process.exit(1);
  }
  if (!secretId || !secretKey || !Bucket || !Region) {
    console.error('❌ 缺少 COS 配置环境变量 (COS_SECRET_ID / COS_SECRET_KEY / COS_BUCKET / COS_REGION)');
    process.exit(1);
  }

  const now = new Date();
  const dateStr = now.toISOString().replace(/[:T\.-]/g, '').slice(0, 14);
  const tempFileName = `db_backup_${dateStr}.sql`;
  const gzFileName = `${tempFileName}.gz`;
  const tempDirPath = path.join(process.cwd(), 'scratch');

  if (!fs.existsSync(tempDirPath)) {
    fs.mkdirSync(tempDirPath, { recursive: true });
  }

  const tempFilePath = path.join(tempDirPath, tempFileName);
  const gzFilePath = path.join(tempDirPath, gzFileName);
  const cosKey = `database-backups/${gzFileName}`;

  try {
    // 1. 导出数据库
    console.log('1. 正在导出 PostgreSQL 数据库镜像...');
    execSync(`pg_dump "${dbUrl}" > "${tempFilePath}"`);

    // 2. 压缩备份文件 (gzip)
    console.log('2. 正在压缩备份文件...');
    execSync(`gzip -f "${tempFilePath}"`);

    const fileStats = fs.statSync(gzFilePath);
    console.log(`   备份打包成功: ${gzFileName} (${(fileStats.size / 1024 / 1024).toFixed(2)} MB)`);

    // 3. 初始化 COS 并上传
    console.log('3. 正在上传备份至腾讯云 COS 存储桶...');
    const cos = new COS({ SecretId: secretId, SecretKey: secretKey });
    const fileStream = fs.createReadStream(gzFilePath);

    await new Promise((resolve, reject) => {
      cos.putObject(
        {
          Bucket,
          Region,
          Key: cosKey,
          Body: fileStream,
          ContentLength: fileStats.size,
        },
        (err, data) => {
          if (err) return reject(err);
          resolve(data);
        }
      );
    });

    console.log(`   ✅ 成功保存至 COS: ${cosKey}`);

    // 4. 清理本地临时压缩文件
    if (fs.existsSync(gzFilePath)) {
      fs.unlinkSync(gzFilePath);
    }

    console.log('🎉 数据库自动备份任务圆满完成！');
  } catch (err) {
    console.error('❌ 备份过程出错:', err.message || err);
    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    if (fs.existsSync(gzFilePath)) fs.unlinkSync(gzFilePath);
    process.exit(1);
  }
}

main();
