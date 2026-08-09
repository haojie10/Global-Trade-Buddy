#!/usr/bin/env python3
"""
分析 channel-players.json 中每个品类的代表玩家总部所在地区。
输出：每个品类的玩家地区分布 + 汇总 + 未识别名单。
"""
import json

CHANNEL = "/Users/jason/Documents/Antigravity/Project/Globaltradebuddy/.antigravity/skills/report-news/references/channel-players.json"

# 品牌 -> 总部地区 (US=美国 EU=欧洲 JP=日本 KR=韩国 CN=中国 CA=加拿大 AU=澳洲 IN=印度 LATAM=拉美 OTHER=其他)
BRAND_REGION = {
    # ---------- US ----------
    "Whirlpool":"US","GE Appliances":"US","Kenmore":"US","Frigidaire":"US","KitchenAid":"US",
    "Apple":"US","Microsoft":"US","Amazon":"US","Google":"US","HP":"US","Dell":"US","Belkin":"US",
    "Bose":"US","Sonos":"US","Logitech":"US","Razer":"US","Leviton":"US","Lutron":"US","Honeywell":"US",
    "Acuity Brands":"US","GE Lighting":"US","Rad Power Bikes":"US","Aventon":"US",
    "Tesla":"US","GM":"US","Ford":"US","ChargePoint":"US","EVgo":"US",
    "AutoZone":"US","O'Reilly":"US","Advance Auto Parts":"US","NAPA":"US","Pep Boys":"US","Dorman":"US",
    "Continental":"EU","Bridgestone":"JP","Goodyear":"US","Michelin":"EU","ACDelco":"US","Monroe":"US",
    "Harley-Davidson":"US","Trek":"US","Specialized":"US","Cannondale":"US","SRAM":"US",
    "Generac":"US","Cummins":"US","Caterpillar":"US","Franklin Electric":"US",
    "Fastenal":"US","Grainger":"US","Motion Industries":"US","McMaster-Carr":"US",
    "Haas":"US","Rockwell":"US","Emerson":"US","Universal Robots":"EU","Cognex":"US",
    "Snap-on":"US","Stanley Black & Decker":"US","DeWalt":"US","TTI":"OTHER","Milwaukee":"US","Ryobi":"JP",
    "3M":"US","Dow":"US","DuPont":"US","Lubrizol":"US","Eastman":"US",
    "First Solar":"US","Enphase":"US","Tesla Energy":"US",
    "Quikrete":"US","Pavestone":"US","Oldcastle":"EU","Trex":"US","TimberTech":"US",
    "Mohawk":"US","Shaw":"US","Interface":"US","Floor & Decor":"US","Rugs.com":"US",
    "Kohler":"US","Moen":"US","Delta":"US",
    "Corelle":"US","Lenox":"US","Libbey":"US","OXO":"US","Calphalon":"US","Cuisinart":"US","Instant Pot":"US",
    "Hallmark":"US","Paper Source":"US","Enesco":"US","Party City":"US","Balsam Hill":"US","Hobby Lobby":"US","Michaels":"US",
    "Ashley":"US","Wayfair":"US","RH":"US","La-Z-Boy":"US","Hooker":"US","Flexsteel":"US","MillerKnoll":"US","Steelcase":"US",
    "West Elm":"US","Pottery Barn":"US","Crate & Barrel":"US","HomeGoods":"US","Kirkland's":"US","At Home":"US","TJ Maxx":"US","Marshalls":"US",
    "Nike":"US","Under Armour":"US","Levi's":"US","Gap":"US","Macy's":"US","Kohl's":"US","Nordstrom":"US","TJX":"US",
    "Carter's":"US","OshKosh":"US","Gymboree":"US","Children's Place":"US","Old Navy":"US",
    "Victoria's Secret":"US","Calvin Klein":"US","Hanes":"US","Fruit of the Loom":"US","Jockey":"US",
    "Columbia":"US","Patagonia":"US","Marmot":"US","Woolrich":"US","L.L.Bean":"US",
    "Fossil":"US","Claire's":"US","Cone Mills":"US","Saucony":"US","Brooks":"US",
    "Converse":"US","Vans":"US","Skechers":"US","Crocs":"US","Samsonite":"US","Tumi":"US","Away":"US",
    "JanSport":"US","Osprey":"US","Eastpak":"US","Mattel":"US","Hasbro":"US","Funko":"US","MGA":"US","Jazwares":"US",
    "Graco":"US","Evenflo":"US","UPPAbaby":"US","Pampers":"US","Huggies":"US",
    "Timex":"US","Garmin":"US","Warby Parker":"US","LensCrafters":"US","Marchon":"US",
    "Remington":"US","Conair":"US","Gillette":"US","Oral-B":"US","Philips Sonicare":"US","Waterpik":"US","T3":"US",
    "Mars Petcare":"US","Hill's":"US","Blue Buffalo":"US","Petco":"US","PetSmart":"US","Chewy":"US","Elanco":"US",
    "Staples":"US","Office Depot":"US","Sharpie":"US","Post-it":"US","Dick's":"US","REI":"US","Academy Sports":"US",
    "Bass Pro":"US","Cabela's":"US","Johnson & Johnson":"US","Medtronic":"EU","Abbott":"US","BD":"US",
    "GE HealthCare":"US","Stryker":"US","Boston Scientific":"US","Nature's Bounty":"US","NOW Foods":"US","GNC":"US","Centrum":"US",
    "PepsiCo":"US","Coca-Cola":"US","Mondelez":"US","Kraft Heinz":"US","General Mills":"US","Kellogg's":"US","Tyson":"US",
    "Walmart":"US","Kroger":"US","Costco":"US","Sysco":"US","US Foods":"US","Whole Foods":"US","Trader Joe's":"US",
    "Fitz & Floyd":"US","At Home":"US","American Standard":"US","Sonalika":"IN",
    "Delta Faucet":"US","Sony":"JP","JBL":"US","ASUS":"OTHER","Acer":"OTHER","TP-Link":"CN",
    "Target":"US","Amazon Business":"US","Five Below":"US","Foot Locker":"US","DSW":"US",
    "Tractor Supply":"US","True Value":"US","Ace Hardware":"US","Home Depot":"US","Lowe's":"US",
    "World Market":"US","The Citizenry":"US","Big Lots":"US","Dollar General":"US","Dollar Tree":"US",
    "Anchor Hocking":"US","PPAI":"US","Belgard":"US","Schlage":"US","Georgia-Pacific":"US",
    "Masco":"US","Armstrong":"US","PPG":"US","Sherwin-Williams":"US","Timken":"US","New Balance":"US",
    "Noritake":"JP","SKF":"EU","Schaeffler":"EU","Grundfos":"EU","Wilo":"EU","GE Vernova":"US",
    "Hitachi":"JP","Deere":"US","Case":"US","Bobcat":"US","John Deere":"US","CNH":"EU","AGCO":"US",
    "Yaskawa":"JP","DMG MORI":"JP","Giant":"OTHER","Canyon":"EU","Brompton":"EU","Bosch eBike":"EU",
    "NIO":"CN","Xpeng":"CN","Li Auto":"CN","Toyota":"JP","Honda":"JP","Nissan":"JP",
    "Yamaha":"JP","Kawasaki":"JP","Suzuki":"JP","KTM":"EU","Ducati":"EU","BMW Motorrad":"EU",
    "TOTO":"JP","Wacoal":"JP","Triumph":"EU","Aerie":"US","Gap Kids":"US","Mini Boden":"EU",
    "H&M Kids":"EU","Zara Kids":"EU","Zara Home":"EU","H&M Home":"EU","Ikea":"EU",
    "Philips Avent":"EU","Purina":"EU","Swarovski":"EU","Sanrio":"JP","Accessorize":"EU",
    "Riedel":"EU","Spiegelau":"EU","Schott Zwiesel":"EU","Bormioli Rocco":"EU","Luigi Bormioli":"EU",
    "ARC International":"EU",    "Tmall Global":"CN","JD Worldwide":"CN","99 Ranch":"US","H Mart":"US",
    "T&T":"CA","Yamibuy":"US","LG Energy Solution":"KR","Giant":"OTHER","B&Q":"EU",
    "ASUS":"OTHER","Acer":"OTHER","溢达 Esquel":"OTHER",
    # ========== 新增欧洲品牌 ==========
    "Miele":"EU","Beko":"EU","Ariston":"EU","Smeg":"EU","Bang & Olufsen":"EU","Sennheiser":"EU","Nokia":"EU",
    "Rittal":"EU","Phoenix Contact":"EU","Prysmian":"EU","iGuzzini":"EU","Fagerhult":"EU","Artemide":"EU",
    "Renault":"EU","Volvo":"EU","Porsche":"EU","Audi":"EU","Skoda":"EU","Valeo":"EU","ZF":"EU","Brembo":"EU",
    "Triumph":"EU","Aprilia":"EU","Piaggio":"EU","Bianchi":"EU","Cube":"EU","Orbea":"EU",
    "Danfoss":"EU","KSB":"EU","SDMO":"EU","Festo":"EU","igus":"EU","HARTING":"EU",
    "Biesse":"EU","Homag":"EU","Starrag":"EU","Manitou":"EU","Wacker Neuson":"EU","Bomag":"EU",
    "Fendt":"EU","Same Deutz-Fahr":"EU","Kuhn":"EU","B&R":"EU","SEW-Eurodrive":"EU","Pilz":"EU",
    "Screwfix":"EU","Castorama":"EU","toom":"EU","Knipex":"EU","Wiha":"EU","Bahco":"EU",
    "Evonik":"EU","Wacker":"EU","Clariant":"EU","SMA Solar":"EU","Fronius":"EU","Vestas":"EU",
    "Knauf":"EU","Wienerberger":"EU","Velux":"EU","Kaldewei":"EU","Laufen":"EU","Ideal Standard":"EU",
    "Bernardaud":"EU","Royal Copenhagen":"EU","Vista Alegre":"EU","Tefal":"EU","Joseph Joseph":"EU","Alessi":"EU",
    "Auchan":"EU","Edeka":"EU","Mercadona":"EU","Iittala":"EU","Kosta Boda":"EU","Nachtmann":"EU",
    "KPM":"EU","Haviland":"EU","Hutschenreuther":"EU","Pandora":"EU","Georg Jensen":"EU","Christofle":"EU",
    "Kaemingk":"EU","Maisons du Monde":"EU","Gisela Graham":"EU","Depesche":"EU",
    "JYSK":"EU","XXXLutz":"EU","Roche Bobois":"EU","Conforama":"EU","Habitat":"EU","Zara Home":"EU","Nkuku":"EU",
    "H&M Home":"EU","Normann Copenhagen":"EU","GARDENA":"EU","Stiga":"EU","Jardiland":"EU",
    "HeidelbergCement":"EU","Marshalls":"EU","Vandersanden":"EU","Balta":"EU","Desso":"EU","Forbo":"EU",
    "Mango":"EU","Hugo Boss":"EU","C&A":"EU","Marks & Spencer":"EU","Vertbaudet":"EU","Petit Bateau":"EU",
    "Lindex":"EU","Wolford":"EU","Etam":"EU","Marie Jo":"EU","On":"EU","Salomon":"EU","Lacoste":"EU",
    "Barbour":"EU","Mammut":"EU","Jack Wolfskin":"EU","Bvlgari":"EU","Falke":"EU","Thomas Sabo":"EU",
    "Zegna":"EU","Vitale Barberis Canonico":"EU","Reda":"EU","Frette":"EU","Christy":"EU","Zucchi":"EU",
    "Camper":"EU","Geox":"EU","Deichmann":"EU","Goyard":"EU","Delvaux":"EU","Mulberry":"EU",
    "Steiff":"EU","Haba":"EU","Jellycat":"EU","Peg Perego":"EU","Nuna":"EU","Silver Cross":"EU",
    "Audemars Piguet":"EU","Hublot":"EU","Breitling":"EU","BaByliss":"EU","Beurer":"EU","Kärcher":"EU",
    "Trixie":"EU","Ferplast":"EU","Eheim":"EU","Pelikan":"EU","Lamy":"EU","Leuchtturm":"EU",
    "Intersport":"EU","Atomic":"EU","Rossignol":"EU","Fresenius":"EU","B.Braun":"EU","Smith & Nephew":"EU",
    "Danone":"EU","Ferrero":"EU","Lindt":"EU","Fortnum & Mason":"EU","Fauchon":"EU","Ladurée":"EU",
    "Bolia":"EU","Cath Kidston":"EU","Ferm Living":"EU","Fjällräven":"EU","Sport 2000":"EU",
    "Alpine":"EU","Migros":"EU",
    # ========== 新增南美品牌 ==========
    "Consul":"LATAM","Positivo":"LATAM","Multilaser":"LATAM","Intral":"LATAM","Lorenzetto":"LATAM",
    "Metal Leve":"LATAM","Dexter":"LATAM","Magazine Luiza":"LATAM","Falabella":"LATAM","Deca":"LATAM",
    "Tok&Stok":"LATAM","Etna":"LATAM","Bauducco":"LATAM","M. Dias Branco":"LATAM","Premier Pet":"LATAM",
    # ========== 新增俄罗斯品牌 (RU 独立地区) ==========
    "Magnit":"RU","X5 Retail":"RU","Lenta":"RU","Ozon":"RU","Wildberries":"RU",
    "DNS":"RU","M.Video":"RU","Eldorado":"RU","Citilink":"RU","VkusVill":"RU",
    "Gloria Jeans":"RU","Melon Fashion Group":"RU","Ostin":"RU","Detsky Mir":"RU",
    "Petrovich":"RU","Stroiland":"RU","Hoff":"RU",
    # ---------- EU 欧洲(含英国/瑞士/北欧) ----------
    "Electrolux":"EU","Bosch":"EU","Siemens":"EU","Dyson":"EU","De'Longhi":"EU","Philips":"EU",
    "ABB":"EU","Schneider Electric":"EU","Legrand":"EU","Eaton":"EU","Hager":"EU",
    "Signify":"EU","ams OSRAM":"EU","Zumtobel":"EU","Trilux":"EU","LEDVANCE":"EU",
    "Volkswagen":"EU","BMW":"EU","Mercedes-Benz":"EU","Stellantis":"EU",
    "Bosch Rexroth":"EU","Gates":"US","Parker":"US","Würth":"EU","RS Components":"EU","Brammer":"EU",
    "Trumpf":"EU","SCM Group":"EU","JCB":"EU","Volvo CE":"EU","Liebherr":"EU","CLAAS":"EU",
    "KUKA":"EU","SICK":"EU","Beckhoff":"EU",
    "Kingfisher":"EU","Leroy Merlin":"EU","Bauhaus":"EU","OBI":"EU","Hornbach":"EU","Häfele":"EU","Assa Abloy":"EU",
    "Hilti":"EU","Metabo":"EU","Festool":"EU","Wera":"EU","Knipex":"EU",
    "BASF":"EU","Henkel":"EU","AkzoNobel":"EU","Covestro":"EU","Sika":"EU","Brenntag":"EU",
    "Saint-Gobain":"EU","CRH":"EU","LafargeHolcim":"EU","James Hardie":"AU","Tarkett":"EU",
    "Travis Perkins":"EU","Ferguson":"EU","Grafton":"EU",
    "Grohe":"EU","Hansgrohe":"EU","Duravit":"EU","Villeroy & Boch":"EU","Roca":"EU","Geberit":"EU",
    "Wedgwood":"EU","Royal Doulton":"EU","Portmeirion":"EU","Denby":"EU","Churchill":"EU","Rosenthal":"EU",
    "Meissen":"EU","Kähler":"EU","Herend":"EU","Lladró":"EU","Goebel":"EU","Zwilling":"EU","WMF":"EU",
    "Fissler":"EU","Le Creuset":"EU","Staub":"EU","Morphy Richards":"EU","Dualit":"EU",
    "Aldi":"EU","Lidl":"EU","Action":"EU","B&M":"EU","Poundland":"EU","Carrefour":"EU","Tesco":"EU",
    "Sainsbury's":"EU","Ahold Delhaize":"EU","IKEA":"EU","Zara":"EU","H&M":"EU","Adidas":"EU","Puma":"EU",
    "Primark":"EU","Next":"EU","Zalando":"EU","ASOS":"EU","Boohoo":"EU","Marks & Spencer":"EU","Topshop":"EU",
    "JD Sports":"EU","Decathlon":"EU","The North Face":"US","Arc'teryx":"CA","Salomon":"EU","Helly Hansen":"EU",
    "Peak Performance":"EU","Gymshark":"EU","Alo Yoga":"US","Moncler":"EU","Canada Goose":"CA",
    "Hermès":"EU","Burberry":"EU","Gucci":"EU","Chantelle":"EU","La Perla":"EU","Mackage":"CA",
    "Lenzing":"EU","Rimowa":"EU","Delsey":"EU","Fjällräven":"EU","LEGO":"EU","Ravensburger":"EU","Playmobil":"EU",
    "Chicco":"EU","Stokke":"EU","Bugaboo":"EU","Cybex":"EU","Britax":"EU","Joie":"EU","Medela":"EU",
    "Tommee Tippee":"EU","Rolex":"EU","Omega":"EU","Cartier":"EU","Patek Philippe":"EU",
    "Audemars Piguet":"EU","Tag Heuer":"EU","Swatch":"EU","Luxottica":"EU","Specsavers":"EU","ZEISS":"EU",
    "Braun":"EU","GHD":"EU","Foreo":"EU","Royal Canin":"EU","Pets at Home":"EU","Fressnapf":"EU","Zooplus":"EU","Tetra":"EU",
    "Moleskine":"EU","Faber-Castell":"EU","Staedtler":"EU","Bic":"EU",
    "Sports Direct":"EU","Frasers":"EU","Nestlé":"EU","Unilever":"EU","Eataly":"EU",
    "Roche":"EU","Siemens Healthineers":"EU","Philips Health":"EU",
    "Skechers":"US","Birkenstock":"EU","Clarks":"EU","ECCO":"EU","Dr. Martens":"EU",
    # ---------- JP 日本 ----------
    "Panasonic":"JP","Toshiba":"JP","KYB":"JP","Fanuc":"JP","Mazak":"JP","Amada":"JP","Komatsu":"JP",
    "Kubota":"JP","Yanmar":"JP","Mitsubishi Electric":"JP","Mitsubishi":"JP","Omron":"JP","Keyence":"JP",
    "Makita":"JP","Echo":"JP","Nitori":"JP","Uniqlo":"JP","Asics":"JP","Bandai Namco":"JP","Seiko":"JP",
    "Citizen":"JP","Casio":"JP","Hoya":"JP","Pilot":"JP","Uni-ball":"JP","Pentel":"JP","Zebra":"JP","Muji":"JP",
    "Toray":"JP","Teijin":"JP","Shimano":"JP","NSK":"JP","NTN":"JP","Bridgestone":"JP","Ryobi":"JP",
    "Daikin":"JP","Sharp":"JP","Aisin":"JP","Denso":"JP",
    # ---------- KR 韩国 ----------
    "Samsung":"KR","LG Electronics":"KR","LG":"KR","Kia":"KR","Hyundai":"KR",
    # ---------- CN 中国(含香港品牌部分) ----------
    "Midea":"CN","Hisense":"CN","TCL":"CN","Xiaomi":"CN","Huawei":"CN","Lenovo":"CN","Anker":"CN",
    "Tuya":"CN","Aqara":"CN","Lightstar":"CN","BYD":"CN","CATL":"CN","LONGi":"CN","JinkoSolar":"CN",
    "JA Solar":"CN","Trina Solar":"CN","Sungrow":"CN","Sany":"CN","XCMG":"CN","Zoomlion":"CN",
    "Worx":"CN","Shein":"CN","Temu":"CN","溢达 Esquel":"OTHER","鲁泰 Luthai":"CN","魏桥 Weiqiao":"CN",
    "申洲 Shenzhou":"CN",
    # ---------- CA 加拿大 ----------
    "Canadian Solar":"CA","Lululemon":"CA","Arc'teryx":"CA","Canada Goose":"CA","Mackage":"CA",
    "Monos":"CA","Herschel":"CA","Dollarama":"CA","Unilock":"CA","Techo-Bloc":"CA","Spin Master":"CA",
    "Brookfield":"CA","Restoration Hardware":"US",
    # ---------- AU 澳洲 ----------
    "Regent":"AU","Swisse":"AU","Blackmores":"AU",
    # ---------- IN 印度 ----------
    "Mahindra":"IN","Sonalika":"IN","Royal Enfield":"IN","Bajaj":"IN","VIP Industries":"IN",
    "Birla":"IN","Welspun":"IN","Trident":"IN",
    # ---------- LATAM ----------
    "Tramontina":"LATAM","WEG":"LATAM",
    # ---------- OTHER ----------
    "SABIC":"OTHER","SolarEdge":"OTHER","Wallbox":"EU","Wallbox Chargers":"EU",
    "TTI":"OTHER","Husqvarna":"EU","Fiskars":"EU","Stihl":"EU","Titan":"OTHER",
}


def main():
    with open(CHANNEL, "r", encoding="utf-8") as f:
        data = json.load(f)

    unknown = set()
    stats = {"US": 0, "EU": 0, "JP": 0, "KR": 0, "CN": 0, "CA": 0, "AU": 0, "IN": 0, "LATAM": 0, "RU": 0, "OTHER": 0}

    print("=== 各品类玩家地区分布 ===\n")
    for cluster in data["clusters"]:
        print(f"【{cluster['name']}】")
        for cat in cluster["categories"]:
            regions = {"US":0,"EU":0,"JP":0,"KR":0,"CN":0,"CA":0,"AU":0,"IN":0,"LATAM":0,"RU":0,"OTHER":0}
            cat_unknown = []
            for p in cat.get("players", []):
                r = BRAND_REGION.get(p)
                if r is None:
                    cat_unknown.append(p)
                    unknown.add(p)
                else:
                    regions[r] += 1
                    stats[r] += 1
            total = sum(regions.values())
            dist = " ".join(f"{k}:{v}" for k, v in regions.items() if v > 0)
            mark = f" ⚠️未识别:{','.join(cat_unknown)}" if cat_unknown else ""
            print(f"  {cat['name']:<16} ({total}家) {dist}{mark}")
        print()

    total = sum(stats.values())
    print("=== 玩家地区汇总 ===")
    for k, v in stats.items():
        print(f"  {k}: {v} ({v/total*100:.1f}%)")
    print(f"  总计: {total}")
    if unknown:
        print(f"\n⚠️ 未识别 {len(unknown)} 个玩家:")
        print("  " + ", ".join(sorted(unknown)))


if __name__ == "__main__":
    main()
