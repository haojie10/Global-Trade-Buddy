import React from 'react';

/**
 * 获取关系连线对应的颜色
 * @param relationType 关系类型，可能值有：'supplier', 'competitor', 'shared_product', 'shared_channel', 'shared_competitor', 'shared_company' 等
 * @param isHovered 当前图谱是否处于 hover 聚焦状态
 * @param isHighlighted 该连线是否需要被高亮
 */
export function getLinkColor(
  relationType: string,
  isHovered: boolean = false,
  isHighlighted: boolean = false,
  customColors?: Record<string, string>
): string {
  // 如果处于 hover 聚焦状态，且当前连线未被高亮，则进行低透明度虚化
  if (isHovered && !isHighlighted) {
    return 'rgba(200, 200, 200, 0.03)';
  }

  if (customColors && customColors[relationType]) {
    return customColors[relationType];
  }

  switch (relationType) {
    case 'supplier':
      return 'rgba(37, 99, 235, 0.75)'; // 商务蓝
    case 'competitor':
      return 'rgba(239, 68, 68, 0.85)'; // 警示红
    case 'shared_product':
      return 'rgba(16, 185, 129, 0.75)'; // 极光绿
    case 'shared_channel':
      return 'rgba(245, 158, 11, 0.75)'; // 琥珀黄/橙色
    case 'shared_competitor':
      return 'rgba(139, 92, 246, 0.6)'; // 优雅紫
    case 'shared_company':
    default:
      return 'rgba(148, 163, 184, 0.4)'; // 默认浅灰色 (slate-400)
  }
}

/**
 * 获取关系连线的粗细 (Width)
 */
export function getLinkWidth(
  relationType: string,
  isHovered: boolean = false,
  isHighlighted: boolean = false,
  lineWidthScale: number = 1.0
): number {
  let baseWidth = 1.0;
  if (isHovered && !isHighlighted) {
    baseWidth = 0.5;
  } else {
    switch (relationType) {
      case 'supplier':
        baseWidth = 3.5; // 供应/经销关系加粗
        break;
      case 'competitor':
        baseWidth = 2.2; // 竞争关系
        break;
      case 'shared_product':
        baseWidth = 1.5; // 相同产品稍粗
        break;
      default:
        baseWidth = 1.0; // 默认细线
        break;
    }
  }

  const safeScale = Math.max(0, isNaN(lineWidthScale) ? 1.0 : lineWidthScale);
  return baseWidth * safeScale;
}

/**
 * 获取关系线划模式 (LineDash)
 * 返回 [dashLength, gapLength] 的数组，如果是实线则返回 null
 */
export function getLinkLineDash(relationType: string): number[] | null {
  switch (relationType) {
    case 'supplier':
      return [2, 2]; // 供销：粗虚线
    case 'mention':
      return [3, 3]; // 涉及关系：细虚线
    case 'shared_channel':
      return [4, 4]; // 渠道：稀疏虚线
    case 'shared_competitor':
      return [2, 2]; // 共享竞争对手：短划线
    case 'competitor':
    default:
      return null; // 其他为实线
  }
}

/**
 * 获取关系流动粒子数量 (Particles)
 */
export function getLinkParticles(relationType: string): number {
  switch (relationType) {
    case 'competitor':
      return 2; // 竞争对手流动粒子
    case 'shared_product':
      return 1; // 共享产品流动粒子
    default:
      return 0; // 其他无粒子
  }
}

/**
 * 获取图谱外层 React 容器的点状网格背景样式
 */
export function getGraphContainerBackgroundStyle(): React.CSSProperties {
  return {
    background: '#f8fafc',
    backgroundImage: 'radial-gradient(rgba(15, 23, 42, 0.08) 1px, transparent 1px)',
    backgroundSize: '24px 24px'
  };
}
