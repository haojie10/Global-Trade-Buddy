import os, glob, re

with open('scratch/banner_base64.txt', 'r', encoding='utf-8') as f:
    b64_logo = f.read().strip()

# ============================================================
# 1. 更新 Company Insight 模板
# ============================================================
comp_tpl_path = '.antigravity/skills/company-insight-pro/assets/report-template.html'
with open(comp_tpl_path, 'r', encoding='utf-8') as f:
    comp_html = f.read()

# 替换 Header 右上角 (去掉 Market Graphic 文字，保留 Powered by + Logo)
comp_html = re.sub(
    r'<div class="flex items-center gap-4">\s*<div class="flex items-center gap-[0-9.]+">[\s\S]*?<\/div>\s*<\/div>',
    f'''<div class="flex items-center gap-4">
                    <div class="flex items-center gap-2">
                        <span class="text-xs text-[#7a756f] font-medium tracking-tight">Powered by</span>
                        <img src="{b64_logo}" alt="Market Graphic" class="h-6 w-auto object-contain" />
                    </div>
                </div>''',
    comp_html,
    count=1
)

# 替换 Footer (去掉 Market Graphic 文字，保留 Logo + 网址超链接)
comp_footer = f'''<!-- ====== Footer ====== -->
        <footer class="mt-16 pt-8 pb-12 border-t border-[rgba(160,109,68,0.08)] text-center text-xs text-[#7a756f]">
            <div class="flex flex-col items-center justify-center gap-2 mb-3">
                <img src="{b64_logo}" alt="Market Graphic" class="h-7 w-auto object-contain" />
                <a href="https://marketgraphic.cn" target="_blank" rel="noopener noreferrer" class="text-xs text-[#ff641e] hover:underline font-medium tracking-wide">
                    www.marketgraphic.cn
                </a>
            </div>
            <div class="mb-2 leading-relaxed">
                <p>数据来源：官方发布、商业登记信息、EPR框架合规指南、消费者舆情反馈及行业公开研报。</p>
                <p class="mt-1">报告生成声明：本报告由 <strong>Market Graphic</strong> 平台分析生成。</p>
            </div>
        </footer>'''

comp_html = re.sub(
    r'<!-- ====== Footer ====== -->\s*<footer[\s\S]*?<\/footer>',
    comp_footer,
    comp_html,
    count=1
)

with open(comp_tpl_path, 'w', encoding='utf-8') as f:
    f.write(comp_html)
print("[OK] Updated company-insight-pro template")

# ============================================================
# 2. 更新 Category Insight 模板
# ============================================================
cat_tpl_path = '.antigravity/skills/category-insight/assets/report-template.html'
with open(cat_tpl_path, 'r', encoding='utf-8') as f:
    cat_html = f.read()

# 替换 Header 右上角 (去掉 Market Graphic 文字，保留 Powered by + Logo)
cat_html = re.sub(
    r'<div class="powered-by-mg"[\s\S]*?<\/div>',
    f'''<div class="powered-by-mg" style="position: absolute; top: 1.5rem; right: 1.5rem; display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: var(--text-muted); z-index: 10;">
                <span style="font-size: 12px; color: #7a756f; font-weight: 500;">Powered by</span>
                <img src="{b64_logo}" alt="Market Graphic" style="height: 24px; width: auto; object-fit: contain; vertical-align: middle;" />
            </div>''',
    cat_html,
    count=1
)

# 替换 Footer (去掉 Market Graphic 文字，保留 Logo + 网址超链接)
cat_footer = f'''<!-- 页脚 -->
        <footer class="footer" style="margin-top: 3rem; padding-top: 2rem; padding-bottom: 2.5rem; border-top: 1px solid rgba(160, 109, 68, 0.08); text-align: center;">
            <div style="margin-bottom: 1.5rem; font-size: 0.8rem; line-height: 1.6; text-align: left; max-width: 800px; margin-left: auto; margin-right: auto; padding: 1.2rem; background: rgba(160, 109, 68, 0.03); border: 1px solid rgba(160, 109, 68, 0.08); border-radius: 12px; color: var(--text-secondary);">
                <strong style="color: var(--text-primary); display: block; margin-bottom: 0.5rem;">数据与信息来源：</strong>
                <ol style="margin-left: 1.2rem; padding-left: 0; color: var(--text-secondary);">
                    <!-- SOURCES_LIST -->
                </ol>
            </div>
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; margin-bottom: 0.75rem; margin-top: 1.5rem;">
                <img src="{b64_logo}" alt="Market Graphic" style="height: 28px; width: auto; object-fit: contain; vertical-align: middle;" />
                <a href="https://marketgraphic.cn" target="_blank" rel="noopener noreferrer" style="color: #ff641e; text-decoration: none; font-size: 12px; font-weight: 500; letter-spacing: 0.03em;">
                    www.marketgraphic.cn
                </a>
            </div>
            <div style="color: var(--text-muted); font-size: 0.8rem;">
                本报告由 <strong style="color: #ff641e;">Market Graphic</strong> 平台智能分析生成 &copy; 2026 Market Graphic. 保留所有权利。
            </div>
        </footer>'''

cat_html = re.sub(
    r'<!-- 页脚 -->\s*<footer[\s\S]*?<\/footer>',
    cat_footer,
    cat_html,
    count=1
)

with open(cat_tpl_path, 'w', encoding='utf-8') as f:
    f.write(cat_html)
print("[OK] Updated category-insight template")

# ============================================================
# 3. 复制更新 report-customer 和 report-category 模板
# ============================================================
with open('.antigravity/skills/report-customer/assets/report-template.html', 'w', encoding='utf-8') as f:
    f.write(comp_html)
with open('.antigravity/skills/report-category/assets/report-template.html', 'w', encoding='utf-8') as f:
    f.write(cat_html)
print("[OK] Synced report-customer & report-category templates")

# ============================================================
# 4. 全量更新 report/ 下的 5 份已交付报告
# ============================================================
# 4.1 Company Insight 报告
for fpath in glob.glob('report/Company Insight/*.html'):
    with open(fpath, 'r', encoding='utf-8') as f:
        txt = f.read()

    # 更新 Header (移除多余文字)
    txt = re.sub(
        r'<div class="flex items-center gap-4">\s*<div class="flex items-center gap-[0-9.]+">[\s\S]*?<\/div>\s*<\/div>',
        f'''<div class="flex items-center gap-4">
                    <div class="flex items-center gap-2">
                        <span class="text-xs text-[#7a756f] font-medium tracking-tight">Powered by</span>
                        <img src="{b64_logo}" alt="Market Graphic" class="h-6 w-auto object-contain" />
                    </div>
                </div>''',
        txt,
        count=1
    )

    # 更新 Footer
    comp_rep_footer = f'''<footer class="mt-16 pt-8 pb-12 border-t border-[rgba(160,109,68,0.08)] text-center text-xs text-[#7a756f]">
            <div class="flex flex-col items-center justify-center gap-2 mb-3">
                <img src="{b64_logo}" alt="Market Graphic" class="h-7 w-auto object-contain" />
                <a href="https://marketgraphic.cn" target="_blank" rel="noopener noreferrer" class="text-xs text-[#ff641e] hover:underline font-medium tracking-wide">
                    www.marketgraphic.cn
                </a>
            </div>
            <div class="mb-2 leading-relaxed">
                <p>数据来源：官方发布、商业登记信息、EPR框架合规指南、消费者舆情反馈及行业公开研报。</p>
                <p class="mt-1">报告生成声明：本报告由 <strong>Market Graphic</strong> 平台分析生成。</p>
            </div>
        </footer>'''

    txt = re.sub(
        r'<footer[\s\S]*?<\/footer>',
        comp_rep_footer,
        txt,
        count=1
    )

    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(txt)
    print(f"[OK] Refreshed Company Report: {fpath}")

# 4.2 Catagory Insight 报告
for fpath in glob.glob('report/Catagory Insight/*.html'):
    with open(fpath, 'r', encoding='utf-8') as f:
        txt = f.read()

    # 更新 Header
    txt = re.sub(
        r'<div class="powered-by-mg"[\s\S]*?<\/div>',
        f'''<div class="powered-by-mg" style="position: absolute; top: 1.5rem; right: 1.5rem; display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: var(--text-muted); z-index: 10;">
                <span style="font-size: 12px; color: #7a756f; font-weight: 500;">Powered by</span>
                <img src="{b64_logo}" alt="Market Graphic" style="height: 24px; width: auto; object-fit: contain; vertical-align: middle;" />
            </div>''',
        txt,
        count=1
    )

    # 提取 sources
    sources_match = re.search(r'(<div[^>]*sources[^>]*>[\s\S]*?<\/div>|<ol[^>]*>[\s\S]*?<\/ol>)', txt)
    sources_block = sources_match.group(0) if sources_match else ''

    cat_rep_footer = f'''<footer class="footer" style="margin-top: 3rem; padding-top: 2rem; padding-bottom: 2.5rem; border-top: 1px solid rgba(160, 109, 68, 0.08); text-align: center;">
            {sources_block}
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; margin-bottom: 0.75rem; margin-top: 1.5rem;">
                <img src="{b64_logo}" alt="Market Graphic" style="height: 28px; width: auto; object-fit: contain; vertical-align: middle;" />
                <a href="https://marketgraphic.cn" target="_blank" rel="noopener noreferrer" style="color: #ff641e; text-decoration: none; font-size: 12px; font-weight: 500; letter-spacing: 0.03em;">
                    www.marketgraphic.cn
                </a>
            </div>
            <div style="color: var(--text-muted); font-size: 0.8rem;">
                本报告由 <strong style="color: #ff641e;">Market Graphic</strong> 平台智能分析生成 &copy; 2026 Market Graphic. 保留所有权利。
            </div>
        </footer>'''

    txt = re.sub(
        r'<footer[\s\S]*?<\/footer>',
        cat_rep_footer,
        txt,
        count=1
    )

    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(txt)
    print(f"[OK] Refreshed Catagory Report: {fpath}")
