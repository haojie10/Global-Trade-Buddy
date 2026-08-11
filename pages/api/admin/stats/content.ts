import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../../lib/api-handler';
import { requireAdmin } from '../../../../lib/auth';

// 常见国家/关键词到 7 大标准区域的智能映射表
const REGION_MAPPING: Record<string, string> = {
  '美国': '北美', '加拿大': '北美', '墨西哥': '北美', '北美': '北美', '北美洲': '北美', 'usa': '北美', 'us': '北美',
  '英国': '欧洲', '德国': '欧洲', '法国': '欧洲', '意大利': '欧洲', '西班牙': '欧洲', '波兰': '欧洲', '荷兰': '欧洲', '西欧': '欧洲', '东欧': '欧洲', '欧洲': '欧洲', 'uk': '欧洲',
  '日本': '亚太', '韩国': '亚太', '澳大利亚': '亚太', '新西兰': '亚太', '印度': '亚太', '亚太': '亚太', '亚洲': '亚太',
  '越南': '东南亚', '泰国': '东南亚', '印度尼西亚': '东南亚', '马来西亚': '东南亚', '菲律宾': '东南亚', '新加坡': '东南亚', '东南亚': '东南亚',
  '沙特': '中东', '阿联酋': '中东', '土耳其': '中东', '以色列': '中东', '中东': '中东',
  '巴西': '南美', '阿根廷': '南美', '智利': '南美', '秘鲁': '南美', '哥伦比亚': '南美', '南美': '南美', '南美洲': '南美',
  '南非': '非洲', '埃及': '非洲', '尼日利亚': '非洲', '肯尼亚': '非洲', '非洲': '非洲'
};

function normalizeRegion(raw: string): string | null {
  if (!raw) return null;
  const clean = raw.trim();
  for (const [key, reg] of Object.entries(REGION_MAPPING)) {
    if (clean.toLowerCase().includes(key.toLowerCase())) {
      return reg;
    }
  }
  return null;
}

async function contentStatsHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  const session = requireAdmin(req);
  if (!session) {
    return res.status(403).json({ error: '权限不足，仅管理员可访问' });
  }

  // 1. 行业分布
  const industryDistRes = await dbClient.query(
    `SELECT i.name, COUNT(DISTINCT ri.report_id)::int as value
     FROM industries i
     LEFT JOIN report_industries ri ON i.id = ri.industry_id
     GROUP BY i.name
     ORDER BY value DESC`
  );
  const industryDist = industryDistRes.rows;

  // 2. 地区分布
  const regionDistRes = await dbClient.query(
    `SELECT c.region as name, COUNT(DISTINCT rc.report_id)::int as value
     FROM countries c
     JOIN report_countries rc ON c.id = rc.country_id
     GROUP BY c.region
     ORDER BY value DESC`
  );
  const regionDist = regionDistRes.rows;

  // 3. 国家分布
  const countryDistRes = await dbClient.query(
    `SELECT c.name, c.region, COUNT(DISTINCT rc.report_id)::int as value
     FROM countries c
     LEFT JOIN report_countries rc ON c.id = rc.country_id
     GROUP BY c.name, c.region
     ORDER BY value DESC
     LIMIT 10`
  );
  const countryDist = countryDistRes.rows;

  // 4. 全量计算 行业 × 区域 矩阵热力图（结合关联表 + 报告本身的 market_region 双重智能归一化）
  const allReportsRes = await dbClient.query(`
    SELECT r.id, r.title, r.market_region,
           ARRAY_AGG(DISTINCT i.name) FILTER (WHERE i.name IS NOT NULL) as industries,
           ARRAY_AGG(DISTINCT c.region) FILTER (WHERE c.region IS NOT NULL) as country_regions,
           ARRAY_AGG(DISTINCT c.name) FILTER (WHERE c.name IS NOT NULL) as country_names
    FROM reports r
    LEFT JOIN report_industries ri ON r.id = ri.report_id
    LEFT JOIN industries i ON ri.industry_id = i.id
    LEFT JOIN report_countries rc ON r.id = rc.report_id
    LEFT JOIN countries c ON rc.country_id = c.id
    GROUP BY r.id, r.title, r.market_region
  `);

  const matrixMap = new Map<string, number>(); // key: `${industry}__${region}` -> count

  for (const r of allReportsRes.rows) {
    const rIndustries: string[] = (r.industries || []).filter(Boolean);
    
    // 解析报告涉及的标准大区集合
    const rRegions = new Set<string>();

    // a. 从关联的 countries.region 获取
    if (r.country_regions && Array.isArray(r.country_regions)) {
      for (const reg of r.country_regions) {
        const norm = normalizeRegion(reg);
        if (norm) rRegions.add(norm);
      }
    }

    // b. 从关联的 countries.name 获取
    if (r.country_names && Array.isArray(r.country_names)) {
      for (const cname of r.country_names) {
        const norm = normalizeRegion(cname);
        if (norm) rRegions.add(norm);
      }
    }

    // c. 从 reports.market_region 获取（容错兜底，覆盖美国、加拿大等）
    if (r.market_region) {
      const parts = r.market_region.split(/,|，|\/|\s+/).map((s: string) => s.trim()).filter(Boolean);
      for (const part of parts) {
        const norm = normalizeRegion(part);
        if (norm) rRegions.add(norm);
      }
    }

    // 如果还没有，尝试从标题中提取国家/区域
    if (rRegions.size === 0 && r.title) {
      const norm = normalizeRegion(r.title);
      if (norm) rRegions.add(norm);
    }

    // 默认若仍未识别出区域，则不归入特定 7 大区
    for (const ind of rIndustries) {
      for (const reg of Array.from(rRegions)) {
        const key = `${ind}__${reg}`;
        matrixMap.set(key, (matrixMap.get(key) || 0) + 1);
      }
    }
  }

  const matrix: Array<{ industry: string; region: string; count: number }> = [];
  matrixMap.forEach((count, key) => {
    const [industry, region] = key.split('__');
    matrix.push({ industry, region, count });
  });

  // 5. 新鲜度看板
  const freshnessRes = await dbClient.query(
    `SELECT 
       COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END)::int as green,
       COUNT(CASE WHEN created_at >= NOW() - INTERVAL '90 days' AND created_at < NOW() - INTERVAL '30 days' THEN 1 END)::int as yellow,
       COUNT(CASE WHEN created_at < NOW() - INTERVAL '90 days' THEN 1 END)::int as red
     FROM reports`
  );
  const freshness = [
    { name: '活跃 (<30天)', value: freshnessRes.rows[0]?.green || 0 },
    { name: '黄警 (30-90天)', value: freshnessRes.rows[0]?.yellow || 0 },
    { name: '老化 (>90天)', value: freshnessRes.rows[0]?.red || 0 }
  ];

  // 6. 内容缺口建议 (最近 30 天未命中搜索词)
  let gaps: Array<{ name: string; count: number }> = [];
  try {
    const gapsRes = await dbClient.query(
      `SELECT query as name, COUNT(*)::int as count
       FROM search_logs
       WHERE results_count = 0 AND created_at >= NOW() - INTERVAL '30 days'
       GROUP BY query
       ORDER BY count DESC
       LIMIT 10`
    );
    gaps = gapsRes.rows;
  } catch (err) {
    console.warn('Search logs query failed (table may be empty or missing):', err);
  }

  // 7. 智能选题与生产建议生成算法
  const standardRegions = ['北美', '欧洲', '亚太', '东南亚', '中东', '南美'];
  const topicRecommendations: Array<{
    title: string;
    region: string;
    industry: string;
    reason: string;
    urgency: 'high' | 'medium';
  }> = [];

  // a. 基于高频未命中词建议
  if (gaps.length > 0) {
    for (const gap of gaps.slice(0, 3)) {
      topicRecommendations.push({
        title: `【高需求补品】${gap.name} 深度市场准入与竞品分析`,
        region: '全球 / 重点市场',
        industry: gap.name,
        reason: `近 30 天内有 ${gap.count} 位用户主动检索但未搜出结果`,
        urgency: 'high'
      });
    }
  }

  // b. 基于热力图空白区域智能推荐（挑出已有行业但在核心区域为 0 的缺口）
  for (const indRow of industryDist.slice(0, 4)) {
    for (const reg of standardRegions) {
      const match = matrix.find(m => m.industry === indRow.name && m.region === reg);
      if (!match || match.count === 0) {
        if (topicRecommendations.length < 6) {
          topicRecommendations.push({
            title: `【区域盲区填补】${reg}市场 - ${indRow.name}主流渠道与选品洞察`,
            region: reg,
            industry: indRow.name,
            reason: `平台在「${indRow.name}」行业有深度积累，但「${reg}」大区尚处于内容空白`,
            urgency: 'medium'
          });
        }
      }
    }
  }

  return res.status(200).json({
    industryDist,
    regionDist,
    countryDist,
    matrix,
    freshness,
    gaps,
    topicRecommendations
  });
}

export default withDb(contentStatsHandler, {
  methods: ['GET']
});
