"""v2 세밀 추출 (Opus 5.5).  python extract_v2.py 30 [long]  → sample_v2.jsonl"""
import json, re, sys, random, datetime, anthropic
from rapidfuzz import fuzz
from dotenv import load_dotenv
load_dotenv(".env")
client = anthropic.Anthropic()
MODEL = "claude-opus-5-5"

N = lambda t, d=None: {"type": [t, "null"], **({"description": d} if d else {})}
E = lambda: N("string", "근거: 원문 핵심 구절을 그대로 복사(60자 이내)")
arr = lambda items, d: {"type": "array", "items": {"type": "string", "enum": items}, "description": d}

SIDO = ["서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"]
DOMAINS = ["주거", "일자리·취업", "창업", "교육·자격증", "금융·자산형성", "생활·복지", "건강·심리", "문화·여가",
           "결혼·출산·육아", "참여·권리", "교통·통신", "농어업"]
GROUPS = ["대학생", "대학원생", "고교생·학교밖청년", "구직자", "재직자", "중소기업재직자", "창업자·예비창업자",
          "소상공인·자영업자", "농어업인", "예술인", "신혼부부", "임산부·출산가구", "자녀양육가구", "1인가구",
          "저소득·수급자", "장애인", "군장병·제대군인", "한부모", "다문화·외국인", "자립준비청년", "전입자·귀농귀촌"]
ASK = ["age", "region", "employment", "education", "income", "assets", "marital", "housing", "household_head", "target_group"]

PROPS = {
  "individual_applicable": {"type": "boolean"},
  "applicant_type": {"type": "string", "enum": ["청년개인", "가구·부부", "보호자", "기업·단체", "기관·대학", "해당없음"],
                     "description": "누가 직접 신청하는가"},
  "policy_type": {"type": "string", "enum": ["현금지원", "대출·이자지원", "비용·바우처지원", "교육·프로그램", "공간·시설", "기타"]},
  "domains": arr(DOMAINS, "해당 분야 1~3개"),
  "target_groups": arr(GROUPS, "원문에 명시된 대상 집단만"),
  "min_age": N("integer"), "max_age": N("integer"), "age_evidence": E(),
  "employment": arr(["unemployed", "employed", "self_employed", "student"], "원문에 명시된 취업상태 대상. 없으면 []"),
  "employment_evidence": E(),
  "education": arr(["고졸이하", "대학재학", "대학휴학", "졸업예정", "대졸", "대학원"], "학력·재학 요건. 없으면 []"),
  "education_evidence": E(),
  "income_median_pct_max": N("integer", "기준 중위소득 % 상한"),
  "income_annual_max_manwon": N("integer", "연소득 상한, 만원"),
  "income_basis": {"type": ["string", "null"], "enum": ["본인", "가구", "부부합산", None]},
  "income_other": N("string", "중위소득·연소득 외 소득기준 (예: 도시근로자 월평균소득 100%)"),
  "income_evidence": E(),
  "asset_max_manwon": N("integer", "자산 상한, 만원"), "asset_evidence": E(),
  "residence_sido": {"type": ["string", "null"], "enum": SIDO + [None], "description": "거주 요건 시·도"},
  "residence_sigungu": N("string", "거주 요건 시·군·구 (예: 연수구)"),
  "residence_min_months": N("integer", "최소 거주기간(개월)"),
  "residence_evidence": E(),
  "marital": {"type": ["string", "null"], "enum": ["미혼", "신혼부부", "기혼", None]}, "marital_evidence": E(),
  "homeless_required": N("boolean", "무주택 요건"), "homeless_evidence": E(),
  "household_head_required": N("boolean", "세대주 요건"), "household_head_evidence": E(),
  "exclusions": {"type": "array", "items": {"type": "string"}, "description": "제외 대상, 각 20자 이내"},
  "extra_requirements": {"type": "array", "items": {"type": "string"}, "description": "위 필드에 없는 핵심 자격요건, 각 20자 이내"},
  "apply_start": N("string", "YYYY-MM-DD"), "apply_end": N("string", "YYYY-MM-DD"),
  "always_open": N("boolean", "상시·매월 접수"), "apply_evidence": E(),
  "first_come": N("boolean"), "first_come_evidence": E(),
  "apply_channels": arr(["온라인", "방문", "우편·이메일", "기관추천", "기타"], "신청 방법"),
  "benefit": {"type": "string", "description": "무엇을 얼마나 지원하는지 한 문장"},
  "benefit_amount_max_manwon": N("integer", "1인(1가구) 기준 최대 지원금액 합계, 만원. 금액 지원이 아니면 null"),
  "benefit_amount_evidence": E(),
  "benefit_period_months": N("integer", "지원 기간(개월)"),
  "search_summary": {"type": "string", "description": "검색용 요약 2~3문장: 누구에게, 무엇을, 어떤 조건으로. 원문에 없는 내용 금지"},
  "ask_keys": arr(ASK, "이 정책 자격을 판단하려면 사용자에게 물어봐야 할 항목"),
  "confidence": {"type": "number", "description": "0~1, 자격 정보가 원문에 충분할수록 높게"},
}
TOOL = {"name": "save_policy", "description": "청년정책 원문을 구조화해 저장",
        "input_schema": {"type": "object", "properties": PROPS, "required": list(PROPS)}}

SYSTEM = """너는 청년정책 공고문을 구조화하는 분석가다. 결과는 청년에게 맞춤 정책을 추천하고 자격을 판정하는 데 쓰인다.

원칙
- 원문에 명시된 것만 추출한다. 없으면 JSON null 또는 [] (문자열 "null" 금지).
- 추측·상식으로 채우지 않는다. 기관명·정책명의 지역만 보고 거주 요건을 만들지 않는다. 단 원문에 '관내', '도내', '시민' 등 거주 요건이 있으면 기관 소재지로 채운다.
- *_evidence는 그 값의 근거가 되는 원문 구절을 한 글자도 바꾸지 말고 60자 이내로 복사한다. 여러 구절이면 " ; "로 구분. 값이 null이면 evidence도 null.

필드 규칙
- 나이: 포함 기준 정수. '30세 미만'→29, '18세 초과'→19. 출생연도로 적혀 있으면 올해 기준 나이로 환산하지 말고 null로 두고 extra_requirements에 '1981~2007년생'처럼 적는다. 대출 만기·상환 조건의 나이는 자격 나이가 아니다.
- employment: 미취업·구직·실업·취업준비·실업초기→unemployed, 재직자·근로자·직장인→employed, 창업자·예비창업자·자영업·소상공인·개인사업자→self_employed, 대학생·대학원생·재학생·휴학생→student. '직장가입자 제외'처럼 제외로만 표현되면 employment는 비우고 exclusions에 적는다.
- 소득: 중위소득 %면 income_median_pct_max, 연소득 금액이면 income_annual_max_manwon(만원)과 income_basis. 도시근로자 월평균소득·건강보험료 기준 등은 income_other. 매출액은 소득이 아니다(extra_requirements).
- 거주: residence_sido는 17개 시·도 약칭(서울, 경기, 전남 …). 시·군·구 요건이 있으면 residence_sigungu. '전입 후 3개월 이상'이면 residence_min_months=3.
- apply_*: 신청·접수·모집 기간만. 사업기간·운영기간·교육기간은 아니다. 연도가 없으면 2026년. 매달·상시 접수면 always_open=true.
- first_come: '선착순' 또는 '예산 소진 시 (조기)마감'일 때만 true. 우선순위 선정은 선착순이 아니다.
- individual_applicable: 청년(또는 청년 부모·부부)이 직접 신청·이용할 수 있으면 true. 대학·기업·기관·단체가 신청하거나, 시설 조성·제도 개선·펀드 조성처럼 개인 신청 경로가 없으면 false. 청년이 직접 이용 신청하는 공간·장비대여·교육은 true.
- policy_type(주된 혜택 하나): 현금지원=수당·장려금·활동비·장학금 현금 지급 / 대출·이자지원=대출 상품, 대출이자·보증료 지원 / 비용·바우처지원=월세·임차료·응시료·시술비·관람비 등 특정 비용 지원 또는 이용권·바우처 / 교육·프로그램=강좌·상담·멘토링·행사·인턴 / 공간·시설=공간 대관·입주·센터 / 기타.
- benefit_amount_max_manwon: '월 20만원 최대 12개월'이면 240. 이자율·감면율만 있으면 null.
- ask_keys: 이 정책의 자격 조건 중 사용자 정보가 필요한 항목만 (조건이 없으면 [])."""

EVID = {"min_age": "age_evidence", "max_age": "age_evidence", "employment": "employment_evidence",
        "education": "education_evidence",
        "income_median_pct_max": "income_evidence", "income_annual_max_manwon": "income_evidence",
        "income_basis": "income_evidence", "income_other": "income_evidence", "asset_max_manwon": "asset_evidence",
        "residence_sido": "residence_evidence", "residence_sigungu": "residence_evidence",
        "residence_min_months": "residence_evidence", "marital": "marital_evidence",
        "homeless_required": "homeless_evidence", "household_head_required": "household_head_evidence",
        "apply_start": "apply_evidence", "apply_end": "apply_evidence", "always_open": "apply_evidence",
        "first_come": "first_come_evidence", "benefit_amount_max_manwon": "benefit_amount_evidence"}
NUMERIC = ["min_age", "max_age", "income_median_pct_max"]

def params(p, max_tokens=2500):
    return {"model": MODEL, "max_tokens": max_tokens,
            "system": [{"type": "text", "text": SYSTEM, "cache_control": {"type": "ephemeral"}}],
            "tools": [TOOL], "tool_choice": {"type": "auto"},
            "messages": [{"role": "user", "content": f"정책명: {p['name']}\n기관: {p['org']}\n\n{p['text']}\n\n위 원문을 save_policy 도구로 한 번 저장하라. 다른 설명은 쓰지 마라."}]}

norm = lambda s: re.sub(r"\s+", "", s or "")
clean = lambda v: None if v in ("null", "None", "") else v

def ev_ok(ev, src):
    parts = [norm(x) for x in re.split(r";|…|\.\.\.", ev or "") if x.strip()]
    return bool(parts) and all(x in src or fuzz.partial_ratio(x, src) >= 92 for x in parts)

def num_ok(k, v, ev):
    e = norm(ev)
    return (str(v) in e or (k == "max_age" and str(v + 1) in e and "미만" in e)
            or (k == "min_age" and str(v - 1) in e and "초과" in e))

def verify(out, text):
    src = norm(text)
    out = {k: clean(v) for k, v in out.items()}
    out["rejected"] = []
    for k, ek in EVID.items():
        v = out.get(k)
        if v is None or v == []:
            continue
        if v is False and not out.get(ek):
            out[k] = None; continue
        ev = out.get(ek)
        if not ev_ok(ev, src) or (k in NUMERIC and not num_ok(k, v, ev)):
            out[k] = [] if isinstance(v, list) else None
            out["rejected"].append(k)
    return out

if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    mode = sys.argv[2] if len(sys.argv) > 2 else "random"
    rows = [json.loads(l) for l in open("policies.jsonl")]
    if mode == "long":
        rows = [r for r in rows if len(r["text"]) > 500]
    rows = random.Random(42).sample(rows, n)
    tot = {"in": 0, "cw": 0, "cr": 0, "out": 0}
    with open("sample_v2.jsonl", "w") as f:
        for p in rows:
            r = client.messages.create(**params(p))
            u = r.usage
            tot["in"] += u.input_tokens; tot["out"] += u.output_tokens
            tot["cw"] += u.cache_creation_input_tokens or 0; tot["cr"] += u.cache_read_input_tokens or 0
            raw = next(b.input for b in r.content if b.type == "tool_use")
            out = verify(raw, p["name"] + "\n" + p["text"])
            f.write(json.dumps({"plcy_no": p["plcy_no"], "name": p["name"], "result": out}, ensure_ascii=False) + "\n")
            print("■", p["name"][:30], out.get("policy_type"), out.get("individual_applicable"), out.get("rejected"), flush=True)
    usd = (tot["in"] * 4 + tot["cw"] * 5 + tot["cr"] * 0.2 + tot["out"] * 20) / 1e6
    print(f"\n{n}건 토큰 {tot} → 실시간 요금 약 ${usd:.2f} (배치면 약 절반)")
