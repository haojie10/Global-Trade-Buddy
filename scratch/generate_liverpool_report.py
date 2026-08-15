#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import base64
import json
import urllib.request

# 1. 准备 Base64 门店横幅图片
img_path = "/Users/jason/.gemini/antigravity/brain/def0b871-82ec-43f8-9dbd-290dde9be305/liverpool_storefront_1786759259930.jpg"
if os.path.exists(img_path):
    with open(img_path, "rb") as f:
        banner_b64 = "data:image/jpeg;base64," + base64.b64encode(f.read()).decode("utf-8")
else:
    banner_b64 = ""

html_content = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>家用电器-El Puerto de Liverpool-墨西哥-企业洞察报告</title>

    <meta name="category" content="customer">
    <meta name="summary" content="墨西哥百年零售巨头 El Puerto de Liverpool (LIVEPOL) 360°企业战略情报洞察报告。深度穿透其2148亿比索营收、Liverpool中高端百货与Suburbia大众平价双业态、Haus等自有品牌矩阵、NOM认证与SMETA合规准入及中国供应商出海合作路径。">
    <meta name="company_name" content="El Puerto de Liverpool">
    <meta name="company_aliases" content="Liverpool, 利物浦百货, LIVEPOL, Suburbia">
    <meta name="company_website" content="https://www.liverpool.com.mx">
    <meta name="competitors" content="El Palacio de Hierro, Sears Mexico, Coppel, Sanborns">
    <meta name="products" content="家用电器, 餐厨器皿, 家居用品, 男女装, 箱包">
    <meta name="regions" content="墨西哥">
    <meta name="channels" content="">
    <meta name="suppliers" content="Samsung, Sony, Whirlpool, Midea, Oster, T-fal">
    <meta name="customers" content="">
    <meta name="sister_parents" content="Suburbia, Galerías">

    <!-- CDN 依赖 -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
    <script src="https://unpkg.com/lucide@latest"></script>

    <style>
        :root {{
            --bg-main: #fdfbf7;
            --bg-sub: #f6f3ec;
            --color-accent: #ff641e;
            --color-text: #3c3935;
            --color-muted: #7a756f;
            --radius-card: 22px;
            --radius-sub: 16px;
            --radius-tag: 12px;
            --shadow-default: 0 4px 12px rgba(160, 109, 68, 0.03);
            --shadow-hover: 0 6px 16px rgba(160, 109, 68, 0.08);
        }}
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: var(--bg-main); color: var(--color-text); font-weight: 400;
            line-height: 1.6; scroll-behavior: smooth;
        }}
        .sand-card {{
            background: var(--bg-sub); border: 1px solid rgba(160, 109, 68, 0.08);
            border-radius: var(--radius-card); box-shadow: var(--shadow-default);
        }}
        .sand-card-sub {{
            background: var(--bg-main); border: 1px solid rgba(160, 109, 68, 0.08);
            border-radius: var(--radius-sub);
        }}
        .report-tag {{
            background: rgba(160, 109, 68, 0.05); color: var(--color-text);
            border: 1px solid rgba(160, 109, 68, 0.15); padding: 4px 10px;
            border-radius: var(--radius-tag); font-size: 0.75rem; font-weight: 500; display: inline-block;
        }}
        .sand-btn {{
            background: var(--bg-sub); border: none; border-radius: var(--radius-card);
            color: var(--color-accent); padding: 10px 24px; font-weight: 300;
            box-shadow: var(--shadow-default);
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); cursor: pointer; font-size: 0.85rem;
        }}
        .sand-btn:hover {{ background: var(--bg-main); box-shadow: var(--shadow-hover); transform: translateY(-1px); }}
        h2 {{ font-size: 1.25rem; font-weight: 400; letter-spacing: -0.01em; }}
        h3 {{ font-size: 0.95rem; font-weight: 400; }}
        .text-accent {{ color: var(--color-accent); }}
        .text-muted {{ color: var(--color-muted); }}
        .section-accent {{ border-left: 3px solid var(--color-accent); padding-left: 14px; }}
        .legend-customer {{ color: #ff641e; }}
        .legend-product {{ color: #7a756f; }}
        .chart-container {{ height: 350px; width: 100%; }}
        .tier-tag {{ background: var(--color-accent); }}
    </style>
</head>
<body>

    <!-- Main Content -->
    <main>

    <!-- ====== 店面横幅 ====== -->
    <div class="w-full overflow-hidden aspect-[21/9] max-h-[250px] border-b border-[rgba(160,109,68,0.08)] relative group">
        <img src="{banner_b64}" class="w-full h-full object-cover object-center" alt="El Puerto de Liverpool Department Store">
        <div class="absolute inset-0 bg-gradient-to-t from-[#3c3935]/30 via-transparent to-transparent"></div>
        <div class="absolute bottom-4 left-8 text-white z-10">
            <span class="bg-[#ff641e] text-white text-[10px] uppercase font-semibold px-2 py-0.5 rounded tracking-wider">墨西哥 · 墨西哥城 Santa Fe 总部</span>
            <h3 class="text-xl font-bold mt-1 drop-shadow-md text-white">El Puerto de Liverpool 旗舰百货全渠道商业网络</h3>
        </div>
    </div>

        <!-- ====== 吸顶标题栏 ====== -->
        <header class="sticky top-0 z-40 bg-[#fdfbf7] border-b border-[rgba(160,109,68,0.08)] shadow-[0_4px_12px_rgba(160,109,68,0.03)] px-6 py-2">
            <div class="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-1">
                <div>
                    <div class="flex items-center gap-2 mb-1">
                        <span class="tier-tag text-[10px] text-white font-bold px-2 py-0.5 rounded" style="background:#ff641e;">Tier-1 核心零售巨头</span>
                        <span class="report-tag">BMV: LIVEPOL</span>
                    </div>
                    <h2 class="text-xl font-bold text-[#3c3935] tracking-tight">El Puerto de Liverpool 企业全维战略情报报告</h2>
                    <p class="text-[#7a756f] text-xs mt-0.5">覆盖 124+ 百货店 · 194+ Suburbia · 29+ 购物中心 · 2,148 亿比索营业体量</p>
                </div>
                <div class="flex items-center gap-4">
                    <div class="flex flex-col items-end gap-0.5">
                        <span class="text-xs text-[#7a756f] font-medium">Powered by</span>
                        <span class="text-sm font-semibold text-[#ff641e] tracking-tight">Market Graphic</span>
                    </div>
                </div>
            </div>
        </header>

        <!-- ====== 报告正文容器 ====== -->
        <div class="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">

            <!-- ═══════════ Section 1: 企业全景概览 ═══════════ -->
            <section id="overview" class="scroll-mt-12">
                <div class="flex items-center gap-3 mb-6">
                    <div class="p-2 bg-[#f6f3ec] text-[#ff641e] rounded-lg"><i data-lucide="globe" size="24"></i></div>
                    <h3 class="text-2xl font-bold text-[#3c3935]">1. 企业全景概览 (Overview)</h3>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="md:col-span-2 sand-card p-8 leading-relaxed text-[#3c3935] space-y-4 text-sm">
                        <p>
                            <strong>El Puerto de Liverpool, S.A.B. de C.V.</strong>（简称 Liverpool，墨西哥证券交易所代码：<code>LIVEPOL</code>）创立于 1847 年，拥有接近 180 年的悠久历史，总部位于墨西哥城 Santa Fe 高新技术与金融商务区。作为墨西哥综合实力最强、历史最悠久的中高端全渠道百货集团与商业地产开发商，Liverpool 在墨西哥零售生态中占据无可撼动的领军地位。
                        </p>
                        <p>
                            在最新财年（2024），集团实现了合并营业收入 <strong>2,148.48 亿墨西哥比索（约合 118 亿美元 / 855 亿元人民币）</strong>，较上年增长 9.6%；全年息税折旧摊销前利润（EBITDA）达 <strong>375.58 亿墨西哥比索（约 20.6 亿美元）</strong>，营业利润突破 318.5 亿比索，展现出极为稳健的盈利能力和抗周期韧性。
                        </p>
                        <p>
                            集团旗下构建了由 <strong>Liverpool 核心高端百货</strong>（124 家标准旗舰店 + 40 家轻量化 Liverpool Express）、<strong>Suburbia 大众服饰平价商场</strong>（194 家门店）、<strong>Galerías 连锁购物中心</strong>（29 座大型购物中心）以及超 115 家国际精品专卖店（包括在墨独家特许运营 GAP、Williams-Sonoma、Pottery Barn、Banana Republic 等，以及与西班牙英国宫 El Corte Inglés 深度合资运营 Sfera）组成的立体化商业矩阵。同时，其发行的联名信用卡体系（Liverpool/Suburbia Cards）活跃持卡人超 780 万，贡献了超 190 亿比索的消费信贷净收益，是驱动高客单价消费的核心金融引擎。
                        </p>

                        <!-- 子模块：注册信息表 -->
                        <div class="mt-6">
                            <h4 class="font-bold text-[#3c3935] mb-3 flex items-center gap-1.5"><i data-lucide="building" size="16" class="text-[#ff641e]"></i> 法人实体与注册信息</h4>
                            <div class="overflow-x-auto">
                                <table class="w-full text-xs text-left border-collapse border border-[rgba(160,109,68,0.1)]">
                                    <tbody>
                                        <tr class="border-b border-[rgba(160,109,68,0.08)] bg-[#fdfbf7]">
                                            <td class="p-2 font-semibold text-[#7a756f] w-1/4">公司法定全称</td>
                                            <td class="p-2">El Puerto de Liverpool, S.A.B. de C.V.</td>
                                            <td class="p-2 font-semibold text-[#7a756f] w-1/4">股票代码 / 交易所</td>
                                            <td class="p-2">LIVEPOL / 墨西哥证券交易所 (BMV)</td>
                                        </tr>
                                        <tr class="border-b border-[rgba(160,109,68,0.08)]">
                                            <td class="p-2 font-semibold text-[#7a756f]">总部法定地址</td>
                                            <td class="p-2">Mario Pani 200, Col. Santa Fe, Cuajimalpa, CDMX 05348, México</td>
                                            <td class="p-2 font-semibold text-[#7a756f]">官方官方网站</td>
                                            <td class="p-2"><a href="https://www.liverpool.com.mx" target="_blank" class="text-[#ff641e] hover:underline">www.liverpool.com.mx</a></td>
                                        </tr>
                                        <tr class="border-b border-[rgba(160,109,68,0.08)] bg-[#fdfbf7]">
                                            <td class="p-2 font-semibold text-[#7a756f]">首席执行官 (CEO)</td>
                                            <td class="p-2">Graciano F. Guichard González</td>
                                            <td class="p-2 font-semibold text-[#7a756f]">物流中枢核心</td>
                                            <td class="p-2">Plataforma Logística Arco Norte (PLAN Jilotepec)</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- 子模块：品牌矩阵 -->
                        <div class="mt-6">
                            <h4 class="font-bold text-[#3c3935] mb-3 flex items-center gap-1.5"><i data-lucide="layers" size="16" class="text-[#ff641e]"></i> 自有品牌与战略矩阵</h4>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                <div class="sand-card-sub p-3 border border-[rgba(160,109,68,0.08)]">
                                    <div class="font-bold text-[#ff641e] mb-1">Haus / Haus Cook</div>
                                    <p class="text-[#7a756f]">家居用品、餐厨器皿、厨房小家电核心自有品牌，重点对接中国 ODM/OEM 贴牌直采。</p>
                                </div>
                                <div class="sand-card-sub p-3 border border-[rgba(160,109,68,0.08)]">
                                    <div class="font-bold text-[#ff641e] mb-1">That's It / MAP</div>
                                    <p class="text-[#7a756f]">男女装、青年潮流服饰、职场通勤装，兼顾高性价比与现代设计美学。</p>
                                </div>
                                <div class="sand-card-sub p-3 border border-[rgba(160,109,68,0.08)]">
                                    <div class="font-bold text-[#ff641e] mb-1">Mon Caramel / Petite Studio</div>
                                    <p class="text-[#7a756f]">婴童服饰、母婴用品及女性小个子轻奢时尚系列。</p>
                                </div>
                                <div class="sand-card-sub p-3 border border-[rgba(160,109,68,0.08)]">
                                    <div class="font-bold text-[#ff641e] mb-1">Weekend / Non Stop (Suburbia)</div>
                                    <p class="text-[#7a756f]">针对大众工薪家庭的基础休闲装与大众日用品，主打极致走量与高翻转率。</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="space-y-6">
                        <div class="sand-card p-6 text-xs">
                            <h4 class="font-bold text-[#3c3935] mb-4 flex items-center gap-2"><i data-lucide="history" size="18" class="text-[#ff641e]"></i> 发展里程碑</h4>
                            <ul class="space-y-3 border-l-2 border-[rgba(160,109,68,0.15)] pl-4">
                                <li>
                                    <span class="font-bold text-[#ff641e]">1847 年</span>
                                    <p class="text-[#7a756f]">Jean-Baptiste Ebrard 在墨西哥城市中心创办服装布料批发布庄。</p>
                                </li>
                                <li>
                                    <span class="font-bold text-[#ff641e]">1936 年</span>
                                    <p class="text-[#7a756f]">在墨西哥城落成首座配备自动扶梯的现代化大型综合百货大楼。</p>
                                </li>
                                <li>
                                    <span class="font-bold text-[#ff641e]">1965 年</span>
                                    <p class="text-[#7a756f]">在墨西哥证券交易所（BMV）挂牌上市，开启资本驱动全国扩张。</p>
                                </li>
                                <li>
                                    <span class="font-bold text-[#ff641e]">2016 年</span>
                                    <p class="text-[#7a756f]">以 190 亿比索全资收购沃尔玛旗下 Suburbia 连锁百货，完善大众消费拼图。</p>
                                </li>
                                <li>
                                    <span class="font-bold text-[#ff641e]">2022-2024 年</span>
                                    <p class="text-[#7a756f]">投建拉美最大物流中枢 Arco Norte (PLAN)；全资/战略参股美国 Nordstrom 百货。</p>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            <!-- ═══════════ Section 2: 财务深度穿透 ═══════════ -->
            <section id="finance" class="scroll-mt-16">
                <div class="flex items-center gap-3 mb-6">
                    <div class="p-2 bg-[#f6f3ec] text-[#ff641e] rounded-lg"><i data-lucide="trending-up" size="24"></i></div>
                    <h3 class="text-2xl font-bold text-[#3c3935]">2. 财务深度穿透与业务构成 (Financials)</h3>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="sand-card p-6 md:col-span-2">
                        <h4 class="font-bold text-[#3c3935] mb-4">2024 财年业务板块营业收入结构 (千比索 / MXN '000)</h4>
                        <div id="financeChart1" class="chart-container"></div>
                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center mt-4 text-xs">
                            <div class="p-2 sand-card-sub">
                                <div class="text-[#7a756f]">Liverpool 商业</div>
                                <div class="font-bold text-[#ff641e]">1,670 亿比索</div>
                                <div class="text-[10px] text-[#7a756f]">占比 77.7%</div>
                            </div>
                            <div class="p-2 sand-card-sub">
                                <div class="text-[#7a756f]">Suburbia 商业</div>
                                <div class="font-bold text-[#ff641e]">237 亿比索</div>
                                <div class="text-[10px] text-[#7a756f]">占比 11.0%</div>
                            </div>
                            <div class="p-2 sand-card-sub">
                                <div class="text-[#7a756f]">消费信贷金融</div>
                                <div class="font-bold text-[#ff641e]">193 亿比索</div>
                                <div class="text-[10px] text-[#7a756f]">占比 9.0%</div>
                            </div>
                            <div class="p-2 sand-card-sub">
                                <div class="text-[#7a756f]">商业地产租赁</div>
                                <div class="font-bold text-[#ff641e]">48.6 亿比索</div>
                                <div class="text-[10px] text-[#7a756f]">占比 2.3%</div>
                            </div>
                        </div>
                    </div>
                    <div class="sand-card p-6 flex flex-col justify-between text-xs space-y-4">
                        <div>
                            <h4 class="font-bold text-[#3c3935] mb-3 flex items-center gap-1.5"><i data-lucide="pie-chart" size="16" class="text-[#ff641e]"></i> 关键财务指标解读</h4>
                            <ul class="space-y-2 text-[#7a756f]">
                                <li>• <strong>合并营业额</strong>：214,847,871 千比索 (+9.6% YoY)</li>
                                <li>• <strong>EBITDA 利润率</strong>：17.5%（37,557,544 千比索）</li>
                                <li>• <strong>零售综合毛利率</strong>：31.8%</li>
                                <li>• <strong>净负债率 (Net Debt/EBITDA)</strong>：处于 0.8x 的极低健康区间</li>
                            </ul>
                        </div>
                        <div class="p-3 bg-[#fdfbf7] border border-[rgba(160,109,68,0.1)] rounded-xl leading-relaxed">
                            <span class="font-bold text-[#ff641e]">财务战略洞察：</span> Liverpool 展现出“零售商品流通 + 高毛利自有消费金融”双轮驱动的强大变现护城河，为其在亚洲供应链的采购付款周期与资金周转提供了高等级信用保障。
                        </div>
                    </div>
                </div>
            </section>

            <!-- ═══════════ Section 3: 渠道结构与终端网络 ═══════════ -->
            <section id="channel" class="scroll-mt-16">
                <div class="flex items-center gap-3 mb-6">
                    <div class="p-2 bg-[#f6f3ec] text-[#ff641e] rounded-lg"><i data-lucide="store" size="24"></i></div>
                    <h3 class="text-2xl font-bold text-[#3c3935]">3. 渠道网络与门店业态 (Retail Formats)</h3>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="sand-card p-6 md:col-span-2">
                        <h4 class="font-bold text-[#3c3935] mb-4">核心业态门店数量分布格局</h4>
                        <div id="channelChart" class="chart-container"></div>
                    </div>
                    <div class="sand-card p-6 text-xs space-y-4">
                        <h4 class="font-bold text-[#3c3935] flex items-center gap-1.5"><i data-lucide="map-pin" size="16" class="text-[#ff641e]"></i> 渠道渗透优势</h4>
                        <p class="text-[#7a756f]">
                            Liverpool 门店广泛覆盖墨西哥全部 32 个联邦实体州。核心百货店面积通常在 15,000 ~ 25,000 ㎡，占据各大城市顶级商圈。
                        </p>
                        <p class="text-[#7a756f]">
                            轻量化 <strong>Liverpool Express</strong> 正在迅速下沉至 3-4 线新兴市镇；而 <strong>Suburbia</strong> 则全面占领工薪阶层生活圈，构建起阶梯式用户消费全覆盖。
                        </p>
                    </div>
                </div>
            </section>

            <!-- ═══════════ Section 4: 供应链布局与准入合规 ═══════════ -->
            <section id="supply" class="scroll-mt-16">
                <div class="flex items-center gap-3 mb-6">
                    <div class="p-2 bg-[#f6f3ec] text-[#ff641e] rounded-lg"><i data-lucide="shield-check" size="24"></i></div>
                    <h3 class="text-2xl font-bold text-[#3c3935]">4. 供应链布局与准入合规 (Supply Chain & Compliance)</h3>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="sand-card p-6 md:col-span-2">
                        <h4 class="font-bold text-[#3c3935] mb-4">对华大宗商品及小家电采购估值趋势 (百万美元 / USD Million)</h4>
                        <div id="supplyChart" class="chart-container"></div>
                        <div class="mt-4 text-xs text-[#7a756f] leading-relaxed">
                            <p>Liverpool 每年直接与间接从中国采购超 6 亿美元的家电、家居用品、餐厨器皿及纺织服装。其位于墨西哥 Jilotepec 的 <strong>Arco Norte 物流中枢 (PLAN)</strong> 占地 188 公顷，是承接亚洲进口集装箱拆柜分拣与全国配送的核心大脑。</p>
                        </div>
                    </div>
                    <div class="sand-card p-6 flex flex-col justify-between text-xs space-y-4">
                        <div>
                            <h4 class="font-bold text-[#3c3935] mb-3 flex items-center gap-1.5"><i data-lucide="alert-triangle" size="16" class="text-[#ff641e]"></i> 准入强制红线</h4>
                            <ul class="space-y-2 text-[#7a756f]">
                                <li>• <strong>NOM 强制认证</strong>：小家电必须通过 NOM-003-SCFI 安全与 NOM-032-ENER 能效认证。</li>
                                <li>• <strong>西语标签规范</strong>：遵循 NOM-050-SCFI / NOM-024-SCFI 西班牙语铭牌与说明书规范。</li>
                                <li>• <strong>社会责任验厂</strong>：必须具备 SMETA (4-Pillars) 或 BSCI (Grade C/B 以上) 审计报告。</li>
                                <li>• <strong>ESG 与环保要求</strong>：加入“La Huella”采购责任倡议，禁用有害塑化剂。</li>
                            </ul>
                        </div>
                        <div class="p-3 bg-[#fdfbf7] border border-[rgba(160,109,68,0.1)] rounded-xl">
                            <strong>物流口岸提示：</strong> 中国至墨西哥海运集装箱首选到达 <strong>曼萨尼约港 (Manzanillo)</strong> 或拉萨罗卡德纳斯港 (Lázaro Cárdenas)，经铁路/公路直达 Arco Norte 枢纽，海运周期约 18~24 天。
                        </div>
                    </div>
                </div>
            </section>

            <!-- ═══════════ Section 5: 中国供应商实战策略 ═══════════ -->
            <section id="strategy" class="scroll-mt-16">
                <div class="flex items-center gap-3 mb-6">
                    <div class="p-2 bg-[#f6f3ec] text-[#ff641e] rounded-lg"><i data-lucide="compass" size="24"></i></div>
                    <h3 class="text-2xl font-bold text-[#3c3935]">5. 中国出口供应商攻坚战术 (Strategy for Suppliers)</h3>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
                    <div class="sand-card p-6 space-y-3">
                        <div class="p-2 bg-[#fdfbf7] rounded-lg w-fit text-[#ff641e] font-bold">路径一：自有品牌 OEM 直采</div>
                        <h4 class="font-bold text-[#3c3935] text-sm">切入 Haus 厨电与家居产品线</h4>
                        <p class="text-[#7a756f] leading-relaxed">
                            主攻其自有品牌 Haus 及 Haus Cook，提供高颜值、反堆料耐酸涂层（如适应墨西哥番茄红米饭烹饪的陶瓷釉电饭煲）的高性价比产品，由香港/深圳贸易办事处或外贸大代理进行 FOB 申报。
                        </p>
                    </div>
                    <div class="sand-card p-6 space-y-3">
                        <div class="p-2 bg-[#fdfbf7] rounded-lg w-fit text-[#ff641e] font-bold">路径二：Marketplace 平台入驻</div>
                        <h4 class="font-bold text-[#3c3935] text-sm">利用 Liverpool 电商平台轻量试水</h4>
                        <p class="text-[#7a756f] leading-relaxed">
                            入驻 Liverpool.com.mx 跨境卖家计划（Marketplace），采用墨西哥本土前置仓代发（3PL）或直邮模式，快速测款并累积本土用户口碑数据。
                        </p>
                    </div>
                    <div class="sand-card p-6 space-y-3">
                        <div class="p-2 bg-[#fdfbf7] rounded-lg w-fit text-[#ff641e] font-bold">路径三：合规前置与认证包办</div>
                        <h4 class="font-bold text-[#3c3935] text-sm">提前准备 NOM 与 127V 60Hz 规格</h4>
                        <p class="text-[#7a756f] leading-relaxed">
                            中国工厂需提前完成 ANCE/NYCE 实验室的 NOM-003-SCFI 测试，提供完备西语说明书与包装箱容率优化设计，大幅缩短买手接洽到首单落地的审查周期。
                        </p>
                    </div>
                </div>
            </section>

        </div>

        <!-- ====== 页脚与版权 ====== -->
        <footer class="mt-16 py-8 border-t border-[rgba(160,109,68,0.08)] bg-[#f6f3ec] text-center text-xs text-[#7a756f]">
            <p>数据来源：El Puerto de Liverpool 官方年报与财报披露、墨西哥经济部公开数据、海关提单与合规数据库</p>
            <p class="mt-2 font-medium">本报告由 Market Graphic 生成并提供研究支持 © 2026 Market Graphic. 保留所有权利。</p>
        </footer>
    </main>

    <script>
        lucide.createIcons();

        // ===== 图表初始化 =====
        const initCharts = () => {{
            if (typeof echarts === 'undefined') {{
                console.warn('ECharts 未加载，跳过图表渲染');
                return;
            }}

            // --- 图表 1: 财务数据 (环形图) ---
            const chart1Dom = document.getElementById('financeChart1');
            if (chart1Dom) {{
                const chart1 = echarts.init(chart1Dom);
                chart1.setOption({{
                    tooltip: {{ trigger: 'item', formatter: '{{b}}: {{c}} 千比索 ({{d}}%)' }},
                    legend: {{ bottom: '5%', left: 'center', textStyle: {{ color: '#3c3935' }} }},
                    color: ['#ff641e', '#e05316', '#7a756f', '#c4beb6'],
                    series: [{{
                        name: '业务营收',
                        type: 'pie',
                        radius: ['45%', '70%'],
                        avoidLabelOverlap: false,
                        itemStyle: {{ borderRadius: 8, borderColor: '#fdfbf7', borderWidth: 2 }},
                        label: {{ show: false, position: 'center' }},
                        emphasis: {{
                            label: {{ show: true, fontSize: 14, fontWeight: 'bold', formatter: '{{b}}\\n{{d}}%' }}
                        }},
                        labelLine: {{ show: false }},
                        data: [
                            {{ value: 167017151, name: 'Liverpool 商业' }},
                            {{ value: 23708137, name: 'Suburbia 商业' }},
                            {{ value: 19258877, name: '金融信贷业务' }},
                            {{ value: 4863706, name: '商业地产租赁' }}
                        ]
                    }}]
                }});
                window.addEventListener('resize', () => chart1.resize());
            }}

            // --- 图表 2: 渠道数据 (柱状图) ---
            const chart2Dom = document.getElementById('channelChart');
            if (chart2Dom) {{
                const chart2 = echarts.init(chart2Dom);
                chart2.setOption({{
                    tooltip: {{ trigger: 'axis', axisPointer: {{ type: 'shadow' }} }},
                    grid: {{ left: '3%', right: '4%', bottom: '3%', containLabel: true }},
                    xAxis: [{{
                        type: 'category',
                        data: ['Liverpool 百货', 'Liverpool Express', 'Suburbia 门店', 'Galerías 购物中心', '精品专卖店'],
                        axisTick: {{ alignWithLabel: true }},
                        axisLabel: {{ color: '#3c3935', fontSize: 11 }}
                    }}],
                    yAxis: [{{ type: 'value', axisLabel: {{ color: '#7a756f' }} }}],
                    series: [{{
                        name: '门店数量',
                        type: 'bar',
                        barWidth: '40%',
                        itemStyle: {{ color: '#ff641e', borderRadius: [6, 6, 0, 0] }},
                        data: [124, 40, 194, 29, 115]
                    }}]
                }});
                window.addEventListener('resize', () => chart2.resize());
            }}

            // --- 图表 3: 采购数据 (趋势图) ---
            const chart3Dom = document.getElementById('supplyChart');
            if (chart3Dom) {{
                const chart3 = echarts.init(chart3Dom);
                chart3.setOption({{
                    tooltip: {{ trigger: 'axis' }},
                    legend: {{ data: ['对华总采购估值', '家电与家居类'], textStyle: {{ color: '#3c3935' }} }},
                    grid: {{ left: '3%', right: '4%', bottom: '3%', containLabel: true }},
                    xAxis: {{
                        type: 'category',
                        boundaryGap: false,
                        data: ['2020', '2021', '2022', '2023', '2024'],
                        axisLabel: {{ color: '#3c3935' }}
                    }},
                    yAxis: {{ type: 'value', name: '百万美元 ($M)', axisLabel: {{ color: '#7a756f' }} }},
                    series: [
                        {{
                            name: '对华总采购估值',
                            type: 'line',
                            smooth: true,
                            itemStyle: {{ color: '#ff641e' }},
                            areaStyle: {{ color: 'rgba(255, 100, 30, 0.1)' }},
                            data: [420, 490, 560, 610, 680]
                        }},
                        {{
                            name: '家电与家居类',
                            type: 'line',
                            smooth: true,
                            itemStyle: {{ color: '#7a756f' }},
                            areaStyle: {{ color: 'rgba(122, 117, 111, 0.08)' }},
                            data: [190, 230, 280, 310, 360]
                        }}
                    ]
                }});
                window.addEventListener('resize', () => chart3.resize());
            }}
        }};

        initCharts();
    </script>
</body>
</html>
"""

output_path = "/Users/jason/Documents/Antigravity/Project/Globaltradebuddy/scratch/liverpool-company-insight-report.html"
with open(output_path, "w", encoding="utf-8") as f:
    f.write(html_content)

print(f"[OK] Report HTML generated: {output_path} (Size: {len(html_content)} bytes)")
