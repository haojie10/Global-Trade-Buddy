import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import {
  getLinkColor,
  getLinkWidth,
  getLinkLineDash,
  getLinkParticles,
  getGraphContainerBackgroundStyle
} from '../lib/graph-styles';

export interface Node {
  id: string;
  title: string;
  category: string;
  market_region: string;
  summary?: string;
  companies?: string[];
  products?: string[];
  channels?: string[];
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
  onNodeSelect?: (node: Node) => void;
  onNodeDoubleClick?: (node: Node) => void;
}

export default function ObsidianGraph({ data, onNodeSelect, onNodeDoubleClick }: ObsidianGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const clickTimeoutRef = useRef<any>(null);
  const lastClickedNodeIdRef = useRef<string | null>(null);
  const lastClickTimeRef = useRef<number>(0);

  // 新增状态管理：折叠展开
  const [expandedNodeIds, setExpandedNodeIds] = React.useState<Set<string>>(new Set());

  // 使用 Ref 存储高亮状态，悬悬停时仅触发 Canvas 重绘，不重启物理引力引擎
  const hoverNodeRef = useRef<any>(null);
  const highlightNodesRef = useRef<Set<string>>(new Set());
  const highlightLinksRef = useRef<Set<any>>(new Set());

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
          links: visibleLinks.map(l => ({ ...l }))
        })
        .nodeId('id')
        .nodeLabel((node: any) => node.node_type === 'report' ? `${node.title} (${node.market_region})` : `${node.title} [${node.entity_type === 'company' ? '公司' : node.entity_type === 'product' ? '产品' : '渠道'}]`)
        // 使用 Canvas 定制节点绘制和文字标签，支持基于聚焦状态的半透明淡出
        .nodeCanvasObject((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
          const label = node.node_type === 'report' ? node.title : node.title;
          const fontSize = 11 / globalScale;
          ctx.font = `${fontSize}px Sans-Serif`;
          
          // 从 Ref 读取高亮参数
          let opacity = 1;
          if (hoverNodeRef.current && !highlightNodesRef.current.has(node.id)) {
            opacity = 0.12;
          }

          // 1. 绘制圆形节点
          ctx.beginPath();
          let size = node.node_type === 'report' ? 4 : (node.entity_type === 'company' ? 6.5 : 5);
          ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);

          let color = '#94a3b8';
          if (node.node_type === 'report') {
            color = node.category === 'customer' ? 'rgba(96, 165, 250, ' + opacity + ')' : 'rgba(52, 211, 153, ' + opacity + ')';
          } else {
            if (node.entity_type === 'company') color = 'rgba(37, 99, 235, ' + opacity + ')';
            else if (node.entity_type === 'product') color = 'rgba(16, 185, 129, ' + opacity + ')';
            else if (node.entity_type === 'channel') color = 'rgba(245, 158, 11, ' + opacity + ')';
          }
          ctx.fillStyle = color;
          ctx.fill();

          // 2. 绘制公司/报告文字标签
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = 'rgba(71, 85, 105, ' + (opacity * 0.95) + ')'; // slate-600

          // 只在局部放大到一定程度或高亮时才绘制长报告的文字标签以防止凌乱，实体节点文字始终绘制
          if (node.node_type === 'entity' || globalScale > 1.2 || (hoverNodeRef.current && highlightNodesRef.current.has(node.id))) {
            const displayLabel = label.length > 10 ? label.slice(0, 10) + '...' : label;
            ctx.fillText(displayLabel, node.x, node.y + size + fontSize * 0.85);
          }
        })
        .linkWidth((link: any) => {
          const s = typeof link.source === 'object' ? link.source.id : link.source;
          const t = typeof link.target === 'object' ? link.target.id : link.target;
          const key = `${s}-${t}`;
          return getLinkWidth(link.relation_type, !!hoverNodeRef.current, highlightLinksRef.current.has(key));
        })
        .linkColor((link: any) => {
          const s = typeof link.source === 'object' ? link.source.id : link.source;
          const t = typeof link.target === 'object' ? link.target.id : link.target;
          const key = `${s}-${t}`;
          return getLinkColor(link.relation_type, !!hoverNodeRef.current, highlightLinksRef.current.has(key));
        })
        .linkLineDash((link: any) => {
          return getLinkLineDash(link.relation_type);
        })
        .linkLabel((link: any) => {
          if (link.link_type === 'mention') return '提及';
          return `${link.relation_key} (${link.market_region || '全球'})`;
        })
        .linkDirectionalParticles((link: any) => {
          return getLinkParticles(link.relation_type);
        })
        .linkDirectionalParticleWidth(1.5)
        .linkDirectionalParticleSpeed(0.005)
        .onNodeHover((node: any) => {
          // 卫语句：如果悬停的节点没有变化，直接返回，防抖避让以提升性能并防止递归
          const prevId = hoverNodeRef.current ? hoverNodeRef.current.id : null;
          const nextId = node ? node.id : null;
          if (prevId === nextId) return;

          const hlNodes = new Set<string>();
          const hlLinks = new Set<string>();
          if (node) {
            hlNodes.add(node.id);
            visibleLinks.forEach((link: any) => {
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
            if (typeof graph.pauseAnimation === 'function') {
              graph.pauseAnimation();
              graph.resumeAnimation();
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
              callbacksRef.current.onNodeSelect?.(node);
              clickTimeoutRef.current = null;
              lastClickedNodeIdRef.current = null;
              lastClickTimeRef.current = 0;
            }, 300);
          }
        });

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
      };
    });
  }, [visibleNodes, visibleLinks, router]);

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
      
      {/* 底部左侧悬浮图例 (Legend) */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        background: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(15, 23, 42, 0.08)',
        borderRadius: '16px',
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        pointerEvents: 'none',
        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.05)',
        zIndex: 10
      }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '2px' }}>📊 拓扑线缆关系图例</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.7rem', color: '#475569' }}>
            <span style={{ display: 'inline-block', width: '24px', height: '3px', background: '#2563eb', borderRadius: '1.5px' }} />
            <span>供应与经销关系 (商务蓝 粗线 + 双粒子流)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.7rem', color: '#475569' }}>
            <span style={{ display: 'inline-block', width: '24px', height: '0px', borderTop: '2px dotted #ef4444' }} />
            <span>竞争对手关系 (警示红 细点虚线)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.7rem', color: '#475569' }}>
            <span style={{ display: 'inline-block', width: '24px', height: '2px', background: '#10b981', borderRadius: '1px' }} />
            <span>相同产品关联 (极光绿 稍粗线 + 单粒子流)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.7rem', color: '#475569' }}>
            <span style={{ display: 'inline-block', width: '24px', height: '0px', borderTop: '2px dashed #f59e0b' }} />
            <span>相同渠道关联 (琥珀橙 均匀虚线)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.7rem', color: '#475569' }}>
            <span style={{ display: 'inline-block', width: '24px', height: '0px', borderTop: '2px dashed #8b5cf6' }} />
            <span>共享竞争对手 (优雅紫 短划虚线)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.7rem', color: '#475569' }}>
            <span style={{ display: 'inline-block', width: '24px', height: '1.5px', background: '#94a3b8', borderRadius: '0.75px' }} />
            <span>其他默认关联 (灰色细实线)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
