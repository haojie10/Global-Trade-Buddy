from PIL import Image, ImageEnhance

# 1. 打开并裁剪 logo 的真实内容边界
img = Image.open('public/images/mg_logo.png').convert('RGBA')
bbox = img.getbbox()
cropped = img.crop(bbox)

# 2. 生成完全填满画幅、零留白的正方形图标 (满格放大)
def create_maximized_square_icon(cropped_img, size):
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    
    # 满幅无边距缩放 (100% 宽度填满画布)
    scale = size / cropped_img.width
    new_w = size
    new_h = max(1, int(round(cropped_img.height * scale)))
    
    # 如果高度超出画布（不太可能），按高度缩放
    if new_h > size:
        scale = size / cropped_img.height
        new_h = size
        new_w = max(1, int(round(cropped_img.width * scale)))
    
    resized = cropped_img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    
    paste_x = (size - new_w) // 2
    paste_y = (size - new_h) // 2
    
    canvas.paste(resized, (paste_x, paste_y), resized)
    return canvas

# 生成全部尺寸 (满幅 100% 充满)
icon_16 = create_maximized_square_icon(cropped, 16)
icon_32 = create_maximized_square_icon(cropped, 32)
icon_48 = create_maximized_square_icon(cropped, 48)
icon_64 = create_maximized_square_icon(cropped, 64)
icon_128 = create_maximized_square_icon(cropped, 128)
icon_180 = create_maximized_square_icon(cropped, 180)
icon_192 = create_maximized_square_icon(cropped, 192)
icon_256 = create_maximized_square_icon(cropped, 256)
icon_512 = create_maximized_square_icon(cropped, 512)

# 保存 PNG
icon_16.save('public/favicon-16x16.png', 'PNG', optimize=True)
icon_32.save('public/favicon-32x32.png', 'PNG', optimize=True)
icon_180.save('public/apple-touch-icon.png', 'PNG', optimize=True)
icon_192.save('public/android-chrome-192x192.png', 'PNG', optimize=True)
icon_512.save('public/android-chrome-512x512.png', 'PNG', optimize=True)
icon_32.save('public/favicon.png', 'PNG', optimize=True)

# 保存复合 ICO 文件 (16, 32, 48, 64, 128, 256)
icon_256.save('public/favicon.ico', format='ICO', sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])

print("[OK] Maximized full-bleed favicon suite generated successfully!")
