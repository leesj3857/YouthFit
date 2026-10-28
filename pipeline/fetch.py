"""신청 기간 안의 정책 원문을 policies.jsonl로 저장 (batch_v2.py로 전체 재정리할 때 사용)"""
import json
from refresh import fetch
rows = fetch()
with open("policies.jsonl", "w") as f:
    for r in rows: f.write(json.dumps(r, ensure_ascii=False) + "\n")
print("saved", len(rows))
