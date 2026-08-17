#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Market Graphic / Category Insight Report Publisher
自动将 Base64 嵌入完成的自包含 HTML 洞察报告上传并发布至 GlobalTradeBuddy 平台。
"""

import os
import re
import json
import sys
import argparse
import urllib.request
import urllib.error

def load_env(env_path):
    env_vars = {}
    if not os.path.exists(env_path):
        return env_vars
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if '=' in line:
                key, val = line.split('=', 1)
                env_vars[key.strip()] = val.strip()
    return env_vars

def extract_meta(html, name):
    match = re.search(r'<meta[^>]*?name=["\']{}["\'][^>]*?content=["\']([^"\']*)["\']'.format(name), html, re.IGNORECASE)
    if match:
        return match[1].strip()
    match_rev = re.search(r'<meta[^>]*?content=["\']([^"\']*)["\'][^>]*?name=["\']{}["\']'.format(name), html, re.IGNORECASE)
    if match_rev:
        return match_rev[1].strip()
    return ''

def publish_report_file(html_path, target_url=None, api_key=None):
    if not os.path.exists(html_path):
        print(f"[ERR] File not found: {html_path}")
        return False

    # 读取环境变量
    env_path = r"d:\我的APP\Globaltradebuddy\.env"
    env_vars = load_env(env_path)
    
    gtb_api_url = target_url or env_vars.get('GTB_API_URL', 'https://marketgraphic.cn')
    agent_api_key = api_key or env_vars.get('AGENT_API_KEY', 'automation_agent_secret')

    with open(html_path, 'r', encoding='utf-8') as f:
        html_content = f.read()

    title_match = re.search(r'<title>([\s\S]*?)</title>', html_content, re.IGNORECASE)
    title = title_match.group(1).strip() if title_match else "未命名品类洞察报告"

    summary = extract_meta(html_content, 'summary')
    regions = extract_meta(html_content, 'regions')
    products = extract_meta(html_content, 'products')

    # 尝试进行 GTB 标准行业品类自动校验与校正
    try:
        excel_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'references', 'GTB产品结构.xlsx')
        if os.path.exists(excel_path):
            import pandas as pd
            from difflib import get_close_matches
            df = pd.read_excel(excel_path)
            valid_set = set(df['行业名称 (Category CN)'].dropna().astype(str).str.strip())
            
            # 校验 products
            prod_list = [p.strip() for p in products.split(',') if p.strip()]
            corrected_prods = []
            has_changed = False
            for p in prod_list:
                if p in valid_set:
                    corrected_prods.append(p)
                else:
                    matches = get_close_matches(p, valid_set, n=1, cutoff=0.3)
                    if matches:
                        match_word = matches[0]
                        print(f"[AUTO-CORRECT] 非标品类词 '{p}' 自动更正为 GTB 标准名称 '{match_word}'")
                        corrected_prods.append(match_word)
                        html_content = html_content.replace(p, match_word)
                        has_changed = True
                    else:
                        corrected_prods.append(p)
            if has_changed:
                products = ', '.join(corrected_prods)
                title_match = re.search(r'<title>([\s\S]*?)</title>', html_content, re.IGNORECASE)
                title = title_match.group(1).strip() if title_match else title
    except Exception as ve:
        print(f"[WARN] GTB Category validation skipped: {ve}")

    payload = {
        "type": "report",
        "title": title,
        "summary": summary or "",
        "contentHtml": html_content,
        "region": regions.split(',')[0].strip() if regions else "全球",
        "country": regions if regions else "全球",
        "industry": products.split(',')[0].strip() if products else "综合品类",
        "tags": [p.strip() for p in products.split(',')] if products else ["品类洞察"]
    }

    endpoint = f"{gtb_api_url.rstrip('/')}/api/agent/publish"
    data = json.dumps(payload).encode('utf-8')

    req = urllib.request.Request(
        endpoint,
        data=data,
        headers={
            "Authorization": f"Bearer {agent_api_key}",
            "Content-Type": "application/json; charset=utf-8"
        },
        method='POST'
    )

    print(f"[INFO] Publishing report: {os.path.basename(html_path)}")
    print(f"[INFO] Target endpoint: {endpoint}")
    print(f"[INFO] Title: {title}")

    # 先发往默认 API URL
    try:
        with urllib.request.urlopen(req, timeout=90) as response:
            res_body = response.read().decode('utf-8')
            res_json = json.loads(res_body)
            print(f"[OK] Report published successfully! ID: {res_json.get('id')}")
            return True
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8')
        print(f"[ERR] HTTP {e.code} Error during upload: {err_body}")
    except Exception as e:
        print(f"[ERR] Network/Upload Error: {str(e)}")

    # 如果远程失败，降级重试 localhost:3000
    if gtb_api_url != "http://localhost:3000":
        local_endpoint = "http://localhost:3000/api/agent/publish"
        print(f"[RETRY] Trying local endpoint: {local_endpoint}")
        local_req = urllib.request.Request(
            local_endpoint,
            data=data,
            headers={
                "Authorization": f"Bearer {agent_api_key}",
                "Content-Type": "application/json; charset=utf-8"
            },
            method='POST'
        )
        try:
            with urllib.request.urlopen(local_req, timeout=10) as response:
                res_body = response.read().decode('utf-8')
                res_json = json.loads(res_body)
                print(f"[OK] Local publish successful! ID: {res_json.get('id')}")
                return True
        except Exception as le:
            print(f"[ERR] Local retry also failed: {str(le)}")

    return False

def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')

    parser = argparse.ArgumentParser(description="Upload and publish category insight HTML report to GlobalTradeBuddy platform.")
    parser.add_argument("html_path", help="Path to the generated自包含 HTML report file.")
    parser.add_argument("--url", help="Target API URL (optional)")
    parser.add_argument("--key", help="Agent API Key (optional)")

    args = parser.parse_args()
    success = publish_report_file(args.html_path, target_url=args.url, api_key=args.key)
    if not success:
        sys.exit(1)

if __name__ == '__main__':
    main()
