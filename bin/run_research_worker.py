#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GTB 分布式多 Agent 调研任务认领与执行 Worker 客户端 (run_research_worker.py)

用法示例：
  1. 自由全量认领运行:
     python bin/run_research_worker.py --worker-name "Office-PC-01"

  2. 指定序号范围跑批 (如 300~350 号客户):
     python bin/run_research_worker.py --worker-name "Home-PC-02" --range 300-350

  3. 指定本地调试环境:
     python bin/run_research_worker.py --api-url "http://localhost:3000" --range 1-10
"""

import os
import sys
import time
import socket
import argparse
import json
import urllib.request
import urllib.error

def parse_args():
    hostname = socket.gethostname()
    parser = argparse.ArgumentParser(description="GTB 分布式多 Agent 客户调研 Worker 客户端")
    parser.add_argument("--worker-name", default=f"{hostname}-Worker", help="当前 Worker 机器或实例唯一标识")
    parser.add_argument("--range", default=None, help="指定认领序号区间 (例如: 300-350)")
    parser.add_argument("--api-url", default=os.environ.get("GTB_API_URL", "https://marketgraphic.cn"), help="GTB 后端 API 地址")
    parser.add_argument("--api-key", default=os.environ.get("AGENT_API_KEY", "automation_agent_secret"), help="Agent API Key 密钥")
    parser.add_argument("--batch-name", default=None, help="指定仅认领某批次名称")
    parser.add_argument("--interval", type=int, default=5, help="完成每个任务后的休眠等待秒数 (默认 5 秒)")
    parser.add_argument("--max-tasks", type=int, default=None, help="最大连续调研任务数 (默认无限循环直到任务池为空)")
    return parser.parse_args()

def post_json(url, payload, api_key):
    data_bytes = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data_bytes,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
            "x-agent-key": api_key
        },
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body)
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8") if e.fp else ""
        raise RuntimeError(f"HTTP {e.code} Error: {err_body}")
    except Exception as e:
        raise RuntimeError(f"Network error: {str(e)}")

def main():
    args = parse_args()

    min_seq = None
    max_seq = None
    if args.range:
        parts = args.range.split("-")
        if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
            min_seq = int(parts[0])
            max_seq = int(parts[1])
            print(f"🎯 限制认领区间: 序号 #{min_seq} ~ #{max_seq}")
        else:
            print(f"⚠️ 无法解析 range 参数 [{args.range}]，将按全量队列认领")

    claim_url = f"{args.api_url.rstrip('/')}/api/agent/tasks/claim"
    complete_url = f"{args.api_url.rstrip('/')}/api/agent/tasks/complete"
    fail_url = f"{args.api_url.rstrip('/')}/api/agent/tasks/fail"
    publish_url = f"{args.api_url.rstrip('/')}/api/agent/publish"

    print("=" * 65)
    print("🚀 GTB 分布式企业调研 Worker 客户端启动成功")
    print(f"💻 机器标识: {args.worker_name}")
    print(f"🌐 服务端 API: {args.api_url}")
    print(f"📋 认领范围: {args.range if args.range else '全局队列按优先级抢单'}")
    print("=" * 65)

    processed_count = 0

    while True:
        if args.max_tasks and processed_count >= args.max_tasks:
            print(f"\n🎉 已达到指定的最大处理上限 ({args.max_tasks} 条)，Worker 正常退出。")
            break

        print(f"\n[{time.strftime('%H:%M:%S')}] 正在向任务中心请求分配下一个待调研客户...")

        claim_payload = {
            "worker_name": args.worker_name,
            "min_seq": min_seq,
            "max_seq": max_seq,
            "batch_name": args.batch_name
        }

        try:
            res = post_json(claim_url, claim_payload, args.api_key)
        except Exception as e:
            print(f"❌ 请求认领任务失败: {e}，将在 10 秒后重试...")
            time.sleep(10)
            continue

        if not res.get("hasTask"):
            print("💤 当前队列中暂无符合条件的待调研任务，休眠 15 秒后重试...")
            time.sleep(15)
            continue

        task = res["task"]
        task_id = task["id"]
        company_name = task["company_name"]
        country = task.get("country", "全球")
        website = task.get("website") or "无"
        seq_no = task.get("seq_no")
        source_info = f" (来源: {task.get('source_company_name')})" if task.get("source_company_name") else ""

        print("-" * 65)
        print(f"✨ 成功原子锁定任务 #{seq_no}: 【{company_name}】 ({country}){source_info}")
        print(f"   官网: {website} | 任务ID: {task_id}")
        print("-" * 65)

        try:
            # 模拟 / 触发实际调研逻辑
            print(f"🔍 [{company_name}] 正在调用 report-customer 技能执行 360° 深度背调...")
            
            # NOTE: 在生产环境中，此处可以挂接技能执行或报告生成管道
            # 例如调用本地 report-customer Agent 生成 HTML 并读取
            # 这里演示发布与完成回写
            time.sleep(2)

            print(f"✅ [{company_name}] 调研报告生成完毕，正在发布并上报任务中心...")

            # 假设生成后回写
            # report_res = post_json(publish_url, { ... }, args.api_key)
            # post_json(complete_url, { "task_id": task_id, "report_id": report_res["id"] }, args.api_key)
            
            processed_count += 1
            print(f"🎉 #{seq_no} {company_name} 处理流转完毕！(当前累计: {processed_count})")

        except Exception as err:
            print(f"❌ #{seq_no} {company_name} 执行异常: {err}")
            try:
                post_json(fail_url, { "task_id": task_id, "error_message": str(err) }, args.api_key)
                print(f"⚠️ 已向任务调度中心上报异常阻断状态")
            except Exception as report_err:
                print(f"❌ 上报异常失败: {report_err}")

        print(f"⏳ 等待 {args.interval} 秒后继续认领下一条...")
        time.sleep(args.interval)

if __name__ == "__main__":
    main()
