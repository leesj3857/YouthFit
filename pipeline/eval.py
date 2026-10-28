import json, re
F = ["individual_applicable", "policy_type", "min_age", "max_age", "employment", "income_median_pct_max",
     "income_annual_max_manwon", "residence", "residence_sido", "marital", "homeless_required",
     "apply_start", "apply_end", "first_come"]

def rnorm(s):
    s = re.sub(r"\s+", "", s)
    s = re.sub(r"^(서울|부산|대구|인천|광주|대전|울산|세종)(특별자치시|특별시|광역시|시)", r"\1", s)
    s = re.sub(r"^(경기|강원|제주)(특별자치도|도)", r"\1", s)
    return s

def nv(k, v):
    if v in (None, [], ""):
        return None
    if isinstance(v, list):
        return sorted(v)
    if k == "residence":
        return rnorm(v)
    return v

import sys
PRED = sys.argv[1] if len(sys.argv) > 1 else "sample.jsonl"
gold = {g["plcy_no"]: g for g in json.load(open("golden.json"))}
pred = {d["plcy_no"]: d["result"] for d in map(json.loads, open(PRED))}
ids = [p for p in gold if p in pred]
print(f"평가 대상 {len(ids)}건\n")
for k in F:
    wrong = [(gold[p]["name"][:18], pred[p].get(k), gold[p]["answer"].get(k))
             for p in ids if nv(k, pred[p].get(k)) != nv(k, gold[p]["answer"].get(k))]
    has = [p for p in ids if nv(k, gold[p]["answer"].get(k)) is not None]
    hit = [p for p in has if nv(k, pred[p].get(k)) == nv(k, gold[p]["answer"].get(k))]
    print(f"{k:26s} 전체 {100 * (len(ids) - len(wrong)) / len(ids):5.1f}%   값 있는 {len(has):2d}건 중 {len(hit):2d}건 맞음")
    for name, pv, gv in wrong:
        print(f"    - {name}: 예측 {json.dumps(pv, ensure_ascii=False)} / 정답 {json.dumps(gv, ensure_ascii=False)}")
