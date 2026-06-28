// 演示模式使用的示例图谱数据（20个报告节点 + 20条关系链接）
export const DEMO_GRAPH_DATA = {
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
      summary: '报告显示"宠物人性化"趋势推动了中高端宠物服饰和高耐咬橡胶发声玩具的消费。Dollar General 等渠道对其采购规模连年上涨。'
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
