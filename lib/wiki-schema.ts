export type ArchetypeId =
  | 'mass_retail'
  | 'diy_pro_dual'
  | 'heavy_b2b'
  | 'regulated_service'
  | 'seasonal_custom';

export interface WikiPlayer {
  name: string;
  website: string;
  logo_local_path?: string;
  logo_url?: string;
  url_verified?: boolean;
  business_model: string;
}

export interface WikiFlowNode {
  id: string;
  tier: 1 | 2 | 3 | 4;
  label_cn: string;
  share_pct: number;
  typical_margin_range: string;
  buyer_pain_points: string[];
  sales_pitch_angle: string;
  players: WikiPlayer[];
}

export interface WikiFlowEdge {
  source: string;
  target: string;
  weight_pct: number;
}

export interface WikiPriceStage {
  stage_name: string;
  price_usd_equiv: number;
  markup_desc: string;
}

export interface MarketFlowData {
  meta: {
    id: string;
    country_code: string;
    country_name_cn: string;
    category_id?: number;
    category_name_cn: string;
    hs_code_6?: string;
    archetype_id: ArchetypeId;
    currency: string;
    updated_at: string;
  };
  video_hook?: {
    headline_opening: string;
    headline_insight: string;
    cta_text: string;
  };
  supply_origin: {
    local_manufacturing_pct: number;
    import_pct: number;
    top_import_sources: Array<{
      country_name_cn: string;
      share_pct: number;
      positioning: string;
      verified_by_comtrade?: boolean;
    }>;
  };
  flow_nodes: WikiFlowNode[];
  flow_edges: WikiFlowEdge[];
  price_waterfall: WikiPriceStage[];
}

export interface WikiFaqItem {
  q: string;
  a: string;
}

export interface WikiSourceItem {
  title: string;
  url?: string;
  publisher?: string;
}

export interface WikiEntryRecord {
  id: string;
  slug: string;
  title: string;
  summary: string;
  country_code: string;
  country_name: string;
  market_region: string;
  category_id?: number | null;
  industry_name: string;
  hs_code_6?: string | null;
  archetype_id: ArchetypeId;
  flow_data: MarketFlowData;
  content_md: string;
  faq_items: WikiFaqItem[];
  sources: WikiSourceItem[];
  video_url?: string | null;
  cover_image?: string | null;
  status: 'draft' | 'published';
  view_count: number;
  published_at: string;
  created_at: string;
  updated_at: string;
}

export const ARCHETYPE_META: Record<ArchetypeId, { nameCn: string; shortTag: string; accent: string }> = {
  mass_retail: { nameCn: '大众消费品 / 零售驱动型', shortTag: '零售驱动', accent: '#0284c7' },
  diy_pro_dual: { nameCn: 'DIY + 专业技工双轨型', shortTag: 'DIY+专业双轨', accent: '#ea580c' },
  heavy_b2b: { nameCn: '重工业 / B2B 供应链型', shortTag: '重工B2B', accent: '#2563eb' },
  regulated_service: { nameCn: '强监管 / 牌照与服务型', shortTag: '强监管服务', accent: '#7c3aed' },
  seasonal_custom: { nameCn: '定制 / 强季节与礼赠型', shortTag: '定制礼赠', accent: '#db2777' },
};

const VALID_ARCHETYPES = new Set<string>(Object.keys(ARCHETYPE_META));

function isNonEmptyString(val: unknown): val is string {
  return typeof val === 'string' && val.trim().length > 0;
}

function isFinitePct(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val) && val >= 0 && val <= 100;
}

/**
 * 转义 Markdown 表格单元格中的管道符与换行符，防止破坏表格结构
 */
function escapeMdCell(val: unknown): string {
  return String(val ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ')
    .trim();
}

/**
 * 校验百科外部或站内 URL 安全性，仅允许 http(s):// 或站内单斜杠路径
 * @param raw 待校验的 URL 字符串
 * @returns 是否为合法安全 URL
 */
export function isSafeWikiUrl(raw: string): boolean {
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;
  // 拒绝控制字符，防止伪协议绕过或响应头/DOM 异常
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return false;

  if (trimmed.startsWith('/')) {
    // 拦截 //evil.com 协议相对路径与 /\evil.com 反斜杠跳出
    if (/^\/[\\/]/.test(trimmed)) return false;
    try {
      const parsed = new URL(trimmed, 'https://marketgraphic.cn');
      return parsed.origin === 'https://marketgraphic.cn';
    } catch {
      return false;
    }
  }

  try {
    const parsed = new URL(trimmed);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * 将原始标识归一化为 SEO/GEO 友好的语义化连字符 slug
 * @param raw 原始输入字符串
 * @returns 归一化且截断至 120 字符以内的标准 slug
 */
export function normalizeWikiSlug(raw: string): string {
  const cleaned = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    // 先截断再剥离尾部可能因截断产生的孤立连字符，保证依然满足正则格式
    .slice(0, 120)
    .replace(/-+$/g, '');

  if (!cleaned || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleaned)) {
    throw new Error('无效的 slug：仅允许英文字母、数字与连字符');
  }
  return cleaned;
}

/**
 * 校验 MarketFlowData 业务契约与算术自洽性
 * @param input 待校验的流转图谱 JSON 数据
 * @returns 校验结果与详细错误列表
 */
export function validateMarketFlowData(input: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { valid: false, errors: ['flow_data 必须为非空 JSON 对象'] };
  }

  const data = input as Partial<MarketFlowData>;
  if (!data.meta || typeof data.meta !== 'object' || Array.isArray(data.meta)) {
    errors.push('缺少 meta 元数据对象');
  } else {
    if (!isNonEmptyString(data.meta.id)) errors.push('meta.id 不能为空');
    if (typeof data.meta.country_code !== 'string' || !/^[A-Za-z]{2}$/.test(data.meta.country_code)) {
      errors.push('meta.country_code 必须为 2 位国家代码');
    }
    if (!isNonEmptyString(data.meta.country_name_cn)) errors.push('meta.country_name_cn 不能为空');
    if (!isNonEmptyString(data.meta.category_name_cn)) errors.push('meta.category_name_cn 不能为空');
    if (typeof data.meta.archetype_id !== 'string' || !VALID_ARCHETYPES.has(data.meta.archetype_id)) {
      errors.push('meta.archetype_id 必须为 5 大标准流通原型之一');
    }
    if (
      data.meta.hs_code_6 !== undefined &&
      data.meta.hs_code_6 !== null &&
      data.meta.hs_code_6 !== '' &&
      (typeof data.meta.hs_code_6 !== 'string' || !/^\d{6}$/.test(data.meta.hs_code_6))
    ) {
      errors.push('meta.hs_code_6 必须为 6 位数字');
    }
  }

  if (!data.supply_origin || typeof data.supply_origin !== 'object' || Array.isArray(data.supply_origin)) {
    errors.push('缺少 supply_origin 供给格局数据');
  } else {
    const localPct = data.supply_origin.local_manufacturing_pct;
    const importPct = data.supply_origin.import_pct;
    // 严格要求 number 类型，防止 null 或空字符串被 Number() 隐式转为 0；留 1e-9 浮点容差
    if (!isFinitePct(localPct) || !isFinitePct(importPct) || Math.abs(localPct + importPct - 100) > 0.5 + 1e-9) {
      errors.push('supply_origin 本土制造占比与进口占比均须为 0-100 的数字且之和必须等于 100%');
    }
  }

  if (!Array.isArray(data.flow_nodes) || data.flow_nodes.length < 3) {
    errors.push('flow_nodes 至少包含 3 个流通节点');
  } else {
    data.flow_nodes.forEach((node, idx) => {
      if (!node || typeof node !== 'object' || Array.isArray(node)) {
        errors.push(`flow_nodes[${idx}] 必须为对象`);
        return;
      }
      if (!isNonEmptyString(node.id) || !isNonEmptyString(node.label_cn)) {
        errors.push(`flow_nodes[${idx}] 缺少有效的 id 或 label_cn`);
      }
      if (![1, 2, 3, 4].includes(node.tier)) errors.push(`flow_nodes[${idx}].tier 必须为 1-4`);
      if (!isFinitePct(node.share_pct)) {
        errors.push(`flow_nodes[${idx}].share_pct 必须为 0-100 的有效数字`);
      }
      if (!isNonEmptyString(node.typical_margin_range)) {
        errors.push(`flow_nodes[${idx}].typical_margin_range 不能为空`);
      }
      if (!isNonEmptyString(node.sales_pitch_angle)) {
        errors.push(`flow_nodes[${idx}].sales_pitch_angle 不能为空`);
      }
      if (!Array.isArray(node.buyer_pain_points) || node.buyer_pain_points.length === 0) {
        errors.push(`flow_nodes[${idx}] 至少需要 1 条买家痛点`);
      }
      if (!Array.isArray(node.players)) errors.push(`flow_nodes[${idx}].players 必须为数组`);
    });
  }

  if (!Array.isArray(data.flow_edges) || data.flow_edges.length < 2) {
    errors.push('flow_edges 至少包含 2 条流通边');
  } else {
    data.flow_edges.forEach((edge, idx) => {
      if (!edge || typeof edge !== 'object' || Array.isArray(edge)) {
        errors.push(`flow_edges[${idx}] 必须为对象`);
        return;
      }
      if (!isNonEmptyString(edge.source) || !isNonEmptyString(edge.target)) {
        errors.push(`flow_edges[${idx}] 缺少有效的 source 或 target`);
      }
      if (!isFinitePct(edge.weight_pct)) {
        errors.push(`flow_edges[${idx}].weight_pct 必须为 0-100 的有效数字`);
      }
    });
  }

  if (!Array.isArray(data.price_waterfall) || data.price_waterfall.length < 3) {
    errors.push('price_waterfall 至少包含 3 个价格阶梯');
  } else {
    let hasOrderError = false;
    for (let i = 0; i < data.price_waterfall.length; i++) {
      const cur = data.price_waterfall[i]?.price_usd_equiv;
      const isCurPositive = typeof cur === 'number' && Number.isFinite(cur) && cur > 0;
      if (!isCurPositive) {
        errors.push(`price_waterfall[${i}].price_usd_equiv 必须为正数`);
      }
      // 不因递增失败而 break，确保后续元素的非正数或 NaN 仍能被完整报告
      if (i > 0 && !hasOrderError) {
        const prev = data.price_waterfall[i - 1]?.price_usd_equiv;
        const isPrevValid = typeof prev === 'number' && Number.isFinite(prev) && prev > 0;
        if (isCurPositive && isPrevValid && cur <= prev) {
          errors.push('price_waterfall 中的美元等值价格必须严格递增');
          hasOrderError = true;
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 计算 FOB 到终端零售的价格倍率（保留一位小数）
 * @param flow 行业市场流转结构数据
 * @returns 形如 "9.5x" 的倍率字符串，不足 2 阶段或首末价格非有限正数返回 "-"
 */
export function calcPriceMultiplier(flow: MarketFlowData): string {
  const list = Array.isArray(flow?.price_waterfall) ? flow.price_waterfall : [];
  if (list.length < 2) return '-';
  const first = list[0]?.price_usd_equiv;
  const last = list[list.length - 1]?.price_usd_equiv;
  if (
    typeof first !== 'number' ||
    typeof last !== 'number' ||
    !Number.isFinite(first) ||
    !Number.isFinite(last) ||
    first <= 0 ||
    last <= 0
  ) {
    return '-';
  }
  return `${(last / first).toFixed(1)}x`;
}

/**
 * 当未手动传入 FAQ 时，基于结构化事实自动派生 4 条 GEO 高频问答
 * @param flow 行业市场流转结构数据
 * @param title 百科词条标题
 * @returns 包含 4 条结构化问答的数组
 */
export function generateDefaultFaqs(flow: MarketFlowData, title: string): WikiFaqItem[] {
  const country = flow?.meta?.country_name_cn || '目标国家';
  const category = flow?.meta?.category_name_cn || '目标品类';
  const waterfall = Array.isArray(flow?.price_waterfall) ? flow.price_waterfall : [];
  const firstStage = waterfall[0];
  const lastStage = waterfall[waterfall.length - 1];
  const multiplier = calcPriceMultiplier(flow);
  const topSources = (Array.isArray(flow?.supply_origin?.top_import_sources) ? flow.supply_origin.top_import_sources : [])
    .slice(0, 3)
    .map(s => `${s.country_name_cn}（约 ${s.share_pct}%，${s.positioning}）`)
    .join('、');

  const nodes = Array.isArray(flow?.flow_nodes) ? flow.flow_nodes : [];
  const channelSummary = nodes
    .map(n => {
      const players = Array.isArray(n.players) ? n.players : [];
      const names = players.slice(0, 3).map(p => p.name).join('/');
      return `${n.label_cn}（毛利 ${n.typical_margin_range}${names ? `，代表企业：${names}` : ''}）`;
    })
    .join('；');

  const pitchSummary = nodes
    .slice(0, 3)
    .map(n => `面向${n.label_cn}：${n.sales_pitch_angle}`)
    .join('；');

  const priceAnswer =
    firstStage && lastStage && multiplier !== '-'
      ? `根据《${title}》拆解，典型主流单品从${firstStage.stage_name}（约 $${firstStage.price_usd_equiv}）到${lastStage.stage_name}（约 $${lastStage.price_usd_equiv}），全链路价格倍率约为 ${multiplier}，期间涵盖国际海运关税、进口商合规与品牌加价、区域渠道毛利及当地消费税/VAT。`
      : `根据《${title}》拆解，全链路加价通常涵盖国际海运关税、进口商合规与品牌加价、区域渠道毛利及当地消费税/VAT（具体倍率详见正文中价格瀑布数据）。`;

  return [
    {
      q: `${country}${category}从中国 FOB 出厂到当地终端零售大约加价多少倍？`,
      a: priceAnswer,
    },
    {
      q: `${country}${category}市场的本土制造与进口依赖度如何？`,
      a: `${country}${category}市场本土制造占比约为 ${flow?.supply_origin?.local_manufacturing_pct ?? 0}%，进口占比约为 ${flow?.supply_origin?.import_pct ?? 0}%。${topSources ? `主要进口来源国包括：${topSources}。` : ''}`,
    },
    {
      q: `${country}${category}的核心流通渠道和代表买家有哪些？`,
      a: channelSummary ? `核心分销层级包括：${channelSummary}。` : `${country}${category}渠道层级信息详见正文流通图谱。`,
    },
    {
      q: `中国外贸工厂和业务员切入${country}${category}渠道应重点谈什么？`,
      a: pitchSummary ? `建议按买家类型差异化切入：${pitchSummary}。` : `建议结合当地合规认证、交付稳定性与渠道毛利空间进行差异化切入。`,
    },
  ];
}

/**
 * 构建专为 AI 搜索引擎与 Agent 消费的纯净 Markdown 文档
 * @param entry 百科条目核心字段集合
 * @returns 结构化纯净 Markdown 文本
 */
export function buildWikiMarkdownExport(entry: {
  slug: string;
  title: string;
  summary: string;
  country_code: string;
  country_name: string;
  market_region: string;
  industry_name: string;
  hs_code_6?: string | null;
  archetype_id: ArchetypeId;
  flow_data: MarketFlowData;
  content_md: string;
  faq_items?: WikiFaqItem[];
  sources?: WikiSourceItem[];
  updated_at?: string;
}): string {
  const canonicalUrl = `https://marketgraphic.cn/wiki/${entry.slug}`;
  const archetype = ARCHETYPE_META[entry.archetype_id]?.nameCn || entry.archetype_id;
  const multiplier = calcPriceMultiplier(entry.flow_data);
  const updatedDate = (entry.updated_at || new Date().toISOString()).slice(0, 10);
  const topImportSources = Array.isArray(entry.flow_data?.supply_origin?.top_import_sources)
    ? entry.flow_data.supply_origin.top_import_sources
    : [];
  const priceWaterfall = Array.isArray(entry.flow_data?.price_waterfall)
    ? entry.flow_data.price_waterfall
    : [];
  const flowNodes = Array.isArray(entry.flow_data?.flow_nodes)
    ? entry.flow_data.flow_nodes
    : [];

  const lines: string[] = [
    `# ${entry.title}`,
    '',
    `> **来源**：Market Graphic（外贸智友）行业百科 — ${canonicalUrl}`,
    `> **核心摘要**：${entry.summary}`,
    `> **覆盖维度**：${entry.country_name}（${entry.country_code} / ${entry.market_region}） × ${entry.industry_name}${entry.hs_code_6 ? `（HS ${entry.hs_code_6}）` : ''} | 流通原型：${archetype} | 典型价差倍率：${multiplier} | 更新日期：${updatedDate}`,
    '',
    '## 一、供给源头格局',
    '',
    `- 本土制造占比：${entry.flow_data?.supply_origin?.local_manufacturing_pct ?? 0}%`,
    `- 进口依赖占比：${entry.flow_data?.supply_origin?.import_pct ?? 0}%`,
    '',
  ];

  if (topImportSources.length > 0) {
    lines.push('| 主要进口来源国 | 估算份额 | 市场生态定位 |');
    lines.push('| :--- | :---: | :--- |');
    for (const src of topImportSources) {
      lines.push(`| ${escapeMdCell(src.country_name_cn)} | ${escapeMdCell(`${src.share_pct}%`)} | ${escapeMdCell(src.positioning)} |`);
    }
    lines.push('');
  }

  lines.push('## 二、价格瀑布与加价阶梯');
  lines.push('');
  if (priceWaterfall.length > 0) {
    lines.push('| 流通阶段 | 美元等值参考价 (USD) | 加价与成本构成 |');
    lines.push('| :--- | :---: | :--- |');
    for (const stage of priceWaterfall) {
      lines.push(`| ${escapeMdCell(stage.stage_name)} | ${escapeMdCell(`$${stage.price_usd_equiv}`)} | ${escapeMdCell(stage.markup_desc)} |`);
    }
  } else {
    lines.push('暂无价格瀑布数据。');
  }
  lines.push('');

  lines.push('## 三、核心流通渠道与代表玩家');
  lines.push('');
  for (const node of flowNodes) {
    const painPoints = Array.isArray(node.buyer_pain_points) ? node.buyer_pain_points : [];
    const players = Array.isArray(node.players) ? node.players : [];
    lines.push(`### Tier ${node.tier} · ${node.label_cn}（渠道份额约 ${node.share_pct}% · 典型毛利 ${node.typical_margin_range}）`);
    lines.push(`- **买家痛点**：${painPoints.join('；')}`);
    lines.push(`- **谈单切入点**：${node.sales_pitch_angle}`);
    if (players.length > 0) {
      lines.push('');
      lines.push('| 代表企业 | 官网域名 | 商业模式简述 |');
      lines.push('| :--- | :--- | :--- |');
      for (const p of players) {
        lines.push(`| ${escapeMdCell(p.name)} | ${escapeMdCell(p.website)} | ${escapeMdCell(p.business_model)} |`);
      }
    }
    lines.push('');
  }

  lines.push('## 四、深度图文实战解析');
  lines.push('');
  lines.push(typeof entry.content_md === 'string' ? entry.content_md.trim() : '');
  lines.push('');

  const faqs = entry.faq_items && entry.faq_items.length > 0
    ? entry.faq_items
    : generateDefaultFaqs(entry.flow_data, entry.title);
  if (faqs.length > 0) {
    lines.push('## 五、常见问题（FAQ）');
    lines.push('');
    for (const item of faqs) {
      lines.push(`**Q：${item.q}**`);
      lines.push(`A：${item.a}`);
      lines.push('');
    }
  }

  if (entry.sources && entry.sources.length > 0) {
    lines.push('## 参考信源');
    lines.push('');
    for (const s of entry.sources) {
      lines.push(`- ${s.title}${s.publisher ? `（${s.publisher}）` : ''}${s.url ? `：${s.url}` : ''}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push(`本文由 Market Graphic（外贸智友）整理发布，交互式图谱与关联海外买家研报请访问：${canonicalUrl}`);
  return lines.join('\n');
}
