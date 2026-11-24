import { describe, it, expect } from 'vitest';
import {
  ARCHETYPE_META,
  normalizeWikiSlug,
  validateMarketFlowData,
  calcPriceMultiplier,
  generateDefaultFaqs,
  buildWikiMarkdownExport,
  MarketFlowData,
} from '../lib/wiki-schema';

/**
 * 构建可供单元测试及后续任务复用的标准德国照明 MarketFlowData 样例
 */
export function buildSampleFlowData(): MarketFlowData {
  return {
    meta: {
      id: 'de_lighting',
      country_code: 'DE',
      country_name_cn: '德国',
      category_id: 4,
      category_name_cn: '照明产品',
      hs_code_6: '940542',
      archetype_id: 'diy_pro_dual',
      currency: 'EUR',
      updated_at: '2026-11-24',
    },
    video_hook: {
      headline_opening: '中国出厂$4.5，德国卖€39.9！',
      headline_insight: '专业电工批发与DIY双轨差价惊人',
      cta_text: '上 marketgraphic.cn 查完整图谱',
    },
    supply_origin: {
      local_manufacturing_pct: 22,
      import_pct: 78,
      top_import_sources: [
        { country_name_cn: '中国', share_pct: 61, positioning: '高性价比主力供给', verified_by_comtrade: true },
        { country_name_cn: '波兰', share_pct: 12, positioning: '近岸快反组装', verified_by_comtrade: false },
      ],
    },
    flow_nodes: [
      {
        id: 'tier1_importers',
        tier: 1,
        label_cn: '德国品牌商 / 进口商',
        share_pct: 100,
        typical_margin_range: '25% - 35%',
        buyer_pain_points: ['怕EPREL能效抽检不合格', '怕WEEE合规停售'],
        sales_pitch_angle: '强调全套CE/ERP测试报告与EPREL预注册支持',
        players: [
          { name: 'Paulmann Licht', website: 'paulmann.com', business_model: '德国家用照明品牌与进口分销商' },
        ],
      },
      {
        id: 'tier2_diy',
        tier: 2,
        label_cn: 'DIY 家装零售连锁',
        share_pct: 48,
        typical_margin_range: '35% - 45%',
        buyer_pain_points: ['看重货架陈列与退货率', '要求德语彩盒包装'],
        sales_pitch_angle: '提供德语合规彩盒与低于1.5%不良率承诺',
        players: [
          { name: 'OBI', website: 'obi.de', business_model: '德国头部DIY建材零售连锁' },
        ],
      },
      {
        id: 'tier2_pro',
        tier: 2,
        label_cn: '专业电工批发商 (Pro)',
        share_pct: 52,
        typical_margin_range: '28% - 38%',
        buyer_pain_points: ['现货率与5年质保', '安装工时效率'],
        sales_pitch_angle: '主打免工具快接端子与5年商用质保方案',
        players: [
          { name: 'Sonepar Deutschland', website: 'sonepar.de', business_model: '全球领先电气B2B批发商' },
        ],
      },
    ],
    flow_edges: [
      { source: 'tier1_importers', target: 'tier2_diy', weight_pct: 48 },
      { source: 'tier1_importers', target: 'tier2_pro', weight_pct: 52 },
    ],
    price_waterfall: [
      { stage_name: '中国 FOB 出厂价', price_usd_equiv: 4.5, markup_desc: '含基础包装与国内港杂' },
      { stage_name: '德国到岸清关价', price_usd_equiv: 5.8, markup_desc: '海运+关税+清关' },
      { stage_name: '进口商/品牌加价', price_usd_equiv: 11.2, markup_desc: '合规认证+仓储+品牌毛利' },
      { stage_name: '终端零售含税价', price_usd_equiv: 42.9, markup_desc: '零售加价+19%德国VAT' },
    ],
  };
}

describe('lib/wiki-schema 校验与 GEO 工具', () => {
  it('ARCHETYPE_META 应完整包含 5 大标准流通原型元数据', () => {
    expect(Object.keys(ARCHETYPE_META)).toHaveLength(5);
    expect(ARCHETYPE_META.mass_retail.shortTag).toBe('零售驱动');
    expect(ARCHETYPE_META.diy_pro_dual.accent).toBe('#ea580c');
    expect(ARCHETYPE_META.heavy_b2b.shortTag).toBe('重工B2B');
    expect(ARCHETYPE_META.regulated_service.shortTag).toBe('强监管服务');
    expect(ARCHETYPE_META.seasonal_custom.shortTag).toBe('定制礼赠');
  });

  it('normalizeWikiSlug 应处理合法输入、超长截断并拦截非法边界', () => {
    expect(normalizeWikiSlug('DE_Lighting_2026')).toBe('de-lighting-2026');
    expect(normalizeWikiSlug('  us  power_tools!! ')).toBe('us-power-tools');

    const longSlug = normalizeWikiSlug(`${'de-lighting-'.repeat(12)}end`);
    expect(longSlug.length).toBeLessThanOrEqual(120);
    expect(longSlug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

    expect(() => normalizeWikiSlug('')).toThrow();
    expect(() => normalizeWikiSlug('___')).toThrow();
    expect(() => normalizeWikiSlug('中文行业')).toThrow();
  });

  it('validateMarketFlowData 应校验合法数据并拦截各类结构或算术违规', () => {
    const valid = buildSampleFlowData();
    const okResult = validateMarketFlowData(valid);
    expect(okResult.valid).toBe(true);
    expect(okResult.errors).toEqual([]);

    // 0. 省略可选字段 hs_code_6 应合法通过
    const withoutHs = buildSampleFlowData();
    delete withoutHs.meta.hs_code_6;
    expect(validateMarketFlowData(withoutHs).valid).toBe(true);

    // 0b. 数组、null 或非对象输入应安全拦截而不崩溃
    expect(validateMarketFlowData([]).valid).toBe(false);
    expect(validateMarketFlowData(null).valid).toBe(false);

    // 0c. meta 字段传入非字符串类型不应抛 TypeError
    const nonStringMeta = buildSampleFlowData() as unknown as { meta: Record<string, unknown> };
    nonStringMeta.meta.id = 12345;
    nonStringMeta.meta.country_name_cn = { name: '德国' };
    nonStringMeta.meta.category_name_cn = null;
    nonStringMeta.meta.country_code = 49;
    nonStringMeta.meta.hs_code_6 = 940542;
    const nonStrRes = validateMarketFlowData(nonStringMeta);
    expect(nonStrRes.valid).toBe(false);
    expect(nonStrRes.errors.length).toBeGreaterThanOrEqual(4);

    // 1. 本土+进口不等于 100%
    const badSupply = buildSampleFlowData();
    badSupply.supply_origin.local_manufacturing_pct = 50;
    badSupply.supply_origin.import_pct = 70;
    const supplyRes = validateMarketFlowData(badSupply);
    expect(supplyRes.valid).toBe(false);
    expect(supplyRes.errors.join(' ')).toContain('100%');

    // 1b. 本土+进口虽然相加等于100但超出 0..100 范围
    const outOfRangeSupply = buildSampleFlowData();
    outOfRangeSupply.supply_origin.local_manufacturing_pct = -10;
    outOfRangeSupply.supply_origin.import_pct = 110;
    expect(validateMarketFlowData(outOfRangeSupply).valid).toBe(false);

    // 1c. 占比传入 null / 空字符串应拦截，杜绝 Number() 隐式转 0
    const nullSupply = buildSampleFlowData() as unknown as {
      supply_origin: { local_manufacturing_pct: unknown; import_pct: unknown };
    };
    nullSupply.supply_origin.local_manufacturing_pct = null;
    nullSupply.supply_origin.import_pct = '';
    expect(validateMarketFlowData(nullSupply).valid).toBe(false);

    // 1d. 误差 0.5 边界：允许 <= 0.5，拦截 > 0.5
    const toleranceOk = buildSampleFlowData();
    toleranceOk.supply_origin.local_manufacturing_pct = 22;
    toleranceOk.supply_origin.import_pct = 78.5;
    expect(validateMarketFlowData(toleranceOk).valid).toBe(true);

    const toleranceBad = buildSampleFlowData();
    toleranceBad.supply_origin.local_manufacturing_pct = 22;
    toleranceBad.supply_origin.import_pct = 78.6;
    expect(validateMarketFlowData(toleranceBad).valid).toBe(false);

    // 2. 价格瀑布非严格递增，且不因 break 吞掉后续元素的非正数校验与 NaN 校验
    const badPrice = buildSampleFlowData();
    badPrice.price_waterfall[0].price_usd_equiv = 10;
    badPrice.price_waterfall[1].price_usd_equiv = 5;
    badPrice.price_waterfall[2].price_usd_equiv = -2;
    badPrice.price_waterfall[3].price_usd_equiv = Number.NaN;
    const priceRes = validateMarketFlowData(badPrice);
    expect(priceRes.valid).toBe(false);
    const priceErrText = priceRes.errors.join(' ');
    expect(priceErrText).toContain('严格递增');
    expect(priceErrText).toContain('price_waterfall[2].price_usd_equiv');
    expect(priceErrText).toContain('price_waterfall[3].price_usd_equiv');

    // 3. 缺节点（少于 3 个）及节点必填字段校验
    const badNodes = buildSampleFlowData();
    badNodes.flow_nodes = badNodes.flow_nodes.slice(0, 2);
    expect(validateMarketFlowData(badNodes).valid).toBe(false);

    const invalidNodeFields = buildSampleFlowData() as unknown as {
      flow_nodes: Array<Record<string, unknown>>;
    };
    invalidNodeFields.flow_nodes[0].share_pct = 150;
    invalidNodeFields.flow_nodes[1].typical_margin_range = '   ';
    invalidNodeFields.flow_nodes[2].sales_pitch_angle = '';
    const nodeFieldRes = validateMarketFlowData(invalidNodeFields);
    expect(nodeFieldRes.valid).toBe(false);
    expect(nodeFieldRes.errors.length).toBeGreaterThanOrEqual(3);

    // 3b. flow_edges 校验 source / target 与 weight_pct
    const badEdges = buildSampleFlowData() as unknown as {
      flow_edges: Array<Record<string, unknown>>;
    };
    badEdges.flow_edges[0].source = '';
    badEdges.flow_edges[1].weight_pct = -5;
    const edgeRes = validateMarketFlowData(badEdges);
    expect(edgeRes.valid).toBe(false);
    expect(edgeRes.errors.length).toBeGreaterThanOrEqual(2);

    // 4. 非法流通原型
    const badArchetype = buildSampleFlowData();
    (badArchetype.meta as { archetype_id: string }).archetype_id = 'unknown_type';
    expect(validateMarketFlowData(badArchetype).valid).toBe(false);

    // 5. 非法 6 位 HS 编码
    const badHs = buildSampleFlowData();
    badHs.meta.hs_code_6 = '9405';
    expect(validateMarketFlowData(badHs).valid).toBe(false);
  });

  it('calcPriceMultiplier 应计算末首阶段倍率并在异常边界时返回短横线', () => {
    const flow = buildSampleFlowData();
    expect(calcPriceMultiplier(flow)).toBe('9.5x');

    const singleStage = buildSampleFlowData();
    singleStage.price_waterfall = [singleStage.price_waterfall[0]];
    expect(calcPriceMultiplier(singleStage)).toBe('-');

    const emptyStage = buildSampleFlowData();
    emptyStage.price_waterfall = [];
    expect(calcPriceMultiplier(emptyStage)).toBe('-');

    const nanStage = buildSampleFlowData();
    nanStage.price_waterfall[nanStage.price_waterfall.length - 1].price_usd_equiv = Number.NaN;
    expect(calcPriceMultiplier(nanStage)).toBe('-');
  });

  it('generateDefaultFaqs 应根据真实数据派生至少 4 条问答并防御空列表边界', () => {
    const faqs = generateDefaultFaqs(buildSampleFlowData(), '德国照明产品流通全景');
    expect(faqs.length).toBeGreaterThanOrEqual(4);
    expect(faqs[0].a).toContain('9.5');
    expect(faqs[1].a).toContain('78%');

    const sparseFlow = buildSampleFlowData() as unknown as MarketFlowData;
    sparseFlow.price_waterfall = [];
    sparseFlow.flow_nodes = [];
    sparseFlow.supply_origin.top_import_sources = [];
    const sparseFaqs = generateDefaultFaqs(sparseFlow, '空字段测试');
    expect(sparseFaqs).toHaveLength(4);
    expect(sparseFaqs.every(item => item.q.length > 0 && item.a.length > 0)).toBe(true);
  });

  it('buildWikiMarkdownExport 应生成含价格表、玩家表、规范链接与信源的纯净 Markdown 并转义表格特殊字符', () => {
    const flow = buildSampleFlowData();
    flow.price_waterfall[0].stage_name = '中国 | FOB\n出厂价';
    flow.flow_nodes[2].players[0].business_model = '全球领先 | 电气\r\nB2B批发商';
    flow.supply_origin.top_import_sources[0].positioning = '高性价比|主力供给';

    const md = buildWikiMarkdownExport({
      slug: 'de-lighting',
      title: '德国照明产品海外流通全景',
      summary: '拆解德国LED照明的DIY与专业电工双轨加价逻辑。',
      country_code: 'DE',
      country_name: '德国',
      market_region: '欧洲',
      industry_name: '照明产品',
      hs_code_6: '940542',
      archetype_id: 'diy_pro_dual',
      flow_data: flow,
      content_md: '## 合规红线\n必须完成 EPREL 注册。',
      faq_items: generateDefaultFaqs(flow, '德国照明产品海外流通全景'),
      sources: [{ title: 'UN Comtrade', url: 'https://comtradeplus.un.org', publisher: 'UN' }],
      updated_at: '2026-11-24T00:00:00.000Z',
    });

    expect(md).toContain('# 德国照明产品海外流通全景');
    expect(md).toContain('| 流通阶段 | 美元等值参考价 (USD) | 加价与成本构成 |');
    expect(md).toContain('Sonepar Deutschland');
    expect(md).toContain('https://marketgraphic.cn/wiki/de-lighting');
    expect(md).toContain('UN Comtrade');
    expect(md).toContain('https://comtradeplus.un.org');
    expect(md).toContain('| 中国 \\| FOB 出厂价 | $4.5 |');
    expect(md).toContain('| Sonepar Deutschland | sonepar.de | 全球领先 \\| 电气 B2B批发商 |');
    expect(md).toContain('| 中国 | 61% | 高性价比\\|主力供给 |');

    // 防御空 price_waterfall、缺失 players/buyer_pain_points 及空 content_md
    const sparseFlow = buildSampleFlowData() as unknown as MarketFlowData;
    sparseFlow.price_waterfall = [];
    sparseFlow.flow_nodes = [
      {
        id: 'n1',
        tier: 1,
        label_cn: '进口商',
        share_pct: 100,
        typical_margin_range: '20%',
        buyer_pain_points: undefined as unknown as string[],
        sales_pitch_angle: '强调交期',
        players: undefined as unknown as MarketFlowData['flow_nodes'][0]['players'],
      },
    ];
    const sparseMd = buildWikiMarkdownExport({
      slug: 'de-lighting-sparse',
      title: '空结构测试',
      summary: '摘要',
      country_code: 'DE',
      country_name: '德国',
      market_region: '欧洲',
      industry_name: '照明产品',
      archetype_id: 'diy_pro_dual',
      flow_data: sparseFlow,
      content_md: '',
    });
    expect(sparseMd).toContain('# 空结构测试');
  });
});
