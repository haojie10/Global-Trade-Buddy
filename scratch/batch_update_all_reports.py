import os, glob, re

with open('scratch/banner_base64.txt', 'r', encoding='utf-8') as f:
    b64_logo = f.read().strip()

# ============================================================
# 1. 更新 Company Insight 文件夹下的所有报告
# ============================================================
company_files = glob.glob('report/Company Insight/*.html')
for fpath in company_files:
    with open(fpath, 'r', encoding='utf-8') as f:
        html = f.read()

    # 1.1 更新 Header 右上角 Powered by Market Graphic
    # 如果已经有 b64_logo，先不重复添加；否则替换
    if b64_logo not in html or 'alt="Market Graphic Logo"' not in html:
        html = re.sub(
            r'<div class="flex items-center gap-4">\s*<div class="flex items-center gap-[0-9.]+">\s*<div class="flex flex-col items-end gap-0.5">\s*<span class="[^"]*">Powered by<\/span>\s*<span class="[^"]*">Market Graphic<\/span>\s*<\/div>(\s*<img[^>]*>)?\s*<\/div>\s*<\/div>',
            f'''<div class="flex items-center gap-4">
                    <div class="flex items-center gap-2.5">
                        <div class="flex flex-col items-end gap-0.5">
                            <span class="text-[11px] text-[#7a756f] font-medium tracking-tight">Powered by</span>
                            <span class="text-sm font-bold text-[#ff641e] tracking-tight">Market Graphic</span>
                        </div>
                        <img src="{b64_logo}" alt="Market Graphic Logo" class="h-7 w-auto object-contain" />
                    </div>
                </div>''',
            html,
            count=1
        )

    # 1.2 更新 Footer (保证带 Logo 和超链接)
    company_footer_replacement = f'''<footer class="mt-16 pt-8 pb-12 border-t border-[rgba(160,109,68,0.08)] text-center text-xs text-[#7a756f]">
            <div class="flex flex-col items-center justify-center gap-2 mb-3">
                <div class="flex items-center gap-2">
                    <img src="{b64_logo}" alt="Market Graphic Logo" class="h-6 w-auto object-contain" />
                    <span class="text-sm font-bold text-[#ff641e] tracking-tight">Market Graphic</span>
                </div>
                <a href="https://marketgraphic.cn" target="_blank" rel="noopener noreferrer" class="text-xs text-[#ff641e] hover:underline font-medium">
                    www.marketgraphic.cn
                </a>
            </div>
            <div class="mb-2 leading-relaxed">
                <p>数据来源：官方发布、商业登记信息、EPR框架合规指南、消费者舆情反馈及行业公开研报。</p>
                <p class="mt-1">报告生成声明：本报告由 <strong>Market Graphic</strong> 平台分析生成。</p>
            </div>
        </footer>'''

    html = re.sub(
        r'<footer[\s\S]*?<\/footer>',
        company_footer_replacement,
        html,
        count=1
    )

    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f"[OK] Updated Company Insight Report: {fpath}")

# ============================================================
# 2. 更新 Catagory Insight 文件夹下的所有报告
# ============================================================
category_files = glob.glob('report/Catagory Insight/*.html')
for fpath in category_files:
    with open(fpath, 'r', encoding='utf-8') as f:
        html = f.read()

    # 2.1 更新 Header 右上角 Powered by Market Graphic
    cat_header_pattern = r'<div class="powered-by-mg"[\s\S]*?Market Graphic[\s\S]*?<\/div>'
    cat_header_replacement = f'''<div class="powered-by-mg" style="position: absolute; top: 1.5rem; right: 1.5rem; display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: var(--text-muted); z-index: 10;">
                <div style="display: flex; flex-direction: column; align-items: flex-end; line-height: 1.2;">
                    <span style="font-size: 10px; color: #7a756f; font-weight: 500;">Powered by</span>
                    <span style="font-weight: 700; font-family: 'Outfit', sans-serif; letter-spacing: 0.02em; color: #ff641e; font-size: 13px;">Market Graphic</span>
                </div>
                <img src="{b64_logo}" alt="Market Graphic Logo" style="height: 28px; width: auto; object-fit: contain; vertical-align: middle;" />
            </div>'''

    html = re.sub(cat_header_pattern, cat_header_replacement, html, count=1)

    # 2.2 更新 Footer (保留原有数据来源并加上 Logo 与官网链接)
    # 提取原有 sources 内容（如果有）
    sources_match = re.search(r'(<div[^>]*sources[^>]*>[\s\S]*?<\/div>|<ol[^>]*>[\s\S]*?<\/ol>)', html)
    sources_block = sources_match.group(0) if sources_match else ''

    cat_footer_replacement = f'''<footer class="footer" style="margin-top: 3rem; padding-top: 2rem; padding-bottom: 2.5rem; border-top: 1px solid rgba(160, 109, 68, 0.08); text-align: center;">
            {sources_block}
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; margin-bottom: 0.75rem; margin-top: 1.5rem;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <img src="{b64_logo}" alt="Market Graphic Logo" style="height: 24px; width: auto; object-fit: contain; vertical-align: middle;" />
                    <span style="font-weight: 700; font-family: 'Outfit', sans-serif; font-size: 14px; color: #ff641e; letter-spacing: 0.02em;">Market Graphic</span>
                </div>
                <a href="https://marketgraphic.cn" target="_blank" rel="noopener noreferrer" style="color: #ff641e; text-decoration: none; font-size: 12px; font-weight: 500; letter-spacing: 0.02em;">
                    www.marketgraphic.cn
                </a>
            </div>
            <div style="color: var(--text-muted); font-size: 0.8rem;">
                本报告由 <strong style="color: #ff641e;">Market Graphic</strong> 平台智能分析生成 &copy; 2026 Market Graphic. 保留所有权利。
            </div>
        </footer>'''

    html = re.sub(
        r'<footer[\s\S]*?<\/footer>',
        cat_footer_replacement,
        html,
        count=1
    )

    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f"[OK] Updated Catagory Insight Report: {fpath}")
