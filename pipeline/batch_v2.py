"""v2 배치 (Opus 5.5).
  python batch_v2.py submit golden   # golden 30건 파일럿
  python batch_v2.py submit all      # 전체
  python batch_v2.py status [golden|all]
  python batch_v2.py collect [golden|all]   → results_v2.jsonl / sample_v2.jsonl
비용 상한 MAX_USD를 넘을 것으로 예상되면 제출하지 않음."""
import json, sys, os, anthropic
from dotenv import load_dotenv
load_dotenv(".env")
from extract_v2 import params, verify
client = anthropic.Anthropic()

MAX_USD = {"golden": 2, "all": 60}
# Opus 5.5 배치 단가 ($/백만 토큰): 입력 2, 출력 10, 캐시읽기 0.2(보수적으로 할인 미적용)
P_IN, P_OUT, P_CR = 2.0, 10.0, 0.2
OUT_EST = 1500          # 1건당 출력 토큰 추정 (파일럿 실측으로 갱신)
SYS_TOK, TEXT_TOK = 4500, 500

cmd = sys.argv[1]; scope = sys.argv[2] if len(sys.argv) > 2 else "all"
idf, outf = f"batch_v2_{scope}.txt", ("sample_v2.jsonl" if scope == "golden" else "data/results_v2.jsonl")
rows = [json.loads(l) for l in open("policies.jsonl")]
if scope == "golden":
    gid = {g["plcy_no"] for g in json.load(open("golden.json"))}
    rows = [r for r in rows if r["plcy_no"] in gid]

if cmd == "submit":
    if os.path.exists(idf) and "--force" not in sys.argv:
        sys.exit(f"이미 제출함: {open(idf).read().strip()}")
    n = len(rows)
    est = (n * TEXT_TOK * P_IN + n * SYS_TOK * P_CR + SYS_TOK * 5 + n * OUT_EST * P_OUT) / 1e6
    worst = (n * (TEXT_TOK + SYS_TOK) * P_IN + n * 2500 * P_OUT) / 1e6   # 캐시 없음 + 출력 최대
    print(f"{n}건 예상 ${est:.2f}, 최악 ${worst:.2f} (상한 ${MAX_USD[scope]})")
    if worst > MAX_USD[scope]:
        sys.exit("최악의 경우 상한 초과 → 제출 안 함")
    b = client.messages.batches.create(requests=[{"custom_id": r["plcy_no"], "params": params(r)} for r in rows])
    open(idf, "w").write(b.id); print("제출:", b.id)

elif cmd == "status":
    b = client.messages.batches.retrieve(open(idf).read().strip()); print(b.processing_status, b.request_counts)

elif cmd == "collect":
    by = {r["plcy_no"]: r for r in rows}
    t = {"in": 0, "cw": 0, "cr": 0, "out": 0}; ok = bad = 0
    with open(outf, "w") as f:
        for res in client.messages.batches.results(open(idf).read().strip()):
            p = by[res.custom_id]
            if res.result.type != "succeeded":
                bad += 1; print("실패", res.custom_id, res.result.type); continue
            m = res.result.message; u = m.usage
            t["in"] += u.input_tokens; t["out"] += u.output_tokens
            t["cw"] += u.cache_creation_input_tokens or 0; t["cr"] += u.cache_read_input_tokens or 0
            tool = [b for b in m.content if b.type == "tool_use"]
            if not tool or m.stop_reason == "max_tokens":
                bad += 1; print("불완전", res.custom_id, m.stop_reason); continue
            out = verify(tool[0].input, p["name"] + "\n" + p["text"])
            f.write(json.dumps({"plcy_no": p["plcy_no"], "name": p["name"], "org": p["org"], "result": out}, ensure_ascii=False) + "\n"); ok += 1
    usd = (t["in"] * P_IN + t["cw"] * 5 + t["cr"] * P_CR + t["out"] * P_OUT) / 1e6
    print(f"성공 {ok} 실패 {bad} 토큰 {t} → 약 ${usd:.2f}, 1건당 출력 {t['out'] / max(ok, 1):.0f}")
