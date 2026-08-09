#!/usr/bin/env python3
"""
更新 channel-players.json 玩家数据：
1. 删除 29 个中国大陆品牌
2. 补充欧洲玩家（每品类 3-4 个，目标欧洲总数 ~400）
3. 补充南美玩家（LATAM）
4. 补充俄罗斯玩家（RU，独立地区）
幂等：新增品牌已存在则跳过。
"""
import json

CHANNEL = "/Users/jason/Documents/Antigravity/Project/Globaltradebuddy/.antigravity/skills/report-news/references/channel-players.json"

# ========== 1. 删除的大陆品牌（29个） ==========
REMOVE_CN = [
    "Midea", "Hisense", "TCL", "Xiaomi", "Huawei", "Lenovo", "Anker", "Tuya", "Aqara", "Lightstar",
    "BYD", "CATL", "LONGi", "JinkoSolar", "JA Solar", "Trina Solar", "Sungrow", "Sany", "XCMG", "Zoomlion",
    "Worx", "Shein", "Temu", "鲁泰 Luthai", "魏桥 Weiqiao", "申洲 Shenzhou", "Tmall Global", "JD Worldwide",
    "TP-Link", "NIO", "Xpeng", "Li Auto",
]

# ========== 2. 补充的欧洲玩家（品类 -> 品牌列表） ==========
ADD_EU = {
    "家用电器": ["Miele", "Beko", "Ariston", "Smeg"],
    "电子消费品及信息产品": ["Bang & Olufsen", "Sennheiser", "Nokia"],
    "电子电气产品": ["Rittal", "Phoenix Contact", "Prysmian"],
    "照明产品": ["iGuzzini", "Fagerhult", "Artemide"],
    "新能源汽车及智慧出行": ["Renault", "Volvo", "Porsche", "Audi"],
    "车辆": ["Renault", "Audi", "Skoda", "Alpine"],
    "汽车配件": ["Valeo", "ZF", "Brembo"],
    "摩托车": ["Triumph", "Aprilia", "Piaggio"],
    "自行车": ["Bianchi", "Cube", "Orbea"],
    "动力、电力设备": ["Danfoss", "KSB", "SDMO"],
    "通用机械及机械基础件": ["Festo", "igus", "HARTING"],
    "加工机械设备": ["Biesse", "Homag", "Starrag"],
    "工程机械（室内/室外）": ["Manitou", "Wacker Neuson", "Bomag"],
    "农业机械（室内/室外）": ["Fendt", "Same Deutz-Fahr", "Kuhn"],
    "工业自动化及智能制造": ["B&R", "SEW-Eurodrive", "Pilz"],
    "五金": ["Screwfix", "Castorama", "toom"],
    "工具": ["Knipex", "Wiha", "Bahco"],
    "新材料及化工产品": ["Evonik", "Wacker", "Clariant"],
    "新能源": ["SMA Solar", "Fronius", "Vestas"],
    "建筑及装饰材料": ["Knauf", "Wienerberger", "Velux"],
    "卫浴设备": ["Kaldewei", "Laufen", "Ideal Standard"],
    "日用陶瓷": ["Bernardaud", "Royal Copenhagen", "Vista Alegre"],
    "餐厨器皿": ["Tefal", "Joseph Joseph", "Alessi"],
    "家居用品": ["Auchan", "Edeka", "Mercadona", "Migros"],
    "玻璃工艺品": ["Iittala", "Kosta Boda", "Nachtmann"],
    "工艺陶瓷": ["KPM", "Haviland", "Hutschenreuther"],
    "礼品及赠品": ["Pandora", "Georg Jensen", "Christofle"],
    "节日用品": ["Kaemingk", "Maisons du Monde", "Gisela Graham", "Depesche", "JYSK"],
    "家具": ["JYSK", "XXXLutz", "Roche Bobois", "Conforama", "Bolia"],
    "编织及藤铁工艺品": ["Habitat", "Zara Home", "Nkuku", "Cath Kidston"],
    "家居装饰品": ["H&M Home", "Normann Copenhagen", "Maisons du Monde", "Ferm Living"],
    "园林用品": ["GARDENA", "Stiga", "Jardiland"],
    "石材/铁艺制品（室外）": ["HeidelbergCement", "Marshalls", "Vandersanden"],
    "地毯及挂毯": ["Balta", "Desso", "Forbo"],
    "男女装": ["Mango", "Hugo Boss", "C&A", "Marks & Spencer"],
    "童装": ["Vertbaudet", "Petit Bateau", "Lindex"],
    "内衣": ["Wolford", "Etam", "Marie Jo"],
    "运动服及休闲服": ["On", "Salomon", "Lacoste"],
    "裘革皮羽绒及制品": ["Barbour", "Mammut", "Jack Wolfskin", "Fjällräven"],
    "服装饰物及配件": ["Bvlgari", "Falke", "Thomas Sabo"],
    "纺织原料面料": ["Zegna", "Vitale Barberis Canonico", "Reda"],
    "家用纺织品": ["Frette", "Christy", "Zucchi"],
    "鞋": ["Camper", "Geox", "Deichmann"],
    "箱包": ["Goyard", "Delvaux", "Mulberry"],
    "玩具": ["Steiff", "Haba", "Jellycat"],
    "孕婴童用品": ["Peg Perego", "Nuna", "Silver Cross"],
    "钟表眼镜": ["Audemars Piguet", "Hublot", "Breitling"],
    "个人护理用具": ["BaByliss", "Beurer", "Kärcher"],
    "宠物用品": ["Trixie", "Ferplast", "Eheim"],
    "办公文具": ["Pelikan", "Lamy", "Leuchtturm"],
    "体育及旅游休闲用品": ["Intersport", "Atomic", "Rossignol", "Sport 2000"],
    "医药保健品及医疗器械": ["Fresenius", "B.Braun", "Smith & Nephew"],
    "食品": ["Danone", "Ferrero", "Lindt"],
    "乡村振兴特色产品": ["Fortnum & Mason", "Fauchon", "Ladurée"],
}

# ========== 3. 补充的南美玩家（品类 -> 品牌列表） ==========
ADD_LATAM = {
    "家用电器": ["Consul"],
    "电子消费品及信息产品": ["Positivo", "Multilaser"],
    "照明产品": ["Intral", "Lorenzetto"],
    "汽车配件": ["Metal Leve"],
    "五金": ["Dexter"],
    "工具": ["Dexter"],
    "家居用品": ["Magazine Luiza", "Falabella"],
    "卫浴设备": ["Deca"],
    "家具": ["Tok&Stok"],
    "家居装饰品": ["Etna"],
    "食品": ["Bauducco", "M. Dias Branco"],
    "宠物用品": ["Premier Pet"],
}

# ========== 4. 补充的俄罗斯玩家（品类 -> 品牌列表，独立地区 RU） ==========
ADD_RU = {
    "家居用品": ["Magnit", "X5 Retail", "Lenta", "Ozon", "Wildberries"],
    "电子消费品及信息产品": ["DNS", "M.Video", "Eldorado", "Citilink"],
    "食品": ["VkusVill"],
    "男女装": ["Gloria Jeans", "Melon Fashion Group", "Ostin"],
    "玩具": ["Detsky Mir"],
    "五金": ["Petrovich", "Stroiland"],
    "家具": ["Hoff"],
}


def main():
    with open(CHANNEL, "r", encoding="utf-8") as f:
        data = json.load(f)

    removed = 0
    added_eu = 0
    added_latam = 0
    added_ru = 0
    not_found_cn = []

    for cluster in data["clusters"]:
        for cat in cluster["categories"]:
            players = cat.get("players", [])
            # 删除中国品牌
            keep = []
            for p in players:
                if p in REMOVE_CN:
                    removed += 1
                else:
                    keep.append(p)
            cat["players"] = keep
            existing = set(keep)

            # 补欧洲
            for b in ADD_EU.get(cat["name"], []):
                if b not in existing:
                    keep.append(b)
                    existing.add(b)
                    added_eu += 1

            # 补南美
            for b in ADD_LATAM.get(cat["name"], []):
                if b not in existing:
                    keep.append(b)
                    existing.add(b)
                    added_latam += 1

            # 补俄罗斯
            for b in ADD_RU.get(cat["name"], []):
                if b not in existing:
                    keep.append(b)
                    existing.add(b)
                    added_ru += 1

            cat["players"] = keep

    with open(CHANNEL, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    total_players = sum(len(cat.get("players", [])) for cl in data["clusters"] for cat in cl["categories"])
    print(f"删除中国品牌: {removed} 个")
    print(f"新增欧洲: {added_eu} 个")
    print(f"新增南美: {added_latam} 个")
    print(f"新增俄罗斯: {added_ru} 个")
    print(f"更新后 players 总数(含跨品类重复): {total_players}")


if __name__ == "__main__":
    main()
