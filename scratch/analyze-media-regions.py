#!/usr/bin/env python3
"""统计 channel-players.json 中 222 个资讯来源的地区分布 (US/EU/其他)。"""
import json
from urllib.parse import urlparse

CHANNEL = "/Users/jason/Documents/Antigravity/Project/Globaltradebuddy/.antigravity/skills/report-news/references/channel-players.json"

# 域名 -> 地区: US=美国, EU=欧洲(含英国), OTHER=其他/全球
REGION = {
    # --- 电子家电与智能出行 ---
    "aham.org": "US", "twice.com": "US", "appliancedesign.com": "US", "cta.tech": "US",
    "theverge.com": "US", "cnet.com": "US", "idc.com": "US",
    "ewweb.com": "US", "electricaltrademagazine.co.uk": "EU", "eda.org.uk": "EU", "euew.org": "EU",
    "ies.org": "US", "led-professional.com": "EU", "pld-m.com": "EU", "lightfair.com": "US",
    "strategiesinlight.com": "US",
    "electrek.co": "US", "insideevs.com": "US", "cleantechnica.com": "US", "autonews.com": "US",
    "about.bnef.com": "US", "bnef.com": "US",
    "wardsauto.com": "US", "nada.org": "US", "autoremarketing.com": "US",
    "sema.org": "US", "automotiveaftermarketnews.com": "US", "autocare.org": "US",
    "moderntiredealer.com": "US",
    "cycleworld.com": "US", "powersportsbusiness.com": "US", "dealernews.com": "US",
    "bicycleretailer.com": "US", "bike-eu.com": "EU", "cyclingindustry.news": "EU",
    # --- 五金工具与机械建材 ---
    "powermag.com": "US", "dieselgasturbine.com": "US",
    "machinedesign.com": "US", "designnews.com": "US", "globalfastenernews.com": "US",
    "fastenertech.com": "US",
    "mmsonline.com": "US", "packworld.com": "US", "amtonline.org": "US", "emo-hannover.com": "EU",
    "aem.org": "US", "equipmentworld.com": "US", "constructionequipment.com": "US",
    "dieselprogress.com": "US",
    "farm-equipment.com": "US", "agribusinessglobal.com": "US", "agriculture.com": "US",
    "automationworld.com": "US", "controleng.com": "US", "therobotreport.com": "US",
    "hannovermesse.de": "EU",
    "hardwareretailing.com": "US", "diyinternational.com": "EU", "diyretailer.com": "EU",
    "eisenwarenmesse.com": "EU",
    "toolboxbuzz.com": "US", "diyweek.net": "EU", "protoolreviews.com": "US",
    "icis.com": "EU", "chemweek.com": "US", "cen.acs.org": "US", "plasticsnews.com": "US",
    "pv-magazine.com": "EU", "solarpowerworldonline.com": "US", "energy-storage.news": "EU",
    "mercomcapital.com": "US",
    "constructiondive.com": "US", "buildingproductsdigest.com": "US",
    "constructionweekonline.com": "OTHER",
    "kbbonline.com": "US", "supplyht.com": "US", "pmengineer.com": "US",
    # --- 日用百货与餐厨陶瓷 ---
    "tablewareinternational.com": "EU", "theinspiredhome.com": "US", "hometextilestoday.com": "US",
    "homeworldbusiness.com": "US",
    "retail-week.com": "EU", "retailgazette.co.uk": "EU", "retaildetail.eu": "EU",
    "chainstoreage.com": "US", "grocerydive.com": "US", "internationalsupermarketnews.com": "OTHER",
    "giftsanddec.com": "US", "glassmagazine.com": "US", "giftfocus.co.uk": "EU",
    "ppai.org": "US", "promomarketing.com": "US", "sageworld.com": "US",
    "seasonalanddecor.com": "US", "progressivegrocer.com": "US", "americasmart.com": "US",
    # --- 家居家具与园林装饰 ---
    "furnituretoday.com": "US", "homenewsnow.com": "US", "furninfo.com": "US", "ahfa.us": "US",
    "highpointmarket.org": "US",
    "homeaccentstoday.com": "US", "interiordesign.net": "US", "hfndigital.com": "US",
    "gardencentreupdate.com": "EU", "gardentradespecialist.com": "EU", "lawnandgardenretailer.com": "US",
    "hardscapemag.com": "US", "landscapemanagement.net": "US", "stoneworld.com": "US",
    "fcnews.net": "US", "floorcoveringweekly.com": "US",
    # --- 服装纺织与鞋帽箱包 ---
    "wwd.com": "US", "sourcingjournal.com": "US", "businessoffashion.com": "EU",
    "fashionnetwork.com": "EU", "drapersonline.com": "EU", "wgsn.com": "EU",
    "apparelresources.com": "OTHER", "kidscreen.com": "OTHER",
    "just-style.com": "EU",
    "sgbonline.com": "US", "sgieurope.com": "EU", "footwearnews.com": "US",
    "outdoorindustry.org": "US",
    "accessoriescouncil.org": "US",
    "fibre2fashion.com": "OTHER", "textiletoday.com.bd": "OTHER", "textileworld.com": "US",
    "itmf.org": "EU", "premierevision.com": "EU", "intertextile.com": "OTHER",
    "worldfootwear.com": "EU", "fdra.org": "US",
    "travelgoods.org": "US",
    # --- 玩具母婴与礼品个护 ---
    "toybook.com": "US", "toyworldmag.co.uk": "EU", "globaltoynews.com": "US",
    "toyassociation.org": "US", "spielwarenmesse.de": "EU",
    "kidstoday.com": "US", "jpma.org": "US", "babyandchild.co.uk": "EU", "nurseryworld.co.uk": "EU",
    "watchtime.com": "US", "hodinkee.com": "US", "watchpro.com": "EU", "jckonline.com": "US",
    "visionmonday.com": "US",
    "happi.com": "US", "cosmeticsbusiness.com": "EU", "gcimagazine.com": "US",
    "beautypackaging.com": "US", "mintel.com": "EU",
    "americanpetproducts.org": "US", "petbusiness.com": "US", "petproductnews.com": "US",
    "petfoodindustry.com": "US", "globalpets.com": "EU",
    "opi.net": "EU", "stationerynews.com": "US", "paperworld.messefrankfurt.de": "EU",
    "paperworld.messefrankfurt.com": "EU",
    "outdoorretailer.com": "US",
    # --- 医药保健与食品特色 ---
    "mddionline.com": "US", "medtechdive.com": "US", "fiercebiotech.com": "US",
    "nutritionaloutlook.com": "US", "naturalproductsinsider.com": "US",
    "fooddive.com": "US", "supermarketnews.com": "US", "foodnavigator.com": "EU",
    "just-food.com": "EU", "igd.com": "EU", "euromonitor.com": "EU",
    "specialtyfood.com": "US", "tridge.com": "OTHER",
}

def domain_of(url):
    d = urlparse(url).netloc.lower()
    if d.startswith("www."):
        d = d[4:]
    return d

def main():
    with open(CHANNEL, "r", encoding="utf-8") as f:
        data = json.load(f)

    stats = {"US": 0, "EU": 0, "OTHER": 0}
    unknown = []
    details = []
    for cluster in data["clusters"]:
        for cat in cluster["categories"]:
            for m in cat.get("media", []):
                d = domain_of(m["url"])
                region = REGION.get(d, "UNKNOWN")
                if region == "UNKNOWN":
                    unknown.append((m["name"], m["url"]))
                else:
                    stats[region] += 1
                details.append((cluster["name"], cat["name"], m["name"], region))

    total = sum(stats.values()) + len(unknown)
    print(f"总计: {total} 个资讯来源\n")
    print(f"🇺🇸 美国 (US):   {stats['US']}  ({stats['US']/total*100:.1f}%)")
    print(f"🇪🇺 欧洲 (EU):   {stats['EU']}  ({stats['EU']/total*100:.1f}%)")
    print(f"🌍 其他/全球:   {stats['OTHER']}  ({stats['OTHER']/total*100:.1f}%)")
    if unknown:
        print(f"\n⚠️ 未识别域名 {len(unknown)} 个:")
        for n, u in unknown:
            print(f"   - {n} | {u}")

    print("\n=== 按大品类分布 ===")
    from collections import defaultdict
    by_cluster = defaultdict(lambda: {"US": 0, "EU": 0, "OTHER": 0, "UNKNOWN": 0})
    for cluster, cat, name, region in details:
        by_cluster[cluster][region] += 1
    for cluster, s in by_cluster.items():
        print(f"{cluster}: US {s['US']} / EU {s['EU']} / 其他 {s['OTHER']}")

if __name__ == "__main__":
    main()
