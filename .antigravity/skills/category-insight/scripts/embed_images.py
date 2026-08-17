#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
图片 Base64 嵌入与临时文件清理脚本
功能：
1. 读取指定的 HTML 文件。
2. 匹配其中相对路径的本地图片（如 concept_xxx.png）。
3. 将图片转化为 Base64 编码直接嵌入 HTML 的 img 标签中，实现单文件自包含。
4. 成功嵌入后，自动删除本地的原图片文件，保持工作目录整洁。
"""

import os
import re
import sys
import base64
import argparse

def get_image_base64_data_url(image_path):
    """读取图片文件并返回 Base64 格式的 Data URL"""
    if not os.path.exists(image_path):
        print(f"[WARN] Image file not found: {image_path}")
        return None
        
    _, ext = os.path.splitext(image_path.lower())
    mime_type = "image/png"
    if ext in [".jpg", ".jpeg"]:
        mime_type = "image/jpeg"
    elif ext == ".gif":
        mime_type = "image/gif"
    elif ext == ".webp":
        mime_type = "image/webp"
    elif ext == ".svg":
        mime_type = "image/svg+xml"

    try:
        with open(image_path, "rb") as image_file:
            encoded_string = base64.b64encode(image_file.read()).decode("utf-8")
            return f"data:{mime_type};base64,{encoded_string}"
    except Exception as e:
        print(f"[WARN] Failed to read image {image_path}: {e}")
        return None

def embed_images_in_html(html_path):
    """扫描 HTML 并嵌入本地图片，然后删除本地图片"""
    if not os.path.exists(html_path):
        print(f"[ERROR] HTML file not found: {html_path}")
        sys.exit(1)

    html_dir = os.path.dirname(os.path.abspath(html_path))
    
    with open(html_path, "r", encoding="utf-8") as file:
        html_content = file.read()

    # 正则表达式寻找 <img ... src="xxx" ...> 标签中的 src
    # 支持双引号和单引号
    img_pattern = re.compile(r'(<img\s+[^>]*src=["\'])([^"\']+\.(?:png|jpg|jpeg|gif|webp|svg))(["\'][^>]*>)', re.IGNORECASE)
    
    matches = img_pattern.findall(html_content)
    if not matches:
        print("[INFO] No local image references found in HTML.")
        return

    print(f"[INFO] Found {len(matches)} local image references. Processing...")
    
    embedded_count = 0
    images_to_delete = []

    # 替换匹配的图片
    def replace_image(match):
        nonlocal embedded_count
        prefix = match.group(1)
        src_path = match.group(2)
        suffix = match.group(3)
        
        # 排除网络链接和已是 Base64 的链接
        if src_path.startswith("http://") or src_path.startswith("https://") or src_path.startswith("data:"):
            return match.group(0)
            
        # 拼出图片绝对路径
        abs_image_path = os.path.join(html_dir, src_path)
        if os.path.exists(abs_image_path):
            base64_data = get_image_base64_data_url(abs_image_path)
            if base64_data:
                embedded_count += 1
                images_to_delete.append(abs_image_path)
                print(f"[OK] Image embedded as Base64: {src_path}")
                return f"{prefix}{base64_data}{suffix}"
        else:
            print(f"[WARN] Local image path does not exist: {abs_image_path}")
            
        return match.group(0)

    # 执行正则替换
    new_html_content = img_pattern.sub(replace_image, html_content)

    # 写回 HTML 文件
    if embedded_count > 0:
        with open(html_path, "w", encoding="utf-8") as file:
            file.write(new_html_content)
        print(f"[OK] Image embedding complete! Embedded {embedded_count} images.")
        
        # 清理原图片文件
        print("[INFO] Cleaning up temporary image files...")
        deleted_count = 0
        for img_path in set(images_to_delete):
            try:
                if os.path.exists(img_path):
                    os.remove(img_path)
                    print(f"[OK] Deleted temp image: {os.path.basename(img_path)}")
                    deleted_count += 1
            except Exception as e:
                print(f"[WARN] Failed to delete file {img_path}: {e}")
        print(f"[OK] Cleanup done. Deleted {deleted_count} temp image files.")
    else:
        print("[INFO] No images were embedded, no changes made.")

def main():
    parser = argparse.ArgumentParser(description="将 HTML 报告中的本地图片转为 Base64 并内嵌，完成后清理原图片文件。")
    parser.add_argument("html_file", help="目标 HTML 报告文件路径")
    args = parser.parse_args()
    
    embed_images_in_html(args.html_file)

if __name__ == "__main__":
    main()
