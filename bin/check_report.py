#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GlobalTradeBuddy 报告查重与列表检索工具 (供 Agent 调研前前置调用)
"""

import sys
import os
import json
import io
import argparse
import urllib.request
import urllib.parse

# 确保在 Windows 控制台下输出 UTF-8 避免乱码
if sys.platform.startswith('win'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

def get_env_var(key, default=None):
    # 优先从环境变量获取
    val = os.environ.get(key)
    if val:
        return val
    # 尝试从当前目录或根目录 .env 文件解析
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

def check_reports(company=None, product=None, region=None, search=None, all_reports=False):
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
        headers={'x-agent-api-key': api_key, 'User-Agent': 'GTB-Agent-DuplicateChecker/1.0'}
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as response:
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

def main():
    parser = argparse.ArgumentParser(description="GlobalTradeBuddy 报告快速查重与列表检索")
    parser.add_argument('--company', type=str, help="按企业名称查重 (如: Dollarama, PetSmart)")
    parser.add_argument('--product', type=str, help="按产品/品类查重 (如: 泳帽, 高顶灯)")
    parser.add_argument('--region', type=str, help="目标国家或区域 (如: 加拿大, 美国, 英国)")
    parser.add_argument('--search', type=str, help="通用关键词模糊搜索")
    parser.add_argument('--all', action='store_true', help="获取平台全量报告清单")

    args = parser.parse_args()

    if not (args.company or args.product or args.search or args.all):
        parser.print_help()
        sys.exit(1)

    result = check_reports(
        company=args.company,
        product=args.product,
        region=args.region,
        search=args.search,
        all_reports=args.all
    )

    if 'error' in result:
        print(f"❌ 查重请求失败: {result['error']}", file=sys.stderr)
        sys.exit(1)

    # 打印给 Agent 的清晰易读输出
    if args.all:
        total = result.get('total', 0)
        print(f"📊 平台当前共有 {total} 篇报告：")
        for i, rep in enumerate(result.get('reports', []), 1):
            print(f"  {i}. [{rep.get('category', 'report')}] {rep.get('title')} ({rep.get('market_region', '全球')}) - {rep.get('created_at')} -> {rep.get('url')}")
    else:
        exists = result.get('exists', False)
        if exists:
            matched = result.get('matched', [])
            print(f"⚠️ [发现重复/已存在] 平台已存在 {len(matched)} 篇相关报告：")
            for i, rep in enumerate(matched, 1):
                print(f"  {i}. 《{rep.get('title')}》")
                print(f"     - 类别: {rep.get('category')} | 区域: {rep.get('market_region')}")
                print(f"     - 发布日期: {rep.get('created_at')}")
                print(f"     - 查看链接: {rep.get('url')}")
        else:
            print("✅ [无重复] 平台目前尚未收录该主题报告，可以放心开始调研生成！")

if __name__ == '__main__':
    main()
