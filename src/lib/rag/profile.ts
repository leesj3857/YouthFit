/** 역질문 템플릿 · 응답 반영 · 자격 판정 (LLM 없이 규칙으로) */
import type { AnswerValue, Check, CheckStatus, PolicyRecord, Profile, Question, QuestionKey } from "./types";

export const SIDO = ["서울", "경기", "인천", "부산", "대구", "광주", "대전", "울산", "세종", "강원",
  "충북", "충남", "전북", "전남", "경북", "경남", "제주"] as const;
/** 2026년 광주·전남 통합(온통청년 지역코드 12) → 같은 지역으로 판정 */
const REGION_ALIAS: Record<string, string> = { 광주: "전남광주", 전남: "전남광주" };
export const normRegion = (s?: string | null) => (s ? REGION_ALIAS[s] ?? s : s);
/** 1인가구 기준중위소득 근사치(월, 만원). 가구·부부 소득 기준 정책은 '확인 필요'로 둔다 */
const MEDIAN_1P_MONTHLY = 256;

const opt = (value: string, label: string, desc?: string) => ({ value, label, ...(desc ? { desc } : {}) });

export const QUESTIONS: Record<QuestionKey, Omit<Question, "key">> = {
  age: { text: "만 나이로 몇 살이세요?", widget: { type: "slider", min: 15, max: 45, step: 1, defaultValue: 26, unit: "age", presets: [20, 24, 29, 34, 39] } },
  sigungu: { text: "어느 시·군·구에 사세요? 시·군·구에서 따로 주는 혜택도 있어요.", widget: { type: "single", layout: "chips", options: [] } },
  region: { text: "주민등록상 어느 지역에 살고 계세요?", widget: { type: "single", layout: "chips", options: SIDO.map((s) => opt(s, s)) } },
  employment: {
    text: "지금 어떤 상황이세요?",
    widget: { type: "single", layout: "list", options: [
      opt("unemployed", "취업 준비 중이에요", "구직 활동이나 시험을 준비하고 있어요"),
      opt("employed", "회사에 다니고 있어요", "정규직·계약직·아르바이트 모두 포함"),
      opt("student", "학생이에요", "대학·대학원, 휴학 중이어도 괜찮아요"),
      opt("self_employed", "창업·자영업·프리랜서예요")] },
  },
  education: {
    text: "학교는 어떻게 되세요?",
    widget: { type: "single", layout: "list", options: [
      opt("고졸이하", "고졸 이하"), opt("대학재학", "대학 재학 중"), opt("대학휴학", "대학 휴학 중"),
      opt("졸업예정", "졸업 예정"), opt("대졸", "대학 졸업"), opt("대학원", "대학원")] },
  },
  income: {
    text: "본인 연소득(세전)은 대략 어느 정도예요?",
    widget: { type: "single", layout: "list", options: [
      opt("0", "소득 없음"), opt("2400", "2,400만원 이하"), opt("3600", "2,400~3,600만원"),
      opt("5000", "3,600~5,000만원"), opt("7000", "5,000~7,000만원"), opt("99999", "7,000만원 초과")] },
  },
  assets: { text: "본인(부부 합산) 순자산은 어느 정도예요?", widget: { type: "single", layout: "chips", options: [opt("10000", "1억 이하"), opt("30000", "1~3억"), opt("99999", "3억 초과")] } },
  marital: { text: "결혼 여부를 알려주세요.", widget: { type: "single", layout: "chips", options: [opt("미혼", "미혼"), opt("신혼부부", "결혼 7년 이내"), opt("기혼", "결혼 7년 초과")] } },
  housing: {
    text: "지금 집이 있으신가요?",
    widget: { type: "single", layout: "list", options: [
      opt("parents", "부모님 집에 살아요", "본인 명의 집은 없어요"), opt("rent", "전·월세로 따로 살아요", "무주택"), opt("own", "집을 갖고 있어요")] },
  },
  household_head: { text: "주민등록상 세대주이신가요?", widget: { type: "confirm", yes: "네, 세대주예요", no: "아니요" } },
  target_group: { text: "해당하는 게 있으면 모두 골라주세요.", widget: { type: "multi", options: [] } },
  benefit_type: {
    text: "어떤 형태의 혜택을 찾으세요? 여러 개 골라도 돼요.",
    widget: { type: "multi", options: [
      opt("현금지원", "현금 지원금", "수당·장려금·활동비"),
      opt("비용·바우처지원", "비용 지원·바우처", "월세·응시료·교육비 등"),
      opt("대출·이자지원", "저금리 대출·이자 지원"),
      opt("교육·프로그램", "교육·상담·취업 프로그램"),
      opt("공간·시설", "공간·주거시설 이용"),
      opt("any", "상관없어요")] },
  },
  monthly: { text: "한 달에 저축할 수 있는 금액은 어느 정도예요?", widget: { type: "slider", min: 0, max: 100, step: 5, defaultValue: 30, unit: "manwon", presets: [10, 30, 50, 70] } },
};

export function makeQuestion(key: QuestionKey, extra?: Partial<Question>): Question {
  return { key, ...QUESTIONS[key], skippable: true, ...extra };
}

export function applyAnswer(p: Profile, key: QuestionKey, v: AnswerValue | null): Profile {
  const n: Profile = { ...p, asked: [...new Set([...p.asked, key])], skipped: [...p.skipped] };
  if (v === null || v === "skip") {
    n.skipped = [...new Set([...n.skipped, key])];
    return n;
  }
  switch (key) {
    case "age": n.age = Number(v); break;
    case "region": n.sido = String(v); break;
    case "sigungu": n.sigungu = String(v); break;
    case "employment": n.employment = v as Profile["employment"]; break;
    case "education": n.education = String(v); break;
    case "income": {
      const x = Number(v);
      n.annualIncome = x;
      n.incomePct = x >= 99999 ? 999 : Math.round((x / 12 / MEDIAN_1P_MONTHLY) * 100);
      break;
    }
    case "assets": n.assets = Number(v); break;
    case "marital": n.marital = v as Profile["marital"]; break;
    case "housing": n.housing = v as Profile["housing"]; n.homeless = v !== "own"; break;
    case "household_head": n.householdHead = Boolean(v); break;
    case "target_group": n.targetGroups = (v as string[]).filter((g) => g !== "none"); break;
    case "monthly": n.monthlySaving = Number(v); break;
    case "benefit_type": n.benefitTypes = (v as string[]).filter((x) => x !== "any"); break;
  }
  return n;
}

/** 취업상태로 이미 알 수 있는 대상 집단 */
const IMPLIED: Record<string, string[]> = {
  student: ["대학생", "대학원생"], unemployed: ["구직자"], employed: ["재직자", "중소기업재직자"],
  self_employed: ["창업자·예비창업자", "소상공인·자영업자"],
};
/** 해당자가 아니면 받을 수 없는 좁은 대상 집단 (대학생·구직자·1인가구 같은 넓은 집단은 다른 조건으로 판정) */
export const RESTRICTIVE = new Set(["대학원생", "고교생·학교밖청년", "중소기업재직자", "창업자·예비창업자", "소상공인·자영업자",
  "농어업인", "예술인", "신혼부부", "임산부·출산가구", "자녀양육가구", "저소득·수급자", "장애인", "군장병·제대군인", "한부모",
  "다문화·외국인", "자립준비청년"]);

const EMP_LABEL: Record<string, string> = { unemployed: "미취업", employed: "재직", student: "학생", self_employed: "창업·자영업" };

/** 정책 1건의 자격 판정. fail이 하나라도 있으면 추천에서 제외, unknown은 역질문 대상 */
export function judge(pol: PolicyRecord, p: Profile): { status: CheckStatus; checks: Check[] } {
  const c = pol.cond, ev = pol.evidence, checks: Check[] = [];
  const add = (key: QuestionKey, status: CheckStatus, text: string, evidence?: string) => checks.push({ key, status, text, evidence });
  const skipped = new Set(p.skipped);

  if (c.min_age != null || c.max_age != null) {
    const t = c.min_age != null && c.max_age != null ? `만 ${c.min_age}~${c.max_age}세` : c.max_age != null ? `만 ${c.max_age}세 이하` : `만 ${c.min_age}세 이상`;
    add("age", p.age == null ? "unknown" : p.age >= (c.min_age ?? 0) && p.age <= (c.max_age ?? 200) ? "pass" : "fail", t, ev.age);
  }

  const sido = normRegion(pol.region);
  if (sido) {
    const mine = normRegion(p.sido);
    const t = `${sido === "전남광주" ? "광주·전남" : sido} 거주`;
    add("region", mine == null ? "unknown" : mine !== sido ? "fail" : "pass", t, ev.residence);
    const sgg = pol.sigungus;
    if (sgg?.length && mine === sido) {
      const named = sgg.filter((s) => s !== "일부 시·군·구");
      const label = named.length ? named.slice(0, 3).join("·") + (named.length > 3 ? " 등" : "") : "일부 시·군·구";
      const core = (s: string) => s.replace(/(특별자치시|광역시|특별시|시|군|구)$/, "");
      const st: CheckStatus = !p.sigungu ? "unknown"
        : p.sigungu === "기타" ? (named.length ? "fail" : "unknown")
        : named.some((s) => core(s) === core(p.sigungu!) || p.sigungu!.includes(s)) ? "pass" : named.length ? "fail" : "unknown";
      add("sigungu", st, `${label} 거주`, ev.residence);
    }
  }

  if (c.employment?.length) {
    add("employment", p.employment == null ? "unknown" : c.employment.includes(p.employment) ? "pass" : "fail",
      c.employment.map((e) => EMP_LABEL[e] ?? e).join("·"), ev.employment);
  }

  if (c.education?.length) {
    const e = p.education;
    add("education", e == null ? "unknown" : c.education.includes(e) || (e === "대학휴학" && c.education.includes("대학재학")) ? "pass" : "fail",
      c.education.join("·"), ev.education);
  }

  const pct = c.income_median_pct_max, amt = c.income_annual_max_manwon, basis = c.income_basis;
  if (pct || amt || c.income_other) {
    const t = pct ? `기준 중위소득 ${pct}% 이하` : amt ? `연소득 ${amt.toLocaleString()}만원 이하${basis ? `(${basis})` : ""}` : c.income_other!;
    let st: CheckStatus = "unknown";
    if (p.annualIncome != null && !skipped.has("income") && basis !== "가구" && basis !== "부부합산") {
      if (amt) st = p.annualIncome <= amt ? "pass" : "fail";
      else if (pct) st = (p.incomePct ?? 999) <= pct ? "pass" : "fail";
    }
    add("income", st, t, ev.income);
  }

  if (c.asset_max_manwon) {
    add("assets", p.assets == null ? "unknown" : p.assets <= c.asset_max_manwon ? "pass" : "fail", `자산 ${c.asset_max_manwon.toLocaleString()}만원 이하`, ev.asset);
  }
  if (c.marital) {
    const m = p.marital;
    add("marital", m == null ? "unknown" : m === c.marital || (c.marital === "기혼" && m === "신혼부부") ? "pass" : "fail", c.marital, ev.marital);
  }
  if (c.homeless_required) add("housing", p.homeless == null ? "unknown" : p.homeless ? "pass" : "fail", "무주택", ev.homeless);
  if (c.household_head_required) add("household_head", p.householdHead == null ? "unknown" : p.householdHead ? "pass" : "fail", "세대주", ev.household_head);

  const groups = c.target_groups ?? [];
  if (groups.length) {
    const mine = new Set([...(p.targetGroups ?? []), ...(IMPLIED[p.employment ?? ""] ?? []), ...(p.marital === "신혼부부" ? ["신혼부부"] : [])]);
    const t = groups.join("·");
    if (groups.some((g) => mine.has(g))) add("target_group", "pass", t);
    else if (groups.some((g) => !RESTRICTIVE.has(g))) { /* 넓은 집단 포함 → 다른 조건으로 판정 */ }
    else if (p.asked.includes("target_group")) add("target_group", "fail", t);
    else add("target_group", "unknown", t);
  }

  const st = checks.map((x) => x.status);
  return { status: st.includes("fail") ? "fail" : st.includes("unknown") ? "unknown" : "pass", checks };
}
