#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import glob
import sys

# 导入 company-insight-pro 技能的 publish_report 模块
sys.path.append(r"C:\Users\066\.gemini\config\skills\company-insight-pro\scripts")
from publish_report import publish_report_file

def batch_upload():
    report_dir = r"D:\我的APP\客户档案\西欧\英国"
    html_files = sorted(glob.glob(os.path.join(report_dir, "*.html")))
    
    total = len(html_files)
    print(f"=== Found {total} HTML reports in '{report_dir}' ===")
    
    success_list = []
    failed_list = []
    
    target_url = "http://124.222.201.143:3000"
    
    for idx, fpath in enumerate(html_files, 1):
        fname = os.path.basename(fpath)
        print(f"\n[{idx}/{total}] Uploading: {fname} ...")
        
        try:
            ok = publish_report_file(fpath, target_url=target_url)
            if ok:
                success_list.append(fname)
            else:
                failed_list.append((fname, "Upload failed"))
        except Exception as e:
            print(f"[ERR] Exception: {e}")
            failed_list.append((fname, str(e)))
            
    print("\n" + "="*50)
    print(f"=== BATCH UPLOAD SUMMARY ===")
    print(f"Total: {total}, Success: {len(success_list)}, Failed: {len(failed_list)}")
    print("="*50)
    if success_list:
        print("\n[SUCCESS REPORTS]:")
        for s in success_list:
            print(f"  ✓ {s}")
    if failed_list:
        print("\n[FAILED REPORTS]:")
        for f, err in failed_list:
            print(f"  ✗ {f} -> {err}")

if __name__ == '__main__':
    batch_upload()
