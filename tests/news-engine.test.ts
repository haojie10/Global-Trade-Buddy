import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
const { isWithinDays, deduplicateByTitle } = require('../.antigravity/skills/report-news/scripts/fetch-news.js');

describe('GTB 54-Category News Engine Tests', () => {
  it('should correctly validate standard-categories.json has all 54 categories', () => {
    const jsonPath = path.resolve(__dirname, '../.antigravity/skills/report-news/references/standard-categories.json');
    expect(fs.existsSync(jsonPath)).toBe(true);

    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    expect(data.clusters).toBeDefined();
    expect(Array.isArray(data.clusters)).toBe(true);

    const allCatNames = data.clusters.flatMap((c: any) => c.categories.map((cat: any) => cat.name));
    expect(allCatNames.length).toBe(54);
    expect(allCatNames).toContain('五金');
    expect(allCatNames).toContain('工具');
    expect(allCatNames).toContain('汽车配件');
    expect(allCatNames).toContain('宠物用品');
  });

  describe('isWithinDays date verification algorithm', () => {
    it('should accept recent relative dates', () => {
      expect(isWithinDays('just now', 7)).toBe(true);
      expect(isWithinDays('today', 7)).toBe(true);
      expect(isWithinDays('3 hours ago', 7)).toBe(true);
      expect(isWithinDays('yesterday', 7)).toBe(true);
      expect(isWithinDays('4 days ago', 7)).toBe(true);
      expect(isWithinDays('1 week ago', 7)).toBe(true);
    });

    it('should reject dates older than 7 days', () => {
      expect(isWithinDays('8 days ago', 7)).toBe(false);
      expect(isWithinDays('2 weeks ago', 7)).toBe(false);
      expect(isWithinDays('3 months ago', 7)).toBe(false);
      expect(isWithinDays('1 year ago', 7)).toBe(false);
      expect(isWithinDays(undefined, 7)).toBe(false);
      expect(isWithinDays('', 7)).toBe(false);
    });

    it('should accept valid recent absolute dates and reject old absolute dates', () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const twoMonthsAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
      expect(isWithinDays(yesterday, 7)).toBe(true);
      expect(isWithinDays(twoMonthsAgo, 7)).toBe(false);
    });
  });

  describe('deduplicateByTitle Jaccard overlap algorithm', () => {
    it('should remove duplicated stories with high keyword overlap', () => {
      const items = [
        { title: 'Home Depot Expands Pro Store Network with 80 New Locations in US', link: 'url1' },
        { title: 'Home Depot Expands Pro Store Network across the US with 80 Locations', link: 'url2' },
        { title: 'AutoZone Reports Strong Q2 Earnings and New Supply Chain Hub', link: 'url3' }
      ];

      const deduplicated = deduplicateByTitle(items);
      expect(deduplicated.length).toBe(2);
      expect(deduplicated[0].link).toBe('url1');
      expect(deduplicated[1].link).toBe('url3');
    });
  });
});
