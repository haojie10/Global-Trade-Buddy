import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../lib/api-handler';

const SITE_ORIGIN = 'https://marketgraphic.cn';

async function llmsHandler(_req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  let rows: Array<{ slug?: string; title?: string; summary?: string }> = [];
  // NOTE: 单独容错，防止在数据库迁移尚未执行前访问 /llms.txt 触发 500
  try {
    const result = await dbClient.query(
      `SELECT slug, title, summary
       FROM wiki_entries
       WHERE status = 'published'
       ORDER BY updated_at DESC
       LIMIT 500`
    );
    rows = result.rows || [];
  } catch (err: any) {
    console.warn('[llms.txt] 查询 wiki_entries 降级为空列表:', err?.message || err);
  }

  const lines: string[] = [
    '# Market Graphic (外贸智友)',
    '',
    '> 面向中国出海制造企业与外贸 B2B 业务团队的全球产业情报与分销图谱平台，提供各国各品类流通链路、价格瀑布加价拆解、代表买家与深度企业研报。',
    '',
    '## 核心公开栏目',
    '',
    `- [全球行业流通百科](${SITE_ORIGIN}/wiki)：各国分销层级、价格瀑布加价与买家痛点结构化图谱`,
    `- [全球外贸商业快讯](${SITE_ORIGIN}/news)：海外零售渠道、关税合规与供应链动态解析`,
    `- [海外买家与品类深度研报](${SITE_ORIGIN}/reports)：重点零售商 360° 采购决策链与跨渠道品类洞察`,
    '',
    '## 行业百科 (Industry Wiki)',
    '',
  ];

  for (const row of rows) {
    const slug = String(row.slug || '').trim();
    const title = String(row.title || '').replace(/\r?\n/g, ' ').trim();
    const summary = String(row.summary || '').replace(/\r?\n/g, ' ').trim();
    if (!slug || !title) continue;
    lines.push(
      `- [${title}](${SITE_ORIGIN}/wiki/${slug}) ([Markdown](${SITE_ORIGIN}/wiki/${slug}.md))${summary ? `：${summary}` : ''}`
    );
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
  return res.status(200).send(lines.join('\n'));
}

export default withDb(llmsHandler, { methods: ['GET'] });
