import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { runDehydration, parseMetadata } from '../pages/api/admin/reports/upload';
import uploadHandler from '../pages/api/admin/reports/upload';
import { Client } from 'pg';
import { createTestClient, cleanDatabase } from './helpers/db-test-helper';

describe('Report Upload & Dehydration Pipeline Test', () => {
  let dbClient: Client;

  beforeAll(async () => {
    dbClient = createTestClient();
    await dbClient.connect();
    // 清空数据，便于测试
    await cleanDatabase(dbClient);
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
          <p>A 公司是全球领先 of 汽配采购商...</p>
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

  it('should extract alias "美国 A 公司" and normalize to "A 公司", and build relations with attributes', async () => {
    // 1. 获取 "A 公司" 的实体 ID
    const aCompanyRes = await dbClient.query("SELECT id FROM entities WHERE canonical_name = 'A 公司'");
    expect(aCompanyRes.rows.length).toBeGreaterThan(0);
    const aCompanyId = aCompanyRes.rows[0].id;

    // 2. 插入一个已有的历史报告，并将其与 "A 公司" 关联
    const insertExistingReportRes = await dbClient.query(
      `INSERT INTO reports (title, category, market_region, summary, content_html)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      ['历史报告 1', 'product', '全球', '历史报告摘要', '关于 A 公司的内容']
    );
    const existingReportId = insertExistingReportRes.rows[0].id;

    await dbClient.query(
      `INSERT INTO report_entities (report_id, entity_id) VALUES ($1, $2)`,
      [existingReportId, aCompanyId]
    );

    // 3. 模拟上传包含别名 "美国 A 公司" 且市场为 "北美" 的新报告
    const mockHtml = `
      <html>
        <head>
          <title>关于北美市场拓展分析</title>
          <meta name="category" content="customer">
          <meta name="market_region" content="北美">
          <meta name="summary" content="主要关于美国 A 公司。">
        </head>
        <body>
          <p>正文内容：我们计划与美国 A 公司在北美市场展开深度合作。</p>
        </body>
      </html>
    `;

    const req = {
      method: 'POST',
      body: { rawHtml: mockHtml },
    } as any;
    let statusVal = 200;
    let jsonVal: any = null;
    const res = {
      status(code: number) {
        statusVal = code;
        return this;
      },
      json(data: any) {
        jsonVal = data;
        return this;
      },
    } as any;

    let newReportId: any;
    try {
      // 4. 调用 API 处理器
      await uploadHandler(req, res);

      expect(statusVal).toBe(200);
      newReportId = jsonVal.reportId;
      expect(newReportId).toBeDefined();

      // 5. 验证是否提取并归一化为 "A 公司" 实体，以及 report_entities 中的关联
      const reportEntitiesRes = await dbClient.query(
        `SELECT * FROM report_entities WHERE report_id = $1 AND entity_id = $2`,
        [newReportId, aCompanyId]
      );
      expect(reportEntitiesRes.rows.length).toBe(1);

      // 6. 验证关系建边
      const relationsRes = await dbClient.query(
        `SELECT * FROM relations WHERE report_id_a = $1 AND report_id_b = $2`,
        [newReportId, existingReportId]
      );
      expect(relationsRes.rows.length).toBe(1);
      const relation = relationsRes.rows[0];
      expect(relation.relation_key).toBe('A 公司');
      expect(relation.market_region).toBe('北美');
      expect(relation.relation_type).toBe('produces');
    } finally {
      // 7. 清理测试产生的特定报告，不影响其他数据
      if (newReportId) {
        await dbClient.query(`DELETE FROM relations WHERE report_id_a = $1 OR report_id_b = $1`, [newReportId]);
        await dbClient.query(`DELETE FROM report_entities WHERE report_id = $1 OR report_id = $2`, [newReportId, existingReportId]);
        await dbClient.query(`DELETE FROM reports WHERE id = $1 OR id = $2`, [newReportId, existingReportId]);
      } else {
        await dbClient.query(`DELETE FROM report_entities WHERE report_id = $1`, [existingReportId]);
        await dbClient.query(`DELETE FROM reports WHERE id = $1`, [existingReportId]);
      }
    }
  });

  it('should successfully parse manualTags, register new entities, concatenate market regions, and build relations', async () => {
    // 确保特斯拉、锂电池这些测试用的实体在运行前不存在，防止脏数据干扰
    await dbClient.query("DELETE FROM entities WHERE canonical_name = ANY($1)", [['特斯拉', '锂电池']]);

    // 获取 "A 公司" 的实体 ID
    const aCompanyRes = await dbClient.query("SELECT id FROM entities WHERE canonical_name = 'A 公司'");
    expect(aCompanyRes.rows.length).toBeGreaterThan(0);
    const aCompanyId = aCompanyRes.rows[0].id;

    // 插入一个已有的历史报告，并将其与 "A 公司" 关联
    const insertExistingReportRes = await dbClient.query(
      `INSERT INTO reports (title, category, market_region, summary, content_html)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      ['历史报告 2', 'product', '全球', '历史报告摘要', '关于 A 公司的内容']
    );
    const existingReportId = insertExistingReportRes.rows[0].id;

    await dbClient.query(
      `INSERT INTO report_entities (report_id, entity_id) VALUES ($1, $2)`,
      [existingReportId, aCompanyId]
    );

    const mockHtml = `
      <html>
        <head>
          <title>特斯拉与丰田的竞争分析</title>
          <meta name="category" content="customer">
          <meta name="market_region" content="亚洲">
          <meta name="summary" content="关于特斯拉和丰田汽车。">
        </head>
        <body>
          <p>正文内容：特斯拉在亚洲市场表现优异，使用的是锂电池。</p>
        </body>
      </html>
    `;

    const req = {
      method: 'POST',
      body: {
        rawHtml: mockHtml,
        manualTags: {
          companies: ['A 公司', '特斯拉'],
          products: ['锂电池'],
          regions: ['北美', '中东'],
          channels: ['一级供应链']
        }
      },
    } as any;

    let statusVal = 200;
    let jsonVal: any = null;
    const res = {
      status(code: number) {
        statusVal = code;
        return this;
      },
      json(data: any) {
        jsonVal = data;
        return this;
      },
    } as any;

    let newReportId: any;
    try {
      await uploadHandler(req, res);

      expect(statusVal).toBe(200);
      newReportId = jsonVal.reportId;
      expect(newReportId).toBeDefined();

      // 验证新报告的 market_region：应该是由 HTML 中的 "亚洲" 与 manual中的 "北美", "中东" 去重并用逗号拼接
      const reportRes = await dbClient.query('SELECT market_region FROM reports WHERE id = $1', [newReportId]);
      const reportRegion = reportRes.rows[0].market_region;
      expect(reportRegion).toContain('亚洲');
      expect(reportRegion).toContain('北美');
      expect(reportRegion).toContain('中东');

      // 验证“特斯拉”是否成功作为别名归属于“A 公司”
      const teslaAliasRes = await dbClient.query(
        "SELECT * FROM entity_aliases WHERE alias_name = '特斯拉' AND entity_id = $1",
        [aCompanyId]
      );
      expect(teslaAliasRes.rows.length).toBe(1);

      const batteryRes = await dbClient.query("SELECT id FROM entities WHERE canonical_name = '锂电池' AND entity_type = 'product'");
      expect(batteryRes.rows.length).toBe(1);

      const channelRes = await dbClient.query("SELECT id FROM entities WHERE canonical_name = '一级供应链' AND entity_type = 'channel'");
      expect(channelRes.rows.length).toBe(1);

      // 验证 report_entities 中的关联：新报告关联了 A 公司、特斯拉、锂电池、一级供应链
      const resolvedEntitiesRes = await dbClient.query(
        `SELECT e.canonical_name FROM report_entities re
         JOIN entities e ON re.entity_id = e.id
         WHERE re.report_id = $1`,
        [newReportId]
      );
      const resolvedNames = resolvedEntitiesRes.rows.map(r => r.canonical_name);
      expect(resolvedNames).toContain('A 公司');
      expect(resolvedNames).toContain('锂电池');
      expect(resolvedNames).toContain('一级供应链');

      // 验证关系建边
      const relationsRes = await dbClient.query(
        `SELECT * FROM relations WHERE report_id_a = $1 AND report_id_b = $2`,
        [newReportId, existingReportId]
      );
      expect(relationsRes.rows.length).toBe(1);
      const relation = relationsRes.rows[0];
      expect(relation.relation_key).toBe('A 公司');
      expect(relation.market_region).toBe(reportRegion);
      expect(relation.relation_type).toBe('produces');

     } finally {
      // 清理测试产生的数据
      if (newReportId) {
        await dbClient.query(`DELETE FROM relations WHERE report_id_a = $1 OR report_id_b = $1`, [newReportId]);
        await dbClient.query(`DELETE FROM report_entities WHERE report_id = $1 OR report_id = $2`, [newReportId, existingReportId]);
        await dbClient.query(`DELETE FROM reports WHERE id = $1 OR id = $2`, [newReportId, existingReportId]);
      } else {
        await dbClient.query(`DELETE FROM report_entities WHERE report_id = $1`, [existingReportId]);
        await dbClient.query(`DELETE FROM reports WHERE id = $1`, [existingReportId]);
      }
      await dbClient.query("DELETE FROM entities WHERE canonical_name = ANY($1)", [['特斯拉', '锂电池']]);
    }
  });

  it('should successfully parse manualTags for competitor, register new competitor entities, and build relations', async () => {
    await dbClient.query("DELETE FROM entities WHERE canonical_name = ANY($1)", [['测试对手1', '测试对手2']]);

    const mockHtml = `
      <html>
        <head>
          <title>测试竞争对手报告</title>
        </head>
        <body>
          <p>正文内容：测试报告内容。</p>
        </body>
      </html>
    `;

    const req = {
      method: 'POST',
      body: {
        rawHtml: mockHtml,
        manualTags: {
          companies: ['测试公司A'],
          competitors: ['测试对手1', '测试对手2'],
          products: ['轮毂'],
          channels: ['直营']
        }
      },
    } as any;

    let statusVal = 200;
    let jsonVal: any = null;
    const res = {
      status(code: number) {
        statusVal = code;
        return this;
      },
      json(data: any) {
        jsonVal = data;
        return this;
      },
    } as any;

    let newReportId: any;
    try {
      await uploadHandler(req, res);

      expect(statusVal).toBe(200);
      newReportId = jsonVal.reportId;
      expect(newReportId).toBeDefined();

      const competitorRes = await dbClient.query("SELECT id FROM entities WHERE canonical_name = '测试对手1' AND entity_type = 'competitor'");
      expect(competitorRes.rows.length).toBe(1);

      const competitorRes2 = await dbClient.query("SELECT id FROM entities WHERE canonical_name = '测试对手2' AND entity_type = 'competitor'");
      expect(competitorRes2.rows.length).toBe(1);

      const resolvedEntitiesRes = await dbClient.query(
        `SELECT e.canonical_name FROM report_entities re
         JOIN entities e ON re.entity_id = e.id
         WHERE re.report_id = $1`,
        [newReportId]
      );
      const resolvedNames = resolvedEntitiesRes.rows.map(r => r.canonical_name);
      expect(resolvedNames).toContain('测试公司A');
      expect(resolvedNames).toContain('测试对手1');
      expect(resolvedNames).toContain('测试对手2');
    } finally {
      if (newReportId) {
        await dbClient.query(`DELETE FROM relations WHERE report_id_a = $1 OR report_id_b = $1`, [newReportId]);
        await dbClient.query(`DELETE FROM report_entities WHERE report_id = $1`, [newReportId]);
        await dbClient.query(`DELETE FROM reports WHERE id = $1`, [newReportId]);
      }
      await dbClient.query("DELETE FROM entities WHERE canonical_name = ANY($1)", [['测试公司A', '测试对手1', '测试对手2', '轮毂', '直营']]);
    }
  });

  it('should override HTML metadata category and summary when manually supplied', async () => {
    const mockHtml = `
      <html>
        <head>
          <title>分类重写测试报告</title>
          <meta name="category" content="customer">
          <meta name="summary" content="HTML原始的简介。">
        </head>
        <body>
          <p>正文内容。</p>
        </body>
      </html>
    `;

    const req = {
      method: 'POST',
      body: {
        rawHtml: mockHtml,
        category: 'product',
        summary: '这是管理员手动填写的更棒的简介内容。',
        manualTags: {}
      },
    } as any;

    let statusVal = 200;
    let jsonVal: any = null;
    const res = {
      status(code: number) {
        statusVal = code;
        return this;
      },
      json(data: any) {
        jsonVal = data;
        return this;
      },
    } as any;

    let newReportId: any;
    try {
      await uploadHandler(req, res);

      expect(statusVal).toBe(200);
      newReportId = jsonVal.reportId;
      expect(newReportId).toBeDefined();

      const reportRes = await dbClient.query('SELECT category, summary FROM reports WHERE id = $1', [newReportId]);
      const report = reportRes.rows[0];
      // 应该是重写后的 category (product) 与 summary (这是管理员手动填写的...)
      expect(report.category).toBe('product');
      expect(report.summary).toBe('这是管理员手动填写的更棒的简介内容。');

    } finally {
      if (newReportId) {
        await dbClient.query(`DELETE FROM reports WHERE id = $1`, [newReportId]);
      }
    }
  });
});
