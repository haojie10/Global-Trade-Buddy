import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import {
  getLinkColor,
  getLinkWidth,
  getLinkLineDash,
  getLinkParticles,
  getGraphContainerBackgroundStyle
} from '../lib/graph-styles';
import { computeTwoHopHighlight } from '../lib/graph-helpers';

export interface Node {
  id: string;
  title: string;
  category: string;
  market_region: string;
  summary?: string;
  companies?: string[];
  products?: string[];
  channels?: string[];
  node_type?: string;
  entity_type?: string;
}

export interface Link {
  source: any;
  target: any;
  relation_key: string;
  market_region?: string;
  relation_type?: string;
}

export interface ObsidianGraphProps {
  data: {
    nodes: Node[];
    links: Link[];
  };
  onNodeSelect?: (node: Node | null) => void;
  onNodeDoubleClick?: (node: Node) => void;
  nodeSizeScale?: number;
  lineWidthScale?: number;
  speedScale?: number;
  customColors?: Record<string, string>;
  activeRelations?: string[];
}

export default function ObsidianGraph({
  data,
  onNodeSelect,
  onNodeDoubleClick,
  nodeSizeScale = 1.0,
  lineWidthScale = 1.0,
  speedScale = 1.0,
  customColors,
  activeRelations = ['competitor', 'supplier', 'operation', 'mention']
}: ObsidianGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const clickTimeoutRef = useRef<any>(null);
  const lastClickedNodeIdRef = useRef<string | null>(null);
  const lastClickTimeRef = useRef<number>(0);

  // 新增状态管理：折叠展开
  const [expandedNodeIds, setExpandedNodeIds] = React.useState<Set<string>>(new Set());

  // 新增选中状态
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);

  // 使用 Ref 存储高亮状态，悬停时仅触发 Canvas 重绘，不重启物理引力引擎
  const hoverNodeRef = useRef<any>(null);
  const highlightNodesRef = useRef<Set<string>>(new Set());
  const highlightLinksRef = useRef<Set<any>>(new Set());

  // 选中高亮 Ref 和样式 Ref，用于 Canvas 回调读取，防止闭包过旧
  const selectedNodeIdRef = useRef<string | null>(null);
  const selectHighlightNodesRef = useRef<Set<string>>(new Set());
  const selectHighlightLinksRef = useRef<Set<string>>(new Set());
  const nodeSizeScaleRef = useRef(nodeSizeScale);
  const lineWidthScaleRef = useRef(lineWidthScale);
  const speedScaleRef = useRef(speedScale);
  const customColorsRef = useRef(customColors);

  // 声明供销虚线的流动动画缓存 Ref
  const animDashRef = useRef<number[] | null>(null);

  // 保存 graph 实例引用，以实现强制重绘和销毁
  const graphInstanceRef = useRef<any>(null);

  const callbacksRef = useRef({ onNodeSelect, onNodeDoubleClick });
  useEffect(() => {
    callbacksRef.current = { onNodeSelect, onNodeDoubleClick };
  }, [onNodeSelect, onNodeDoubleClick]);

  // 根据折叠展开状态过滤节点和连线
  const visibleNodes = React.useMemo(() => {
    return data.nodes.filter((node: any) => {
      if (node.node_type === 'report') return true;
      if (node.node_type === 'entity') {
        if (node.entity_type === 'company') return true;
        // 对于产品和渠道等实体，只有当它有连线连到已展开的公司节点时，才显示
        const isConnectedToExpanded = data.links.some((link: any) => {
          const s = typeof link.source === 'object' ? link.source.id : link.source;
          const t = typeof link.target === 'object' ? link.target.id : link.target;
          const otherId = s === node.id ? t : (t === node.id ? s : null);
          return otherId && expandedNodeIds.has(otherId);
        });
        return isConnectedToExpanded;
      }
      return true;
    });
  }, [data, expandedNodeIds]);

  const visibleNodeIds = React.useMemo(() => new Set(visibleNodes.map((n: any) => n.id)), [visibleNodes]);

  const visibleLinks = React.useMemo(() => {
    return data.links.filter((link: any) => {
      const s = typeof link.source === 'object' ? link.source.id : link.source;
      const t = typeof link.target === 'object' ? link.target.id : link.target;
      return visibleNodeIds.has(s) && visibleNodeIds.has(t);
    });
  }, [data, visibleNodeIds]);

  const [localActiveRelations, setLocalActiveRelations] = React.useState<string[]>(
    activeRelations || ['competitor', 'supplier', 'operation', 'mention']
  );

  const handleToggleRelation = (key: string) => {
    setLocalActiveRelations(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  React.useEffect(() => {
    if (activeRelations) {
      setLocalActiveRelations(activeRelations);
    }
  }, [activeRelations]);

  // 根据当前勾选的活跃关系对 Links 进行过滤
  const filteredLinksByRelations = React.useMemo(() => {
    return visibleLinks.filter((l: any) => localActiveRelations.includes(l.relation_type || ''));
  }, [visibleLinks, localActiveRelations]);

  // 计算二阶高亮节点集和连线集
  const { highlightNodes: selectHighlightNodes, highlightLinks: selectHighlightLinks } = React.useMemo(() => {
    return computeTwoHopHighlight(selectedNodeId, filteredLinksByRelations);
  }, [selectedNodeId, filteredLinksByRelations]);

  // 同步 Refs，确保 force-graph 回调在不重新实例化的情况下能读取到最新状态
  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId;
    selectHighlightNodesRef.current = selectHighlightNodes;
    selectHighlightLinksRef.current = selectHighlightLinks;
    nodeSizeScaleRef.current = nodeSizeScale;
    lineWidthScaleRef.current = lineWidthScale;
    speedScaleRef.current = speedScale;
    customColorsRef.current = customColors;
  }, [selectedNodeId, selectHighlightNodes, selectHighlightLinks, nodeSizeScale, lineWidthScale, speedScale, customColors]);

  // 全局不间断的虚线流动与重绘动画循环
  useEffect(() => {
    let animId: number;
    const startTime = Date.now();
    const dashAnimateTime = 800; // 虚线流动周期：800毫秒

    const tick = () => {
      if (graphInstanceRef.current) {
        const elapsed = Date.now() - startTime;
        const t = 1 - ((elapsed % dashAnimateTime) / dashAnimateTime);
        
        const dashLen = 3.5;
        const gapLen = 3.5;
        let currentDash = [2, 2];

        // 条纹朝着 target 流动方向计算
        if (t < 0.5) {
          const shift = t * 2;
          currentDash = [0, gapLen * shift, dashLen, gapLen * (1 - shift)];
        } else {
          const shift = (t - 0.5) * 2;
          currentDash = [dashLen * shift, gapLen, dashLen * (1 - shift), 0];
        }

        animDashRef.current = currentDash;

        // 通过重新应用连线虚线设置器来安全触发单帧 Canvas 重绘，且势必不打扰或重置物理引力引擎
        graphInstanceRef.current.linkLineDash(graphInstanceRef.current.linkLineDash());
      }
      animId = requestAnimationFrame(tick);
    };

    tick();
    return () => {
      cancelAnimationFrame(animId);
    };
  }, []);

  // 样式微调属性变更时，使用 linkLineDash 触发 Canvas 重绘
  useEffect(() => {
    if (graphInstanceRef.current) {
      graphInstanceRef.current.linkLineDash(graphInstanceRef.current.linkLineDash());
    }
  }, [nodeSizeScale, lineWidthScale, speedScale, customColors]);

  useEffect(() => {
    // 只有在浏览器端才初始化 force-graph，防止 NextJS SSR 报错
    if (typeof window === 'undefined' || !containerRef.current) return;

    // 动态导入，避免编译时 window 报错
    import('force-graph').then((ForceGraphModule) => {
      const ForceGraph = ForceGraphModule.default;
      
      const graph = (ForceGraph as any)()(containerRef.current!)
        .backgroundColor('rgba(0,0,0,0)')
        .graphData({
          nodes: visibleNodes.map(n => ({ ...n })),
          links: filteredLinksByRelations.map(l => ({ ...l }))
        })
        .nodeId('id')
        .nodeLabel((node: any) => node.node_type === 'report' ? `${node.title} (${node.market_region})` : `${node.title} [${node.entity_type === 'company' ? '公司' : node.entity_type === 'product' ? '产品' : '渠道'}]`)
        // 使用 Canvas 定制节点绘制和文字标签，支持基于聚焦状态的半透明淡出
        .nodeCanvasObject((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
          const label = node.node_type === 'report' ? node.title : node.title;
          const fontSize = 11 / globalScale;
          ctx.font = `${fontSize}px Sans-Serif`;
          
          // 从 Ref 读取高亮参数
          let opacity = 1.0;
          const currentSelectedNodeId = selectedNodeIdRef.current;
          if (currentSelectedNodeId) {
            if (!selectHighlightNodesRef.current.has(node.id)) {
              opacity = 0.12;
            }
          } else if (hoverNodeRef.current) {
            if (!highlightNodesRef.current.has(node.id)) {
              opacity = 0.12;
            }
          }

          // 1. 绘制圆形节点
          ctx.beginPath();
          const isReport = node.node_type === 'report';
          const baseSize = isReport ? 3.5 : (node.entity_type === 'company' ? 3.25 : 2.5);
          const radius = baseSize * (nodeSizeScaleRef.current || 1.0);
          ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);

          const isProduct = node.category === 'product' || node.node_type === 'product';
          ctx.fillStyle = isReport 
            ? (isProduct ? `rgba(122, 117, 111, ${opacity})` : `rgba(255, 100, 30, ${opacity})`)
            : `rgba(148, 163, 184, ${opacity})`;
          ctx.fill();

          // 2. 绘制四角呼吸选中框
          if (currentSelectedNodeId === node.id) {
            const pulse = 1 + Math.sin(Date.now() / 200) * 0.15;
            const boxSize = radius * 2.8 * pulse;
            ctx.strokeStyle = `rgba(255, 100, 30, ${opacity})`;
            ctx.lineWidth = 1.25 / globalScale;
            ctx.beginPath();

            const half = boxSize / 2;
            const len = boxSize / 4;

            // Top-Left
            ctx.moveTo(node.x - half, node.y - half + len);
            ctx.lineTo(node.x - half, node.y - half);
            ctx.lineTo(node.x - half + len, node.y - half);

            // Top-Right
            ctx.moveTo(node.x + half - len, node.y - half);
            ctx.lineTo(node.x + half, node.y - half);
            ctx.lineTo(node.x + half, node.y - half + len);

            // Bottom-Left
            ctx.moveTo(node.x - half, node.y + half - len);
            ctx.lineTo(node.x - half, node.y + half);
            ctx.lineTo(node.x - half + len, node.y + half);

            // Bottom-Right
            ctx.moveTo(node.x + half - len, node.y + half);
            ctx.lineTo(node.x + half, node.y + half);
            ctx.lineTo(node.x + half, node.y + half - len);

            ctx.stroke();
          }

          // 3. 绘制公司/报告文字标签
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = `rgba(60, 57, 53, ${opacity * 0.95})`; // Soft Graphite Dark Gray

          // 只在局部放大到一定程度或高亮时才绘制长报告的文字标签以防止凌乱，实体节点文字始终绘制
          const isHighlighted = currentSelectedNodeId 
            ? selectHighlightNodesRef.current.has(node.id) 
            : (hoverNodeRef.current ? highlightNodesRef.current.has(node.id) : false);

          if (node.node_type === 'entity' || globalScale > 1.2 || isHighlighted) {
            const displayLabel = label.length > 8 ? label.slice(0, 8) + '...' : label;
            ctx.fillText(displayLabel, node.x, node.y + radius + fontSize * 0.9);
          }
        })
        .linkWidth((link: any) => {
          const s = typeof link.source === 'object' ? link.source.id : link.source;
          const t = typeof link.target === 'object' ? link.target.id : link.target;
          const key = `${s}-${t}`;

          const currentSelectedNodeId = selectedNodeIdRef.current;
          let isHighlighted = false;
          let isFocused = false;

          if (currentSelectedNodeId) {
            isFocused = true;
            isHighlighted = selectHighlightLinksRef.current.has(key);
          } else if (hoverNodeRef.current) {
            isFocused = true;
            isHighlighted = highlightLinksRef.current.has(key);
          }

          return getLinkWidth(link.relation_type, isFocused, isHighlighted, lineWidthScaleRef.current);
        })
        .linkColor((link: any) => {
          const s = typeof link.source === 'object' ? link.source.id : link.source;
          const t = typeof link.target === 'object' ? link.target.id : link.target;
          const key = `${s}-${t}`;

          const currentSelectedNodeId = selectedNodeIdRef.current;
          let isHighlighted = false;
          let isFocused = false;

          if (currentSelectedNodeId) {
            isFocused = true;
            isHighlighted = selectHighlightLinksRef.current.has(key);
          } else if (hoverNodeRef.current) {
            isFocused = true;
            isHighlighted = highlightLinksRef.current.has(key);
          }

          return getLinkColor(link.relation_type, isFocused, isHighlighted, customColorsRef.current);
        })
        .linkLineDash((link: any) => {
          if (link.relation_type === 'supplier') {
            return animDashRef.current || [2, 2];
          }
          return getLinkLineDash(link.relation_type);
        })
        .linkLabel((link: any) => {
          if (link.link_type === 'mention') return '提及';
          return `${link.relation_key} (${link.market_region || '全球'})`;
        })
        .linkDirectionalParticles((link: any) => {
          const currentSpeedScale = speedScaleRef.current;
          return (currentSpeedScale && currentSpeedScale > 0) ? getLinkParticles(link.relation_type) : 0;
        })
        .linkDirectionalParticleWidth(1.5)
        .linkDirectionalParticleSpeed(() => {
          const currentSpeedScale = speedScaleRef.current;
          return 0.006 * (currentSpeedScale ?? 1.0);
        })
        .onNodeHover((node: any) => {
          // 卫语句：如果悬停的节点没有变化，直接返回，防抖避让以提升性能并防止递归
          const prevId = hoverNodeRef.current ? hoverNodeRef.current.id : null;
          const nextId = node ? node.id : null;
          if (prevId === nextId) return;

          const hlNodes = new Set<string>();
          const hlLinks = new Set<string>();
          if (node) {
            hlNodes.add(node.id);
            filteredLinksByRelations.forEach((link: any) => {
              const s = typeof link.source === 'object' ? link.source.id : link.source;
              const t = typeof link.target === 'object' ? link.target.id : link.target;
              if (s === node.id) {
                hlLinks.add(`${s}-${t}`);
                hlNodes.add(t);
              } else if (t === node.id) {
                hlLinks.add(`${s}-${t}`);
                hlNodes.add(s);
              }
            });
          }
          // 更新 Ref，不重启实例
          hoverNodeRef.current = node;
          highlightNodesRef.current = hlNodes;
          highlightLinksRef.current = hlLinks;
          
          // 异步调用以切断同步递归堆栈，防止 RangeError 溢出
          setTimeout(() => {
            if (graphInstanceRef.current && typeof graphInstanceRef.current.linkLineDash === 'function') {
              graphInstanceRef.current.linkLineDash(graphInstanceRef.current.linkLineDash());
            }
          }, 0);
        })
        .onNodeClick((node: any) => {
          const now = Date.now();
          if (lastClickedNodeIdRef.current === node.id && now - lastClickTimeRef.current < 300) {
            if (clickTimeoutRef.current) {
              clearTimeout(clickTimeoutRef.current);
              clickTimeoutRef.current = null;
            }
            lastClickedNodeIdRef.current = null;
            lastClickTimeRef.current = 0;
            
            // 双击逻辑：如果是公司实体，进行折叠/展开；如果是报告，触发双击查看
            if (node.node_type === 'entity' && node.entity_type === 'company') {
              setExpandedNodeIds(prev => {
                const next = new Set(prev);
                if (next.has(node.id)) next.delete(node.id);
                else next.add(node.id);
                return next;
              });
            } else {
              callbacksRef.current.onNodeDoubleClick?.(node);
            }
          } else {
            if (clickTimeoutRef.current) {
              clearTimeout(clickTimeoutRef.current);
            }
            lastClickedNodeIdRef.current = node.id;
            lastClickTimeRef.current = now;
            clickTimeoutRef.current = setTimeout(() => {
              // 单击逻辑：设为选中或取消选中，同时触发 onNodeSelect 外部回调
              setSelectedNodeId(prev => {
                const next = prev === node.id ? null : node.id;
                if (next === null) {
                  callbacksRef.current.onNodeSelect?.(null);
                } else {
                  callbacksRef.current.onNodeSelect?.(node);
                }
                return next;
              });
              clickTimeoutRef.current = null;
              lastClickedNodeIdRef.current = null;
              lastClickTimeRef.current = 0;
            }, 300);
          }
        });

      // 保存实例
      graphInstanceRef.current = graph;

      // 调整画布高宽
      const resizeHandler = () => {
        if (containerRef.current) {
          graph.width(containerRef.current.clientWidth);
          graph.height(containerRef.current.clientHeight || 500);
        }
      };
      
      window.addEventListener('resize', resizeHandler);
      resizeHandler();

      return () => {
        window.removeEventListener('resize', resizeHandler);
        if (clickTimeoutRef.current) {
          clearTimeout(clickTimeoutRef.current);
        }
        graph._destructor?.(); // 销毁实例，防内存泄漏
        graphInstanceRef.current = null;
      };
    });
  }, [visibleNodes, filteredLinksByRelations, router]);

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: 'rgba(255, 255, 255, 0.75)',
      borderRadius: '24px',
      overflow: 'hidden',
      border: '1px solid rgba(15, 23, 42, 0.08)',
      backdropFilter: 'blur(20px)',
      boxShadow: '0 10px 30px rgba(15, 23, 42, 0.03)',
      position: 'relative'
    }}>
      <div style={{
        padding: '14px 20px',
        background: 'rgba(15, 23, 42, 0.02)',
        borderBottom: '1px solid rgba(15, 23, 42, 0.06)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>📂 您的个人外贸知识拓扑网络 (已解锁报告)</span>
        <div style={{ display: 'flex', gap: '16px', fontSize: '0.75rem', fontWeight: 600 }}>
          <span style={{ color: '#2563eb' }}>● 客户洞察</span>
          <span style={{ color: '#10b981' }}>● 品类分析</span>
        </div>
      </div>
      <div ref={containerRef} style={{ width: '100%', height: 'calc(100% - 49px)', ...getGraphContainerBackgroundStyle() }} />
      
      {/* 底部左侧悬浮图例 (Legend - 纯静态 Scheme B 版) */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(15, 23, 42, 0.08)',
        borderRadius: '16px',
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.05)',
        zIndex: 10,
        pointerEvents: 'auto'
      }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '2px' }}>图谱关系</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            { key: 'competitor', label: '竞争关系', color: customColorsRef.current?.competitor || '#d32f2f', isDash: false },
            { key: 'supplier', label: '供销关系', color: customColorsRef.current?.supplier || '#ff641e', isDash: true },
            { key: 'operation', label: '经营关系', color: customColorsRef.current?.operation || '#1565c0', isDash: false },
            { key: 'mention', label: '涉及关系', color: customColorsRef.current?.mention || '#a09b95', isDash: false }
          ].map(relation => {
            const isActived = localActiveRelations.includes(relation.key);
            return (
              <div 
                key={relation.key} 
                onClick={() => handleToggleRelation(relation.key)}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  fontSize: '0.7rem', 
                  color: isActived ? '#475569' : '#94a3b8',
                  userSelect: 'none',
                  cursor: 'pointer',
                  opacity: isActived ? 1 : 0.4,
                  transition: 'all 0.2s',
                  padding: '2px 4px',
                  borderRadius: '4px',
                  background: isActived ? 'transparent' : 'rgba(15, 23, 42, 0.02)'
                }}
                title={isActived ? `点击隐藏${relation.label}` : `点击显示${relation.label}`}
              >
                <span style={{ 
                  display: 'inline-block', 
                  width: '24px', 
                  height: relation.isDash ? '0px' : '3px', 
                  background: relation.isDash ? 'none' : relation.color,
                  borderTop: relation.isDash ? `2px dotted ${relation.color}` : 'none',
                  borderRadius: '1.5px' 
                }} />
                <span>{relation.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
