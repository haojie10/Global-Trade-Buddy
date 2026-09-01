import { describe, it, expect } from 'vitest';
import { cleanCompanyName, parseCompetitorString } from '../lib/competitor-discoverer';

describe('Competitor Discovery & Task Dispatcher Tests', () => {
  describe('cleanCompanyName', () => {
    it('should correctly strip legal entity suffixes', () => {
      expect(cleanCompanyName('TEDi GmbH & Co. KG')).toBe('TEDi');
      expect(cleanCompanyName('Action B.V.')).toBe('Action');
      expect(cleanCompanyName('BAUHAUS AG')).toBe('BAUHAUS');
      expect(cleanCompanyName('Walmart Inc.')).toBe('Walmart');
      expect(cleanCompanyName('Feron Co., Ltd.')).toBe('Feron');
    });

    it('should strip quotes and parentheses', () => {
      expect(cleanCompanyName('"Action"')).toBe('Action');
      expect(cleanCompanyName('“TEDi”')).toBe('TEDi');
      expect(cleanCompanyName('(Edeka)')).toBe('Edeka');
    });

    it('should filter out noise and placeholder words', () => {
      expect(cleanCompanyName('未知')).toBe('');
      expect(cleanCompanyName('none')).toBe('');
      expect(cleanCompanyName('中国供应商')).toBe('');
      expect(cleanCompanyName('产业集群')).toBe('');
    });
  });

  describe('parseCompetitorString', () => {
    it('should parse simple comma-separated competitors', () => {
      const raw = 'BM, TEDi, Europris, Normal, Flying Tiger Copenhagen, GiFi';
      const parsed = parseCompetitorString(raw, '欧洲');
      expect(parsed).toHaveLength(6);
      expect(parsed[0]).toEqual({ name: 'BM', country: '欧洲' });
      expect(parsed[1]).toEqual({ name: 'TEDi', country: '欧洲' });
      expect(parsed[3]).toEqual({ name: 'Normal', country: '欧洲' });
    });

    it('should parse enhanced detail format with country and website', () => {
      const raw = 'TEDi|德国|https://tedi.com, Europris|挪威|https://europris.no, Normal';
      const parsed = parseCompetitorString(raw, '全球');
      expect(parsed).toHaveLength(3);
      expect(parsed[0]).toEqual({
        name: 'TEDi',
        country: '德国',
        website: 'https://tedi.com'
      });
      expect(parsed[1]).toEqual({
        name: 'Europris',
        country: '挪威',
        website: 'https://europris.no'
      });
      expect(parsed[2]).toEqual({
        name: 'Normal',
        country: '全球'
      });
    });

    it('should handle empty or invalid input safely', () => {
      expect(parseCompetitorString('')).toEqual([]);
      expect(parseCompetitorString('   ')).toEqual([]);
      expect(parseCompetitorString('未知, 无, none')).toEqual([]);
    });
  });
});
