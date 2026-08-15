import os, glob, re

# ============================================================
# 1. 更新 Company Insight 模版
# ============================================================
comp_tpl_path = '.antigravity/skills/company-insight-pro/assets/report-template.html'
with open(comp_tpl_path, 'r', encoding='utf-8') as f:
    comp_html = f.read()

comp_footer = '''<!-- ====== Footer ====== -->
        <footer class="mt-16 pt-8 pb-12 border-t border-[rgba(160,109,68,0.08)] text-center text-xs text-[#7a756f]">
            <div class="mb-3 leading-relaxed">
                <p>数据来源：官方发布、商业登记信息、EPR框架合规指南、消费者舆情反馈及行业公开研报。</p>
                <p class="mt-1">报告生成声明：本报告由 <strong>Market Graphic</strong> 平台分析生成。</p>
            </div>
            <div class="mt-4">
                <a href="https://marketgraphic.cn" target="_blank" rel="noopener noreferrer" class="text-xs text-[#ff641e] hover:underline font-medium tracking-wide">
                    www.marketgraphic.cn
                </a>
            </div>
        </footer>'''

comp_html = re.sub(r'<!-- ====== Footer ====== -->\s*<footer[\s\S]*?<\/footer>', comp_footer, comp_html, count=1)
with open(comp_tpl_path, 'w', encoding='utf-8') as f:
    f.write(comp_html)
print("[OK] Updated company-insight-pro template footer")

# ============================================================
# 2. 更新 Category Insight 模版
# ============================================================
cat_tpl_path = '.antigravity/skills/category-insight/assets/report-template.html'
with open(cat_tpl_path, 'r', encoding='utf-8') as f:
    cat_html = f.read()

cat_footer = '''<!-- 页脚 -->
        <footer class="footer" style="margin-top: 3rem; padding-top: 2rem; padding-bottom: 2.5rem; border-top: 1px solid rgba(160, 109, 68, 0.08); text-align: center;">
            <div style="margin-bottom: 1.5rem; font-size: 0.8rem; line-height: 1.6; text-align: left; max-width: 800px; margin-left: auto; margin-right: auto; padding: 1.2rem; background: rgba(160, 109, 68, 0.03); border: 1px solid rgba(160, 109, 68, 0.08); border-radius: 12px; color: var(--text-secondary);">
                <strong style="color: var(--text-primary); display: block; margin-bottom: 0.5rem;">数据与信息来源：</strong>
                <ol style="margin-left: 1.2rem; padding-left: 0; color: var(--text-secondary);">
                    <!-- SOURCES_LIST -->
                </ol>
            </div>
            <div style="color: var(--text-muted); font-size: 0.8rem; margin-bottom: 0.75rem;">
                本报告由 <strong style="color: #ff641e;">Market Graphic</strong> 平台智能分析生成 &copy; 2026 Market Graphic. 保留所有权利。
            </div>
            <div>
                <a href="https://marketgraphic.cn" target="_blank" rel="noopener noreferrer" style="color: #ff641e; text-decoration: none; font-size: 12px; font-weight: 500; letter-spacing: 0.03em;">
                    www.marketgraphic.cn
                </a>
            </div>
        </footer>'''

cat_html = re.sub(r'<!-- 页脚 -->\s*<footer[\s\S]*?<\/footer>', cat_footer, cat_html, count=1)
with open(cat_tpl_path, 'w', encoding='utf-8') as f:
    f.write(cat_html)
print("[OK] Updated category-insight template footer")

# ============================================================
# 3. 复制同步 report-customer 和 report-category 模版
# ============================================================
with open('.antigravity/skills/report-customer/assets/report-template.html', 'w', encoding='utf-8') as f:
    f.write(comp_html)
with open('.antigravity/skills/report-category/assets/report-template.html', 'w', encoding='utf-8') as f:
    f.write(cat_html)
print("[OK] Synced report-customer & report-category template footers")

# ============================================================
# 4. 全量更新 report/ 下的所有 5 份交付报告
# ============================================================
# 4.1 Company Insight 报告
for fpath in glob.glob('report/Company Insight/*.html'):
    with open(fpath, 'r', encoding='utf-8') as f:
        txt = f.read()

    comp_rep_footer = '''<footer class="mt-16 pt-8 pb-12 border-t border-[rgba(160,109,68,0.08)] text-center text-xs text-[#7a756f]">
            <div class="mb-3 leading-relaxed">
                <p>数据来源：官方发布、商业登记信息、EPR框架合规指南、消费者舆情反馈及行业公开研报。</p>
                <p class="mt-1">报告生成声明：本报告由 <strong>Market Graphic</strong> 平台分析生成。</p>
            </div>
            <div class="mt-4">
                <a href="https://marketgraphic.cn" target="_blank" rel="noopener noreferrer" class="text-xs text-[#ff641e] hover:underline font-medium tracking-wide">
                    www.marketgraphic.cn
                </a>
            </div>
        </footer>'''

    txt = re.sub(r'<footer[\s\S]*?<\/footer>', comp_rep_footer, txt, count=1)

    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(txt)
    print(f"[OK] Refreshed Company Report Footer: {fpath}")

# 4.2 Catagory Insight 报告
for fpath in glob.glob('report/Catagory Insight/*.html'):
    with open(fpath, 'r', encoding='utf-8') as f:
        txt = f.read()

    sources_match = re.search(r'(<div[^>]*sources[^>]*>[\s\S]*?<\/div>|<ol[^>]*>[\s\S]*?<\/ol>)', txt)
    sources_block = sources_match.group(0) if sources_match else ''

    cat_rep_footer = f'''<footer class="footer" style="margin-top: 3rem; padding-top: 2rem; padding-bottom: 2.5rem; border-top: 1px solid rgba(160, 109, 68, 0.08); text-align: center;">
            {sources_block}
            <div style="color: var(--text-muted); font-size: 0.8rem; margin-bottom: 0.75rem; margin-top: 1.5rem;">
                本报告由 <strong style="color: #ff641e;">Market Graphic</strong> 平台智能分析生成 &copy; 2026 Market Graphic. 保留所有权利。
            </div>
            <div>
                <a href="https://marketgraphic.cn" target="_blank" rel="noopener noreferrer" style="color: #ff641e; text-decoration: none; font-size: 12px; font-weight: 500; letter-spacing: 0.03em;">
                    www.marketgraphic.cn
                </a>
            </div>
        </footer>'''

    txt = re.sub(r'<footer[\s\S]*?<\/footer>', cat_rep_footer, txt, count=1)

    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(txt)
    print(f"[OK] Refreshed Catagory Report Footer: {fpath}")
