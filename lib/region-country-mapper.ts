export interface CountryRegionItem {
  name: string;
  region: string;
  code: string;
}

export const ADMIN_STANDARD_COUNTRIES: CountryRegionItem[] = [
  // 亚洲
  { name: '中国', region: '亚洲', code: 'CN' },
  { name: '日本', region: '亚洲', code: 'JP' },
  { name: '韩国', region: '亚洲', code: 'KR' },
  { name: '新加坡', region: '亚洲', code: 'SG' },
  { name: '越南', region: '亚洲', code: 'VN' },
  { name: '泰国', region: '亚洲', code: 'TH' },
  { name: '印度尼西亚', region: '亚洲', code: 'ID' },
  { name: '马来西亚', region: '亚洲', code: 'MY' },
  { name: '菲律宾', region: '亚洲', code: 'PH' },
  { name: '印度', region: '亚洲', code: 'IN' },
  { name: '巴基斯坦', region: '亚洲', code: 'PK' },
  { name: '沙特阿拉伯', region: '亚洲', code: 'SA' },
  { name: '阿联酋', region: '亚洲', code: 'AE' },
  { name: '土耳其', region: '亚洲', code: 'TR' },
  { name: '以色列', region: '亚洲', code: 'IL' },
  { name: '哈萨克斯坦', region: '亚洲', code: 'KZ' },
  { name: '卡塔尔', region: '亚洲', code: 'QA' },
  { name: '科威特', region: '亚洲', code: 'KW' },
  { name: '孟加拉国', region: '亚洲', code: 'BD' },
  { name: '斯里兰卡', region: '亚洲', code: 'LK' },

  // 欧洲
  { name: '德国', region: '欧洲', code: 'DE' },
  { name: '英国', region: '欧洲', code: 'GB' },
  { name: '法国', region: '欧洲', code: 'FR' },
  { name: '意大利', region: '欧洲', code: 'IT' },
  { name: '西班牙', region: '欧洲', code: 'ES' },
  { name: '荷兰', region: '欧洲', code: 'NL' },
  { name: '波兰', region: '欧洲', code: 'PL' },
  { name: '瑞士', region: '欧洲', code: 'CH' },
  { name: '奥地利', region: '欧洲', code: 'AT' },
  { name: '比利时', region: '欧洲', code: 'BE' },
  { name: '瑞典', region: '欧洲', code: 'SE' },
  { name: '挪威', region: '欧洲', code: 'NO' },
  { name: '芬兰', region: '欧洲', code: 'FI' },
  { name: '丹麦', region: '欧洲', code: 'DK' },
  { name: '爱尔兰', region: '欧洲', code: 'IE' },
  { name: '葡萄牙', region: '欧洲', code: 'PT' },
  { name: '希腊', region: '欧洲', code: 'GR' },
  { name: '匈牙利', region: '欧洲', code: 'HU' },
  { name: '捷克', region: '欧洲', code: 'CZ' },
  { name: '罗马尼亚', region: '欧洲', code: 'RO' },
  { name: '俄罗斯', region: '欧洲', code: 'RU' },
  { name: '乌克兰', region: '欧洲', code: 'UA' },
  { name: '克罗地亚', region: '欧洲', code: 'HR' },
  { name: '塞尔维亚', region: '欧洲', code: 'RS' },

  // 北美洲
  { name: '美国', region: '北美洲', code: 'US' },
  { name: '加拿大', region: '北美洲', code: 'CA' },
  { name: '墨西哥', region: '北美洲', code: 'MX' },
  { name: '巴拿马', region: '北美洲', code: 'PA' },
  { name: '古巴', region: '北美洲', code: 'CU' },
  { name: '牙买加', region: '北美洲', code: 'JM' },
  { name: '多米尼加', region: '北美洲', code: 'DO' },
  { name: '哥斯达黎加', region: '北美洲', code: 'CR' },

  // 南美洲
  { name: '巴西', region: '南美洲', code: 'BR' },
  { name: '阿根廷', region: '南美洲', code: 'AR' },
  { name: '哥伦比亚', region: '南美洲', code: 'CO' },
  { name: '智利', region: '南美洲', code: 'CL' },
  { name: '秘鲁', region: '南美洲', code: 'PE' },
  { name: '委内瑞拉', region: '南美洲', code: 'VE' },
  { name: '厄瓜多尔', region: '南美洲', code: 'EC' },
  { name: '乌拉圭', region: '南美洲', code: 'UY' },

  // 大洋洲
  { name: '澳大利亚', region: '大洋洲', code: 'AU' },
  { name: '新西兰', region: '大洋洲', code: 'NZ' },
  { name: '斐济', region: '大洋洲', code: 'FJ' },
  { name: '巴布亚新几内亚', region: '大洋洲', code: 'PG' },

  // 非洲
  { name: '南非', region: '非洲', code: 'ZA' },
  { name: '埃及', region: '非洲', code: 'EG' },
  { name: '尼日利亚', region: '非洲', code: 'NG' },
  { name: '阿尔及利亚', region: '非洲', code: 'DZ' },
  { name: '摩洛哥', region: '非洲', code: 'MA' },
  { name: '肯尼亚', region: '非洲', code: 'KE' },
  { name: '埃塞俄比亚', region: '非洲', code: 'ET' },
  { name: '加纳', region: '非洲', code: 'GH' },
  { name: '突尼斯', region: '非洲', code: 'TN' },
  { name: '坦桑尼亚', region: '非洲', code: 'TZ' },
  { name: '安哥拉', region: '非洲', code: 'AO' },
  { name: '塞内加尔', region: '非洲', code: 'SN' }
];

export const ADMIN_REGIONS = ['All', '亚洲', '欧洲', '北美洲', '南美洲', '大洋洲', '非洲'];

/**
 * 归一化区域名称，使“北美”与“北美洲”、“南美”与“南美洲”等同
 */
export function normalizeRegionName(region: string): string {
  if (!region) return '';
  if (region === '北美') return '北美洲';
  if (region === '南美') return '南美洲';
  return region;
}

/**
 * 获取具体国家对应的标准大区
 */
export function getRegionByCountryName(countryName: string): string | null {
  const match = ADMIN_STANDARD_COUNTRIES.find(c => c.name === countryName);
  return match ? match.region : null;
}

/**
 * 判断节点的 marketRegion 文本是否属于目标 region
 */
export function isNodeInRegion(nodeMarketRegion: string | undefined | null, targetRegion: string): boolean {
  if (!targetRegion || targetRegion === 'All') return true;
  if (!nodeMarketRegion) return false;

  const normalizedTarget = normalizeRegionName(targetRegion);
  const rawRegions = nodeMarketRegion.split(',').map(r => r.trim()).filter(Boolean);

  for (const raw of rawRegions) {
    const normRaw = normalizeRegionName(raw);

    // 1. 如果节点地区字符串包含“全球”，默认在任何大区均可见
    if (normRaw === '全球') return true;

    // 2. 节点地区字符串直接与目标大区匹配 (例如 nodeMarketRegion 填的就是 "北美" 或 "欧洲")
    if (normRaw === normalizedTarget) return true;

    // 3. 节点地区字符串是具体国家名称（如 "德国"），检查该国家的大区
    const cRegion = getRegionByCountryName(raw);
    if (cRegion && normalizeRegionName(cRegion) === normalizedTarget) {
      return true;
    }
  }

  return false;
}
