import os, glob, re

with open('scratch/banner_base64.txt', 'r', encoding='utf-8') as f:
    b64_logo = f.read().strip()

# ============================================================
# 1. 更新 Company Insight 模板
# ============================================================
comp_tpl_path = '.antigravity/skills/company-insight-pro/assets/report-template.html'
with open(comp_tpl_path, 'r', encoding='utf-8') as f:
    comp_html = f.read()

comp_html = re.sub(
    r'<div class="flex items-center gap-4">\s*<div class="flex items-center gap-2">[\s\S]*?<\/div>\s*<\/div>',
    f'''<div class="flex items-center gap-4">
                    <div class="flex items-center gap-2.5">
                        <span class="text-xs text-[#7a756f] font-medium tracking-tight">Powered by</span>
                        <img src="{b64_logo}" alt="Market Graphic" class="h-9 w-auto object-contain" />
                    </div>
                </div>''',
    comp_html,
    count=1
)
with open(comp_tpl_path, 'w', encoding='utf-8') as f:
    f.write(comp_html)
print("[OK] Enlarged company-insight-pro template logo to h-9 (36px)")

# ============================================================
# 2. 更新 Category Insight 模板
# ============================================================
cat_tpl_path = '.antigravity/skills/category-insight/assets/report-template.html'
with open(cat_tpl_path, 'r', encoding='utf-8') as f:
    cat_html = f.read()

cat_html = re.sub(
    r'<div class="powered-by-mg"[\s\S]*?<\/div>',
    f'''<div class="powered-by-mg" style="position: absolute; top: 1.5rem; right: 1.5rem; display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: var(--text-muted); z-index: 10;">
                <span style="font-size: 12px; color: #7a756f; font-weight: 500;">Powered by</span>
                <img src="{b64_logo}" alt="Market Graphic" style="height: 36px; width: auto; object-fit: contain; vertical-align: middle;" />
            </div>''',
    cat_html,
    count=1
)
with open(cat_tpl_path, 'w', encoding='utf-8') as f:
    f.write(cat_html)
print("[OK] Enlarged category-insight template logo to 36px")

# ============================================================
# 3. 复制同步 report-customer 和 report-category 模板
# ============================================================
with open('.antigravity/skills/report-customer/assets/report-template.html', 'w', encoding='utf-8') as f:
    f.write(comp_html)
with open('.antigravity/skills/report-category/assets/report-template.html', 'w', encoding='utf-8') as f:
    f.write(cat_html)

# ============================================================
# 4. 全量更新 5 份交付报告
# ============================================================
for fpath in glob.glob('report/Company Insight/*.html'):
    with open(fpath, 'r', encoding='utf-8') as f:
        txt = f.read()
    txt = re.sub(
        r'<div class="flex items-center gap-4">\s*<div class="flex items-center gap-2">[\s\S]*?<\/div>\s*<\/div>',
        f'''<div class="flex items-center gap-4">
                    <div class="flex items-center gap-2.5">
                        <span class="text-xs text-[#7a756f] font-medium tracking-tight">Powered by</span>
                        <img src="{b64_logo}" alt="Market Graphic" class="h-9 w-auto object-contain" />
                    </div>
                </div>''',
        txt,
        count=1
    )
    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(txt)
    print(f"[OK] Enlarged logo in Company Report: {fpath}")

for fpath in glob.glob('report/Catagory Insight/*.html'):
    with open(fpath, 'r', encoding='utf-8') as f:
        txt = f.read()
    txt = re.sub(
        r'<div class="powered-by-mg"[\s\S]*?<\/div>',
        f'''<div class="powered-by-mg" style="position: absolute; top: 1.5rem; right: 1.5rem; display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: var(--text-muted); z-index: 10;">
                <span style="font-size: 12px; color: #7a756f; font-weight: 500;">Powered by</span>
                <img src="{b64_logo}" alt="Market Graphic" style="height: 36px; width: auto; object-fit: contain; vertical-align: middle;" />
            </div>''',
        txt,
        count=1
    )
    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(txt)
    print(f"[OK] Enlarged logo in Catagory Report: {fpath}")
