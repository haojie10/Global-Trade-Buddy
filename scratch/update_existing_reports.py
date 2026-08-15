import re

with open('scratch/banner_base64.txt', 'r', encoding='utf-8') as f:
    b64_logo = f.read().strip()

# 1. Update rice cooker report
cat_file = 'report/Catagory Insight/rice-cooker-mexico-liverpool-insight.html'
try:
    with open(cat_file, 'r', encoding='utf-8') as f:
        html = f.read()

    # Update header
    html = re.sub(
        r'<div class="powered-by-mg"[\s\S]*?Market Graphic[\s\S]*?<\/div>',
        f'''<div class="powered-by-mg" style="position: absolute; top: 1.5rem; right: 1.5rem; display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: var(--text-muted); z-index: 10;">
                <div style="display: flex; flex-direction: column; align-items: flex-end; line-height: 1.2;">
                    <span style="font-size: 10px; color: #7a756f; font-weight: 500;">Powered by</span>
                    <span style="font-weight: 700; font-family: 'Outfit', sans-serif; letter-spacing: 0.02em; color: #ff641e; font-size: 13px;">Market Graphic</span>
                </div>
                <img src="{b64_logo}" alt="Market Graphic Logo" style="height: 28px; width: auto; object-fit: contain; vertical-align: middle;" />
            </div>''',
        html,
        count=1
    )

    # Update footer
    html = re.sub(
        r'<footer class="footer"[\s\S]*?<\/footer>',
        f'''<footer class="footer" style="margin-top: 3rem; padding-top: 2rem; padding-bottom: 2.5rem; border-top: 1px solid rgba(160, 109, 68, 0.08); text-align: center;">
            <div style="margin-bottom: 1.5rem; font-size: 0.8rem; line-height: 1.6; text-align: left; max-width: 800px; margin-left: auto; margin-right: auto; padding: 1.2rem; background: rgba(160, 109, 68, 0.03); border: 1px solid rgba(160, 109, 68, 0.08); border-radius: 12px; color: var(--text-secondary);">
                <strong style="color: var(--text-primary); display: block; margin-bottom: 0.5rem;">数据与信息来源：</strong>
                <ol style="margin-left: 1.2rem; padding-left: 0; color: var(--text-secondary);">
                    <li>Liverpool 墨西哥官方在售电饭锅 SKU 及价格数据。</li>
                    <li>PROFECO (墨西哥联邦消费者检察署) 家用电器能效与安全指南 (NOM-003-SCFI)。</li>
                    <li>墨西哥本土烹饪痛点分析报告 (Arroz Rojo 传统焖煮痛点调研)。</li>
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
        </footer>''',
        html,
        count=1
    )

    with open(cat_file, 'w', encoding='utf-8') as f:
        f.write(html)
    print("[OK] Updated local Category report:", cat_file)
except Exception as e:
    print("[WARN] Error updating cat report:", e)

# 2. Update company report
comp_file = 'report/Company Insight/liverpool-company-insight-report.html'
try:
    with open(comp_file, 'r', encoding='utf-8') as f:
        html = f.read()

    # Update header
    html = re.sub(
        r'<div class="flex items-center gap-4">[\s\S]*?Market Graphic<\/span>[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>',
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

    # Update footer
    html = re.sub(
        r'<footer class="mt-16 pt-8[\s\S]*?<\/footer>',
        f'''<footer class="mt-16 pt-8 pb-12 border-t border-[rgba(160,109,68,0.08)] text-center text-xs text-[#7a756f]">
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
        </footer>''',
        html,
        count=1
    )

    with open(comp_file, 'w', encoding='utf-8') as f:
        f.write(html)
    print("[OK] Updated local Company report:", comp_file)
except Exception as e:
    print("[WARN] Error updating comp report:", e)
