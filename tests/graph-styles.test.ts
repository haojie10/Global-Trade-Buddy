import { describe, it, expect } from 'vitest';
import {
  getLinkColor,
  getLinkWidth,
  getLinkLineDash,
  getLinkParticles,
  getGraphContainerBackgroundStyle
} from '../lib/graph-styles';

describe('Graph Connection Visual Styles mapping logic', () => {
  describe('getLinkColor', () => {
    it('should return correct color for supplier relation', () => {
      // 供应关系 - 商务蓝
      expect(getLinkColor('supplier')).toBe('rgba(37, 99, 235, 0.75)');
    });

    it('should return correct color for competitor relation', () => {
      // 竞争关系 - 警示红
      expect(getLinkColor('competitor')).toBe('rgba(239, 68, 68, 0.85)');
    });

    it('should return correct color for shared_product relation', () => {
      // 共享产品 - 极光绿
      expect(getLinkColor('shared_product')).toBe('rgba(16, 185, 129, 0.75)');
    });

    it('should return correct color for shared_channel relation', () => {
      // 共享渠道 - 琥珀黄/橙色
      expect(getLinkColor('shared_channel')).toBe('rgba(245, 158, 11, 0.75)');
    });

    it('should return correct color for shared_competitor relation', () => {
      // 共享竞争对手 - 紫色
      expect(getLinkColor('shared_competitor')).toBe('rgba(139, 92, 246, 0.6)');
    });

    it('should return correct color for other relations (default)', () => {
      // 默认关系/共享公司 - 浅灰
      expect(getLinkColor('shared_company')).toBe('rgba(148, 163, 184, 0.4)');
      expect(getLinkColor('unknown')).toBe('rgba(148, 163, 184, 0.4)');
    });

    it('should fade out when not highlighted during hover state', () => {
      // 当处于 hover 且该 link 没有被 highlight 时，不透明度极低
      expect(getLinkColor('supplier', true, false)).toBe('rgba(200, 200, 200, 0.03)');
    });

    it('should return custom color when customColors map is provided', () => {
      const customColors = {
        supplier: 'rgba(255, 0, 0, 1)',
        competitor: '#ff00ff'
      };
      expect(getLinkColor('supplier', false, false, customColors)).toBe('rgba(255, 0, 0, 1)');
      expect(getLinkColor('competitor', false, false, customColors)).toBe('#ff00ff');
      expect(getLinkColor('shared_product', false, false, customColors)).toBe('rgba(16, 185, 129, 0.75)');
      expect(getLinkColor('supplier', true, false, customColors)).toBe('rgba(200, 200, 200, 0.03)');
    });
  });

  describe('getLinkWidth', () => {
    it('should return 1.0 width for supplier', () => {
      expect(getLinkWidth('supplier')).toBe(1.0);
    });

    it('should return 1.0 width for competitor', () => {
      expect(getLinkWidth('competitor')).toBe(1.0);
    });

    it('should return 1.5 width for shared_product', () => {
      expect(getLinkWidth('shared_product')).toBe(1.5);
    });

    it('should return 1.0 width for standard relations', () => {
      expect(getLinkWidth('shared_channel')).toBe(1.0);
      expect(getLinkWidth('shared_company')).toBe(1.0);
    });

    it('should return thin width when not highlighted during hover state', () => {
      expect(getLinkWidth('supplier', true, false)).toBe(0.5);
    });

    it('should scale the width by lineWidthScale', () => {
      expect(getLinkWidth('supplier', false, false, 2.0)).toBe(2.0);
      expect(getLinkWidth('shared_product', false, false, 0.5)).toBe(0.75);
      expect(getLinkWidth('shared_channel', false, false, 1.5)).toBe(1.5);
      expect(getLinkWidth('supplier', true, false, 2.0)).toBe(1.0);
      // Safety boundaries
      expect(getLinkWidth('supplier', false, false, NaN)).toBe(1.0);
      expect(getLinkWidth('supplier', false, false, -1.5)).toBe(0);
    });
  });

  describe('getLinkLineDash', () => {
    it('should return [2, 2] for supplier', () => {
      expect(getLinkLineDash('supplier')).toEqual([2, 2]);
    });

    it('should return [4, 4] for shared_channel', () => {
      expect(getLinkLineDash('shared_channel')).toEqual([4, 4]);
    });

    it('should return [2, 2] for shared_competitor', () => {
      expect(getLinkLineDash('shared_competitor')).toEqual([2, 2]);
    });

    it('should return null for competitor, shared_product, and other relations', () => {
      expect(getLinkLineDash('competitor')).toBeNull();
      expect(getLinkLineDash('shared_product')).toBeNull();
      expect(getLinkLineDash('shared_company')).toBeNull();
    });
  });

  describe('getLinkParticles', () => {
    it('should return 2 particles for competitor', () => {
      expect(getLinkParticles('competitor')).toBe(2);
    });

    it('should return 1 particle for shared_product', () => {
      expect(getLinkParticles('shared_product')).toBe(1);
    });

    it('should return 0 particles for other relations', () => {
      expect(getLinkParticles('supplier')).toBe(0);
      expect(getLinkParticles('shared_channel')).toBe(0);
      expect(getLinkParticles('shared_company')).toBe(0);
    });
  });

  describe('getGraphContainerBackgroundStyle', () => {
    it('should return correct background styles for dotted grid', () => {
      const style = getGraphContainerBackgroundStyle();
      expect(style.background).toBe('rgba(160, 109, 68, 0.03)');
      expect(style.backgroundImage).toContain('radial-gradient');
      expect(style.backgroundSize).toBe('24px 24px');
    });
  });
});
