import { describe, it, expect } from 'vitest';
import { getExchangeRates } from '../pages/api/tools/currency';
import { processImageBeautify } from '../pages/api/tools/image-beautify';

describe('Trade Tools API Test', () => {
  it('should fetch exchange rates successfully', async () => {
    const rates = await getExchangeRates();
    expect(rates.USD).toBeDefined();
    expect(rates.EUR).toBeDefined();
    expect(rates.USD).toBeGreaterThan(5); // 人民币汇率基线合理值
  });

  it('should process image beautification and return studio cdn URL', async () => {
    const rawImageBuffer = Buffer.from('mock_image_data');
    const result = await processImageBeautify(rawImageBuffer, 'image/png');
    expect(result.success).toBe(true);
    expect(result.url).toContain('https://cdn.globaltradebuddy.com/studio/');
  });
});
