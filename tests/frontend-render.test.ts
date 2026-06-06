import { describe, it, expect } from 'vitest';
import { generateWatermarkBase64 } from '../components/WatermarkContainer';

describe('Frontend Watermark Logic Test', () => {
  it('should generate transparent canvas base64 watermark pattern', () => {
    // 验证水印渲染算法
    const base64 = generateWatermarkBase64('13800000000', '2026-06-06');
    expect(base64).toContain('data:image/png;base64');
  });
});
