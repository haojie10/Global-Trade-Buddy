import re, os

# 1. 读取 Base64 logo
with open('scratch/banner_base64.txt', 'r', encoding='utf-8') as f:
    b64_logo = f.read().strip()

# ============================================================
# 2. 更新 company-insight-pro/assets/report-template.html
# ============================================================
comp_tpl_path = '.antigravity/skills/company-insight-pro/assets/report-template.html'
with open(comp_tpl_path, 'r', encoding='utf-8') as f:
    comp_html = f.read()

# 替换 Header 右上角
old_header_chunk = '''                <div class="flex items-center gap-4">
                    <div class="flex items-center gap-3">
                        <div class="flex flex-col items-end gap-0.5">
                            <span class="text-xs text-[#7a756f] font-medium">Powered by</span>
                            <span class="text-sm font-semibold text-[#ff641e] tracking-tight">Market Graphic</span>
                        </div>
                    </div>
                </div>'''

new_header_chunk = f'''                <div class="flex items-center gap-4">
                    <div class="flex items-center gap-2.5">
                        <div class="flex flex-col items-end gap-0.5">
                            <span class="text-[11px] text-[#7a756f] font-medium tracking-tight">Powered by</span>
                            <span class="text-sm font-bold text-[#ff641e] tracking-tight">Market Graphic</span>
                        </div>
                        <img src="{b64_logo}" alt="Market Graphic Logo" class="h-7 w-auto object-contain" />
                    </div>
                </div>'''

if old_header_chunk in comp_html:
    comp_html = comp_html.replace(old_header_chunk, new_header_chunk)
else:
    print("[WARN] company-insight-pro header chunk not matched exactly, using regex")
    comp_html = re.sub(
        r'<div class="flex items-center gap-4">[\s\S]*?Market Graphic<\/span>[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>',
        new_header_chunk,
        comp_html,
        count=1
    )

# 替换 Footer
old_footer_chunk = '''        <!-- ====== Footer ====== -->
        <footer class="mt-16 pt-8 border-t border-[rgba(160,109,68,0.08)] text-center text-xs text-[#7a756f]">
            <div class="mb-2 leading-relaxed">
                <p>数据来源：官方发布、商业登记信息、EPR框架合规指南、消费者舆情反馈及行业公开研报。</p>
                <p class="mt-1">报告生成声明：本报告由 <strong>Market Graphic</strong> 平台分析生成。</p>
            </div>
        </footer>'''

new_footer_chunk = f'''        <!-- ====== Footer ====== -->
        <footer class="mt-16 pt-8 pb-12 border-t border-[rgba(160,109,68,0.08)] text-center text-xs text-[#7a756f]">
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

comp_html = comp_html.replace(old_footer_chunk, new_footer_chunk)

with open(comp_tpl_path, 'w', encoding='utf-8') as f:
    f.write(comp_html)
print("[OK] Updated company-insight-pro/assets/report-template.html")

# ============================================================
# 3. 更新 category-insight/assets/report-template.html
# ============================================================
cat_tpl_path = '.antigravity/skills/category-insight/assets/report-template.html'
with open(cat_tpl_path, 'r', encoding='utf-8') as f:
    cat_html = f.read()

# 替换 Header 右上角
old_cat_header = '''            <div class="powered-by-mg" style="position: absolute; top: 1.5rem; right: 1.5rem; display: flex; align-items: center; gap: 6px; font-size: 0.85rem; color: var(--text-muted); z-index: 10;">
                <svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px; vertical-align: middle;"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                <span style="font-weight: 600; font-family: 'Outfit', sans-serif; letter-spacing: 0.05em; vertical-align: middle;">Market Graphic</span>
            </div>'''

new_cat_header = f'''            <div class="powered-by-mg" style="position: absolute; top: 1.5rem; right: 1.5rem; display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: var(--text-muted); z-index: 10;">
                <div style="display: flex; flex-direction: column; align-items: flex-end; line-height: 1.2;">
                    <span style="font-size: 10px; color: #7a756f; font-weight: 500;">Powered by</span>
                    <span style="font-weight: 700; font-family: 'Outfit', sans-serif; letter-spacing: 0.02em; color: #ff641e; font-size: 13px;">Market Graphic</span>
                </div>
                <img src="{b64_logo}" alt="Market Graphic Logo" style="height: 28px; width: auto; object-fit: contain; vertical-align: middle;" />
            </div>'''

cat_html = cat_html.replace(old_cat_header, new_cat_header)

# 替换 Footer
old_cat_footer = '''        <!-- 页脚 -->
        <footer class="footer" style="margin-top: 3rem; padding-top: 2rem; border-top: 1px solid rgba(160, 109, 68, 0.08); text-align: center;">
            <div style="margin-bottom: 1.5rem; font-size: 0.8rem; line-height: 1.6; text-align: left; max-width: 800px; margin-left: auto; margin-right: auto; padding: 1.2rem; background: rgba(160, 109, 68, 0.03); border: 1px solid rgba(160, 109, 68, 0.08); border-radius: 12px; color: var(--text-secondary);">
                <strong style="color: var(--text-primary); display: block; margin-bottom: 0.5rem;">数据与信息来源：</strong>
                <ol style="margin-left: 1.2rem; padding-left: 0; color: var(--text-secondary);">
                    <!-- SOURCES_LIST -->
                </ol>
            </div>
            <div style="color: var(--text-muted); font-size: 0.8rem;">
                本报告由 <strong style="color: var(--primary);">Market Graphic</strong> 生成并提供研究支持 &copy; 2026 Market Graphic. 保留所有权利。
            </div>
        </footer>'''

new_cat_footer = f'''        <!-- 页脚 -->
        <footer class="footer" style="margin-top: 3rem; padding-top: 2rem; padding-bottom: 2.5rem; border-top: 1px solid rgba(160, 109, 68, 0.08); text-align: center;">
            <div style="margin-bottom: 1.5rem; font-size: 0.8rem; line-height: 1.6; text-align: left; max-width: 800px; margin-left: auto; margin-right: auto; padding: 1.2rem; background: rgba(160, 109, 68, 0.03); border: 1px solid rgba(160, 109, 68, 0.08); border-radius: 12px; color: var(--text-secondary);">
                <strong style="color: var(--text-primary); display: block; margin-bottom: 0.5rem;">数据与信息来源：</strong>
                <ol style="margin-left: 1.2rem; padding-left: 0; color: var(--text-secondary);">
                    <!-- SOURCES_LIST -->
                </ol>
            </div>
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; margin-bottom: 0.75rem;">
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

cat_html = cat_html.replace(old_cat_footer, new_cat_footer)

with open(cat_tpl_path, 'w', encoding='utf-8') as f:
    f.write(cat_html)
print("[OK] Updated category-insight/assets/report-template.html")
