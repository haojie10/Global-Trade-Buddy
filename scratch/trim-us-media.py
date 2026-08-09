#!/usr/bin/env python3
"""
精简 channel-players.json 中的美国资讯来源（159 -> 99）。
按 (品类名, 来源名) 精确删除，只影响美国来源，保留欧美亚澳。
"""
import json

CHANNEL = "/Users/jason/Documents/Antigravity/Project/Globaltradebuddy/.antigravity/skills/report-news/references/channel-players.json"

# (品类名, 来源名) 精确删除清单 —— 基于影响力评估：
# - 与权威媒体重复的（WardsAuto vs Automotive News、CleanTechnica vs Electrek）
# - 博客/消费向低影响力（Tool Box Buzz、Pro Tool Reviews、Hodinkee）
# - 细分冷门或展会类（Glass Magazine、Global Fastener News、Atlanta Market）
# - 跨品类冗余引用（Sourcing Journal/WWD 在弱相关品类中的重复）
REMOVE = {
    "家用电器": ["Appliance Design", "Consumer Technology Association"],
    "电子消费品及信息产品": ["CNET", "IDC 报告"],
    "照明产品": ["Strategies in Light", "LightFair"],
    "新能源汽车及智慧出行": ["InsideEVs", "CleanTechnica", "Electrek"],
    "车辆": ["WardsAuto", "Auto Remarketing"],
    "汽车配件": ["Auto Care Association", "Modern Tire Dealer"],
    "摩托车": ["Cycle World", "Dealernews"],
    "动力、电力设备": ["Diesel & Gas Turbine Worldwide"],
    "通用机械及机械基础件": ["Design News", "Global Fastener News", "Fastener Technology International"],
    "加工机械设备": ["Packaging World"],
    "工程机械（室内/室外）": ["Diesel Progress", "AEM"],
    "农业机械（室内/室外）": ["Successful Farming", "AgriBusiness Global"],
    "工业自动化及智能制造": ["The Robot Report"],
    "工具": ["Tool Box Buzz", "Pro Tool Reviews"],
    "新材料及化工产品": ["Plastics News"],
    "新能源": ["Mercom Capital"],
    "建筑及装饰材料": ["Building Products Digest"],
    "卫浴设备": ["PM Engineer"],
    "餐厨器皿": ["KBB"],
    "玻璃工艺品": ["Glass Magazine"],
    "礼品及赠品": ["Promo Marketing", "SAGE"],
    "节日用品": ["Atlanta Market", "Progressive Grocer 季节性"],
    "家具": ["Furniture World", "High Point Market"],
    "编织及藤铁工艺品": ["Interior Design"],
    "家居装饰品": ["Home & Textiles Today"],
    "石材/铁艺制品（室外）": ["Stone World"],
    "地毯及挂毯": ["Floor Trends"],
    "童装": ["WWD Kids"],
    "内衣": ["Sourcing Journal"],
    "裘革皮羽绒及制品": ["WWD", "Sourcing Journal"],
    "服装饰物及配件": ["Accessories Council"],
    "家用纺织品": ["Sourcing Journal"],
    "箱包": ["WWD"],
    "玩具": ["Global Toy News"],
    "钟表眼镜": ["Hodinkee"],
    "个人护理用具": ["Beauty Packaging"],
    "宠物用品": ["Pet Product News", "Petfood Industry"],
    "医药保健品及医疗器械": ["Fierce MedTech", "Natural Products Insider", "Nutritional Outlook"],
    "乡村振兴特色产品": ["Specialty Food Magazine"],
    "食品": ["Supermarket News"],
}


def main():
    with open(CHANNEL, "r", encoding="utf-8") as f:
        data = json.load(f)

    removed = 0
    not_found = []
    for cluster in data["clusters"]:
        for cat in cluster["categories"]:
            targets = REMOVE.get(cat["name"], [])
            if not targets:
                continue
            media = cat.get("media", [])
            keep = []
            for m in media:
                if m["name"] in targets:
                    removed += 1
                    print(f"  ✂️ [{cat['name']}] {m['name']}")
                else:
                    keep.append(m)
            cat["media"] = keep
            # 记录未匹配到的目标（防止品类名写错）
            kept_names = {m["name"] for m in keep}
            for t in targets:
                if t not in kept_names and not any(m["name"] == t for m in media):
                    not_found.append((cat["name"], t))

    with open(CHANNEL, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    total = sum(len(cat.get("media", [])) for cl in data["clusters"] for cat in cl["categories"])
    print(f"\n已删除: {removed} 个美国来源")
    print(f"更新后总来源数: {total}")
    if not_found:
        print("⚠️ 未在数据中找到的删除目标:")
        for c, t in not_found:
            print(f"  - [{c}] {t}")


if __name__ == "__main__":
    main()
