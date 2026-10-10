import { describe, it, expect } from 'vitest';
import { generateWatermarkBase64 } from '../components/WatermarkContainer';
import { localizeReportHtml } from '../lib/localize-report-assets';

describe('Frontend Watermark Logic Test', () => {
  it('should generate transparent canvas base64 watermark pattern', () => {
    // 验证水印渲染算法
    const base64 = generateWatermarkBase64('13800000000', '2026-06-06');
    expect(base64).toContain('data:image/png;base64');
  });
});

describe('Report HTML Asset Localization & Acceleration', () => {
  it('should remove render-blocking Google Fonts links and preconnect tags', () => {
    const rawHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;600;700;800&display=swap" rel="stylesheet">
      </head>
      <body><h1>Report</h1></body>
      </html>
    `;
    const localized = localizeReportHtml(rawHtml);
    expect(localized).not.toContain('fonts.googleapis.com');
    expect(localized).not.toContain('fonts.gstatic.com');
  });

  it('should replace external CDN scripts with local vendor URLs', () => {
    const rawHtml = `
      <html>
      <head>
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>
        <script src="https://unpkg.com/lucide@0.294.0/dist/umd/lucide.min.js"></script>
      </head>
      <body><div>Content</div></body>
      </html>
    `;
    const localized = localizeReportHtml(rawHtml);
    expect(localized).toContain('/vendor/tailwind.min.js');
    expect(localized).toContain('/vendor/echarts.min.js');
    expect(localized).toContain('/vendor/lucide.min.js');
    expect(localized).not.toContain('https://cdn.tailwindcss.com');
    expect(localized).not.toContain('https://cdn.jsdelivr.net');
    expect(localized).not.toContain('https://unpkg.com');
  });

  it('should add lazy loading attributes to images in report', () => {
    const rawHtml = `<div><img src="https://example.com/image.jpg" alt="test"></div>`;
    const localized = localizeReportHtml(rawHtml);
    expect(localized).toContain('loading="lazy"');
    expect(localized).toContain('decoding="async"');
  });

  it('should inject base target="_blank" and preview scripts', () => {
    const rawHtml = `<html><head></head><body><a href="https://example.com">Link</a></body></html>`;
    const localized = localizeReportHtml(rawHtml);
    expect(localized).toContain('<base target="_blank">');
    expect(localized).toContain('GTB_PREVIEW_IMAGE');
  });
});
