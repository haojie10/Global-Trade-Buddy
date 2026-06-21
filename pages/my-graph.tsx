import { GetServerSideProps } from 'next';
import React, { useState } from 'react';
import pool from '../lib/db';
import { parseCookies } from '../lib/cookies';
import { getUserGraph, getGraphData } from './api/user/graph';
import ObsidianGraph from '../components/ObsidianGraph';
import Link from 'next/link';
import { filterGraphData, GraphNode, GraphLink } from '../lib/graph-helpers';
import NodeProfilePanel from '../components/NodeProfilePanel';
import ReportList from '../components/ReportList';

const DEMO_GRAPH_DATA = {
  nodes: [
    {
      id: 'demo-1',
      title: 'Home Depot 零售研报',
      node_type: 'report',
      category: 'customer',
      market_region: '北美',
      companies: ['Home Depot', 'Ryobi', 'Milwaukee'],
      products: ['园艺工具', '手持电钻'],
      channels: ['建材超市', '线上DTC'],
      summary: '本研报深度剖析了北美最大的建材家居零售商 Home Depot 的供应商选择与上架逻辑。Ryobi 与 Milwaukee 在其电动工具区域占有主导地位。'
    },
    {
      id: 'demo-2',
      title: "Lowe's 采购报告",
      node_type: 'report',
      category: 'customer',
      market_region: '北美',
      companies: ["Lowe's", 'Kobalt', 'Craftsman'],
      products: ['户外家具', '园艺剪'],
      channels: ['建材超市', '直营门店'],
      summary: "报告展示了 Lowe's 针对春季户外用品的最新采购预算。其自营品牌 Kobalt 正在大力推广环保材质的户外园林修剪工具。"
    },
    {
      id: 'demo-3',
      title: 'Walmart 全球采购报告',
      node_type: 'report',
      category: 'customer',
      market_region: '全球',
      companies: ['Walmart', 'Mainstays'],
      products: ['环保纸袋', '智能风扇'],
      channels: ['大卖场', '一元店'],
      summary: '本季 Walmart 全球联采着重于环保纸质包装及夏季消费电子的集中配货。其超值品牌 Mainstays 锁定了亚太供应商的最新订单。'
    },
    {
      id: 'demo-4',
      title: 'Target 供应链分析报告',
      node_type: 'report',
      category: 'customer',
      market_region: '美国',
      companies: ['Target', 'Threshold'],
      products: ['LED 照明', '智能风扇'],
      channels: ['精品大卖场', '线上零售'],
      summary: 'Target 正对其在美国本土的物流网络进行重组。本次供应链评测报告着重分析了其主流合作品牌 Threshold 的智能风扇备货瓶颈。'
    },
    {
      id: 'demo-5',
      title: 'Costco 自营品牌研究报告',
      node_type: 'report',
      category: 'customer',
      market_region: '北美',
      companies: ['Costco', 'Kirkland Signature'],
      products: ['智能风扇', '环保纸袋'],
      channels: ['会员仓储店'],
      summary: 'Kirkland Signature 报告详细说明了 Costco 包装袋向可降解材质过渡的节奏，并展示了其夏季主力智能风扇的市场准入门槛。'
    },
    {
      id: 'demo-6',
      title: "Sam's Club 供应商画像",
      node_type: 'report',
      category: 'customer',
      market_region: '美国',
      companies: ["Sam's Club", "Member's Mark"],
      products: ['水上运动服装', '户外家具'],
      channels: ['会员仓储店'],
      summary: "分析了 Sam's Club 自有品牌 Member's Mark 的水上运动服装供货渠道，指出其正寻找具备高弹力速干面料技术的中国代工厂。"
    },
    {
      id: 'demo-7',
      title: 'Aldi 欧洲折价渠道报告',
      node_type: 'report',
      category: 'customer',
      market_region: '欧洲',
      companies: ['Aldi Süd', 'Aldi Nord'],
      products: ['水上运动服装', '环保纸袋'],
      channels: ['廉价超市'],
      summary: '廉价超市巨人 Aldi 在欧洲推广极简包装，水上运动服装仅在夏季特色促销周短暂在架销售。报告提供了完整的准入资质 checklist。'
    },
    {
      id: 'demo-8',
      title: 'Lidl 零售准入分析报告',
      node_type: 'report',
      category: 'customer',
      market_region: '欧洲',
      companies: ['Lidl'],
      products: ['水上运动服装', 'LED 照明'],
      channels: ['廉价超市', '欧洲联采'],
      summary: 'Lidl 超市针对欧洲市场的准入合规门槛（CE 与 RoHS 认证）进行了大篇幅梳理，并附带了部分服装纺织品 OEKO-TEX 环保认证的标准。'
    },
    {
      id: 'demo-9',
      title: 'Dollar General 采购线索',
      node_type: 'report',
      category: 'customer',
      market_region: '美国',
      companies: ['Dollar General'],
      products: ['宠物用品', 'LED 照明'],
      channels: ['折扣一元店'],
      summary: 'DG 一元店的核心吸引力在于低价高频消耗品。其采购线索显示下半年度将大幅增加宠物玩具和百货小照明挂卡类货物的采购比重。'
    },
    {
      id: 'demo-10',
      title: 'Dollarama 供应链报告',
      node_type: 'report',
      category: 'customer',
      market_region: '加拿大',
      companies: ['Dollarama'],
      products: ['不锈钢厨具', '宠物用品'],
      channels: ['加拿大一元店'],
      summary: '加拿大最大的低价零售连锁 Dollarama 正加速优化本地分销效率，重点涉及不锈钢日常刀叉勺以及环保猫狗盆等宠物塑料硬件。'
    },
    {
      id: 'demo-11',
      title: '园艺工具品类洞察报告',
      node_type: 'report',
      category: 'product',
      market_region: '全球',
      products: ['园艺工具'],
      summary: '园艺剪、电锯等修剪工具全球年复合增长率为 5.2%。北美是最大的消费市场，锂电化与轻量化是制造端升级的重点。'
    },
    {
      id: 'demo-12',
      title: '户外家具市场研究报告',
      node_type: 'report',
      category: 'product',
      market_region: '北美',
      products: ['户外家具'],
      summary: '户外铝合金桌椅和防紫外线藤编沙发需求平稳增长，报告着重对比了低碳足迹环保板材在北美家庭庭院中的高接受度。'
    },
    {
      id: 'demo-13',
      title: '智能风扇品类研究报告',
      node_type: 'report',
      category: 'product',
      market_region: '北美',
      products: ['智能风扇'],
      summary: '智能直流无刷风扇依靠低噪与 Wi-Fi 语音唤醒控制，正迅速蚕食传统 AC 电风扇市场。Costco 与 Target 是主力出货窗口。'
    },
    {
      id: 'demo-14',
      title: '水上运动服装市场报告',
      node_type: 'report',
      category: 'product',
      market_region: '欧洲',
      products: ['水上运动服装'],
      summary: "防晒服、潜水服以及快干泳装在欧洲度假季的销量出现爆发式增长。报告对比了 Aldi 等超市促销周与 Sam's Club 会员仓储的备货期差。"
    },
    {
      id: 'demo-15',
      title: '环保纸袋市场分析报告',
      node_type: 'report',
      category: 'product',
      market_region: '全球',
      products: ['环保纸袋'],
      summary: '禁塑令在全球各主要国家（如英美法、中国等）落地，促使牛皮纸袋和可降解编织纸袋的需求发生结构性攀升，成本控制是采购核心。'
    },
    {
      id: 'demo-16',
      title: 'LED 照明品类分析报告',
      node_type: 'report',
      category: 'product',
      market_region: '全球',
      products: ['LED 照明'],
      summary: '太阳能户外 LED 草坪灯、便携式野营手提灯成为零售渠道新亮点，智能感应调光等微创新能够显著拉高产品毛利润。'
    },
    {
      id: 'demo-17',
      title: '不锈钢厨具采购指南',
      node_type: 'report',
      category: 'product',
      market_region: '北美',
      products: ['不锈钢厨具'],
      summary: '加拿大与美国日常餐饮不锈钢制品（304/430级）的市场消费指南，梳理了 Dollarama 一类大宗买家对铅铬金属溶出测试的严格合规要求。'
    },
    {
      id: 'demo-18',
      title: '宠物用品品类洞察报告',
      node_type: 'report',
      category: 'product',
      market_region: '全球',
      products: ['宠物用品'],
      summary: '报告显示“宠物人性化”趋势推动了中高端宠物服饰和高耐咬橡胶发声玩具的消费。Dollar General 等渠道对其采购规模连年上涨。'
    },
    {
      id: 'demo-19',
      title: '消费电子品类准入报告',
      node_type: 'report',
      category: 'product',
      market_region: '全球',
      products: ['消费电子'],
      summary: '消费级电子百货（蓝牙音箱、加湿器等）准入合规大全，梳理了亚马逊等平台和实体零售对 UL、FCC 证书审核的最新动向。'
    },
    {
      id: 'demo-20',
      title: '家居装饰品类市场研究',
      node_type: 'report',
      category: 'product',
      market_region: '北美',
      products: ['家居装饰'],
      summary: '仿真绿植、时尚挂钟和装饰镜品类研究，展示了在当前消费低迷环境下低客单价装饰摆件作为情绪消费的独特逆势上扬特征。'
    }
  ],
  links: [
    { source: 'demo-1', target: 'demo-2', relation_type: 'competitor', relation_key: '同行业主攻竞争' },
    { source: 'demo-3', target: 'demo-4', relation_type: 'competitor', relation_key: '大卖场竞争对手' },
    { source: 'demo-5', target: 'demo-6', relation_type: 'competitor', relation_key: '仓储零售主竞对' },
    { source: 'demo-7', target: 'demo-8', relation_type: 'competitor', relation_key: '折价超市主竞对' },
    { source: 'demo-9', target: 'demo-10', relation_type: 'competitor', relation_key: '一元店跨国竞争' },
    { source: 'demo-3', target: 'demo-9', relation_type: 'supplier', relation_key: '供销调配' },
    { source: 'demo-5', target: 'demo-10', relation_type: 'supplier', relation_key: '全球联采供货' },
    { source: 'demo-6', target: 'demo-7', relation_type: 'supplier', relation_key: '大宗采购流转' },
    { source: 'demo-11', target: 'demo-1', relation_type: 'operation', relation_key: '主攻品类' },
    { source: 'demo-12', target: 'demo-2', relation_type: 'operation', relation_key: '热销品类' },
    { source: 'demo-15', target: 'demo-3', relation_type: 'operation', relation_key: '绿色品类' },
    { source: 'demo-16', target: 'demo-4', relation_type: 'operation', relation_key: '核心经营' },
    { source: 'demo-13', target: 'demo-5', relation_type: 'operation', relation_key: '核心经营' },
    { source: 'demo-14', target: 'demo-6', relation_type: 'operation', relation_key: '特色专营' },
    { source: 'demo-18', target: 'demo-9', relation_type: 'operation', relation_key: '主营品类' },
    { source: 'demo-17', target: 'demo-10', relation_type: 'operation', relation_key: '特色在架' },
    { source: 'demo-1', target: 'demo-3', relation_type: 'mention', relation_key: '横向参考' },
    { source: 'demo-2', target: 'demo-5', relation_type: 'mention', relation_key: '采购模式参考' },
    { source: 'demo-13', target: 'demo-11', relation_type: 'mention', relation_key: '跨品类提及' },
    { source: 'demo-5', target: 'demo-4', relation_type: 'mention', relation_key: '运营提及' },
    { source: 'demo-6', target: 'demo-8', relation_type: 'mention', relation_key: '欧洲供应链关联' }
  ]
};

interface MyGraphProps {
  graphData: {
    nodes: GraphNode[];
    links: GraphLink[];
  };
  userId: string;
  userRole: string;
  freeQuota: number;
  unlockedReports: any[];
}

export default function MyGraphPage({ graphData, userId, userRole, freeQuota, unlockedReports: initialUnlockedReports }: MyGraphProps) {
  const [quota, setQuota] = useState(freeQuota);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 演示模式及样式微调状态
  // 演示模式及样式微调状态（若真实数据量过小或完全无连线，则默认直接开启演示模式以获得完美演示体验）
  const [isDemoMode, setIsDemoMode] = useState(
    !graphData.nodes || 
    graphData.nodes.length < 10 || 
    !graphData.links || 
    graphData.links.length === 0
  );
  const [nodeSizeScale, setNodeSizeScale] = useState(1.0);
  const [lineWidthScale, setLineWidthScale] = useState(1.0);
  const [speedScale, setSpeedScale] = useState(1.0);
  const [customColors, setCustomColors] = useState<Record<string, string>>({
    competitor: '#d32f2f',
    supplier: '#ff641e',
    operation: '#1565c0',
    mention: '#a09b95'
  });
  const [activeRelations, setActiveRelations] = useState<string[]>(['competitor', 'supplier', 'operation', 'mention']);

  // 筛选与画像状态管理
  const [selectedMarket, setSelectedMarket] = useState('All');
  const [selectedProduct, setSelectedProduct] = useState('All');
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  // 新增：实体详情及图谱动态数据源
  const [currentGraphData, setCurrentGraphData] = useState(graphData);
  const [entityDetail, setEntityDetail] = useState<any>(null);
  const [unlockedReports, setUnlockedReports] = useState(initialUnlockedReports || []);

  if (!userId) {
    return (
      <div style={{
        background: 'var(--bg-main)',
        color: 'var(--color-text)',
        minHeight: '100vh',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px',
        textAlign: 'center'
      }}>
        <div style={{
          background: 'var(--bg-sub)',
          border: 'none',
          padding: '40px',
          borderRadius: 'var(--border-radius)',
          maxWidth: '480px',
          boxShadow: '0 10px 40px rgba(160, 109, 68, 0.04)'
        }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 300, marginBottom: '16px' }}>暂未登录</h2>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem', marginBottom: '24px', lineHeight: 1.6 }}>
            游客模式下无法查看个人知识拓扑网图。请返回首页登录或注册账号后体验！
          </p>
          <Link href="/" className="sand-btn" style={{ padding: '10px 24px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            返回首页登录
          </Link>
        </div>
      </div>
    );
  }

  const handleInitSeedData = async () => {
    if (loading) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/user/unlock-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          reportId: 'seed-action',
        }),
      });

      const data = await res.json();
      if (data.success) {
        // 解锁并初始化种子数据成功，重新载入页面数据以显示图谱
        window.location.reload();
      } else {
        setError(data.error || '生成种子数据失败，请重试');
      }
    } catch (err) {
      console.error(err);
      setError('网络请求失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 1. 动态刷新图谱核心数据
  const refreshGraphData = async () => {
    try {
      const res = await fetch('/api/user/graph');
      if (res.ok) {
        const data = await res.json();
        setCurrentGraphData(data);
      }
    } catch (err) {
      console.error('刷新图谱失败', err);
    }
  };

  // 2. 动态拉取公司/实体详细别名及关系
  const fetchEntityDetail = async (entityId: string) => {
    try {
      const res = await fetch(`/api/user/entities/detail?id=${entityId}`);
      if (res.ok) {
        const data = await res.json();
        setEntityDetail(data);
      }
    } catch (err) {
      console.error('获取实体详情失败', err);
    }
  };

  // 监听选中节点变化，动态加载详情
  React.useEffect(() => {
    if (selectedNode && selectedNode.node_type === 'entity') {
      fetchEntityDetail(selectedNode.id);
    } else {
      setEntityDetail(null);
    }
  }, [selectedNode]);

  const activeGraphData = isDemoMode ? DEMO_GRAPH_DATA : currentGraphData;
  const hasData = activeGraphData.nodes && activeGraphData.nodes.length > 0;

  // 动态提取筛选选项
  const markets = hasData ? ['All', ...Array.from(new Set(activeGraphData.nodes.map(n => n.market_region).filter(Boolean)))] : ['All'];
  const products = hasData ? ['All', ...Array.from(new Set(activeGraphData.nodes.flatMap(n => n.products || []).filter(Boolean)))] : ['All'];

  // 过滤数据
  const filteredGraphData = hasData ? filterGraphData(
    activeGraphData.nodes,
    activeGraphData.links,
    selectedMarket,
    selectedProduct,
    focusNodeId
  ) : { nodes: [], links: [] };

  const focusedNode = hasData && focusNodeId ? activeGraphData.nodes.find(n => n.id === focusNodeId) : null;

  return (
    <div style={{
      background: 'var(--bg-main)',
      color: 'var(--color-text)',
      minHeight: '100vh',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflowX: 'hidden'
    }}>
      {/* 头部导航栏 - 漂浮样式 */}
      <div style={{ padding: '20px 40px 10px 40px', flexShrink: 0, zIndex: 10 }}>
        <header style={{
          background: 'rgba(246, 243, 236, 0.8)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          padding: '12px 30px',
          borderRadius: 'var(--border-radius)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 10px 40px rgba(160, 109, 68, 0.02)',
          maxWidth: '1400px',
          margin: '0 auto',
          width: '100%'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4.5 16.5c-1.5 1.26-2.5 3.19-2.5 5.5h20c0-2.31-1-4.24-2.5-5.5" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="2" r="1" />
              <circle cx="4" cy="16" r="1" />
              <circle cx="20" cy="16" r="1" />
            </svg>
            <span style={{
              fontSize: '1.25rem',
              fontWeight: 400,
              color: 'var(--color-text)',
              letterSpacing: '-0.5px'
            }}>
              市场图谱
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', fontSize: '0.9rem' }}>
            <button
              onClick={() => {
                setIsDemoMode(!isDemoMode);
                setSelectedNode(null);
                setFocusNodeId(null);
              }}
              style={{
                background: 'rgba(255, 100, 30, 0.06)',
                color: 'var(--color-accent)',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '0.85rem',
                fontWeight: 300,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              {isDemoMode ? "切换至真实已解锁数据" : "体验 20 份演示拓扑"}
            </button>
            <Link 
              href="/" 
              className="sand-btn"
              style={{
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              返回平台报告大厅
            </Link>
            <span style={{ color: 'var(--color-muted)', fontWeight: 300, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              业务员 ID: <code style={{ color: 'var(--color-accent)', fontWeight: 400 }}>{userId.substring(0, 8)}...</code>
            </span>
            <span style={{
              background: 'var(--bg-sub)',
              padding: '6px 14px',
              borderRadius: '20px',
              color: 'var(--color-text)',
              fontWeight: 300,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 9.9-1" />
              </svg>
              剩余额度: <b style={{ color: 'var(--color-accent)', fontWeight: 500 }}>{quota}</b> 次
            </span>
          </div>
        </header>
      </div>

      {/* 主体内容区（分左右两栏） */}
      <main style={{
        height: '680px',
        display: 'flex',
        padding: '10px 40px 24px 40px',
        gap: '24px',
        overflow: 'hidden',
        maxWidth: '1480px',
        margin: '0 auto',
        width: '100%',
        zIndex: 10,
        boxSizing: 'border-box'
      }}>
        {/* 左栏：图谱面板 */}
        <div style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {hasData && (
            <>
              {/* 顶部筛选栏 */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                padding: '12px 24px',
                background: 'var(--bg-sub)',
                borderRadius: 'var(--border-radius)',
                marginBottom: '16px',
                boxShadow: '0 6px 20px rgba(160, 109, 68, 0.01)',
                flexWrap: 'wrap'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--color-muted)', fontWeight: 500 }}>国家/市场</span>
                    <select
                      value={selectedMarket}
                      onChange={(e) => setSelectedMarket(e.target.value)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '10px',
                        border: 'none',
                        background: 'var(--bg-main)',
                        fontSize: '0.85rem',
                        outline: 'none',
                        cursor: 'pointer',
                        color: 'var(--color-text)'
                      }}
                    >
                      {markets.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--color-muted)', fontWeight: 500 }}>产品品类</span>
                    <select
                      value={selectedProduct}
                      onChange={(e) => setSelectedProduct(e.target.value)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '10px',
                        border: 'none',
                        background: 'var(--bg-main)',
                        fontSize: '0.85rem',
                        outline: 'none',
                        cursor: 'pointer',
                        color: 'var(--color-text)'
                      }}
                    >
                      {products.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSelectedMarket('All');
                    setSelectedProduct('All');
                    setFocusNodeId(null);
                    setSelectedNode(null);
                  }}
                  className="sand-btn"
                  style={{
                    padding: '6px 18px',
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  重置筛选与聚焦
                </button>
              </div>

              {/* 聚焦提醒横幅 */}
              {focusNodeId && focusedNode && (
                <div style={{
                  padding: '10px 20px',
                  background: 'rgba(255, 100, 30, 0.05)',
                  borderRadius: '12px',
                  color: 'var(--color-accent)',
                  fontSize: '0.85rem',
                  marginBottom: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span>正在聚焦报告：<strong>{focusedNode.title}</strong> (只展示其一阶关联节点)</span>
                  <span
                    onClick={() => setFocusNodeId(null)}
                    style={{
                      cursor: 'pointer',
                      fontWeight: 600,
                      textDecoration: 'underline'
                    }}
                  >
                    [清除聚焦]
                  </span>
                </div>
              )}
            </>
          )}

          {hasData ? (
            <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
              <ObsidianGraph
                data={filteredGraphData}
                onNodeSelect={(node) => {
                  setSelectedNode(node as any);
                }}
                onNodeDoubleClick={(node) => {
                  setFocusNodeId(node.id);
                }}
                nodeSizeScale={nodeSizeScale}
                lineWidthScale={lineWidthScale}
                speedScale={speedScale}
                customColors={customColors}
                activeRelations={activeRelations}
              />

              {/* 右上角图谱样式与颜色自定义设置面板 (Scheme B 暖乳白) */}
              <div style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'rgba(253, 251, 247, 0.95)',
                backdropFilter: 'blur(12px)',
                borderRadius: '16px',
                padding: '16px',
                width: '180px',
                boxShadow: '0 6px 20px rgba(160, 109, 68, 0.03)',
                zIndex: 10,
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                border: '1px solid rgba(160, 109, 68, 0.08)'
              }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-muted)', letterSpacing: '0.5px' }}>图谱样式设置</div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--color-muted)' }}>
                    <span>节点大小</span>
                    <span>{nodeSizeScale.toFixed(1)}x</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.5" 
                    max="2.0" 
                    step="0.1" 
                    value={nodeSizeScale} 
                    onChange={e => setNodeSizeScale(parseFloat(e.target.value))}
                    style={{ accentColor: 'var(--color-accent)', cursor: 'pointer', width: '100%' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--color-muted)' }}>
                    <span>线缆粗细</span>
                    <span>{lineWidthScale.toFixed(1)}x</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.5" 
                    max="2.0" 
                    step="0.1" 
                    value={lineWidthScale} 
                    onChange={e => setLineWidthScale(parseFloat(e.target.value))}
                    style={{ accentColor: 'var(--color-accent)', cursor: 'pointer', width: '100%' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--color-muted)' }}>
                    <span>粒子流动</span>
                    <span>{speedScale.toFixed(1)}x</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.0" 
                    max="2.0" 
                    step="0.2" 
                    value={speedScale} 
                    onChange={e => setSpeedScale(parseFloat(e.target.value))}
                    style={{ accentColor: 'var(--color-accent)', cursor: 'pointer', width: '100%' }}
                  />
                </div>

                <div style={{ borderTop: '1px solid rgba(160, 109, 68, 0.08)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-muted)' }}>线缆颜色</div>
                  {[
                    { key: 'competitor', label: '竞争关系' },
                    { key: 'supplier', label: '供销关系' },
                    { key: 'operation', label: '经营关系' },
                    { key: 'mention', label: '涉及关系' }
                  ].map(item => (
                    <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.65rem' }}>
                      <span style={{ color: 'var(--color-text)' }}>{item.label}</span>
                      <input 
                        type="color" 
                        value={customColors[item.key]} 
                        onChange={e => setCustomColors(prev => ({ ...prev, [item.key]: e.target.value }))}
                        style={{ border: 'none', padding: 0, width: '18px', height: '18px', cursor: 'pointer', background: 'none' }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.85)',
              borderRadius: '24px',
              border: '1px solid rgba(15, 23, 42, 0.08)',
              backdropFilter: 'blur(30px)',
              padding: '40px',
              textAlign: 'center',
              boxShadow: '0 12px 40px 0 rgba(15, 23, 42, 0.03)'
            }}>
              <div 
                className="floating-planet"
                style={{
                  fontSize: '4.5rem',
                  marginBottom: '28px',
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  fontWeight: 800,
                  cursor: 'default',
                  userSelect: 'none'
                }}
              >
                🪐
              </div>
              <h2 style={{
                fontSize: '1.7rem',
                fontWeight: 300,
                marginBottom: '16px',
                color: '#0f172a',
                letterSpacing: '-0.5px'
              }}>
                开启您的外贸星空知识网络
              </h2>
              <p style={{
                maxWidth: '520px',
                fontSize: '0.95rem',
                color: '#475569',
                lineHeight: 1.6,
                marginBottom: '36px'
              }}>
                您的个人知识拓扑网络目前还是空的。在这里，您可以通过在报告大厅解锁和阅读行业客户与品类报告，自动生成互相关联的实体知识卡片网络，帮您洞察跨区域客户之间的隐藏商机。
              </p>
              
              <button
                onClick={handleInitSeedData}
                disabled={loading}
                className="water-drop-btn"
                style={{
                  padding: '14px 32px',
                  fontSize: '0.95rem',
                  fontWeight: 500,
                  opacity: loading ? 0.7 : 1,
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? '⚡ 正在生成专属知识节点...' : '🔌 快速生成演示图谱并解锁首批报告'}
              </button>

              {error && (
                <div style={{ marginTop: '16px', color: '#ef4444', fontSize: '0.85rem', fontWeight: 600 }}>
                  ⚠️ {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 右栏：外贸便捷小工具面板 */}
        <div style={{
          width: '450px',
          background: 'rgba(255, 255, 255, 0.75)',
          borderRadius: '24px',
          border: '1px solid rgba(15, 23, 42, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.03)'
        }}>
          <NodeProfilePanel
            selectedNode={selectedNode}
            userRole={userRole}
            entityDetail={entityDetail}
            onRefreshGraph={refreshGraphData}
            onNodeSelectUpdate={(node) => setSelectedNode(node)}
            onFetchEntityDetail={fetchEntityDetail}
            onDeleteNodeSuccess={() => setSelectedNode(null)}
          />
        </div>

      </main>

      {/* 底部已解锁报告卡片区域 */}
      {unlockedReports && unlockedReports.length > 0 && (
        <section style={{
          maxWidth: '1400px',
          margin: '40px auto 80px auto',
          padding: '0 40px',
          width: '100%',
          boxSizing: 'border-box',
          zIndex: 10,
          position: 'relative'
        }}>
          <h3 style={{
            fontSize: '1.25rem',
            fontWeight: 400,
            color: '#0f172a',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            🔓 最近解锁的报告 (最多显示10篇)
          </h3>
          <ReportList
            reports={unlockedReports}
            userId={userId}
            userRole={userRole}
            quota={quota}
            onUnlockSuccess={() => {}}
          />
        </section>
      )}
    </div>
  );
}

// SSR 加载个人知识图谱数据
export const getServerSideProps: GetServerSideProps = async (context) => {
  const cookies = parseCookies(context.req.headers.cookie);
  const cookieUserId = cookies.user_id;
  
  const dbClient = await pool.connect();

  try {
    let userId: string | null = null;
    let userRole = 'guest';
    let freeQuota = 0;

    if (cookieUserId) {
      const userRes = await dbClient.query('SELECT id, role, free_quota FROM users WHERE id = $1', [cookieUserId]);
      if (userRes.rows.length > 0) {
        userId = userRes.rows[0].id;
        userRole = userRes.rows[0].role;
        freeQuota = userRes.rows[0].free_quota;
      }
    }

    let graphData: any = { nodes: [], links: [] };
    let unlockedReports: any[] = [];

    if (userId) {
      graphData = await getGraphData(userId, userRole, dbClient);

      if (userRole === 'admin') {
        const reportsRes = await dbClient.query(
          `SELECT id, title, category, market_region, summary, TRUE AS "isUnlocked" 
           FROM reports 
           ORDER BY created_at DESC 
           LIMIT 10`
        );
        unlockedReports = reportsRes.rows;
      } else {
        const reportsRes = await dbClient.query(
          `SELECT r.id, r.title, r.category, r.market_region, r.summary, TRUE AS "isUnlocked"
           FROM reports r
           JOIN unlocks u ON r.id = u.report_id
           WHERE u.user_id = $1
           ORDER BY u.created_at DESC
           LIMIT 10`,
          [userId]
        );
        unlockedReports = reportsRes.rows;
      }
    }

    return {
      props: {
        graphData,
        userId: userId || '',
        userRole,
        freeQuota,
        unlockedReports
      }
    };
  } catch (err) {
    console.error('SSR 加载个人图谱失败，原因:', err);
    return {
      props: {
        graphData: { nodes: [], links: [] },
        userId: '',
        userRole: 'guest',
        freeQuota: 0,
        unlockedReports: []
      }
    };
  } finally {
    dbClient.release();
  }
};
