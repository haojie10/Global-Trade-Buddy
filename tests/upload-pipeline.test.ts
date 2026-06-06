import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { runDehydration, parseMetadata } from '../pages/api/admin/reports/upload';
import { Client } from 'pg';

describe('Report Upload & Dehydration Pipeline Test', () => {
  let dbClient: Client;

  beforeAll(async () => {
    dbClient = new Client({
      connectionString: 'postgresql://postgres:postgres@localhost:5432/postgres',
    });
    await dbClient.connect();
    // 清空数据，便于测试
    await dbClient.query('DELETE FROM relations');
    await dbClient.query('DELETE FROM reports');
  });

  afterAll(async () => {
    await dbClient.end();
  });

  it('should successfully parse report metadata and extract entities', () => {
    const mockHtml = `
      <html>
        <head>
          <title>欧美汽配买家 A 公司 360 度调研报告</title>
          <meta name="category" content="customer">
          <meta name="market_region" content="欧美">
          <meta name="summary" content="这份报告详细分析了 A 公司的采购流程、信用评级以及主要供应商。">
        </head>
        <body>
          <h1>A 公司的铝合金轮毂采购分析</h1>
          <p>A 公司是全球领先的汽配采购商...</p>
        </body>
      </html>
    `;
    
    const meta = parseMetadata(mockHtml);
    expect(meta.title).toBe('欧美汽配买家 A 公司 360 度调研报告');
    expect(meta.category).toBe('customer');
    expect(meta.market_region).toBe('欧美');
    expect(meta.summary).toContain('这份报告详细分析了 A 公司的采购流程');
    expect(meta.entities).toContain('A 公司');
    expect(meta.entities).toContain('铝合金轮毂');
  });

  it('should extract base64 images and substitute with OSS URLs', async () => {
    const rawHtml = `
      <html>
        <body>
          <p>测试图 1</p>
          <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==" />
          <p>测试图 2</p>
          <img src="data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==" />
        </body>
      </html>
    `;

    // 传入一个 mock 上传函数，返回固定的 CDN 地址
    const mockUploadToOSS = async (buffer: Buffer, mimeType: string) => {
      const extension = mimeType.split('/')[1] || 'png';
      const mockFileName = `img_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.${extension}`;
      return `https://cdn.globaltradebuddy.com/uploads/${mockFileName}`;
    };

    const { cleanHtml, imageCount } = await runDehydration(rawHtml, mockUploadToOSS);
    expect(imageCount).toBe(2);
    expect(cleanHtml).not.toContain('data:image/png;base64');
    expect(cleanHtml).not.toContain('data:image/jpeg;base64');
    expect(cleanHtml).toContain('https://cdn.globaltradebuddy.com/uploads/img_');
  });
});
