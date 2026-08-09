import { describe, it, expect } from 'vitest';
import { filterReports, PlatformReport } from '../components/ReportList';

describe('Report Filter Helper Logic', () => {
  const mockReports: PlatformReport[] = [
    { id: '1', title: '美国汽配报告', category: 'customer', market_region: '北美', summary: 'A公司采购详情', industries: '汽车配件, 五金', isUnlocked: true },
    { id: '2', title: '德国刹车片行业分析', category: 'product', market_region: '欧盟', summary: '德国工业分析', industries: '汽车配件', isUnlocked: false },
    { id: '3', title: '全球大豆市场', category: 'product', market_region: '全球', summary: '全球大豆分析', industries: '食品', isUnlocked: true }
  ];

  it('should filter by search query on title or summary', () => {
    const result = filterReports(mockReports, '汽配', 'All', 'All', 'All');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('should filter by category', () => {
    const result = filterReports(mockReports, '', 'customer', 'All', 'All');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('should filter by region including "全球"', () => {
    const result = filterReports(mockReports, '', 'All', '北美', 'All');
    // 应该匹配 1 (北美) 和 3 (全球)
    expect(result.map(r => r.id)).toEqual(expect.arrayContaining(['1', '3']));
  });

  it('should filter by industry', () => {
    const resultAuto = filterReports(mockReports, '', 'All', 'All', '汽车配件');
    expect(resultAuto.map(r => r.id)).toEqual(['1', '2']);

    const resultFood = filterReports(mockReports, '', 'All', 'All', '食品');
    expect(resultFood.map(r => r.id)).toEqual(['3']);

    const resultNone = filterReports(mockReports, '', 'All', 'All', '家用电器');
    expect(resultNone).toHaveLength(0);
  });

  it('should combine multiple filters simultaneously', () => {
    const result = filterReports(mockReports, '德国', 'product', '欧盟', '汽车配件');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });
});
