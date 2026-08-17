from PIL import Image, ImageOps

# 1. 打开并裁剪 logo 的真实内容边界
img = Image.open('public/images/mg_logo.png').convert('RGBA')
bbox = img.getbbox()
cropped = img.crop(bbox)

# 2. 生成适合不同尺寸的正方形图标 (居中适配)
def create_square_icon(cropped_img, size, padding_ratio=0.1, bg_color=(0, 0, 0, 0)):
    canvas = Image.new('RGBA', (size, size), bg_color)
    max_w = int(size * (1 - padding_ratio * 2))
    max_h = int(size * (1 - padding_ratio * 2))
    
    # 保持宽高比缩放
    w_ratio = max_w / cropped_img.width
    h_ratio = max_h / cropped_img.height
    scale = min(w_ratio, h_ratio)
    
    new_w = max(1, int(cropped_img.width * scale))
    new_h = max(1, int(cropped_img.height * scale))
    
    resized = cropped_img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    
    paste_x = (size - new_w) // 2
    paste_y = (size - new_h) // 2
    
    canvas.paste(resized, (paste_x, paste_y), resized)
    return canvas

# 生成不同尺寸
icon_16 = create_square_icon(cropped, 16, padding_ratio=0.05)
icon_32 = create_square_icon(cropped, 32, padding_ratio=0.08)
icon_48 = create_square_icon(cropped, 48, padding_ratio=0.1)
icon_180 = create_square_icon(cropped, 180, padding_ratio=0.12)
icon_192 = create_square_icon(cropped, 192, padding_ratio=0.12)
icon_512 = create_square_icon(cropped, 512, padding_ratio=0.12)

# 保存 PNG
icon_16.save('public/favicon-16x16.png', 'PNG')
icon_32.save('public/favicon-32x32.png', 'PNG')
icon_180.save('public/apple-touch-icon.png', 'PNG')
icon_192.save('public/android-chrome-192x192.png', 'PNG')
icon_512.save('public/android-chrome-512x512.png', 'PNG')
icon_32.save('public/favicon.png', 'PNG')

# 保存多尺寸复合 ICO 文件
icon_512.save('public/favicon.ico', format='ICO', sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])

print("[OK] Favicon suite generated successfully in public/ directory:")
print(" - public/favicon.ico")
print(" - public/favicon.png")
print(" - public/favicon-16x16.png")
print(" - public/favicon-32x32.png")
print(" - public/apple-touch-icon.png")
print(" - public/android-chrome-192x192.png")
print(" - public/android-chrome-512x512.png")
