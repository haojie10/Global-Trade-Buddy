import React, { useEffect, useState } from 'react';

// 生成水印背景图的 Base64 算法 (兼顾 Node 测试环境与浏览器环境)
export function generateWatermarkBase64(text: string, date: string): string {
  // 如果在 Node 环境 (Vitest 测试)，直接返回 Mock Base64，防 DOM 缺失报错
  if (typeof window === 'undefined') {
    return 'data:image/png;base64,mock_watermark_data';
  }

  const canvas = document.createElement('canvas');
  canvas.width = 300;
  canvas.height = 200;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // 清除画布
  ctx.clearRect(0, 0, 300, 200);
  
  // 设置透明度和斜度
  ctx.globalAlpha = 0.015; // 浅色明亮背景下调低透明度，以不干扰阅读
  ctx.font = '12px system-ui';
  ctx.fillStyle = '#0f172a'; // 深灰色字，适配浅色白底背景
  
  // 旋转
  ctx.translate(150, 100);
  ctx.rotate((-30 * Math.PI) / 180);
  ctx.textAlign = 'center';
  
  // 绘制多行水印
  ctx.fillText(text, 0, -10);
  ctx.fillText(date, 0, 10);
  
  return canvas.toDataURL('image/png');
}

interface WatermarkProps {
  text: string;
  children: React.ReactNode;
}

export default function WatermarkContainer({ text, children }: WatermarkProps) {
  const [bgUrl, setBgUrl] = useState('');

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const base64 = generateWatermarkBase64(text, today);
    setBgUrl(base64);
  }, [text]);

  return (
    <div style={{ position: 'relative', minHeight: '100%' }}>
      {bgUrl && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none', // 保证水印层不能阻挡鼠标点击，业务员仍能正常选中文字
            zIndex: 9999, // 浮于最顶层防截图
            backgroundImage: `url(${bgUrl})`,
            backgroundRepeat: 'repeat',
          }}
        />
      )}
      {children}
    </div>
  );
}
