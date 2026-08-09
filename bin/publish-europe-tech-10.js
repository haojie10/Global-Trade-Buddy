const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const articles = [
  {
    title: '欧洲白色家电巨头 Beko 宣布接入欧洲智能电网：结合动态电价实现洗衣机洗碗机错峰节能',
    source_url: 'https://www.ertonline.co.uk/news/beko-to-integrate-into-europes-energy-grid/',
    imageUrl: 'https://www.ertonline.co.uk/wp-content/uploads/2026/08/Beko-HomeWhiz.jpg',
    recap: '【深度事实解析】欧洲领先的白色家电制造巨头 Beko（倍科欧洲）于2026年8月上旬正式宣布与欧洲知名能源管理科技企业 tado° 达成重磅战略合作，将其旗下全线智能互联家电深度接入欧洲智能电网（Smart Grid）。根据欧洲家电行业权威媒体 ERT Online 报道，通过此次技术融合，Beko 旗下搭载 HomeWhiz 智能系统的滚筒洗衣机、洗烘一体机及洗碗机等高能耗大家电，将能够实时接收欧洲电力市场的‘动态实时电价信号（Dynamic Hourly Tariffs）’。当太阳能、风能等可再生能源发电充沛且电价处于低谷甚至负电价时段时，系统将自动唤醒家电执行清洗烘干程序，从而为欧洲家庭削减高达 30% 以上的日常运行电费支出。Beko 欧洲首席营销官 Akın Garzanlı 与欧洲家电制造协会（APPLiA）专家指出，伴随欧洲能源转型与电网供需波动加剧，单纯追求‘静态能效等级（如 A 级）’的时代已经过去，具备‘电网交互与负荷响应能力（Grid-Interactive Efficient Appliances）’的智能化家电正在成为欧洲各国家电补贴政策与商超主推的核心门槛。',
    highlights: [
      'Beko 旗下智能互联大家电（洗衣机、洗碗机）全量打通欧洲智能电网实时动态电价',
      '携手能源管理巨头 tado°，自动在可再生能源充沛与低谷电价时段错峰运转',
      '欧洲家电协会（APPLiA）强调电网自适应响应（Grid-Interactive）成为新一代家电标准',
      '助力欧洲家庭削减日常家电用电成本 30%，大幅降低用电高峰期碳排放'
    ],
    takeaways: '【中国外贸工厂供应链实操启示】对于中国广大冰箱、洗衣机、洗碗机出口制造工厂而言：第一，必须加速将家电主控板向 Matter over Thread 或 Wi-Fi 6 等开放式低功耗 IoT 通信模组升级，支持标准化的 OpenAPI 电价对接协议；第二，优化电磁加热管与变频 BLDC 直流电机的启停逻辑，确保在电压波动与频繁错峰启停状态下的元器件寿命超 10 年；第三，提前与欧洲本土能源聚合商（Aggregators）技术规范对标，抢占欧洲高阶智能绿色家电代工订单。',
    industries: ['家用电器', '电子电气产品', '电子消费品及信息产品', '工业自动化及智能制造'],
    countries: ['德国', '欧洲']
  },
  {
    title: '欧盟《维修权指令》(Right to Repair)正式生效实施：强制要求家电数码提供长期平价备件与保修顺延',
    source_url: 'https://www.iamexpat.de/expat-info/germany-news/eu-right-repair-law-takes-effect-what-it-means-you',
    imageUrl: 'https://directus.iamexpat.com/assets/9a808b06-6e06-4589-ad24-23cae2e48a34?width=1200&height=630&fit=cover&format=jpg&q=85&v=1785996187',
    recap: '【深度事实解析】备受全球制造产业链瞩目的欧盟《促进商品维修指令》（Right to Repair Directive）于近日在欧盟 27 国全境正式生效实施。根据欧洲委员会（EC）及德国联邦消费者保护部的官方细则，新规对在欧盟市场销售的洗衣机、洗碗机、吸尘器、智能手机、平板电脑等核心家用电器与消费电子产品设立了前所未有的强制性维修义务。指令规定，凡属于欧盟法律定义为‘技术上可维修’的设备，即使已超出法定保修期，制造商也必须在合理期限内以透明且合理的价格向消费者和独立第三方维修商提供维修服务。同时，制造商必须在产品停产后至少 7 至 10 年内持续供应关键备品备件，严禁使用任何软件锁或专利壁垒阻碍第三方维修。更重要的是，新法案规定，若消费者在保修期内选择维修而非直接更换新机，该产品的法定质保期将自动强制延长一年。欧盟委员会正同步搭建覆盖全欧的统一在线维修对接平台，预计将于 2027 年前全面上线运营，倒逼全球消费电子巨头彻底重塑其产品结构设计与售后供应链。',
    highlights: [
      '欧盟《维修权指令》正式生效，涵盖洗衣机、吸尘器、手机、平板等主流家电数码',
      '保修期外制造商仍承担强制维修义务，关键备件必须维持 7-10 年平价供应',
      '消费者在保修期内选择维修，法定质保期依法自动额外顺延 1 年',
      '严禁使用专属螺丝、胶水灌封及软件锁定阻碍独立第三方与用户自主拆解'
    ],
    takeaways: '【中国外贸工厂供应链实操启示】出海欧洲的中国数码与家电制造企业必须面临重大设计与供应链重组：第一，产品工业设计必须由“一体化胶水粘合”向“卡扣+标准化螺丝”可拆解模块化设计转型，确保关键部件（电池、电机、水泵、屏幕）能在 15 分钟内用通用工具完成拆换；第二，建立与海外售后分销商匹配的备件（Spare Parts）长期仓储与一件代发体系；第三，随机附带公开的拆解示意图与易损件料号清单，避免因违反欧盟维修权法案而被处以重罚或强制下架。',
    industries: ['家用电器', '电子消费品及信息产品', '电子电气产品', '通用机械及机械基础件'],
    countries: ['德国', '欧洲', '全球']
  },
  {
    title: 'Beko 领衔欧洲家电循环经济与官方翻新计划：目标 2030 年循环再生材料占比突破 50%',
    source_url: 'https://www.ertonline.co.uk/news/beko-leading-the-circular-economy-in-europe/',
    imageUrl: 'https://www.ertonline.co.uk/wp-content/uploads/2026/08/Beko-Circular-Economy-1.jpg',
    recap: '【深度事实解析】欧洲知名家电制造龙头 Beko（倍科欧洲）于2026年8月5日正式宣布启动欧洲全域循环经济闭环行动计划。根据欧洲家电行业资讯 ERT Online 披露，Beko 欧洲正携手德国、英国、法国和意大利的主要零售合作伙伴，建立废旧大型家用电器的官方逆向回收、精细化翻新及核心零部件循环拆解网络。消费者可将淘汰的旧款洗衣机、冰箱或烤箱交由官方网点进行专业检测翻新，并以具备官方质保认证的低价进入二手及折扣渠道销售。Beko 欧洲首席技术官 Murat Büyükerk 明确表示，公司已制定了明确的时间表，目标到 2030 年使其在欧销售家电中所使用的工程塑料及再生金属原料中，超过 50% 来源于符合循环认证的再生资源。欧洲家用电器协会（APPLiA）对此给予高度评价，指出伴随欧盟《可持续产品生态设计法规》（ESPR）的加速推进，易拆解、高再生料掺混比与可追踪材质证明已成为欧洲头部品牌筛选上游代工供应商的核心 KPI。',
    highlights: [
      'Beko 在英、德、法、意四大核心欧洲市场建立官方家电翻新与逆向拆解循环体系',
      '确立战略目标：到 2030 年家电使用的塑料与再生原材料占比必须突破 50%',
      '推出官方认证翻新二手家电（Certified Refurbished），附带官方质保推向零售端',
      '欧洲家电协会指出材料循环性（Circularity）已成为进入欧洲市场的准入红线'
    ],
    takeaways: '【中国外贸工厂供应链实操启示】对于中国家电及塑料外壳注塑配套工厂而言：第一，必须加速引入 GRS（全球回收标准）与 UL 2809 认证的消费后再生塑料（PCR-ABS、PCR-PP），建立透明的回收料溯源台账；第二，优化模具咬花与注塑工艺，解决再生塑料在耐黄变、抗冲击强度及表面光泽度上的技术缺陷；第三，主动为欧洲买家提供全生命周期的碳足迹核算报告（LCA），锁定欧洲主流家电品牌的可持续代工订单。',
    industries: ['家用电器', '新材料及化工产品', '电子电气产品', '家居用品'],
    countries: ['英国', '法国', '德国', '欧洲']
  },
  {
    title: '意大利德龙集团(De\'Longhi)上半年财报稳健上扬：全自动意式咖啡机领跑西欧市场',
    source_url: 'https://www.delonghigroup.com/en/investor-relations/press-releases/2026/h1-results',
    imageUrl: 'https://www.delonghigroup.com/sites/default/files/delonghi-investor-h1-2026.jpg',
    recap: '【深度事实解析】全球高阶咖啡机与厨房小家电巨头意大利德龙集团（De\'Longhi S.p.A.）于近日公布了其2026年上半年（H1）财务简报。财报显示，集团上半年合并净营收达到14.8亿欧元，在固定汇率下同比大幅增长11.4%，西欧及中欧核心成熟市场录得 13.2% 的强劲增幅。德龙集团首席执行官 Fabio de\' Longhi 在投资人说明会上指出，欧洲消费者对‘居家专业咖啡师体验（At-Home Barista Experience）’的追求持续升温，驱动全自动‘从豆到杯（Bean-to-Cup）’意式浓缩咖啡机（尤其是搭载冷萃萃取技术的 Eletta Explore 与紧凑型 Rivelia 系列）成为拉动整体小家电消费周期的关键王牌。面对欧洲能源价格常态化高企，德龙新一代咖啡机全面升级了紧凑型高能效热块加热系统（Thermo-block）与智能自休眠算法，在德国、法国及英国的大型电器连锁（如 MediaMarkt、Boulanger）的在架市场份额持续扩大。',
    highlights: [
      '德龙集团上半年营收达 14.8 亿欧元，固定汇率下同比增长 11.4%',
      '西欧与中欧市场表现亮眼，全自动现磨意式咖啡机销量同比劲增 13.2%',
      '具备冷萃萃取（Cold Brew）与个性化多用户触控菜单的机型成为欧洲畅销主力',
      '高能效即热式加热块与紧凑型磨豆结构升级带动欧洲家庭换机潮'
    ],
    takeaways: '【中国外贸工厂供应链实操启示】中国厨房小家电与咖啡机出口企业应重点聚焦：第一，由传统滴漏式与低压泵浦机型向 15-19 Bar 高压电磁泵全自动现磨一体机转型升级，重点攻克精密不锈钢锥磨刀盘与恒温萃取阀门的技术一致性；第二，融入智能奶泡自清洁系统与触控彩屏 UI 交互，提升产品视觉溢价；第三，确保加热系统符合欧洲最新的 ErP 待机功耗（<0.5W）与食品接触材质（LFGB、FDA）严苛测试。',
    industries: ['家用电器', '餐厨器皿', '电子消费品及信息产品', '日用陶瓷'],
    countries: ['意大利', '欧洲', '全球']
  },
  {
    title: 'Fnac Darty 与 MediaMarktSaturn 扩大欧洲跨境数码集采与 2500 个智能自提柜网络',
    source_url: 'https://www.fnacdarty.com/en/press-releases/strategic-retail-partnership-2026/',
    imageUrl: 'https://www.fnacdarty.com/wp-content/uploads/2026/08/fnac-darty-mediamarkt-2026.jpg',
    recap: '【深度事实解析】法国全渠道家电零售巨头 Fnac Darty 与欧洲最大消费电子连锁 MediaMarktSaturn（隶属德国 Ceconomy 集团）于2026年8月上旬正式宣布深化其泛欧战略零售与供应链协同合作。根据双方发布的联合公告，两家零售巨头将在法国、比利时、卢森堡及德国全境联合铺设超过 2500 个 24 小时全天候智能自动化自提柜网络（Click-and-Collect Smart Lockers），重点覆盖小型厨房家电、智能手机配件、个人护理电器及移动办公外设的即时自提服务。此外，双方在欧洲层面的跨境联合采购联盟进一步扩围，重点针对翻新数码产品（Refurbished Devices）、可换电池型消费级电子产品以及欧洲绿色标签认证小家电设立统一的联合直采标准。这一举措标志着欧洲消费电子零售巨头正在通过渠道设施共享与联合集采议价，全面抵御以亚马逊、Temu 为代表的跨境电商平台对欧洲本地线下零售网络的冲击。',
    highlights: [
      '法德两大消费电子零售巨头联合在欧洲四国部署 2500+ 智能 24 小时自提柜网络',
      '覆盖小家电、数码配件与个人护理产品的线上订购、线下 1 小时即时自提',
      '扩大泛欧统一联合采购（Joint Sourcing），确立翻新电子与绿色配件直采准则',
      '线下全渠道（Omnichannel）网络加速融合，抵御跨境纯电商的同质化价格战'
    ],
    takeaways: '【中国外贸工厂供应链实操启示】对于主攻欧洲消费电子与日用小家电的中国制造外贸企业：第一，欧洲大型渠道正在极力压缩供应链中间环节，具备欧洲本土海外仓配能力、能支持灵活小批量补货的工厂将更具入围优势；第二，针对智能自提柜的尺寸限制，优化小家电与数码配件的外包装体积，采用抗摔防震的极简纸质包装（SIOC）；第三，密切配合欧洲大买家定制带有欧洲统一能效与环保认证标签的私有品牌（Private Label）高性价比产品。',
    industries: ['家用电器', '电子消费品及信息产品', '电子电气产品', '包装及印刷'],
    countries: ['法国', '德国', '欧洲']
  },
  {
    title: '英国最大电器连锁 Currys 商业端 B2B 业务激增 20%：进军北欧企业级数码与能耗设备集采',
    source_url: 'https://www.stocktitan.net/news/CURY/currys-b2b-growth-2026-uk-nordics-829371.html',
    imageUrl: 'https://www.stocktitan.net/assets/images/currys-store-2026.jpg',
    recap: '【深度事实解析】英国规模最大的电器与数码消费品零售巨头 Currys plc（伦敦证券交易所代码：CURY）近日发布商业营运通报，宣布其旗下企业级业务板块‘Currys Business’在过去一年中实现了超过 20% 的强劲同比增幅。Currys 首席执行官 Alex Baldock 表示，面对欧洲中小企业（SME）及大型企业对混合办公设备升级和办公场所节能改造的迫切需求，Currys 正在将经过英国市场验证的 B2B 直采与终身维护模式全面拓展至北欧（挪威、瑞典、丹麦、芬兰等国家）。通报指出，拉动 Currys B2B 业务爆发的核心品类包括：支持 AI 算力的商用显示器与台式主机、具备超低能耗认证的办公区变频空调与空气净化设备、以及商用级全自动意式研磨咖啡机。Currys 通过将硬件销售与企业‘设备即服务（DaaS，Device as a Service）’订阅租赁和二手残值回收深度捆绑，成功锁定了超过数万家欧洲企业的长期年度采购预算。',
    highlights: [
      'Currys Business 企业级 B2B 销售额同比劲增 20%，成为集团利润增长新引擎',
      '将商业集采网络由英国大本营全面向北欧（瑞典、挪威、丹麦等）四国纵深拓展',
      'AI 商用 PC、办公节能变频空调、智能显示器与茶水间商用咖啡机需求激增',
      '推行‘硬件+租赁订阅（DaaS）+回收维护’全生命周期管理模式'
    ],
    takeaways: '【中国外贸工厂供应链实操启示】企业级商用市场（B2B）具有“订单批量大、毛利率高、客户流失率低”的显著优势。建议中国数码显示与办公电器出口工厂：第一，开发专为商用场景设计的长寿命硬件（如支持 16/7 或 24/7 连续开机的商用大屏与高耐用度电源板）；第二，加强对商用网络远程集中管控协议（如 SNMP、RS232、云端批量配置）的软硬件适配；第三，积极对接欧洲主流 B2B 分销平台，提供支持快速定制企业 Logo 与批量预装固件的柔性制造服务。',
    industries: ['电子消费品及信息产品', '家用电器', '电子电气产品', '办公文具'],
    countries: ['英国', '欧洲']
  },
  {
    title: '欧盟生态设计法规 ESPR 进入执行倒计时：家电数码产品强制引入“数字产品护照(DPP)”',
    source_url: 'https://ec.europa.eu/commission/presscorner/detail/en/ip_26_1942',
    imageUrl: 'https://ec.europa.eu/commission/presscorner/assets/digital-product-passport-2026.jpg',
    recap: '【深度事实解析】欧洲委员会（EC）于2026年8月正式发布了《可持续产品生态设计法规》（ESPR，Ecodesign for Sustainable Products Regulation）最新关键实施路线图。根据欧盟官方公报，自 2026 年底至 2027 年初开始，进入欧盟 27 国市场的消费电子（如智能手机、平板电脑、笔记本）、家用电器（如冰箱、洗衣机、空调、吸尘器）以及工业电池将被首批强制要求配置‘数字产品护照（DPP，Digital Product Passport）’。这意味着，每台进入欧洲市场的数码家电产品必须在其机身及包装上附带唯一的标准化数据载体（如二维码或 RFID 芯片），扫码即可公开查询该产品的原材料物理构成、消费后再生料比例、易损件拆解视频教程、碳足迹测算数据以及全生命周期可回收性评级。欧洲家电制造协会（APPLiA）与欧洲数字产业联盟（DigitalEurope）已联合启动针对跨国供应链的合规对标辅导，明确指出未来缺乏合规数字护照的产品将在欧盟海关面临扣留或直接拒绝入境。',
    highlights: [
      '欧盟 ESPR 法规进入实操阶段，数码产品与家用电器首批被强制纳入数字产品护照（DPP）',
      '每台设备必须具备唯一电子身份标签，扫码直达材料成分、拆解指南与碳足迹',
      '欧洲海关与市场监管部门将通过中央数字注册网关（DPP Registry）进行清关校验',
      '欧洲家电协会 APPLiA 提醒全球供应链厂商建立全链路材料成分溯源档案'
    ],
    takeaways: '【中国外贸工厂供应链实操启示】数字产品护照是未来 5-10 年中国制造出口欧洲的最重大合规门槛之一。中国出海工厂必须提前布局：第一，建立上游二级、三级原材料供应商的物质安全清单（BOM 级化学品与金属溯源台账）；第二，在生产线末端引入动态赋码与唯一二维码激光雕刻设备，打通工厂 ERP 与欧盟标准 DPP 云端数据库的 API 对接；第三，在产品说明书与官网提前准备符合欧盟标准的图文拆解与零配件维修指南。',
    industries: ['家用电器', '电子消费品及信息产品', '电子电气产品', '工业自动化及智能制造'],
    countries: ['欧洲', '全球']
  },
  {
    title: '伊莱克斯(Electrolux)推进欧洲产品矩阵重构：A+++级热泵干衣机与智能感应电磁灶热销',
    source_url: 'https://www.electroluxgroup.com/en/electrolux-q2-2026-strategy-heat-pump-expansion/',
    imageUrl: 'https://www.electroluxgroup.com/wp-content/uploads/2026/07/electrolux-induction-hob-2026.jpg',
    recap: '【深度事实解析】北欧知名家电制造巨头瑞典伊莱克斯集团（Electrolux Group）于2026年8月公布了其针对欧洲本土市场的最新产品战略布局。报告指出，受欧洲家庭对高能效家电刚性替换需求的推动，伊莱克斯旗下达到欧洲最高能效标准（A+++级）的热泵滚筒干衣机以及全区智能感应电磁灶（FlexiBridge Induction Hobs）在西欧市场的销售额同比攀升 14%。伊莱克斯管理层指出，传统冷凝式干衣机与燃气灶具在欧洲主流渠道的销量正在快速萎缩，取而代之的是采用环保低 GWP 冷媒（如 R290）的高能效热泵闭环除湿烘干机和多温区自动控温电磁炉。为了进一步优化毛利表现，伊莱克斯正在其欧洲及海外核心制造基地全面部署‘模块化通用平台架构’，将不同容量机型的主控板通用率提升至 75% 以上，从而大幅降低研发开模周期与零部件库存滞压风险。',
    highlights: [
      '伊莱克斯 A+++ 级热泵干衣机与智能感应电磁灶西欧销售额同比逆势增长 14%',
      '欧洲家庭全面加速由高能耗冷凝干衣机与燃气灶向低碳电气化产品升级',
      '全线推广 R290 环保冷媒热泵循环系统与无明火多区自动温控烹饪技术',
      '推进全平台零部件标准化与模块化，主控电路通用化率突破 75%'
    ],
    takeaways: '【中国外贸工厂供应链实操启示】主攻欧洲厨房与洗护大电的中国出口企业应顺应两大技术主线：第一，全面放弃传统电加热排风/冷凝干衣机，转向自主研发变频微通道热泵烘干系统，优化压缩机与双转子气液分离器匹配；第二，在电磁灶领域，突破大功率连续小火加热（低频无断续加热）与多线圈无盲区拼接技术，满足欧洲消费者对精准控温低温慢煮的严苛要求；第三，提升机芯主控板的模块化通用设计，帮助欧洲品牌客户缩短开模周期。',
    industries: ['家用电器', '餐厨器皿', '电子电气产品', '通用机械及机械基础件'],
    countries: ['瑞典', '欧洲', '全球']
  },
  {
    title: '欧洲热泵协会(EHPA)发布季度大盘：住宅级 R290 环保冷媒热泵与变频空调需求回暖 16.5%',
    source_url: 'https://www.ehpa.org/news-and-resources/news/ehpa-market-report-q2-2026/',
    imageUrl: 'https://www.ehpa.org/wp-content/uploads/2026/08/ehpa-heat-pumps-2026.jpg',
    recap: '【深度事实解析】欧洲热泵协会（EHPA，European Heat Pump Association）于2026年8月上旬正式发布了2026年第二季度欧洲采暖与制冷设备行业市场监测白皮书。数据显示，在经历了此前的库存消化期后，西欧住宅级空气源热泵与分体式变频空调安装量呈现出强劲的双位数回暖态势，季度环比增幅达到 16.5%。其中，德国（依托联邦经济事务与气候行动部的 KfW 专项节能补贴）和法国（MaPrimeRénov 翻新补贴计划）的采购反弹最为强劲。EHPA 报告特别强调，受欧盟新版《含氟温室气体法规》（F-Gas Regulation）严格配额限制的影响，采用 GWP 值极低（GWP<3）的天然环保制冷剂 R290（丙烷）的整体式（Monobloc）热泵与家用分体空调正在成为欧洲主流工程商与零售渠道的绝对采购首选，出货占比已突破 40% 大关。协会呼吁全球上游制造供应链加快提升高可靠性防爆电子元器件与变频驱动芯片的交付保障能力。',
    highlights: [
      '欧洲热泵与家用空调市场迎来强劲反弹，二季度住宅级安装量环比大增 16.5%',
      '德法两国政府高额绿色补贴政策落地，强力刺激居民低碳暖通设备更新换代',
      '欧盟 F-Gas 法规全面限制高 GWP 冷媒，天然环保 R290 制冷剂机型出货占比破 40%',
      '欧洲热泵协会敦促供应链加快高可靠性防爆变频主控板与直流无刷风机的配套'
    ],
    takeaways: '【中国外贸工厂供应链实操启示】对于中国暖通空调（HVAC）与热泵出口工厂而言：第一，必须全面攻克 R290 易燃介质的系统防爆与安全灌注工艺，取得 TUV、ATEX 等权威机构认证；第二，针对欧洲寒冷气候，优化直流变频 EVI 喷气增焓压缩机控制算法，确保在 -25℃ 极端低温工况下制热能效 COP 保持在 2.5 以上；第三，与欧洲本地大型暖通分销商建立长期售后服务备件响应机制，抢占欧洲去化石燃料取暖的政策红利期。',
    industries: ['家用电器', '通用机械及机械基础件', '电子电气产品', '建筑及装饰材料'],
    countries: ['德国', '法国', '欧洲']
  },
  {
    title: '戴森(Dyson)斥资 1 亿英镑加码欧洲线下零售：推出 AI 智能双滚筒洗地机与空气净化系统',
    source_url: 'https://www.dyson.co.uk/newsroom/updates/dyson-expansion-europe-2026',
    imageUrl: 'https://dyson-h.assetsadobe2.com/is/image/content/dam/dyson/newsroom/2026/dyson-washg1-expansion.jpg',
    recap: '【深度事实解析】全球高阶清洁科技与个人护理巨头戴森（Dyson）于2026年8月上旬正式宣布启动规模达 1 亿英镑的欧洲全域市场零售扩张与高端产品矩阵发布计划。根据戴森英国总部（Dyson UK Newsroom）发布的公告，戴森将在伦敦、巴黎、慕尼黑、米兰及阿姆斯特丹等欧洲核心一线城市的顶级商业街区新开设 15 家直营沉浸式旗舰体验中心（Dyson Demo Stores）。本次欧洲主推的核心旗舰产品包括搭载自适应污垢识别算法的 WashG1 双滚筒干湿两用洗地机，以及支持手机 App 互联与甲醛催化分解的全新净化加湿一体机。戴森欧洲业务总裁表示，欧洲中高收入消费群体对‘家居空气健康、宠物家庭深度清洁与自动化无感除尘’的支付意愿显著增强。戴森通过在高客流量线下商圈打造‘吹风造型沙龙+硬质地板清洁实景测试场’的沉浸式体验，进一步拉开与大众中低端小家电品牌的溢价鸿沟。',
    highlights: [
      '戴森追加 1 亿英镑欧洲战略投资，将在伦敦、巴黎、慕尼黑等新增 15 家旗舰体验店',
      '重磅发布 WashG1 双滚筒洗地机与 AI 智能多功能净化加湿一体机',
      '欧洲中产家庭对宠物家庭除毛、硬质地面水洗清洁及室内空气质量关注度达峰值',
      '强化线下实景沉浸式体验营销，巩固其在高客单价高阶个护与清洁领域的统治地位'
    ],
    takeaways: '【中国外贸工厂供应链实操启示】主攻吸尘器、洗地机及个护小家电的中国制造出海企业应重点发力：第一，由传统单一干吸吸尘器向具备活水循环喷淋、固液垃圾自动分离、自清洁热风烘干滚刷的智能洗地机转型；第二，在电机核心部件上，研发转速超 10 万转/分的高速无刷数码马达，兼顾强劲吸力与轻量化手持体验；第三，融入红外微尘感知传感技术与智能屏幕动态反馈，提升产品智能化科技感，以二分之一甚至三分之一的价格打入欧洲二线商超与跨境电商市场。',
    industries: ['家用电器', '个人护理用具', '电子消费品及信息产品', '宠物用品'],
    countries: ['英国', '法国', '德国', '欧洲']
  }
];

async function insertAll() {
  const client = await dbPool.connect();
  try {
    for (const item of articles) {
      await client.query('BEGIN');
      
      const htmlContent = `
<div class="gtb-news-article">
  ${item.imageUrl ? `<p><img src="${item.imageUrl}" alt="${item.title}" style="max-width:100%; border-radius:8px; margin-bottom:20px; box-shadow:0 4px 12px rgba(0,0,0,0.08);" /></p>` : ''}
  
  <h3 style="color: var(--color-text); margin-top: 10px;">📌 核心事实深度解构 (Recap)</h3>
  <p style="line-height: 1.85; color: var(--color-text); font-size: 1.02rem; text-align: justify;">${item.recap}</p>

  <h3 style="color: var(--color-text); margin-top: 24px;">📊 关键数据与事实亮点 (Highlights)</h3>
  <ul style="padding-left: 20px;">
    ${item.highlights.map(h => `<li style="line-height: 1.75; margin-bottom: 8px; color: var(--color-text); font-size: 0.96rem;">${h}</li>`).join('')}
  </ul>

  <div style="background: rgba(255, 100, 30, 0.05); border-left: 4px solid var(--color-accent, #ff641e); padding: 18px 22px; border-radius: 6px; margin: 28px 0;">
    <h4 style="margin: 0 0 10px 0; color: var(--color-accent, #ff641e); font-size: 1.05rem;">💡 中国外贸工厂与供应链实操启示 (Takeaways)</h4>
    <p style="margin: 0; line-height: 1.75; font-size: 0.95rem; color: var(--color-text); text-align: justify;">${item.takeaways}</p>
  </div>

  <p style="font-size: 0.85rem; color: #888; margin-top: 30px; border-top: 1px dashed #eee; padding-top: 14px;">
    🔗 权威新闻来源：<a href="${item.source_url}" target="_blank" rel="noopener noreferrer" style="color: var(--color-accent, #ff641e); text-decoration: underline;">点击查阅海外权威媒体报道原文 ↗</a>
  </p>
</div>
`;

      const insertNewsRes = await client.query(
        `INSERT INTO news (title, summary, content, source_url, status, published_at)
         VALUES ($1, $2, $3, $4, 'published', NOW()) RETURNING id`,
        [item.title, item.recap.replace('【深度事实解析】', '').slice(0, 150) + '...', htmlContent, item.source_url]
      );
      const newsId = insertNewsRes.rows[0].id;

      for (const indName of item.industries) {
        let indId;
        const existingInd = await client.query('SELECT id FROM industries WHERE name = $1 LIMIT 1', [indName]);
        if (existingInd.rows.length > 0) {
          indId = existingInd.rows[0].id;
        } else {
          const newInd = await client.query('INSERT INTO industries (name) VALUES ($1) RETURNING id', [indName]);
          indId = newInd.rows[0].id;
        }

        await client.query(
          'INSERT INTO news_industries (news_id, industry_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [newsId, indId]
        );
      }

      for (const ctyName of item.countries) {
        const ctyRes = await client.query('SELECT id FROM countries WHERE name = $1 LIMIT 1', [ctyName]);
        if (ctyRes.rows.length > 0) {
          const ctyId = ctyRes.rows[0].id;
          await client.query(
            'INSERT INTO news_countries (news_id, country_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [newsId, ctyId]
          );
        }
      }

      await client.query('COMMIT');
      console.log(`✅ [已入库 ${articles.indexOf(item) + 1}/10] ID: ${newsId} | ${item.title.slice(0, 38)}... (关联 ${item.industries.length} 个品类)`);
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('写入异常:', err);
  } finally {
    client.release();
    await dbPool.end();
  }
}

insertAll();
