#!/usr/bin/env python3
"""
将 channel-players.json 中的资讯源生成 Chrome 书签文件夹结构：
GTB资讯源
├── 7 大品类集群 (电子家电与智能出行 / 五金工具与机械建材 / ...)
│   └── 细分产品品类 (家用电器 / 电子消费品 / ...)
│       └── 资讯来源书签
写入前自动备份原 Bookmarks 文件。
"""
import json
import shutil
import sys
import time
import uuid
from datetime import datetime

BOOKMARKS = "/Users/jason/Library/Application Support/Google/Chrome/Default/Bookmarks"
CHANNEL = "/Users/jason/Documents/Antigravity/Project/Globaltradebuddy/.antigravity/skills/report-news/references/channel-players.json"

def chrome_ts():
    """Chrome 书签时间戳格式 (微秒, 1601年基准)"""
    return str(int((time.time() + 11644473600) * 1000000))

def main():
    with open(CHANNEL, "r", encoding="utf-8") as f:
        channel = json.load(f)

    # 1. 备份
    backup = BOOKMARKS + ".backup-" + datetime.now().strftime("%Y%m%d-%H%M%S")
    shutil.copy2(BOOKMARKS, backup)
    print(f"[备份] 已备份书签 -> {backup}")

    with open(BOOKMARKS, "r", encoding="utf-8") as f:
        data = json.load(f)

    bar = data["roots"]["bookmark_bar"]
    # 分配全局唯一 id（Chrome 要求正整型）
    used_ids = set()

    def collect_ids(node):
        if isinstance(node.get("id"), int):
            used_ids.add(node["id"])
        for ch in node.get("children", []):
            collect_ids(ch)
    collect_ids(data["roots"])
    next_id = max(used_ids, default=0) + 1

    # 2. 构建书签节点
    def make_folder(name):
        nonlocal next_id
        node = {
            "children": [],
            "date_added": chrome_ts(),
            "date_last_used": "0",
            "date_modified": chrome_ts(),
            "guid": uuid.uuid4().hex,
            "id": next_id,
            "name": name,
            "type": "folder",
        }
        next_id += 1
        return node

    def make_url(name, url):
        nonlocal next_id
        node = {
            "date_added": chrome_ts(),
            "date_last_used": "0",
            "guid": uuid.uuid4().hex,
            "id": next_id,
            "name": name,
            "type": "url",
            "url": url,
        }
        next_id += 1
        return node

    # 3. 检查是否已存在 -> 更新模式：删除旧文件夹再重建
    for i, child in enumerate(bar.get("children", [])):
        if child.get("name") == "GTB资讯源" and child.get("type") == "folder":
            bar["children"].pop(i)
            print("[更新] 已移除旧版 GTB资讯源 文件夹，重建为最新版本。")
            break

    root_folder = make_folder("GTB资讯源")
    for cluster in channel["clusters"]:
        cluster_folder = make_folder(cluster["name"])
        for cat in cluster["categories"]:
            cat_folder = make_folder(cat["name"])
            for m in cat.get("media", []):
                cat_folder["children"].append(make_url(m["name"], m["url"]))
            if cat_folder["children"]:
                cluster_folder["children"].append(cat_folder)
        if cluster_folder["children"]:
            root_folder["children"].append(cluster_folder)

    bar["children"].append(root_folder)
    bar["date_modified"] = chrome_ts()

    # 4. 写回（保留 2 空格缩进，Chrome 兼容）
    with open(BOOKMARKS, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    n_cat = sum(1 for c in channel["clusters"] for _ in c["categories"])
    n_url = sum(1 for c in channel["clusters"] for cat in c["categories"] for _ in cat.get("media", []))
    print(f"[完成] 已写入 GTB资讯源: {len(channel['clusters'])} 大品类 / {n_cat} 细分品类 / {n_url} 个资讯来源")
    print("[提醒] Chrome 正在运行时，请完全退出并重启 Chrome 后生效！")

if __name__ == "__main__":
    sys.exit(main())
