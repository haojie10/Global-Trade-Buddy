import urllib.request
import urllib.error
import json

url = "https://marketgraphic.cn/api/admin/entities/heal"
req = urllib.request.Request(
    url,
    headers={
        "Authorization": "Bearer automation_agent_secret",
        "Content-Type": "application/json"
    },
    method="POST"
)

try:
    with urllib.request.urlopen(req, timeout=30) as res:
        data = res.read().decode('utf-8')
        print("Success:", data)
except urllib.error.HTTPError as e:
    print(f"HTTP {e.code}: {e.read().decode('utf-8')}")
except Exception as e:
    print(f"Error: {e}")
