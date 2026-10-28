"""정형화 결과 + DB 원문을 프론트(Next.js)용 JSON으로 내보내기 (DB 읽기 전용, API 비용 없음)
  python export_web.py            (pipeline 폴더에서, 기본 출력 ../src/data)"""
import json, os, sys, re, datetime, psycopg2
from dotenv import load_dotenv
load_dotenv(".env")
OUT = os.path.expanduser(sys.argv[1] if len(sys.argv) > 1 else "../src/data"); os.makedirs(OUT, exist_ok=True)
TODAY = datetime.date.today().isoformat()
CODE = {"11": "서울", "12": "전남광주", "26": "부산", "27": "대구", "28": "인천", "30": "대전", "31": "울산", "36": "세종",
        "41": "경기", "43": "충북", "44": "충남", "47": "경북", "48": "경남", "50": "제주", "51": "강원", "52": "전북"}
REGION = {"광주": "전남광주", "전남": "전남광주"}
INTEREST = [("주거", "housing"), ("금융·자산형성", "asset"), ("일자리·취업", "job"), ("창업", "job"), ("농어업", "job"),
            ("교육·자격증", "edu")]
cut = lambda s, n: (s or "").strip()[:n] or None

conn = psycopg2.connect(os.environ["DATABASE_URL"]); conn.set_session(readonly=True); cur = conn.cursor()
cur.execute("""SELECT plcy_no, org_name, apply_url, ref_urls, sido_codes, apply_start, apply_end, biz_end,
               description, support_content, apply_method, screening_method, documents, categories, sigungu_codes FROM policies""")
db = {r[0]: r for r in cur.fetchall()}
# 시·도별 전체 시·군·구 코드 (전국 정책들의 코드 합집합)
ALL = {}
for r in db.values():
    for c in r[14] or []: ALL.setdefault(c[:2], set()).add(c)
SGG = re.compile(r"(?<![가-힣])([가-힣]{1,3}(?:시|군|구))(?![가-힣])")
def local_names(name, org, llm_sgg):
    """시·군·구 단위 정책이면 그 이름들, 아니면 None"""
    out = []
    if llm_sgg: out += [x.strip() for x in re.split(r"[,·/ ]+", llm_sgg) if x.strip()]
    for src in (org or "", name or ""):
        out += [m for m in SGG.findall(src) if m not in out]
    return out[:3]

# 이름이 한 개로 확실한 단일 코드 정책에서 '코드→시군구 이름'을 학습해, 이름을 못 찾은 정책에 쓴다
import collections as _c
_votes = _c.defaultdict(_c.Counter)
for _pno, r in db.items():
    if r[14] and len(r[14]) == 1:
        nm = [m for m in SGG.findall(r[1] or "")] or [m for m in SGG.findall("")]
        if len(nm) == 1: _votes[r[14][0]][nm[0]] += 1
CODE_NAME = {c: v.most_common(1)[0][0] for c, v in _votes.items()}

JF = ["min_age", "max_age", "employment", "education", "income_median_pct_max", "income_annual_max_manwon",
      "income_basis", "income_other", "asset_max_manwon", "residence_sido", "residence_sigungu", "residence_min_months",
      "marital", "homeless_required", "household_head_required", "target_groups"]
pols = []
for l in open(os.getenv("RESULTS", "data/results_v2.jsonl")):
    d = json.loads(l); f = d["result"]; p = db.get(d["plcy_no"])
    if not p: continue
    sido = REGION.get(f.get("residence_sido"), f.get("residence_sido"))
    db_sido = [CODE.get(c, c) for c in (p[4] or [])]
    if not sido and len(db_sido) == 1: sido = db_sido[0]
    codes = p[14] or []
    prefixes = {c[:2] for c in codes}
    local = bool(codes) and len(prefixes) == 1 and len(codes) < len(ALL.get(next(iter(prefixes)), ())) * 0.7
    sigungus = (local_names(d["name"], p[1], f.get("residence_sigungu"))
                or sorted({CODE_NAME[c] for c in codes if c in CODE_NAME}) or ["일부 시·군·구"]) if local else (
        [f["residence_sigungu"]] if f.get("residence_sigungu") else None)
    apply_end = f.get("apply_end") or (p[6].isoformat() if p[6] else None)
    interest = next((i for dom, i in INTEREST if dom in (f.get("domains") or [])), "life")
    ev = {k[:-9]: v for k, v in f.items() if k.endswith("_evidence") and v}
    pols.append({
        "id": d["plcy_no"], "name": d["name"].strip(), "org": d.get("org") or p[1],
        "url": p[2] or (p[3][0] if p[3] else None) or f"https://www.youthcenter.go.kr/youthPolicy/ythPlcyTotalSearch/ythPlcyDetail/{d['plcy_no']}",
        "youthcenterUrl": f"https://www.youthcenter.go.kr/youthPolicy/ythPlcyTotalSearch/ythPlcyDetail/{d['plcy_no']}",
        "applicable": f.get("individual_applicable") is not False, "applicant": f.get("applicant_type"),
        "type": f.get("policy_type"), "domains": f.get("domains") or [], "interest": interest,
        "region": sido, "sigungus": sigungus, "nationwide": len(db_sido) >= 15 and not f.get("residence_sido"),
        "applyStart": f.get("apply_start") or (p[5].isoformat() if p[5] else None), "applyEnd": apply_end,
        "alwaysOpen": f.get("always_open"), "firstCome": f.get("first_come"),
        "expired": bool(apply_end and apply_end < TODAY),
        "benefit": f.get("benefit"), "benefitAmount": f.get("benefit_amount_max_manwon"), "benefitMonths": f.get("benefit_period_months"),
        "summary": f.get("search_summary"), "channels": f.get("apply_channels") or [],
        "exclusions": f.get("exclusions") or [], "extra": f.get("extra_requirements") or [],
        "cond": {k: f.get(k) for k in JF if f.get(k) not in (None, [])}, "evidence": ev,
        "confidence": f.get("confidence"),
        "detail": {"description": cut(p[8], 600), "support": cut(p[9], 1500), "applyMethod": cut(p[10], 800),
                   "screening": cut(p[11], 400), "documents": cut(p[12], 600)},
    })
json.dump(pols, open(f"{OUT}/policies.json", "w"), ensure_ascii=False, separators=(",", ":"))

cur.execute("""SELECT s.fin_co_no, s.fin_prdt_cd, s.company_name, s.name, s.join_member, s.join_way, s.special_condition,
                      s.etc_note, s.max_limit, s.is_youth, s.fin_grp_code, s.dcls_month, f.homepage_url,
                      json_agg(json_build_object('term', o.term_months, 'base', o.base_rate, 'max', o.max_rate,
                                                 'type', o.reserve_type_name, 'rateType', o.rate_type_name))
               FROM saving_products s LEFT JOIN saving_product_options o USING (fin_co_no, fin_prdt_cd)
               LEFT JOIN financial_companies f ON f.fin_co_no = s.fin_co_no
               GROUP BY 1,2,3,4,5,6,7,8,9,10,11,12,13""")
sav = []
for r in cur.fetchall():
    jm = r[4] or ""; txt = jm + " " + (r[6] or "")
    m = re.search(r"(\d{2})\s*세?\s*[~∼\-]\s*(?:만\s*)?(\d{2})\s*세", txt)
    m2 = re.search(r"만?\s*(\d{2})\s*세\s*이하", jm)
    age = [int(m[1]), int(m[2])] if m else ([0, int(m2[1])] if m2 else None)
    opts = sorted([{**o, "base": float(o["base"] or 0), "max": float(o["max"] or 0)} for o in r[13] if o["term"]],
                  key=lambda o: (o["term"], o["type"] or ""))
    if not opts: continue
    sav.append({"id": f"{r[0]}-{r[1]}", "company": r[2], "name": r[3], "joinMember": jm, "joinWay": r[5],
                "special": r[6], "note": r[7], "maxLimit": r[8], "bank": r[10] == "020000",
                "youth": bool(r[9]) or "청년" in (r[3] + txt), "age": age, "disclosed": r[11], "homepage": r[12],
                "options": opts})
json.dump(sav, open(f"{OUT}/savings.json", "w"), ensure_ascii=False, separators=(",", ":"), default=str)
live = [p for p in pols if p["applicable"] and not p["expired"]]
print(f"정책 {len(pols)} (추천 대상 {len(live)}, 시·군·구 한정 {sum(1 for p in pols if p['sigungus'])}), 적금 {len(sav)} → {OUT}")
import collections; print(collections.Counter(x for p in pols if p["sigungus"] for x in p["sigungus"]).most_common(15))
