#!/usr/bin/env python3
"""
向 channel-players.json 补充地区资讯来源（欧洲各国 / 南美 / 日韩 / 澳洲）。
幂等：同一 URL 已存在则跳过。不删除任何现有来源。
"""
import json

CHANNEL = "/Users/jason/Documents/Antigravity/Project/Globaltradebuddy/.antigravity/skills/report-news/references/channel-players.json"

# 品类名 -> 新增来源列表 [(显示名, URL)]
ADDITIONS = {
    # ---- 电子家电与智能出行 ----
    "家用电器": [
        ("Appliance Retailer (澳洲家电)", "https://www.applianceretailer.com.au/"),
        ("Elektro Retail Magazine (荷兰电子零售)", "https://elektroretailmagazine.nl/"),
    ],
    "电子消费品及信息产品": [
        ("Appliance Retailer (澳洲家电)", "https://www.applianceretailer.com.au/"),
        ("Elektro Retail Magazine (荷兰电子零售)", "https://elektroretailmagazine.nl/"),
    ],
    "新能源汽车及智慧出行": [
        ("日经中文网 Nikkei (日本)", "https://cn.nikkei.com/"),
    ],
    "车辆": [
        ("日经中文网 Nikkei (日本)", "https://cn.nikkei.com/"),
    ],
    # ---- 五金工具与机械建材 ----
    "五金": [
        ("ANZ Hardware Journal (澳洲五金)", "https://www.anzhardware.com.au/"),
    ],
    "建筑及装饰材料": [
        ("Le Moniteur (法国建材)", "https://www.lemoniteur.fr/"),
    ],
    # ---- 日用百货与餐厨陶瓷 ----
    "家居用品": [
        ("Lebensmittel Zeitung (德国LZ)", "https://www.lebensmittelzeitung.net/"),
        ("LSA Conso (法国)", "https://www.lsa-conso.fr/"),
        ("GDO Week (意大利)", "https://www.gdoweek.it/"),
        ("Alimarket (西班牙)", "https://www.alimarket.es/"),
        ("Wiadomości Handlowe (波兰)", "https://wiadomoscihandlowe.pl/"),
        ("SuperHiper ABRAS (巴西)", "http://superhiper.com.br/"),
        ("ANTAD (墨西哥零售协会)", "https://antad.net/"),
        ("Inside Retail Australia (澳洲)", "https://insideretail.com.au/"),
        ("Retailbiz Australia (澳洲)", "https://www.retailbiz.com.au/"),
        ("ILACAD World Retail (拉美)", "https://www.ilacad.com/"),
        ("日经中文网 Nikkei (日本)", "https://cn.nikkei.com/"),
    ],
    "礼品及赠品": [
        ("LSA Conso (法国)", "https://www.lsa-conso.fr/"),
        ("GDO Week (意大利)", "https://www.gdoweek.it/"),
        ("Alimarket (西班牙)", "https://www.alimarket.es/"),
        ("Inside Retail Australia (澳洲)", "https://insideretail.com.au/"),
    ],
    "节日用品": [
        ("SuperHiper ABRAS (巴西)", "http://superhiper.com.br/"),
        ("ANTAD (墨西哥零售协会)", "https://antad.net/"),
        ("Retailbiz Australia (澳洲)", "https://www.retailbiz.com.au/"),
    ],
    # ---- 家居家具与园林装饰 ----
    "家具": [
        ("Furniture News (英国)", "https://www.furniturenews.net/"),
        ("Möbelmarkt (德国家具)", "https://www.moebelmarkt.de/"),
        ("日经中文网 Nikkei (日本)", "https://cn.nikkei.com/"),
        ("Inside Retail Australia (澳洲)", "https://insideretail.com.au/"),
    ],
    "家居装饰品": [
        ("LSA Conso (法国)", "https://www.lsa-conso.fr/"),
        ("Inside Retail Australia (澳洲)", "https://insideretail.com.au/"),
        ("ILACAD World Retail (拉美)", "https://www.ilacad.com/"),
    ],
    # ---- 服装纺织与鞋帽箱包 ----
    "男女装": [
        ("繊研新聞 Senken (日本时尚)", "https://senken.co.jp/"),
        ("Apparel Resources (印度/南亚)", "https://apparelresources.com/"),
        ("Inside Retail Australia (澳洲)", "https://insideretail.com.au/"),
    ],
    "童装": [
        ("繊研新聞 Senken (日本时尚)", "https://senken.co.jp/"),
    ],
    "内衣": [
        ("繊研新聞 Senken (日本时尚)", "https://senken.co.jp/"),
    ],
    "运动服及休闲服": [
        ("繊研新聞 Senken (日本时尚)", "https://senken.co.jp/"),
    ],
    "服装饰物及配件": [
        ("繊研新聞 Senken (日本时尚)", "https://senken.co.jp/"),
    ],
    "纺织原料面料": [
        ("繊研新聞 Senken (日本时尚)", "https://senken.co.jp/"),
        ("Textile Today (孟加拉)", "https://www.textiletoday.com.bd/"),
    ],
    "家用纺织品": [
        ("繊研新聞 Senken (日本时尚)", "https://senken.co.jp/"),
    ],
    "鞋": [
        ("繊研新聞 Senken (日本时尚)", "https://senken.co.jp/"),
        ("World Footwear (葡萄牙)", "https://www.worldfootwear.com/"),
    ],
    "箱包": [
        ("繊研新聞 Senken (日本时尚)", "https://senken.co.jp/"),
    ],
    # ---- 玩具母婴与礼品个护 ----
    "玩具": [
        ("TOYMAG Asia (亚洲玩具)", "https://www.toymagasia.com/"),
        ("SuperHiper ABRAS (巴西)", "http://superhiper.com.br/"),
    ],
    "孕婴童用品": [
        ("SuperHiper ABRAS (巴西)", "http://superhiper.com.br/"),
    ],
    "个人护理用具": [
        ("Cosmetics Business (英国)", "https://www.cosmeticsbusiness.com/"),
    ],
    "宠物用品": [
        ("GlobalPETS (欧洲宠物)", "https://www.globalpets.com/"),
    ],
    "体育及旅游休闲用品": [
        ("SGI Europe (欧洲体育)", "https://www.sgieurope.com/"),
    ],
    # ---- 医药保健与食品特色 ----
    "食品": [
        ("Lebensmittel Zeitung (德国LZ)", "https://www.lebensmittelzeitung.net/"),
        ("LSA Conso (法国)", "https://www.lsa-conso.fr/"),
        ("GDO Week (意大利)", "https://www.gdoweek.it/"),
        ("Alimarket (西班牙)", "https://www.alimarket.es/"),
        ("Wiadomości Handlowe (波兰)", "https://wiadomoscihandlowe.pl/"),
        ("SuperHiper ABRAS (巴西)", "http://superhiper.com.br/"),
        ("ANTAD (墨西哥零售协会)", "https://antad.net/"),
        ("Inside Retail Australia (澳洲)", "https://insideretail.com.au/"),
        ("ILACAD World Retail (拉美)", "https://www.ilacad.com/"),
        ("日经中文网 Nikkei (日本)", "https://cn.nikkei.com/"),
    ],
    "乡村振兴特色产品": [
        ("SuperHiper ABRAS (巴西)", "http://superhiper.com.br/"),
        ("Tridge (全球农产品贸易数据)", "https://www.tridge.com/"),
    ],
    # ================= 第二轮：补齐 LATAM/JP/AU/EU 缺口 (均已验证) =================
    # ---- 电子家电与智能出行 ----
    "照明产品": [
        ("日刊工業新聞 Newswitch (日本)", "https://newswitch.jp/"),
        ("Lighting Council Australia (澳洲)", "https://www.lightingcouncil.com.au/"),
    ],
    "电子电气产品": [
        ("日刊工業新聞 Newswitch (日本)", "https://newswitch.jp/"),
    ],
    "汽车配件": [
        ("E-handel (北欧)", "https://ehandel.com/"),
    ],
    "摩托车": [
        ("BikeBiz (英国)", "https://bikebiz.com/"),
    ],
    "自行车": [
        ("BikeBiz (英国)", "https://bikebiz.com/"),
    ],
    # ---- 五金工具与机械建材 ----
    "动力、电力设备": [
        ("日刊工業新聞 Newswitch (日本)", "https://newswitch.jp/"),
        ("Manufacturers' Monthly (澳洲)", "https://www.manmonthly.com.au/"),
    ],
    "通用机械及机械基础件": [
        ("日刊工業新聞 Newswitch (日本)", "https://newswitch.jp/"),
        ("Manufacturers' Monthly (澳洲)", "https://www.manmonthly.com.au/"),
    ],
    "加工机械设备": [
        ("日刊工業新聞 Newswitch (日本)", "https://newswitch.jp/"),
        ("Australian Manufacturing (澳洲)", "https://www.australianmanufacturing.com.au/"),
    ],
    "工程机械（室内/室外）": [
        ("日刊工業新聞 Newswitch (日本)", "https://newswitch.jp/"),
        ("Manufacturers' Monthly (澳洲)", "https://www.manmonthly.com.au/"),
    ],
    "农业机械（室内/室外）": [
        ("日刊工業新聞 Newswitch (日本)", "https://newswitch.jp/"),
        ("Manufacturers' Monthly (澳洲)", "https://www.manmonthly.com.au/"),
    ],
    "工业自动化及智能制造": [
        ("日刊工業新聞 Newswitch (日本)", "https://newswitch.jp/"),
        ("Australian Manufacturing (澳洲)", "https://www.australianmanufacturing.com.au/"),
    ],
    "工具": [
        ("E-handel (北欧)", "https://ehandel.com/"),
    ],
    "新材料及化工产品": [
        ("日刊工業新聞 Newswitch (日本)", "https://newswitch.jp/"),
    ],
    "新能源": [
        ("日刊工業新聞 Newswitch (日本)", "https://newswitch.jp/"),
    ],
    "建筑及装饰材料": [
        ("日刊工業新聞 Newswitch (日本)", "https://newswitch.jp/"),
    ],
    "卫浴设备": [
        ("日刊工業新聞 Newswitch (日本)", "https://newswitch.jp/"),
    ],
    # ---- 日用百货与餐厨陶瓷 ----
    "日用陶瓷": [
        ("Diamond Retail Media (日本)", "https://diamond-rm.net/"),
    ],
    "餐厨器皿": [
        ("Diamond Retail Media (日本)", "https://diamond-rm.net/"),
    ],
    "玻璃工艺品": [
        ("Diamond Retail Media (日本)", "https://diamond-rm.net/"),
    ],
    "工艺陶瓷": [
        ("Diamond Retail Media (日本)", "https://diamond-rm.net/"),
    ],
    # ---- 家居家具与园林装饰 ----
    "编织及藤铁工艺品": [
        ("Inside Retail Australia (澳洲)", "https://insideretail.com.au/"),
        ("E-handel (北欧)", "https://ehandel.com/"),
    ],
    "园林用品": [
        ("Inside Retail Australia (澳洲)", "https://insideretail.com.au/"),
    ],
    "石材/铁艺制品（室外）": [
        ("Australian Manufacturing (澳洲)", "https://www.australianmanufacturing.com.au/"),
    ],
    "地毯及挂毯": [
        ("Diamond Retail Media (日本)", "https://diamond-rm.net/"),
    ],
    # ---- 服装纺织与鞋帽箱包 ----
    "童装": [
        ("Drapers (英国)", "https://www.drapersonline.com/"),
    ],
    "内衣": [
        ("Drapers (英国)", "https://www.drapersonline.com/"),
    ],
    "运动服及休闲服": [
        ("Inside Retail Australia (澳洲)", "https://insideretail.com.au/"),
    ],
    "裘革皮羽绒及制品": [
        ("Sourcing Journal (美国)", "https://sourcingjournal.com/"),
    ],
    "服装饰物及配件": [
        ("Inside Retail Australia (澳洲)", "https://insideretail.com.au/"),
    ],
    "家用纺织品": [
        ("Drapers (英国)", "https://www.drapersonline.com/"),
    ],
    # ---- 玩具母婴与礼品个护 ----
    "玩具": [
        ("Inside Retail Australia (澳洲)", "https://insideretail.com.au/"),
    ],
    "孕婴童用品": [
        ("Inside Retail Australia (澳洲)", "https://insideretail.com.au/"),
    ],
    "钟表眼镜": [
        ("Diamond Retail Media (日本)", "https://diamond-rm.net/"),
    ],
    "个人护理用具": [
        ("E-handel (北欧)", "https://ehandel.com/"),
    ],
    "宠物用品": [
        ("Inside Retail Australia (澳洲)", "https://insideretail.com.au/"),
    ],
    "办公文具": [
        ("Diamond Retail Media (日本)", "https://diamond-rm.net/"),
    ],
    "体育及旅游休闲用品": [
        ("Inside Retail Australia (澳洲)", "https://insideretail.com.au/"),
    ],
    # ---- 医药保健与食品特色 ----
    "医药保健品及医疗器械": [
        ("日刊工業新聞 Newswitch (日本)", "https://newswitch.jp/"),
        ("E-handel (北欧)", "https://ehandel.com/"),
    ],
    # ================= 第三轮：韩国 + 南美补充 (已验证) =================
    "家用电器": [
        ("Daily Trend (韩国零售)", "https://www.dailytrend.co.kr/"),
    ],
    "电子消费品及信息产品": [
        ("Daily Trend (韩国零售)", "https://www.dailytrend.co.kr/"),
        ("ILACAD World Retail (拉美)", "https://www.ilacad.com/"),
    ],
    "电子电气产品": [
        ("ILACAD World Retail (拉美)", "https://www.ilacad.com/"),
    ],
    "照明产品": [
        ("ILACAD World Retail (拉美)", "https://www.ilacad.com/"),
    ],
    "新能源汽车及智慧出行": [
        ("Daily Trend (韩国零售)", "https://www.dailytrend.co.kr/"),
    ],
    "车辆": [
        ("Daily Trend (韩国零售)", "https://www.dailytrend.co.kr/"),
    ],
    "汽车配件": [
        ("Daily Trend (韩国零售)", "https://www.dailytrend.co.kr/"),
    ],
    "摩托车": [
        ("Daily Trend (韩国零售)", "https://www.dailytrend.co.kr/"),
    ],
    "自行车": [
        ("Daily Trend (韩国零售)", "https://www.dailytrend.co.kr/"),
    ],
    "五金": [
        ("ILACAD World Retail (拉美)", "https://www.ilacad.com/"),
        ("Daily Trend (韩国零售)", "https://www.dailytrend.co.kr/"),
    ],
    "工具": [
        ("Daily Trend (韩国零售)", "https://www.dailytrend.co.kr/"),
    ],
    "建筑及装饰材料": [
        ("ILACAD World Retail (拉美)", "https://www.ilacad.com/"),
    ],
    "卫浴设备": [
        ("Daily Trend (韩国零售)", "https://www.dailytrend.co.kr/"),
    ],
    "日用陶瓷": [
        ("ILACAD World Retail (拉美)", "https://www.ilacad.com/"),
    ],
    "餐厨器皿": [
        ("ILACAD World Retail (拉美)", "https://www.ilacad.com/"),
    ],
    "玻璃工艺品": [
        ("ILACAD World Retail (拉美)", "https://www.ilacad.com/"),
    ],
    "工艺陶瓷": [
        ("ILACAD World Retail (拉美)", "https://www.ilacad.com/"),
    ],
    "编织及藤铁工艺品": [
        ("ILACAD World Retail (拉美)", "https://www.ilacad.com/"),
        ("Daily Trend (韩国零售)", "https://www.dailytrend.co.kr/"),
    ],
    "园林用品": [
        ("ILACAD World Retail (拉美)", "https://www.ilacad.com/"),
    ],
    "石材/铁艺制品（室外）": [
        ("ILACAD World Retail (拉美)", "https://www.ilacad.com/"),
    ],
    "地毯及挂毯": [
        ("ILACAD World Retail (拉美)", "https://www.ilacad.com/"),
    ],
    "男女装": [
        ("Daily Trend (韩国零售)", "https://www.dailytrend.co.kr/"),
    ],
    "童装": [
        ("Daily Trend (韩国零售)", "https://www.dailytrend.co.kr/"),
    ],
    "内衣": [
        ("Daily Trend (韩国零售)", "https://www.dailytrend.co.kr/"),
    ],
    "运动服及休闲服": [
        ("Daily Trend (韩国零售)", "https://www.dailytrend.co.kr/"),
    ],
    "裘革皮羽绒及制品": [
        ("Daily Trend (韩国零售)", "https://www.dailytrend.co.kr/"),
    ],
    "服装饰物及配件": [
        ("Daily Trend (韩国零售)", "https://www.dailytrend.co.kr/"),
    ],
    "纺织原料面料": [
        ("Daily Trend (韩国零售)", "https://www.dailytrend.co.kr/"),
    ],
    "家用纺织品": [
        ("Daily Trend (韩国零售)", "https://www.dailytrend.co.kr/"),
    ],
    "鞋": [
        ("Daily Trend (韩国零售)", "https://www.dailytrend.co.kr/"),
    ],
    "箱包": [
        ("Daily Trend (韩国零售)", "https://www.dailytrend.co.kr/"),
    ],
    "玩具": [
        ("Daily Trend (韩国零售)", "https://www.dailytrend.co.kr/"),
    ],
    "孕婴童用品": [
        ("Daily Trend (韩国零售)", "https://www.dailytrend.co.kr/"),
    ],
    "钟表眼镜": [
        ("Daily Trend (韩国零售)", "https://www.dailytrend.co.kr/"),
    ],
    "个人护理用具": [
        ("Daily Trend (韩国零售)", "https://www.dailytrend.co.kr/"),
    ],
    "宠物用品": [
        ("Daily Trend (韩国零售)", "https://www.dailytrend.co.kr/"),
    ],
    "办公文具": [
        ("Daily Trend (韩国零售)", "https://www.dailytrend.co.kr/"),
    ],
    "体育及旅游休闲用品": [
        ("Daily Trend (韩国零售)", "https://www.dailytrend.co.kr/"),
    ],
    "食品": [
        ("Daily Trend (韩国零售)", "https://www.dailytrend.co.kr/"),
    ],
    "乡村振兴特色产品": [
        ("ILACAD World Retail (拉美)", "https://www.ilacad.com/"),
    ],
}


def main():
    with open(CHANNEL, "r", encoding="utf-8") as f:
        data = json.load(f)

    added_count = 0
    skipped_count = 0
    not_found = []

    for cluster in data["clusters"]:
        for cat in cluster["categories"]:
            additions = ADDITIONS.get(cat["name"], [])
            if not additions:
                continue
            existing_urls = {m["url"].rstrip("/") for m in cat.get("media", [])}
            for name, url in additions:
                key = url.rstrip("/")
                if key in existing_urls:
                    skipped_count += 1
                    continue
                cat.setdefault("media", []).append({"name": name, "url": url})
                existing_urls.add(key)
                added_count += 1

    with open(CHANNEL, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"新增: {added_count} 个来源")
    print(f"跳过(已存在): {skipped_count} 个")

    # 校验品类名是否都匹配
    all_names = {cat["name"] for cl in data["clusters"] for cat in cl["categories"]}
    for cat_name in ADDITIONS:
        if cat_name not in all_names:
            not_found.append(cat_name)
    if not_found:
        print(f"⚠️ 未匹配到的品类: {not_found}")

    total = sum(len(cat.get("media", [])) for cl in data["clusters"] for cat in cl["categories"])
    print(f"更新后总来源数: {total}")


if __name__ == "__main__":
    main()
