import { GetServerSideProps } from 'next';
import pool from '../lib/db';

const EXTERNAL_DATA_URL = 'https://marketgraphic.cn';

function generateSiteMap(reports: any[], newsList: any[]) {
  return `<?xml version="1.0" encoding="UTF-8"?>
   <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
     <url>
       <loc>${EXTERNAL_DATA_URL}/</loc>
       <priority>1.0</priority>
       <changefreq>daily</changefreq>
     </url>
     <url>
       <loc>${EXTERNAL_DATA_URL}/news</loc>
       <priority>0.8</priority>
       <changefreq>daily</changefreq>
     </url>
     <url>
       <loc>${EXTERNAL_DATA_URL}/reports</loc>
       <priority>0.8</priority>
       <changefreq>daily</changefreq>
     </url>
     ${reports
       .map(({ id, updated_at, created_at }) => {
         return `
       <url>
           <loc>${EXTERNAL_DATA_URL}/reports/${id}</loc>
           <lastmod>${new Date(updated_at || created_at || Date.now()).toISOString()}</lastmod>
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
  let reports = [];
  let newsList = [];
  
  try {
    const reportsResult = await pool.query('SELECT id, updated_at, created_at FROM reports');
    reports = reportsResult.rows;

    const newsResult = await pool.query("SELECT id, published_at FROM news WHERE status='published'");
    newsList = newsResult.rows;
  } catch (error) {
    console.error('Error fetching sitemap data:', error);
  }

  const sitemap = generateSiteMap(reports, newsList);

  res.setHeader('Content-Type', 'text/xml');
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
