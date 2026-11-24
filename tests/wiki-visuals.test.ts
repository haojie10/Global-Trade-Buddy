import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import WikiPriceWaterfall from '../components/wiki/WikiPriceWaterfall';
import WikiFlowMap from '../components/wiki/WikiFlowMap';
import WikiEntryCard, { WikiListItem } from '../components/wiki/WikiEntryCard';
import { ARCHETYPE_META, WikiFlowNode, WikiPriceStage } from '../lib/wiki-schema';
import type { PlayerAssetMatch } from '../lib/wiki-service';

describe('WikiPriceWaterfall 价格瀑布组件', () => {
  it('在 SSR 下正确输出语义化明细 table、阶段名、美元价格、9.5x 倍率与加价说明', () => {
    const stages: WikiPriceStage[] = [
      { stage_name: '中国 FOB 出厂', price_usd_equiv: 4, markup_desc: '中山灯具厂含基础彩盒' },
      { stage_name: '海运清关到岸', price_usd_equiv: 6.2, markup_desc: '含海运、关税与 19% 进口环节税' },
      { stage_name: '德国商超零售', price_usd_equiv: 38, markup_desc: 'OBI 终端零售含 19% VAT' },
    ];

    const html = renderToStaticMarkup(
      React.createElement(WikiPriceWaterfall, { stages, currency: 'EUR' })
    );

    expect(html).toContain('<table');
    expect(html).toContain('流通阶段');
    expect(html).toContain('美元等值价 (USD)');
    expect(html).toContain('较 FOB 倍率');
    expect(html).toContain('成本与加价说明');

    expect(html).toContain('中国 FOB 出厂');
    expect(html).toContain('$4');
    expect(html).toContain('1.0x');
    expect(html).toContain('中山灯具厂含基础彩盒');

    expect(html).toContain('海运清关到岸');
    expect(html).toContain('$6.2');

    expect(html).toContain('德国商超零售');
    expect(html).toContain('$38');
    expect(html).toContain('9.5x');
    expect(html).toContain('OBI 终端零售含 19% VAT');
  });

  it('空数组返回 null（SSR 输出空字符串）', () => {
    const html = renderToStaticMarkup(
      React.createElement(WikiPriceWaterfall, { stages: [], currency: 'USD' })
    );
    expect(html).toBe('');
  });

  it('首阶段价格为 0 或异常值时倍率显示 "-"，绝不输出 NaN 或 Infinity', () => {
    const stages: WikiPriceStage[] = [
      { stage_name: '异常出厂价', price_usd_equiv: 0, markup_desc: '暂无报价' },
      { stage_name: '终端零售', price_usd_equiv: 25, markup_desc: '含税零售价' },
    ];

    const html = renderToStaticMarkup(
      React.createElement(WikiPriceWaterfall, { stages, currency: 'USD' })
    );

    expect(html).not.toContain('NaN');
    expect(html).not.toContain('Infinity');
    expect(html).toContain('>-<');
  });
});

describe('WikiFlowMap 分层流通图谱组件', () => {
  const sampleNodes: WikiFlowNode[] = [
    {
      id: 'node-tier1-importer',
      tier: 1,
      label_cn: '全国品牌进口商',
      share_pct: 42,
      typical_margin_range: '28%-35%',
      buyer_pain_points: ['ERP 能效认证齐备', '德国仓安全库存'],
      sales_pitch_angle: '强调通过 TÜV 预审与 45 天稳态交付',
      players: [
        {
          name: 'Paulmann Licht GmbH',
          website: 'https://www.paulmann.com/en/',
          business_model: '欧洲照明全渠道品牌运营商',
        },
        {
          name: 'Malicious Corp',
          website: 'javascript:alert(1)',
          logo_url: 'javascript:alert(2)',
          business_model: '测试恶意协议拦截',
        },
      ],
    },
    {
      id: 'node-tier2-diy',
      tier: 2,
      label_cn: 'DIY 建材连锁商超',
      share_pct: 36,
      typical_margin_range: '40%-52%',
      buyer_pain_points: ['货架陈列包装抗压', '低退货率'],
      sales_pitch_angle: '提供德语说明书与欧洲托盘标准打托',
      players: [
        {
          name: 'OBI Bau- und Heimwerkermärkte',
          website: 'obi.de',
          logo_url: 'https://marketgraphic-image-1302276463.cos.ap-shanghai.myqcloud.com/report-images/obi.png',
          business_model: '德国头部 DIY 建材连锁零售商',
        },
        {
          name: 'constructor',
          website: '',
          business_model: '原型链碰撞边界测试玩家',
        },
      ],
    },
  ];

  const playerMatches: Record<string, PlayerAssetMatch> = {
    'paulmann.com': {
      reportId: 'rep-paulmann-001',
      reportTitle: 'Paulmann 360° 客户采购洞察',
      contactCount: 12,
    },
    'obi.de': {
      reportId: null,
      reportTitle: null,
      contactCount: 8,
    },
  };

  it('在 SSR 下完整渲染 Tier 1 / Tier 2、痛点、切入话术、Monogram 徽章与站内资产联动', () => {
    const html = renderToStaticMarkup(
      React.createElement(WikiFlowMap, {
        nodes: sampleNodes,
        playerMatches,
      })
    );

    // 仅渲染存在节点的层级 Tier 1 / Tier 2，且内容不被折叠隐藏
    expect(html).toContain('Tier 1');
    expect(html).toContain('Tier 2');
    expect(html).not.toContain('Tier 3');
    expect(html).not.toContain('Tier 4');

    expect(html).toContain('全国品牌进口商');
    expect(html).toContain('42%');
    expect(html).toContain('28%-35%');
    expect(html).toContain('ERP 能效认证齐备');
    expect(html).toContain('强调通过 TÜV 预审与 45 天稳态交付');

    expect(html).toContain('DIY 建材连锁商超');
    expect(html).toContain('货架陈列包装抗压');
    expect(html).toContain('提供德语说明书与欧洲托盘标准打托');

    // 无 logo_url 时降级为 Monogram（Paulmann 首字母 P）
    expect(html).toContain('>P<');

    // 合法 logo_url 渲染 <img>
    expect(html).toContain(
      '<img src="https://marketgraphic-image-1302276463.cos.ap-shanghai.myqcloud.com/report-images/obi.png"'
    );

    // 命中 reportId 时输出 /reports/... 链接与联系人提示
    expect(html).toContain('href="/reports/rep-paulmann-001"');
    expect(html).toContain('查看 360° 客户研报 →');
    expect(html).toContain('已收录 12 位采购联系人');

    // 仅命中 contactCount（无 reportId）时输出申请解锁按钮
    expect(html).toContain('<button');
    expect(html).toContain('已收录 8 位采购联系人 · 申请研报解锁');

    // 合法官网外链带安全属性
    expect(html).toContain('href="https://paulmann.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');

    // 绝不输出任何 javascript: 危险链接或图片
    expect(html).not.toContain('javascript:');
  });

  it('支持通过清洗公司名匹配站内资产，并安全拦截原型链键名', () => {
    const cleanNameNodes: WikiFlowNode[] = [
      {
        id: 'node-clean-name',
        tier: 3,
        label_cn: '区域工程批发商',
        share_pct: 22,
        typical_margin_range: '18%-25%',
        buyer_pain_points: ['交期不稳定'],
        sales_pitch_angle: '提供本地仓现货直发',
        players: [
          {
            name: 'Acme Lighting GmbH',
            website: '',
            business_model: '区域工程渠道批发商',
          },
          {
            name: 'toString',
            website: '',
            business_model: '原型链属性测试',
          },
        ],
      },
    ];

    const matches: Record<string, PlayerAssetMatch> = {
      'acme lighting': {
        reportId: 'rep-acme-99',
        reportTitle: 'Acme Lighting 研报',
        contactCount: 0,
      },
    };

    const html = renderToStaticMarkup(
      React.createElement(WikiFlowMap, { nodes: cleanNameNodes, playerMatches: matches })
    );

    expect(html).toContain('Tier 3');
    expect(html).toContain('href="/reports/rep-acme-99"');
    expect(html).toContain('查看 360° 客户研报 →');
    expect(html).not.toContain('已收录 0 位采购联系人');
  });
});

describe('WikiEntryCard 百科大厅卡片组件', () => {
  it('正确输出 /wiki/de-lighting 链接、国家品类、HS 编码、9.5x 倍率与原型标签', () => {
    const item: WikiListItem = {
      id: 'wiki-001',
      slug: 'de-lighting',
      title: '德国住宅照明市场流通全图谱',
      summary: '拆解中国 LED 灯具进入德国 DIY 建材与专业电工渠道的加价路径。',
      country_code: 'DE',
      country_name: '德国',
      market_region: '欧洲',
      industry_name: '家居照明',
      hs_code_6: '940542',
      archetype_id: 'diy_pro_dual',
      price_multiplier: '9.5x',
      player_count: 14,
      view_count: 320,
      updated_at: '2026-11-20T10:00:00Z',
    };

    const html = renderToStaticMarkup(React.createElement(WikiEntryCard, { item }));

    expect(html).toContain('href="/wiki/de-lighting"');
    expect(html).toContain('德国');
    expect(html).toContain('家居照明');
    expect(html).toContain('940542');
    expect(html).toContain('9.5x');
    expect(html).toContain('14');
    expect(html).toContain('免费阅读 →');
    expect(html).toContain(ARCHETYPE_META.diy_pro_dual.shortTag);
  });
});
