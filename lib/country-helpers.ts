/**
 * 国家与大区辅助处理工具
 */

export const CONTINENT_NAMES = [
  '欧洲', '欧洲区', '欧陆',
  '北美洲', '北美', '北美地区',
  '南美洲', '南美', '南美地区', '拉丁美洲', '拉美',
  '亚洲', '亚太', '东亚', '东南亚', '南亚', '中亚', '西亚',
  '大洋洲', '澳洲',
  '非洲', '北非', '西非', '南非',
  '中东', '中东地区',
  '全球', '全球市场', '海外', '国际'
];

/**
 * 从区域输入列表中只提取具体国家名称，排除大洲/大区等宏观词汇
 * 例如: ['英国', '欧洲'] -> ['英国']
 * 例如: ['美国', '北美'] -> ['美国']
 * 例如: '英国, 欧洲' -> ['英国']
 */
export function filterCountriesOnly(inputs: string[] | string | undefined | null): string[] {
  if (!inputs) return [];

  let list: string[] = [];
  if (typeof inputs === 'string') {
    list = inputs.split(/,|，|\/|\||;|；|\s+/).map(s => s.trim()).filter(Boolean);
  } else if (Array.isArray(inputs)) {
    list = inputs.flatMap(item => 
      typeof item === 'string' 
        ? item.split(/,|，|\/|\||;|；|\s+/).map(s => s.trim()).filter(Boolean)
        : []
    );
  }

  // 1. 过滤掉完全匹配大区/大洲名称的词
  const countryCandidates = list.filter(item => {
    return !CONTINENT_NAMES.includes(item);
  });

  // 如果过滤后有具体的国家候选词，去重并返回国家列表
  if (countryCandidates.length > 0) {
    return Array.from(new Set(countryCandidates));
  }

  // 如果原本只有大区词（例如只填写了“全球”或“欧洲”），作为兜底保留
  return Array.from(new Set(list));
}
