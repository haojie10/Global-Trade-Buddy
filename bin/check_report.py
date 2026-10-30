#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GlobalTradeBuddy 报告查重与列表检索工具 (供 Agent 调研前前置调用)
支持「公司名 + 官网域名 + 国家」多维实体消歧与跨国防护
"""

import sys
import os
import io
import re
import json
import argparse
import urllib.request
import urllib.parse
import urllib.error

# 强制在 Windows 控制台下使用 UTF-8 输出，彻底杜绝 GBK 编码崩溃
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
elif sys.platform.startswith('win'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
elif sys.platform.startswith('win'):
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')


def get_env_var(key, default=None):
    val = os.environ.get(key)
    if val:
        return val
    env_paths = [
        os.path.join(os.getcwd(), '.env'),
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'),
        'D:/我的APP/Globaltradebuddy/.env'
    ]
    for p in env_paths:
        if os.path.exists(p):
            try:
                with open(p, 'r', encoding='utf-8') as f:
                    for line in f:
                        line = line.strip()
                        if line.startswith('#') or '=' not in line:
                            continue
                        k, v = line.split('=', 1)
                        if k.strip() == key:
                            return v.strip().strip('"').strip("'")
            except Exception:
                pass
    return default


# 常见复合二级顶级域名列表 (ccTLD + SLD)
MULTI_SUFFIXES = {
    'co.uk', 'org.uk', 'gov.uk', 'ac.uk', 'me.uk', 'ltd.uk', 'plc.uk',
    'com.cn', 'net.cn', 'org.cn', 'gov.cn', 'edu.cn',
    'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au',
    'com.mx', 'org.mx', 'gob.mx', 'edu.mx',
    'co.jp', 'ne.jp', 'or.jp', 'go.jp',
    'com.br', 'org.br', 'net.br',
    'co.nz', 'net.nz', 'org.nz',
    'co.za', 'org.za',
    'com.sg', 'com.hk', 'com.tw', 'com.tr',
    'com.ar', 'com.co', 'com.pe', 'com.ve', 'com.uy',
    'co.il', 'org.il'
}


def extract_apex_domain(url_or_domain):
    """
    解析提取标准根域名 (Apex Domain)，如:
    https://fencing.bekaert.com -> bekaert.com
    https://www.beka-cookware.com -> beka-cookware.com
    http://beka.cl/ -> beka.cl
    whsmithplc.co.uk -> whsmithplc.co.uk
    """
    if not url_or_domain:
        return ""
    text = str(url_or_domain).strip().lower()
    if not text.startswith(('http://', 'https://')):
        text = 'http://' + text
    try:
        parsed = urllib.parse.urlparse(text)
        netloc = parsed.netloc or parsed.path
    except Exception:
        netloc = text

    # 去除端口与多余路径
    netloc = netloc.split(':')[0].strip('/')
    # 剥离前缀 www., www2. 等
    netloc = re.sub(r'^www\d*\.', '', netloc)

    parts = netloc.split('.')
    if len(parts) <= 2:
        return netloc

    last_two = '.'.join(parts[-2:])
    if last_two in MULTI_SUFFIXES and len(parts) >= 3:
        return '.'.join(parts[-3:])

    return '.'.join(parts[-2:])


# 大洲与国家对应字典 (中英文全面支持)
CONTINENT_MAP = {
    'Europe': {
        'france', 'french', 'uk', 'united kingdom', 'great britain', 'england', 'germany', 'deutschland',
        'belgium', 'netherlands', 'holland', 'spain', 'portugal', 'italy', 'poland', 'russia', 'switzerland',
        'austria', 'sweden', 'norway', 'denmark', 'finland', 'greece', 'ireland', 'czech', 'czech republic',
        'romania', 'hungary', 'europe', 'eu', 'western europe', 'eastern europe', 'northern europe', 'southern europe',
        '法国', '英国', '德国', '比利时', '荷兰', '西班牙', '葡萄牙', '意大利', '波兰', '俄罗斯', '瑞士',
        '奥地利', '瑞典', '挪威', '丹麦', '芬兰', '希腊', '爱尔兰', '捷克', '罗马尼亚', '匈牙利', '欧洲',
        '欧盟', '西欧', '东欧', '北欧', '南欧'
    },
    'South America': {
        'chile', 'brazil', 'brasil', 'argentina', 'colombia', 'peru', 'uruguay', 'paraguay', 'venezuela',
        'ecuador', 'bolivia', 'south america', 'latin america', 'latam',
        '智利', '巴西', '阿根廷', '哥伦比亚', '秘鲁', '乌拉圭', '巴拉圭', '委内瑞拉', '厄瓜多尔', '玻利维亚',
        '南美', '南美洲', '拉美', '拉丁美洲'
    },
    'North America': {
        'usa', 'united states', 'us', 'america', 'canada', 'mexico', 'north america',
        '美国', '加拿大', '墨西哥', '北美', '北美洲'
    },
    'Asia': {
        'china', 'japan', 'korea', 'south korea', 'vietnam', 'thailand', 'singapore', 'malaysia',
        'indonesia', 'philippines', 'india', 'uae', 'united arab emirates', 'saudi arabia', 'israel',
        'asia', 'east asia', 'southeast asia', 'middle east', 'apac',
        '中国', '日本', '韩国', '越南', '泰国', '新加坡', '马来西亚', '印度尼西亚', '印尼', '菲律宾',
        '印度', '阿联酋', '沙特', '沙特阿拉伯', '以色列', '亚洲', '东亚', '东南亚', '中东', '亚太'
    },
    'Oceania': {
        'australia', 'new zealand', 'oceania', 'aus', 'nz',
        '澳大利亚', '澳洲', '新西兰', '大洋洲'
    },
    'Africa': {
        'south africa', 'egypt', 'nigeria', 'kenya', 'morocco', 'africa',
        '南非', '埃及', '尼日利亚', '肯尼亚', '摩洛哥', '非洲'
    }
}


def get_continents(region_str):
    """解析国家或区域文本所在的一个或多个大洲"""
    if not region_str:
        return set()
    cleaned = re.sub(r'[,/|；;，]', ' ', str(region_str).lower())
    words = [w.strip() for w in cleaned.split() if w.strip()]
    continents = set()
    for word in words:
        for cont, country_set in CONTINENT_MAP.items():
            if word in country_set:
                continents.add(cont)
    return continents


def clean_company_name(name):
    """去除公司名称中的法律后缀、停用词、多余标点和引号"""
    if not name:
        return ""
    cleaned = re.sub(
        r'\b(AG|GmbH|LLC|Inc\.?|Ltd\.?|Corp\.?|PLC|SA|SAS|BV|SE|S\.A\.B\.|Co\.,\s*Ltd\.?|S\.p\.A\.|Pty\s*Ltd|Pty\s*Limited|Co\.?|Sp\.\s*z\s*o\.\s*o\.|Spzoo|s\.r\.o\.|sro)\b',
        '',
        name,
        flags=re.IGNORECASE
    )
    cleaned = re.sub(
        r'\b(international|global|group|holdings|holding|trading|wholesale|retail|distribution|industries|enterprise)\b',
        '',
        cleaned,
        flags=re.IGNORECASE
    )
    cleaned = re.sub(r"['’`\"“”]", '', cleaned)
    cleaned = re.sub(r'[\(\)\[\]（）\-—_,\.&+/\\:]', ' ', cleaned).strip()
    return re.sub(r'\s+', ' ', cleaned).strip().lower()


def fetch_reports_from_api(company=None, product=None, region=None, search=None, all_reports=False):
    """请求平台 agent reports API 获取候选报告"""
    api_url = get_env_var('GTB_API_URL', 'https://marketgraphic.cn').rstrip('/')
    api_key = get_env_var('AGENT_API_KEY', 'automation_agent_secret')

    params = {'apiKey': api_key}
    if company:
        params['company'] = company
    if product:
        params['product'] = product
    if region:
        params['region'] = region
    if search:
        params['search'] = search
    if all_reports:
        params['all'] = 'true'

    query_str = urllib.parse.urlencode(params)
    target_url = f"{api_url}/api/agent/reports?{query_str}"

    req = urllib.request.Request(
        target_url,
        headers={'x-agent-api-key': api_key, 'User-Agent': 'GTB-Agent-DuplicateChecker/2.0'}
    )

    try:
        with urllib.request.urlopen(req, timeout=12) as response:
            res_data = response.read().decode('utf-8')
            return json.loads(res_data)
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode('utf-8')
        try:
            err_json = json.loads(err_msg)
            return {'error': err_json.get('error', str(e))}
        except Exception:
            return {'error': f"HTTP {e.code}: {e.reason}"}
    except Exception as e:
        return {'error': f"Request failed: {str(e)}"}


def disambiguate(target_company, target_country, target_website, candidate):
    """
    多维实体消歧核心算法
    返回判定结果字典:
    {
      'status': 'DUPLICATE' | 'DUPLICATE_BRANCH' | 'DIFFERENT_DOMAIN' | 'WARNING_CROSS_BORDER' | 'NO_MATCH',
      'reason': str
    }
    """
    target_apex = extract_apex_domain(target_website)
    cand_apex = extract_apex_domain(candidate.get('website'))

    clean_target = clean_company_name(target_company)
    cand_primary = candidate.get('primary_company') or ''
    cand_title = candidate.get('title') or ''
    clean_cand = clean_company_name(cand_primary or cand_title)

    # 1. 根域名同源与排他比对
    if target_apex and cand_apex:
        # 1.1 同源检测 (根域名一致或互为子域名)
        if target_apex == cand_apex or target_apex.endswith('.' + cand_apex) or cand_apex.endswith('.' + target_apex):
            return {
                'status': 'DUPLICATE_BRANCH',
                'reason': f"根域名指纹同源一致 (待查: {target_apex} vs 库中: {cand_apex})，判定为同一跨国集团分支"
            }
        # 1.2 两者均提供官网域名，但根域名不同 -> 确认独立同名企业，消歧放行！
        return {
            'status': 'DIFFERENT_DOMAIN',
            'reason': f"两者官网根域名完全不同 (待查: {target_apex} vs 库中: {cand_apex})，确认非同源独立企业"
        }

    # 2. 若无法通过域名彻底消歧，检查名称匹配性
    # 短名与短名、包含关系匹配
    is_name_match = False
    if clean_target and clean_cand:
        if clean_target == clean_cand:
            is_name_match = True
        elif len(clean_target) >= 3 and len(clean_cand) >= 3:
            if re.search(rf'\b{re.escape(clean_cand)}\b', clean_target) or re.search(rf'\b{re.escape(clean_target)}\b', clean_cand):
                is_name_match = True

    if not is_name_match:
        return {
            'status': 'NO_MATCH',
            'reason': '企业名称差异较大，未命中'
        }

    # 3. 国别异地防护机制 (Cross-border Guard)
    # 当无法提供官网域名，且清洗后的企业名称少于 6 个字符 (如 Beka, Star, Apex 等高频词)
    if len(clean_target) < 6:
        target_conts = get_continents(target_country)
        cand_conts = get_continents(candidate.get('market_region'))
        # 如果双方国别已知且大洲完全无交集 (如 Europe vs South America)
        if target_conts and cand_conts and target_conts.isdisjoint(cand_conts):
            return {
                'status': 'WARNING_CROSS_BORDER',
                'reason': f"企业短名少于6字({clean_target})，且待查国家({target_country} / {','.join(target_conts)})与库中国别({candidate.get('market_region')} / {','.join(cand_conts)})跨大洲无同源证据，启动异地防护降级放行"
            }

    # 兜底：无域名可辨析且同大洲或长名重合，判定为重复
    return {
        'status': 'DUPLICATE',
        'reason': f"企业名称高度匹配 ({clean_target} ≈ {clean_cand})，且未能提供相异根域名消歧"
    }


def print_card(candidate, status_label, reason, is_duplicate=True):
    print("\n========================================================")
    if is_duplicate:
        print(f"⚠️ [发现重复/已存在] {status_label}")
    else:
        print(f"🔔 [异地同名警示放行] {status_label}")
    print(f"  • 已有企业主名: {candidate.get('primary_company') or '未知'}")
    print(f"  • 报告标题    : 《{candidate.get('title')}》")
    print(f"  • 报告 ID      : {candidate.get('id')}")
    print(f"  • 国别/区域   : {candidate.get('market_region') or '全球'}")
    print(f"  • 官方网址    : {candidate.get('website') or '无公开信息'}")
    print(f"  • 所属大类    : {candidate.get('products') or '综合渠道'}")
    print(f"  • 发布时间    : {candidate.get('created_at')}")
    print(f"  • 在线链接    : {candidate.get('url')}")
    print(f"  • 判定依据    : {reason}")
    print("========================================================")
    print("💡 [操作指引]")
    if is_duplicate:
        print(f"  - 若需对已有企业报告全面迭代升级，请使用: --target-id {candidate.get('id')}")
    print("  - 若当前待查企业与上述实体的官网及所属品类完全无关，请确认作为独立国别研报新建。\n")


def main():
    parser = argparse.ArgumentParser(description="GlobalTradeBuddy 报告多维查重与实体消歧门禁工具")
    parser.add_argument('--company', type=str, help="待查重企业名称 (如: Bekaert, Beka International)")
    parser.add_argument('--website', type=str, help="待查重企业官方网站 URL (如: https://fencing.bekaert.com)")
    parser.add_argument('--country', type=str, help="待查重企业所属国家 (如: France, United Kingdom)")
    parser.add_argument('--region', type=str, help="目标国家或区域别名 (等同于 --country)")
    parser.add_argument('--product', type=str, help="按产品/品类查重 (如: 泳帽, 高顶灯)")
    parser.add_argument('--search', type=str, help="通用关键词模糊搜索")
    parser.add_argument('--all', action='store_true', help="获取平台全量报告清单")

    args = parser.parse_args()

    country = args.country or args.region
    company = args.company
    website = args.website

    if not (company or args.product or args.search or args.all):
        parser.print_help()
        sys.exit(1)

    # 1. 列表模式
    if args.all:
        result = fetch_reports_from_api(all_reports=True)
        if 'error' in result:
            print(f"❌ 查重请求失败: {result['error']}", file=sys.stderr)
            sys.exit(1)
        total = result.get('total', 0)
        print(f"📊 平台当前共有 {total} 篇报告：")
        for i, rep in enumerate(result.get('reports', []), 1):
            print(f"  {i}. [{rep.get('category', 'report')}] {rep.get('title')} ({rep.get('market_region', '全球')}) - {rep.get('created_at')} -> {rep.get('url')}")
        sys.exit(0)

    # 2. 搜索或产品查重
    if not company:
        result = fetch_reports_from_api(product=args.product, region=country, search=args.search)
        if 'error' in result:
            print(f"❌ 查重请求失败: {result['error']}", file=sys.stderr)
            sys.exit(1)
        matched = result.get('matched', [])
        if result.get('exists') and matched:
            print(f"⚠️ [发现重复/已存在] 平台已存在 {len(matched)} 篇相关报告：")
            for rep in matched:
                print_card(rep, "品类/主题存在已有报告", "关键词命中")
            sys.exit(10)
        else:
            print("✅ [无重复] 平台目前尚未收录该主题报告，可以放心开始调研生成！")
            sys.exit(0)

    # 3. 企业查重 + 多维实体消歧 (核心逻辑)
    print(f"[*] 正在查重目标公司: {company} (国家: {country or '未提供'}, 官网: {website or '未提供'}) ...")
    result = fetch_reports_from_api(company=company)

    if 'error' in result:
        print(f"❌ 查重请求失败: {result['error']}", file=sys.stderr)
        sys.exit(1)

    matched = result.get('matched', [])
    if not result.get('exists') or not matched:
        print("\n✅ [无重复] 平台目前尚未收录该企业客户报告，可以安全新建！\n")
        sys.exit(0)

    # 对所有命中候选报告逐一执行消歧判定
    duplicate_hits = []
    different_domain_hits = []
    warning_cross_border_hits = []

    for cand in matched:
        decision = disambiguate(company, country, website, cand)
        status = decision['status']
        reason = decision['reason']

        if status in ('DUPLICATE', 'DUPLICATE_BRANCH'):
            duplicate_hits.append((cand, status, reason))
        elif status == 'DIFFERENT_DOMAIN':
            different_domain_hits.append((cand, reason))
        elif status == 'WARNING_CROSS_BORDER':
            warning_cross_border_hits.append((cand, reason))

    # 判定决策 1: 若存在任何真实同源/分支重复 -> 强制阻断，退出码 10
    if duplicate_hits:
        for cand, status, reason in duplicate_hits:
            status_label = "命中同名企业跨国分支 (根域名同源)" if status == 'DUPLICATE_BRANCH' else "命中同名企业报告"
            print_card(cand, status_label, reason, is_duplicate=True)
        sys.exit(10)

    # 判定决策 2: 若全都被域名消歧放行 -> 退出码 0
    if different_domain_hits and not warning_cross_border_hits:
        print("\n========================================================")
        print("✅ [无重复 / 根域名消歧放行]")
        print(f"  • 待查企业: {company} (官网: {website})")
        print(f"  • 库中虽存在相似名称报告，但官网根域名完全不一致:")
        for cand, reason in different_domain_hits:
            print(f"    - 已有报告《{cand.get('title')}》: 主名 {cand.get('primary_company')} | 国别 {cand.get('market_region')} | 官网 {cand.get('website') or '无'}")
            print(f"      (消歧说明: {reason})")
        print("  • 判定结论: 确认为独立同名企业，允许安全新建独立研报。")
        print("========================================================\n")
        sys.exit(0)

    # 判定决策 3: 触发异地跨国防护降级 -> 退出码 0，但输出 Warning 卡片
    if warning_cross_border_hits:
        for cand, reason in warning_cross_border_hits:
            print_card(cand, "跨大洲同名企业异地防护", reason, is_duplicate=False)
        sys.exit(0)

    # 兜底放行
    print("\n✅ [无重复] 未发现目标公司已发布的战略情报报告，可安全新建。\n")
    sys.exit(0)


if __name__ == '__main__':
    main()
