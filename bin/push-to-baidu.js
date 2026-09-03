/**
 * 百度搜索资源平台 API 自动推送与智能轮询脚本
 * 
 * 使用方式:
 *   node bin/push-to-baidu.js              # 正常执行推送（默认根据当天剩余配额或设置上限）
 *   node bin/push-to-baidu.js --dry-run    # 仅预览待推送的 URL 列表，不发起真实请求
 *   node bin/push-to-baidu.js --limit=10   # 自定义单次推送条数
 */

const { Pool } = require('pg');
const https = require('https');
const http = require('http');
require('dotenv').config({ path: '.env.production' });
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

// 1. 基础配置
// 百度站长绑定的 site 标识（经实测百度验证格式为 www.marketgraphic.cn）
const SITE_PARAM = (process.env.BAIDU_PUSH_SITE || 'www.marketgraphic.cn').replace(/^https?:\/\//, '').replace(/\/+$/, '');
const BASE_URL = `https://${SITE_PARAM}`;
const TOKEN = process.env.BAIDU_PUSH_TOKEN || 'RHoP3e1b7xMRJAzs';

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const limitArg = args.find(arg => arg.startsWith('--limit='));
const customLimit = limitArg ? parseInt(limitArg.split('=')[1], 10) : (process.argv[2] && !isNaN(parseInt(process.argv[2])) ? parseInt(process.argv[2], 10) : null);
const PUSH_LIMIT = customLimit || parseInt(process.env.BAIDU_PUSH_LIMIT || '10', 10);

const connectionString = process.env.DATABASE_URL;

let pool = null;
if (connectionString) {
  pool = new Pool({
    connectionString,
    ssl: undefined,
    connectionTimeoutMillis: 3000
  });
}

// 2. HTTP POST 请求封装（向百度提交 URL 列表）
function postUrlsToBaidu(siteParam, token, urls) {
  return new Promise((resolve, reject) => {
    const postData = urls.join('\n');
    const endpoint = `http://data.zz.baidu.com/urls?site=${encodeURIComponent(siteParam)}&token=${token}`;
    const urlObj = new URL(endpoint);

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 80,
      path: `${urlObj.pathname}${urlObj.search}`,
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ statusCode: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, raw: body });
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(postData);
    req.end();
  });
}

// 3. 从 sitemap.xml 获取 URL 作为补充/后备
function fetchSitemapUrls(baseUrl) {
  return new Promise((resolve) => {
    const sitemapUrl = `https://marketgraphic.cn/sitemap.xml`;
    https.get(sitemapUrl, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const matches = data.match(/<loc>(.*?)<\/loc>/g);
        if (matches) {
          const urls = matches.map(m => {
            let rawUrl = m.replace(/<\/?loc>/g, '').trim();
            // 确保统一转换为当前绑定的 BASE_URL 域名格式
            return rawUrl.replace(/^https?:\/\/[^/]+/, baseUrl);
          });
          resolve(urls);
        } else {
          resolve([]);
        }
      });
    }).on('error', (err) => {
      console.warn('⚠️ 读取 sitemap.xml 异常:', err.message);
      resolve([]);
    });
  });
}

async function main() {
  console.log('====================================================');
  console.log('🚀 启动百度搜索资源平台 API 自动推送任务');
  console.log(`📌 百度平台绑定站点: ${SITE_PARAM}`);
  console.log(`🔗 推送基础域名: ${BASE_URL}`);
  console.log(`🎯 本次推送目标上限: ${PUSH_LIMIT} 条`);
  console.log(`⚙️  运行模式: ${isDryRun ? '【DRY-RUN 预览模式】(不发起请求)' : '【LIVE 实际推送模式】'}`);
  console.log('====================================================\n');

  let dbConnected = false;
  try {
    const pushQueue = []; // { url, type: 'static' | 'report' | 'news' | 'sitemap', id?: string }
    const seenUrls = new Set();

    function addUrl(url, type, id) {
      if (!seenUrls.has(url) && pushQueue.length < PUSH_LIMIT) {
        seenUrls.add(url);
        pushQueue.push({ url, type, id });
      }
    }

    // 1. 添加核心静态枢纽页
    addUrl(`${BASE_URL}/`, 'static');
    addUrl(`${BASE_URL}/reports`, 'static');
    addUrl(`${BASE_URL}/news`, 'static');

    // 2. 若数据库可用，通过数据库进行精准优先级与增量分析
    if (pool) {
      try {
        // 自动确保所需字段存在
        await pool.query(`ALTER TABLE reports ADD COLUMN IF NOT EXISTS baidu_pushed_at TIMESTAMP WITH TIME ZONE;`);
        await pool.query(`ALTER TABLE news ADD COLUMN IF NOT EXISTS baidu_pushed_at TIMESTAMP WITH TIME ZONE;`);

        // 2.1 优先查询【从未推送过】的最新报告 (baidu_pushed_at IS NULL)
        if (pushQueue.length < PUSH_LIMIT) {
          const remainingQuota = PUSH_LIMIT - pushQueue.length;
          const unpushedReports = await pool.query(
            `SELECT id, created_at FROM reports 
             WHERE baidu_pushed_at IS NULL 
             ORDER BY created_at DESC 
             LIMIT $1`,
            [remainingQuota]
          );
          unpushedReports.rows.forEach(r => addUrl(`${BASE_URL}/reports/${r.id}`, 'report', r.id));
        }

        // 2.2 优先查询【从未推送过】的最新已发布新闻资讯
        if (pushQueue.length < PUSH_LIMIT) {
          const remainingQuota = PUSH_LIMIT - pushQueue.length;
          const unpushedNews = await pool.query(
            `SELECT id, published_at FROM news 
             WHERE status = 'published' AND baidu_pushed_at IS NULL 
             ORDER BY published_at DESC 
             LIMIT $1`,
            [remainingQuota]
          );
          unpushedNews.rows.forEach(n => addUrl(`${BASE_URL}/news/${n.id}`, 'news', n.id));
        }

        // 2.3 额度未满：自动捞取【历史最久未推送】的存量报告进行轮询补充
        if (pushQueue.length < PUSH_LIMIT) {
          const remainingQuota = PUSH_LIMIT - pushQueue.length;
          const oldestPushedReports = await pool.query(
            `SELECT id, baidu_pushed_at FROM reports 
             WHERE baidu_pushed_at IS NOT NULL 
             ORDER BY baidu_pushed_at ASC, created_at DESC 
             LIMIT $1`,
            [remainingQuota]
          );
          oldestPushedReports.rows.forEach(r => addUrl(`${BASE_URL}/reports/${r.id}`, 'report', r.id));
        }

        // 2.4 额度若仍未满：自动捞取【历史最久未推送】的存量资讯进行轮询补充
        if (pushQueue.length < PUSH_LIMIT) {
          const remainingQuota = PUSH_LIMIT - pushQueue.length;
          const oldestPushedNews = await pool.query(
            `SELECT id, baidu_pushed_at FROM news 
             WHERE status = 'published' AND baidu_pushed_at IS NOT NULL 
             ORDER BY baidu_pushed_at ASC, published_at DESC 
             LIMIT $1`,
            [remainingQuota]
          );
          oldestPushedNews.rows.forEach(n => addUrl(`${BASE_URL}/news/${n.id}`, 'news', n.id));
        }

        dbConnected = true;
      } catch (dbErr) {
        console.warn(`ℹ️  数据库直连提示: ${dbErr.message}，切换为从站点 Sitemap 自动补充 URL`);
      }
    }

    // 3. 如果数据库未连上或待推送数量未满上限，通过 Sitemap 补充
    if (pushQueue.length < PUSH_LIMIT) {
      const sitemapUrls = await fetchSitemapUrls(BASE_URL);
      sitemapUrls.forEach(url => addUrl(url, 'sitemap'));
    }

    console.log(`📋 待推送 URL 汇总 (共计 ${pushQueue.length} 条):`);
    pushQueue.forEach((item, idx) => {
      console.log(`   [${idx + 1}] [${item.type.toUpperCase()}] ${item.url}`);
    });
    console.log('');

    if (pushQueue.length === 0) {
      console.log('ℹ️  当前没有需要推送的 URL，任务结束。');
      return;
    }

    if (isDryRun) {
      console.log('🔍 [DRY-RUN] 预览完成，未向百度发送请求，未修改数据库。');
      return;
    }

    // 4. 执行实际推送
    const urlsToPush = pushQueue.map(item => item.url);
    console.log(`📡 正在向百度主动推送接口发送数据 (${urlsToPush.length} 条)...`);
    const result = await postUrlsToBaidu(SITE_PARAM, TOKEN, urlsToPush);

    console.log(`\n📬 百度接口响应结果 (HTTP ${result.statusCode}):`);
    console.log(JSON.stringify(result.data || result.raw, null, 2));

    if (result.data && result.data.success !== undefined) {
      console.log(`\n🎉 推送成功！本次成功接收: ${result.data.success} 条，今日剩余配额: ${result.data.remain} 条`);
      
      // 5. 更新已推送记录的时间戳 (若数据库连接可用)
      if (dbConnected && pool) {
        const reportIds = pushQueue.filter(i => i.type === 'report' && i.id).map(i => i.id);
        const newsIds = pushQueue.filter(i => i.type === 'news' && i.id).map(i => i.id);

        if (reportIds.length > 0) {
          await pool.query(
            `UPDATE reports SET baidu_pushed_at = NOW() WHERE id = ANY($1::uuid[])`,
            [reportIds]
          );
          console.log(`✅ 已更新 ${reportIds.length} 篇报告的 baidu_pushed_at 时间戳`);
        }

        if (newsIds.length > 0) {
          await pool.query(
            `UPDATE news SET baidu_pushed_at = NOW() WHERE id = ANY($1::uuid[])`,
            [newsIds]
          );
          console.log(`✅ 已更新 ${newsIds.length} 条资讯的 baidu_pushed_at 时间戳`);
        }
      }
    } else if (result.data && result.data.error) {
      console.error(`\n❌ 百度接口返回错误 [${result.data.error}]: ${result.data.message}`);
    } else {
      console.warn('\n⚠️ 百度返回非预期响应:', result.raw);
    }

  } catch (error) {
    console.error('❌ 执行百度推送任务异常:', error);
  } finally {
    if (pool) {
      try {
        await pool.end();
      } catch (_) {}
    }
    console.log('\n🏁 任务已退出。');
  }
}

main();
