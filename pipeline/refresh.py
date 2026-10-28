"""매일 데이터 갱신 (GitHub Actions에서 실행)
1) DB에서 신청 기간 안의 정책을 읽고  2) 새로 생기거나 원문이 바뀐 정책만 Opus로 정형화
3) 범위 검사  4) export_web.py로 ../src/data 갱신
환경변수: DATABASE_URL, ANTHROPIC_API_KEY
선택: REFRESH_MAX(한 번에 처리할 최대 건수, 기본 150), REFRESH_MAX_USD(비용 상한, 기본 5)"""
import json, os, re, sys, hashlib, subprocess
import psycopg2, anthropic
from dotenv import load_dotenv
load_dotenv(".env")
from extract_v2 import params, verify

MAX_NEW = int(os.getenv("REFRESH_MAX", 150))
MAX_USD = float(os.getenv("REFRESH_MAX_USD", 5))
EST_USD = 0.04          # Opus 5.5 실시간 호출 1건 예상 비용 (출력 약 1,500토큰)
RES, HASH = "data/results_v2.jsonl", "data/hashes.json"

SQL = """SELECT plcy_no, name, org_name,
         concat_ws(E'\\n\\n', description, support_content, extra_qualification,
                   earn_etc, exclusion, raw->>'etcMttrCn', apply_method) AS text
  FROM policies
  WHERE apply_end >= current_date
     OR (apply_end IS NULL AND (biz_end IS NULL OR biz_end >= current_date))"""

def fetch():
    conn = psycopg2.connect(os.environ["DATABASE_URL"]); conn.set_session(readonly=True)
    cur = conn.cursor(); cur.execute(SQL)
    return [{"plcy_no": a, "name": b, "org": c, "text": d} for a, b, c, d in cur.fetchall()]

def range_check(x):
    for k in ("min_age", "max_age"):
        if isinstance(x.get(k), int) and not 0 <= x[k] <= 100: x[k] = None
    if isinstance(x.get("min_age"), int) and isinstance(x.get("max_age"), int) and x["min_age"] > x["max_age"]:
        x["min_age"] = x["max_age"] = None
    for k, lo, hi in (("income_median_pct_max", 20, 300), ("income_annual_max_manwon", 500, 50000),
                      ("asset_max_manwon", 100, 200000), ("residence_min_months", 1, 120), ("benefit_amount_max_manwon", 1, 100000)):
        if isinstance(x.get(k), int) and not lo <= x[k] <= hi: x[k] = None
    for k in ("apply_start", "apply_end"):
        if x.get(k) and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", x[k]): x[k] = None
    if x.get("apply_start") and x.get("apply_end") and x["apply_start"] > x["apply_end"]:
        x["apply_start"] = x["apply_end"] = None
    return x

def main():
    rows = fetch()
    results = {json.loads(l)["plcy_no"]: json.loads(l) for l in open(RES)}
    hashes = json.load(open(HASH))
    digest = lambda p: hashlib.sha1((p["name"] + "\n" + p["text"]).encode()).hexdigest()
    todo = [p for p in rows if hashes.get(p["plcy_no"]) != digest(p) or p["plcy_no"] not in results]
    limit = min(MAX_NEW, int(MAX_USD / EST_USD))
    print(f"DB 정책 {len(rows)}건 중 새로 정리할 정책 {len(todo)}건 (이번 실행 상한 {limit}건)")
    client = anthropic.Anthropic(); done = 0; out_tok = 0
    for p in todo[:limit]:
        try:
            r = client.messages.create(**params(p))
            if r.stop_reason == "max_tokens":
                r = client.messages.create(**params(p, 5000))
            tool = [b for b in r.content if b.type == "tool_use"]
            if not tool: print("  도구 응답 없음:", p["name"][:30]); continue
            out = range_check(verify(tool[0].input, p["name"] + "\n" + p["text"]))
            results[p["plcy_no"]] = {"plcy_no": p["plcy_no"], "name": p["name"], "org": p["org"], "result": out}
            hashes[p["plcy_no"]] = digest(p); done += 1; out_tok += r.usage.output_tokens
            print(f"  ✓ {p['name'][:40]}")
        except Exception as e:
            print("  실패:", p["name"][:30], e)
    with open(RES, "w") as f:
        for v in results.values(): f.write(json.dumps(v, ensure_ascii=False) + "\n")
    json.dump(hashes, open(HASH, "w"), separators=(",", ":"))
    print(f"정리 완료 {done}건, 출력 토큰 {out_tok} (약 ${done * EST_USD:.2f} 이하)")
    subprocess.run([sys.executable, "export_web.py"], check=True)
    summary = os.getenv("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a") as f:
            f.write(f"### 정책 데이터 갱신\n- DB 정책 {len(rows)}건\n- 새로 정리 {done}건 / 대기 {max(len(todo) - done, 0)}건\n")

if __name__ == "__main__":
    main()
