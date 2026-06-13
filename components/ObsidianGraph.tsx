import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/router';

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

  const callbacksRef = useRef({ onNodeSelect, onNodeDoubleClick });
  useEffect(() => {
    callbacksRef.current = { onNodeSelect, onNodeDoubleClick };
  }, [onNodeSelect, onNodeDoubleClick]);

  useEffect(() => {
    // 只有在浏览器端才初始化 force-graph，防止 NextJS SSR 报错
    if (typeof window === 'undefined' || !containerRef.current) return;

    // 动态导入，避免编译时 window 报错
    import('force-graph').then((ForceGraphModule) => {
      const ForceGraph = ForceGraphModule.default;
      
      const graph = (ForceGraph as any)()(containerRef.current!)
        .backgroundColor('#f8fafc')
        .graphData({
          nodes: data.nodes.map(n => ({ ...n })),
          links: data.links
        })
        .nodeId('id')
        .nodeLabel((node: any) => `${node.title} (${node.market_region})`)
        .nodeColor((node: any) => {
          // 客户节点渲染为商务蓝，品类报告渲染为极光绿
          return node.category === 'customer' ? '#2563eb' : '#10b981';
        })
        .nodeVal((node: any) => (node.category === 'customer' ? 5 : 4))
        .linkWidth(1.5)
        .linkColor(() => 'rgba(37, 99, 235, 0.15)')
        .linkLabel((link: any) => `共同关键词: ${link.relation_key}`)
        .onNodeClick((node: any) => {
          const now = Date.now();
          if (lastClickedNodeIdRef.current === node.id && now - lastClickTimeRef.current < 300) {
            if (clickTimeoutRef.current) {
              clearTimeout(clickTimeoutRef.current);
              clickTimeoutRef.current = null;
            }
            lastClickedNodeIdRef.current = null;
            lastClickTimeRef.current = 0;
            callbacksRef.current.onNodeDoubleClick?.(node);
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
  }, [data, router]);

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: 'rgba(255, 255, 255, 0.75)',
      borderRadius: '24px',
      overflow: 'hidden',
      border: '1px solid rgba(15, 23, 42, 0.08)',
      backdropFilter: 'blur(20px)',
      boxShadow: '0 10px 30px rgba(15, 23, 42, 0.03)'
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
      <div ref={containerRef} style={{ width: '100%', height: 'calc(100% - 49px)', background: '#f8fafc' }} />
    </div>
  );
}
