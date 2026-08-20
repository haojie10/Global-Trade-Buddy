import { GetServerSideProps } from 'next';
import pool from '../lib/db';

const EXTERNAL_DATA_URL = 'https://marketgraphic.cn';

function generateSiteMap(reports: any[], newsList: any[], latestDate: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
   <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
     <url>
       <loc>${EXTERNAL_DATA_URL}/</loc>
       <lastmod>${latestDate}</lastmod>
       <priority>1.0</priority>
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
  
  let client;
  try {
    client = await pool.connect();
    const reportsResult = await client.query('SELECT id, created_at FROM reports ORDER BY created_at DESC');
    reports = reportsResult.rows || [];

    const newsResult = await client.query("SELECT id, published_at FROM news WHERE status='published' ORDER BY published_at DESC");
    newsList = newsResult.rows || [];
  } catch (error) {
    console.error('Sitemap 数据生成错误:', error);
  } finally {
    if (client) {
      client.release();
    }
  }

  const latestDate = new Date(
    reports[0]?.created_at || newsList[0]?.published_at || Date.now()
  ).toISOString();

  const sitemap = generateSiteMap(reports, newsList, latestDate);

  res.setHeader('Content-Type', 'text/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');
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
