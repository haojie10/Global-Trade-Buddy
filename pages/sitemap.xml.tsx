import { GetServerSideProps } from 'next';
import pool from '../lib/db';

const EXTERNAL_DATA_URL = 'https://marketgraphic.cn';

function generateSiteMap(reports: any[], newsList: any[], wikiList: any[], latestDate: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
   <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
     <url>
       <loc>${EXTERNAL_DATA_URL}/</loc>
       <lastmod>${latestDate}</lastmod>
       <priority>1.0</priority>
       <changefreq>daily</changefreq>
     </url>
     <url>
       <loc>${EXTERNAL_DATA_URL}/wiki</loc>
       <lastmod>${latestDate}</lastmod>
       <priority>0.9</priority>
       <changefreq>daily</changefreq>
     </url>
     <url>
       <loc>${EXTERNAL_DATA_URL}/news</loc>
       <lastmod>${latestDate}</lastmod>
       <priority>0.8</priority>
       <changefreq>daily</changefreq>
     </url>
     <url>
       <loc>${EXTERNAL_DATA_URL}/reports</loc>
       <lastmod>${latestDate}</lastmod>
       <priority>0.8</priority>
       <changefreq>daily</changefreq>
     </url>
     ${wikiList
       .map(({ slug, updated_at }) => {
         return `
       <url>
           <loc>${EXTERNAL_DATA_URL}/wiki/${encodeURIComponent(slug)}</loc>
           <lastmod>${new Date(updated_at || Date.now()).toISOString()}</lastmod>
           <priority>0.85</priority>
           <changefreq>weekly</changefreq>
       </url>
     `;
       })
       .join('')}
     ${reports
       .map(({ id, created_at }) => {
         return `
       <url>
           <loc>${EXTERNAL_DATA_URL}/reports/${id}</loc>
           <lastmod>${new Date(created_at || Date.now()).toISOString()}</lastmod>
           <priority>0.7</priority>
           <changefreq>weekly</changefreq>
       </url>
     `;
       })
       .join('')}
     ${newsList
       .map(({ id, published_at }) => {
         return `
       <url>
           <loc>${EXTERNAL_DATA_URL}/news/${id}</loc>
           <lastmod>${new Date(published_at || Date.now()).toISOString()}</lastmod>
           <priority>0.6</priority>
           <changefreq>monthly</changefreq>
       </url>
     `;
       })
       .join('')}
   </urlset>
 `;
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  let reports: any[] = [];
  let newsList: any[] = [];
  let wikiList: any[] = [];

  let client;
  try {
    client = await pool.connect();
    const reportsResult = await client.query('SELECT id, created_at FROM reports ORDER BY created_at DESC');
    reports = reportsResult.rows || [];

    const newsResult = await client.query("SELECT id, published_at FROM news WHERE status='published' ORDER BY published_at DESC");
    newsList = newsResult.rows || [];

    // NOTE: 单独容错，避免尚未执行百科迁移的数据库阻断整站 Sitemap 输出
    try {
      const wikiResult = await client.query(
        "SELECT slug, updated_at FROM wiki_entries WHERE status = 'published' ORDER BY updated_at DESC"
      );
      wikiList = wikiResult.rows || [];
    } catch (wikiError: any) {
      console.warn('⚠️ Sitemap 查询 wiki_entries 失败（可能尚未迁移）:', wikiError?.message || wikiError);
    }

    console.log(`[Sitemap] 成功获取 ${reports.length} 篇研报, ${newsList.length} 篇资讯, ${wikiList.length} 篇百科`);
  } catch (error: any) {
    console.error('❌ Sitemap 数据库查询失败:', error?.message || error);
  } finally {
    if (client) {
      client.release();
    }
  }

  const candidateTimestamps = [
    reports[0]?.created_at,
    newsList[0]?.published_at,
    wikiList[0]?.updated_at,
  ]
    .filter(Boolean)
    .map((dateValue) => new Date(dateValue).getTime())
    .filter((timestamp) => Number.isFinite(timestamp));

  const latestDate = new Date(
    candidateTimestamps.length > 0 ? Math.max(...candidateTimestamps) : Date.now()
  ).toISOString();

  const sitemap = generateSiteMap(reports, newsList, wikiList, latestDate);

  res.setHeader('Content-Type', 'text/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=120');
  res.write(sitemap);
  res.end();

  return {
    props: {},
  };
};

export default function SiteMap() {
  // getServerSideProps will do the heavy lifting
  return null;
}
