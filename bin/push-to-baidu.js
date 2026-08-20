/**
 * Market Graphic (外贸智友) - 百度搜索资源平台主动推送脚本
 * 
 * 作用：一键读取数据库中已发布的所有研报与行业资讯 URL，推入百度蜘蛛即时抓取队列。
 * 用法:
 *   node bin/push-to-baidu.js          (默认推送前 10 条最核心页面，适配百度新站初始每日配额)
 *   node bin/push-to-baidu.js 50       (推送前 50 条)
 *   node bin/push-to-baidu.js all      (全量 500+ 条全推)
 */

const { Pool } = require('pg');
const path = require('path');
const http = require('http');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const DOMAIN = process.env.BAIDU_PUSH_SITE || 'https://www.marketgraphic.cn';
const BAIDU_TOKEN = process.env.BAIDU_PUSH_TOKEN || 'RHoP3e1b7xMRJAzs';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  console.log('====================================================');
  console.log('🚀 Market Graphic - 百度 API 主动推送自动化工具');
  console.log('====================================================\n');
  console.log(`🎯 目标推送站点: ${DOMAIN}`);
  console.log(`🔑 调用凭证 Token: ${BAIDU_TOKEN ? BAIDU_TOKEN.slice(0, 4) + '****' : '未设置'}\n`);

  const allUrls = [
    `${DOMAIN}/`,
    `${DOMAIN}/reports`,
    `${DOMAIN}/news`
  ];

  try {
    const client = await pool.connect();
    let reportsCount = 0;
    let newsCount = 0;
    try {
      // 1. 获取所有已发布研报（按创建时间倒序）
      const reportsRes = await client.query('SELECT id FROM reports ORDER BY created_at DESC');
      reportsCount = reportsRes.rows.length;
      reportsRes.rows.forEach(r => {
        allUrls.push(`${DOMAIN}/reports/${r.id}`);
      });

      // 2. 获取所有已发布资讯
      const newsRes = await client.query("SELECT id FROM news WHERE status = 'published' ORDER BY published_at DESC");
      newsCount = newsRes.rows.length;
      newsRes.rows.forEach(n => {
        allUrls.push(`${DOMAIN}/news/${n.id}`);
      });

      console.log(`📊 数据库全量内容索引: 共 ${allUrls.length} 条（研报: ${reportsCount} 篇, 资讯: ${newsCount} 篇）`);
    } finally {
      client.release();
    }

    // 解析推送数量限制（默认 10 条适配新站额度）
    const arg = process.argv[2];
    let pushUrls = allUrls;
    if (arg === 'all') {
      pushUrls = allUrls;
    } else if (arg && !isNaN(parseInt(arg))) {
      pushUrls = allUrls.slice(0, parseInt(arg));
    } else {
      pushUrls = allUrls.slice(0, 10);
    }

    console.log(`👉 本次选定推送 URL: ${pushUrls.length} 条（包含主站核心大厅及最新核心研报）\n`);
    pushUrls.forEach((u, i) => console.log(`   ${i + 1}. ${u}`));

    // 3. 执行向百度 API 的 POST 推送
    const targetUrl = `http://data.zz.baidu.com/urls?site=${DOMAIN}&token=${BAIDU_TOKEN}`;
    const payload = pushUrls.join('\n');

    console.log('\n⏳ 正在向百度蜘蛛提交当前批次 URL...');

    const req = http.request(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          if (result.success) {
            console.log('\n🎉 百度推送成功！');
            console.log(`   - 本次成功接收条数 (success): ${result.success}`);
            console.log(`   - 今日剩余可用配额 (remain): ${result.remain}`);
            console.log('\n💡 提示：百度对新站初始分配每日 10 条 API 配额，随着蜘蛛持续抓取，每日配额会自动提升至上千条！');
          } else {
            console.error('\n❌ 百度推送返回错误:', result);
          }
        } catch (e) {
          console.log('\n百度响应原始内容:', body);
        } finally {
          pool.end();
        }
      });
    });

    req.on('error', (err) => {
      console.error('❌ 发送推送请求失败:', err.message);
      pool.end();
    });

    req.write(payload);
    req.end();

  } catch (err) {
    console.error('❌ 数据库查询失败:', err);
    pool.end();
  }
}

main();
