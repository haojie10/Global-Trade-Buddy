/**
 * Market Graphic (外贸智友) - 百度搜索资源平台主动推送脚本
 * 
 * 作用：一键读取数据库中已发布的所有研报与行业资讯 URL，批量推入百度蜘蛛即时抓取队列。
 * 使用方法：
 *   1. 在 .env 中配置 BAIDU_PUSH_TOKEN=你的百度推送Token
 *   2. 执行: node bin/push-to-baidu.js
 */

const { Pool } = require('pg');
const path = require('path');
const https = require('https');
const http = require('http');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const DOMAIN = 'https://marketgraphic.cn';
const BAIDU_TOKEN = process.env.BAIDU_PUSH_TOKEN;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  console.log('====================================================');
  console.log('🚀 Market Graphic - 百度 API 主动推送自动化工具');
  console.log('====================================================\n');

  if (!BAIDU_TOKEN) {
    console.warn('⚠️  未在 .env 中检测到 BAIDU_PUSH_TOKEN！');
    console.log('👉 获取方式：');
    console.log('   1. 登录百度搜索资源平台 (https://ziyuan.baidu.com/)');
    console.log('   2. 进入【普通收录】 -> 【API提交】获取接口调用凭证 token');
    console.log('   3. 在 .env 中添加: BAIDU_PUSH_TOKEN=你的Token\n');
  }

  const urls = [
    `${DOMAIN}/`,
    `${DOMAIN}/reports`,
    `${DOMAIN}/news`
  ];

  try {
    const client = await pool.connect();
    try {
      // 1. 获取所有已发布研报
      const reportsRes = await client.query('SELECT id FROM reports ORDER BY created_at DESC');
      reportsRes.rows.forEach(r => {
        urls.push(`${DOMAIN}/reports/${r.id}`);
      });

      // 2. 获取所有已发布资讯
      const newsRes = await client.query("SELECT id FROM news WHERE status = 'published' ORDER BY published_at DESC");
      newsRes.rows.forEach(n => {
        urls.push(`${DOMAIN}/news/${n.id}`);
      });

      console.log(`📊 成功检索到待推送链接共 ${urls.length} 条：`);
      console.log(`   - 核心主页与大厅: 3 条`);
      console.log(`   - 深度商业研报: ${reportsRes.rows.length} 篇`);
      console.log(`   - 行业热点资讯: ${newsRes.rows.length} 篇\n`);
    } finally {
      client.release();
    }

    if (!BAIDU_TOKEN) {
      console.log('📋 待推送 URL 列表预览 (前 10 条):');
      urls.slice(0, 10).forEach((u, i) => console.log(`   ${i + 1}. ${u}`));
      if (urls.length > 10) console.log(`   ... 剩余 ${urls.length - 10} 条`);
      console.log('\n💡 请配置 BAIDU_PUSH_TOKEN 后再次运行以完成推送。');
      return;
    }

    // 3. 执行向百度 API 的 POST 推送
    const targetUrl = `http://data.zz.baidu.com/urls?site=${DOMAIN}&token=${BAIDU_TOKEN}`;
    const payload = urls.join('\n');

    console.log('⏳ 正在向百度蜘蛛提交 URL 列表...');

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
            console.log(`   - 本次成功推送条数 (success): ${result.success}`);
            console.log(`   - 当天剩余可推送条数 (remain): ${result.remain}`);
          } else {
            console.error('\n❌ 百度推送返回错误:', result);
          }
        } catch (e) {
          console.log('\n百度响应原始内容:', body);
        }
      });
    });

    req.on('error', (err) => {
      console.error('❌ 发送推送请求失败:', err.message);
    });

    req.write(payload);
    req.end();

  } catch (err) {
    console.error('❌ 数据库查询失败:', err);
  } finally {
    client.release();
  }
}

main();
