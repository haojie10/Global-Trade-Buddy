import { describe, it, expect } from 'vitest';
import { filterReports, PlatformReport } from '../components/ReportList';

describe('Report Filter Helper Logic', () => {
  const mockReports: PlatformReport[] = [
    { id: '1', title: '美国汽配报告', category: 'customer', market_region: '北美', summary: 'A公司采购详情', isUnlocked: true },
    { id: '2', title: '德国刹车片行业分析', category: 'product', market_region: '欧盟', summary: '德国工业分析', isUnlocked: false },
    { id: '3', title: '全球大豆市场', category: 'product', market_region: '全球', summary: '全球大豆分析', isUnlocked: true }
  ];

  it('should filter by search query on title or summary', () => {
    const result = filterReports(mockReports, '汽配', 'All', 'All');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('should filter by category', () => {
    const result = filterReports(mockReports, '', 'customer', 'All');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('should filter by region including "全球"', () => {
    const result = filterReports(mockReports, '', 'All', '北美');
    // 应该匹配 1 (北美) 和 3 (全球)
    expect(result.map(r => r.id)).toEqual(expect.arrayContaining(['1', '3']));
  });
});
