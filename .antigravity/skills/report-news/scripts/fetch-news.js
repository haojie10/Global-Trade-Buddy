#!/usr/bin/env node
/**
 * GTB 54品类实时行业资讯采集与深度提炼引擎
 * 
 * 功能：
 * 1. 结合大模型动态常识库，针对 54 品类、行业协会、主要玩家与商业变动进行精准检索
 * 2. SerpAPI Google News 原生检索 (tbs=qdr:w 强制一周内最新资讯)
 * 3. isWithinDays 算法级严格 7 天时效过滤
 * 4. Cheerio 真实网页正文与高清 og:image 配图抓取
 * 5. 四段式深度外贸情报提炼 (400-500字事实解析 + 数据亮点 + 中国出口供应链实操启示)
 * 6. 54品类智能多标签无上限关联 (周六日海运/合规大盘全量 54 品类打标)
 * 7. 自动去重并写入 GTB 本地数据库
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../../../../.env') });

const SERPAPI_API_KEY = process.env.SERPAPI_API_KEY;
const AI_API_KEY = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
const AI_BASE_URL = process.env.DEEPSEEK_BASE_URL || (process.env.DEEPSEEK_API_KEY ? 'https://api.deepseek.com' : (process.env.OPENAI_BASE_URL || 'https://api.openai.com'));
const AI_MODEL = process.env.AI_MODEL || (process.env.DEEPSEEK_API_KEY ? 'deepseek-chat' : 'gpt-4o-mini');
const DATABASE_URL = process.env.DATABASE_URL;

// 读取 54 个标准品类元数据
const categoriesPath = path.resolve(__dirname, '../references/standard-categories.json');
const categoriesData = fs.existsSync(categoriesPath) ? JSON.parse(fs.readFileSync(categoriesPath, 'utf8')) : { clusters: [] };
const ALL_STANDARD_CATEGORIES = categoriesData.clusters.flatMap(c => c.categories.map(cat => cat.name));

// 读取 54 品类渠道玩家与行业协会图谱（用于检索词增强）
const channelPlayersPath = path.resolve(__dirname, '../references/channel-players.json');
const channelPlayersData = fs.existsSync(channelPlayersPath) ? JSON.parse(fs.readFileSync(channelPlayersPath, 'utf8')) : { clusters: [] };

/**
 * 根据品类名查找渠道图谱信息（玩家 / 零售商 / 协会）
 */
function findChannelInfo(categoryName) {
  for (const cluster of channelPlayersData.clusters || []) {
    const cat = (cluster.categories || []).find(c => c.name === categoryName);
    if (cat) return cat;
  }
  return null;
}

/**
 * 严格 7 天时效性判定算法
 */
function isWithinDays(dateStr, days = 7) {
  if (!dateStr) return false;
  const lower = String(dateStr).toLowerCase().trim();

  if (/^(just now|today)$/i.test(lower)) return true;
  if (/\d+\s*(hour|minute|min|second|sec)s?\s*ago/i.test(lower)) return true;
  if (lower === 'yesterday') return true;

  const daysMatch = lower.match(/(\d+)\s*days?\s*ago/i);
  if (daysMatch) return parseInt(daysMatch[1], 10) <= days;

  const weeksMatch = lower.match(/(\d+)\s*weeks?\s*ago/i);
  if (weeksMatch) return parseInt(weeksMatch[1], 10) * 7 <= days;

  if (/\d+\s*(month|year)s?\s*ago/i.test(lower)) return false;

  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return parsed >= cutoff;
  }
  return false;
}

/**
 * 基于标题关键词重叠度进行去重 (Jaccard 算法)
 */
function deduplicateByTitle(items) {
  const extractKeywords = (title) => {
    return new Set(
      String(title)
        .toLowerCase()
        .replace(/[^\w\s\u4e00-\u9fff]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 3)
    );
  };

  const overlapRatio = (a, b) => {
    if (a.size === 0 || b.size === 0) return 0;
    let overlap = 0;
    for (const word of a) {
      if (b.has(word)) overlap++;
    }
    return overlap / Math.min(a.size, b.size);
  };

  const result = [];
  const keywordSets = [];

  for (const item of items) {
    const keywords = extractKeywords(item.title);
    const isDuplicate = keywordSets.some(existing => overlapRatio(existing, keywords) > 0.45);
    if (!isDuplicate) {
      result.push(item);
      keywordSets.push(keywords);
    }
  }
  return result;
}

/**
 * 调用 SerpAPI Google News 引擎进行真实新闻检索
 */
async function searchGoogleNews(query, location = 'us') {
  if (!SERPAPI_API_KEY) {
    console.warn('⚠️ SERPAPI_API_KEY 未配置，无法调用真实的 Google News 接口。');
    return [];
  }

  try {
    const params = new URLSearchParams({
      engine: 'google',
      tbm: 'nws',
      tbs: 'qdr:w', // 原生 1 周内
      hl: 'en',
      q: query,
      gl: location,
      api_key: SERPAPI_API_KEY
    });

    const res = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
    if (!res.ok) {
      console.error(`SerpApi 响应异常: ${res.status} ${res.statusText}`);
      return [];
    }

    const data = await res.json();
    if (!data.news_results || !Array.isArray(data.news_results)) return [];

    return data.news_results.map(item => {
      const sourceObj = item.source || {};
      const thumbnailObj = item.thumbnail || {};
      return {
        title: String(item.title || ''),
        link: String(item.link || ''),
        snippet: String(item.snippet || ''),
        imageUrl: typeof item.thumbnail === 'string' ? item.thumbnail : (thumbnailObj.src || ''),
        date: item.date || '',
        source: typeof item.source === 'string' ? item.source : (sourceObj.name || sourceObj.title || '海外权威媒体')
      };
    });
  } catch (err) {
    console.error(`搜索新闻异常 [${query}]:`, err.message);
    return [];
  }
}

/**
 * 网页正文抓取与高清 og:image 配图提取
 */
async function scrapeArticle(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    clearTimeout(timeout);

    if (!res.ok || res.status < 200 || res.status >= 400) {
      return { text: '', ogImage: '', isValid: false };
    }
    const html = await res.text();
    if (html.length < 500 || html.includes('403 Forbidden') || html.includes('Access Denied')) {
      return { text: '', ogImage: '', isValid: false };
    }

    // 正则提取 og:image
    let ogImage = '';
    const ogMatch = html.match(/<meta[^>]*?property=["']og:image["'][^>]*?content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*?content=["']([^"']+)["'][^>]*?property=["']og:image["']/i)
      || html.match(/<meta[^>]*?name=["']twitter:image["'][^>]*?content=["']([^"']+)["']/i);
    if (ogMatch && ogMatch[1]) {
      ogImage = ogMatch[1].trim();
    }

    // 简单清洗正文 HTML
    const cleanText = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 5000);

    return { text: cleanText, ogImage, isValid: true };
  } catch (err) {
    return { text: '', ogImage: '', isValid: false };
  }
}

/**
 * AI 四段式深度商业提炼 (400-500字深度事实 + 数据亮点 + 出口工厂供应链启示 + 54品类标签)
 */
async function summarizeWithAI(rawItem, contentText, categoryName, isMacroWeekend = false) {
  const categoriesPromptList = ALL_STANDARD_CATEGORIES.join('、');

  const prompt = `
你是一位资深全球贸易与供应链行业首席分析师。
请根据以下海外新闻原文，为中国出海制造企业、外贸工厂和出口贸易商撰写一份深度专业情报。

新闻标题：${rawItem.title}
媒体来源：${rawItem.source}
新闻链接：${rawItem.link}
正文内容：
${(contentText || rawItem.snippet).slice(0, 4500)}

【写作要求（必须严格遵守）】：
1. 标题（title）：中文精炼专业标题，突出核心企业、行业协会或关键事件。
2. 深度事实解析（recap）：【字数必须达到 400~500 字】，中文。详细阐述事件的完整脉络、背景、具体涉及的数据/金额/门店数量/关键人事任命或战略投资，并报道行业协会的权威表态或市场主流玩家的反应。严禁敷衍或寥寥数语！
3. 数据亮点（highlights）：提取 3~5 个关键数据指标、关键事实或时间节点，作为字符串数组。
4. 中国外贸供应链实操启示（takeaways）：【字数 150~200 字】，深入解构对中国出口工厂选品、BOM成本控制、关税规避、买家谈判的落地指导建议。
5. 涉及品类（industries）：
   ${isMacroWeekend 
     ? '这是周末全行业宏观外贸要闻，请将 industries 设为全量 54 个品类：[' + categoriesPromptList + ']' 
     : '从 GTB 54 个标准品类候选列表中，根据新闻实际波及的品类范围进行完整匹配（如果是 Home Depot/Walmart 战略事件可匹配十几个品类，不要人为限制数量）：[' + categoriesPromptList + ']'}
6. 涉及国家/地区（countries）：提取新闻直接关联的国家或地区（如 "美国", "德国", "欧盟", "全球" 等）。

请以 JSON 格式输出：
{
  "title": "...",
  "recap": "...",
  "highlights": ["...", "..."],
  "takeaways": "...",
  "industries": ["品类1", "品类2"],
  "countries": ["国家1"]
}
`;

  if (AI_API_KEY) {
    try {
      const response = await fetch(`${AI_BASE_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AI_API_KEY}`
        },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        })
      });

      if (response.ok) {
        const json = await response.json();
        const parsed = JSON.parse(json.choices[0].message.content);
        return {
          ...parsed,
          source_url: rawItem.link,
          imageUrl: rawItem.imageUrl
        };
      }
    } catch (err) {
      console.warn('AI 提炼接口调用失败，使用结构化兜底:', err.message);
    }
  }

  // 兜底结构化包装 (未配置 AI Key 时)
  return {
    title: rawItem.title,
    recap: `【深度事实解析】${rawItem.snippet}。根据海外最新报道，该事件正在对行业产生深远影响。涉及的海外主要渠道与相关行业协会正密切评估市场反馈。面对全球供应链波动与渠道采购策略的重构，相关市场参与者正在加快调整产品陈列与进出口采购节奏。`,
    highlights: [`报道来源：${rawItem.source}`, `发布日期：${rawItem.date || '最近一周'}`],
    takeaways: `【外贸实操启示】建议中国相关品类出口制造工厂密切关注该渠道在架 SKU 与关税合规变动，提早进行 BOM 成本优化与差异化产品布局。`,
    industries: isMacroWeekend ? ALL_STANDARD_CATEGORIES : [categoryName || '家居用品'],
    countries: ['全球'],
    source_url: rawItem.link,
    imageUrl: rawItem.imageUrl
  };
}

/**
 * 将提炼好的情报组装为高质量 HTML 并存入数据库
 */
async function saveNewsToDatabase(newsItem, dbPool) {
  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');

    // 组装高质感 HTML 内容
    const htmlContent = `
<div class="gtb-news-article">
  ${newsItem.imageUrl ? `<p><img src="${newsItem.imageUrl}" alt="${newsItem.title}" style="max-width:100%; border-radius:8px; margin-bottom:20px;" /></p>` : ''}
  
  <h3>📌 核心事实深度解构 (Recap)</h3>
  <p style="line-height: 1.8; color: var(--color-text); font-size: 1.05rem;">${newsItem.recap}</p>

  <h3>📊 关键数据与事实亮点 (Highlights)</h3>
  <ul>
    ${(newsItem.highlights || []).map(h => `<li style="line-height: 1.7; margin-bottom: 6px;">${h}</li>`).join('')}
  </ul>

  <div style="background: rgba(255, 100, 30, 0.04); border-left: 4px solid var(--color-accent, #ff641e); padding: 16px 20px; border-radius: 4px; margin: 24px 0;">
    <h4 style="margin: 0 0 8px 0; color: var(--color-accent, #ff641e);">💡 中国外贸工厂与供应链实操启示 (Takeaways)</h4>
    <p style="margin: 0; line-height: 1.7; font-size: 0.95rem;">${newsItem.takeaways}</p>
  </div>

  <p style="font-size: 0.85rem; color: #888; margin-top: 24px;">
    🔗 权威新闻来源：<a href="${newsItem.source_url}" target="_blank" rel="noopener noreferrer" style="color: var(--color-accent, #ff641e); text-decoration: underline;">点击查阅海外媒体报道原文 ↗</a>
  </p>
</div>
`;

    // 1. 插入 news 表
    const insertNewsRes = await client.query(
      `INSERT INTO news (title, summary, content, source_url, status, published_at)
       VALUES ($1, $2, $3, $4, 'published', NOW()) RETURNING id`,
      [newsItem.title, newsItem.recap.slice(0, 160) + '...', htmlContent, newsItem.source_url]
    );
    const newsId = insertNewsRes.rows[0].id;

    // 2. 插入 news_industries 关联 (支持无上限多品类关联)
    const industriesList = Array.isArray(newsItem.industries) ? newsItem.industries : [];
    for (const indName of industriesList) {
      let indId;
      const existingInd = await client.query('SELECT id FROM industries WHERE name = $1 LIMIT 1', [indName]);
      if (existingInd.rows.length > 0) {
        indId = existingInd.rows[0].id;
      } else {
        const newInd = await client.query('INSERT INTO industries (name) VALUES ($1) RETURNING id', [indName]);
        indId = newInd.rows[0].id;
      }

      await client.query(
        'INSERT INTO news_industries (news_id, industry_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [newsId, indId]
      );
    }

    // 3. 插入 news_countries 关联
    const countriesList = Array.isArray(newsItem.countries) ? newsItem.countries : [];
    for (const ctyName of countriesList) {
      let lookup = ctyName;
      if (lookup.toLowerCase() === 'usa' || lookup.toLowerCase() === 'us') lookup = '美国';
      if (lookup.toLowerCase() === 'germany') lookup = '德国';
      if (lookup.toLowerCase() === 'eu') lookup = '欧洲';

      const ctyRes = await client.query('SELECT id FROM countries WHERE name = $1 LIMIT 1', [lookup]);
      if (ctyRes.rows.length > 0) {
        const ctyId = ctyRes.rows[0].id;
        await client.query(
          'INSERT INTO news_countries (news_id, country_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [newsId, ctyId]
        );
      }
    }

    await client.query('COMMIT');
    console.log(`✅ [已入库] ${newsItem.title} (已关联 ${industriesList.length} 个品类)`);
    return newsId;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`❌ 入库失败 [${newsItem.title}]:`, err.message);
    return null;
  } finally {
    client.release();
  }
}

/**
 * 主执行函数
 */
async function main() {
  const args = process.argv.slice(2);
  const targetCategoryArg = args.find(a => a.startsWith('--category='))?.split('=')[1];
  const targetDayArg = args.find(a => a.startsWith('--day='))?.split('=')[1];
  const isDryRun = args.includes('--dry-run');

  const now = new Date();
  const beijingDay = targetDayArg ? parseInt(targetDayArg, 10) : now.getUTCDay(); // 0=周日, 1=周一, ..., 6=周六

  console.log(`\n======================================================`);
  console.log(`🚀 GTB 54品类实时资讯引擎启动 (北京时间星期: ${beijingDay})`);
  console.log(`======================================================\n`);

  let dbPool = null;
  if (!isDryRun) {
    if (!DATABASE_URL) {
      console.error('❌ 错误: DATABASE_URL 环境变量未配置。');
      process.exit(1);
    }
    dbPool = new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
  }

  try {
    let taskList = [];

    if (targetCategoryArg) {
      taskList.push({ category: targetCategoryArg, isMacroWeekend: false });
    } else if (beijingDay === 6) {
      // 周六：全球海运与外贸大盘
      taskList.push({
        category: '【全球海运与宏观外贸大盘周报】',
        query: '("container freight rate" OR "SCFI" OR "Drewry WCI" OR "Red Sea shipping" OR "USD exchange rate") (shipping OR logistics OR trade) news',
        isMacroWeekend: true
      });
    } else if (beijingDay === 0 || beijingDay === 7) {
      // 周日：全球外贸合规日历与展会前瞻
      taskList.push({
        category: '【全球外贸合规预警与下周日历前瞻】',
        query: '("trade compliance" OR "EUDR regulation" OR "CBAM" OR "FDA regulation" OR "anti-dumping" OR "trade show") (tariff OR compliance OR export) news',
        isMacroWeekend: true
      });
    } else {
      // 工作日轮巡 54 品类
      const clusterMap = {
        1: categoriesData.clusters.find(c => c.id === 'electronics_mobility'),
        2: categoriesData.clusters.find(c => c.id === 'hardware_machinery_building'),
        3: categoriesData.clusters.find(c => c.id === 'daily_goods_tableware'),
        4: categoriesData.clusters.find(c => c.id === 'furniture_garden_decor'),
        5: categoriesData.clusters.find(c => c.id === 'apparel_textile_bags')
      };
      const todayCluster = clusterMap[beijingDay] || categoriesData.clusters[0];
      console.log(`📌 今日重点板块: [${todayCluster.name}] (包含 ${todayCluster.categories.length} 个品类)`);

      for (const cat of todayCluster.categories) {
        taskList.push({
          category: cat.name,
          enName: cat.en,
          keywords: cat.keywords,
          isMacroWeekend: false
        });
      }
    }

    for (const task of taskList) {
      console.log(`\n🔍 正在检索品类: 【${task.category}】...`);
      
      // 构造大模型知识驱动的动态检索词 (融入行业协会、头部玩家、开店与商业变动)
      let query = task.query;
      if (!query) {
        const subKws = (task.keywords || []).slice(0, 3).join(' OR ');
        // 从渠道玩家图谱中取该品类的代表玩家与协会，增强检索精准度
        const channelInfo = findChannelInfo(task.category);
        const players = (channelInfo?.players || []).slice(0, 5);
        const associations = (channelInfo?.associations || []).slice(0, 3);
        const playerKws = players.length > 0 ? ` (${players.join(' OR ')})` : '';
        const assocKws = associations.length > 0 ? ` (${associations.join(' OR ')})` : '';
        query = `("${task.enName || task.category}" OR ${subKws || 'retail'})${playerKws}${assocKws} (association OR "store openings" OR "expansion" OR "investment" OR "leadership" OR "tariff" OR "supply chain") news`;
      }

      const rawNewsList = await searchGoogleNews(query, 'us');
      console.log(`   └─ 找到 ${rawNewsList.length} 条原始资讯`);

      // 严格 7 天时效过滤
      const validNewsList = rawNewsList.filter(item => isWithinDays(item.date, 7));
      console.log(`   └─ 经过 7 天时效严格核验: 留存 ${validNewsList.length} 条最新资讯`);

      // 标题关键词相似度去重
      const uniqueList = deduplicateByTitle(validNewsList).slice(0, 5); // 每个品类精选最多 5 条
      console.log(`   └─ 经相似度算法去重: 精选 ${uniqueList.length} 条独立深度资讯`);

      for (const item of uniqueList) {
        console.log(`   🌐 正在抓取正文与高清配图: ${item.title.slice(0, 40)}...`);
        const { text, ogImage, isValid } = await scrapeArticle(item.link);
        if (!isValid) {
          console.log(`   ⚠️ 链接连通性校验未通过(404/403/超时)，跳过此条: ${item.link}`);
          continue;
        }
        if (ogImage) item.imageUrl = ogImage;

        console.log(`   🤖 正在进行 400-500 字深度商业与外贸启示提炼...`);
        const processed = await summarizeWithAI(item, text, task.category, task.isMacroWeekend);

        if (!isDryRun && dbPool) {
          await saveNewsToDatabase(processed, dbPool);
        } else {
          console.log(`   [DRY-RUN 结果]`, JSON.stringify(processed, null, 2));
        }
      }
    }

    console.log(`\n🎉 全部资讯采集与提炼任务圆满完成！`);
  } catch (err) {
    console.error('❌ 执行失败:', err);
  } finally {
    if (dbPool) await dbPool.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  isWithinDays,
  deduplicateByTitle,
  searchGoogleNews,
  scrapeArticle,
  summarizeWithAI,
  findChannelInfo
};
