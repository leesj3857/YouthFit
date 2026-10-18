import { JOB, MARRIAGE, MAJOR, PROVIDER_GROUP, PROVISION_METHOD, SCHOOL, SPECIAL, decodeCodes } from "@/lib/youthcenter-codes";

/** 온통청년 API 응답 항목 중 화면에서 쓰는 필드만 추린 타입 */
export interface Policy {
  plcyNo: string;
  pvsnInstGroupCd: string;
  plcyPvsnMthdCd: string;
  plcyNm: string;
  plcyKywdNm: string;
  plcyExplnCn: string;
  lclsfNm: string;
  mclsfNm: string;
  plcySprtCn: string;
  sprvsnInstCdNm: string;
  operInstCdNm: string;
  aplyPrdSeCd: string;
  aplyYmd: string;
  bizPrdBgngYmd: string;
  bizPrdEndYmd: string;
  bizPrdEtcCn: string;
  aplyUrlAddr: string;
  refUrlAddr1: string;
  sprtTrgtMinAge: string;
  sprtTrgtMaxAge: string;
  sprtTrgtAgeLmtYn: string;
  earnCndSeCd: string;
  earnMinAmt: string;
  earnMaxAmt: string;
  earnEtcCn: string;
  mrgSttsCd: string;
  plcyMajorCd: string;
  jobCd: string;
  schoolCd: string;
  sbizCd: string;
  addAplyQlfcCndCn: string;
  ptcpPrpTrgtCn: string;
  plcyAplyMthdCn: string;
  srngMthdCn: string;
  sbmsnDcmntCn: string;
  etcMttrCn: string;
  sprtSclCnt: string;
  sprtSclLmtYn: string;
  sprtArvlSeqYn: string;
  refUrlAddr2: string;
  zipCd: string;
  inqCnt: string;
  frstRegDt: string;
  lastMdfcnDt: string;
}

export interface PolicySuccess {
  ok: true;
  policies: Policy[];
  total: number;
  page: number;
  size: number;
  resultCode: number;
  resultMessage: string;
  elapsedMs: number;
  fetchedAt: string;
  requestUrl: string;
}

export interface PolicyFailure {
  ok: false;
  error: string;
  elapsedMs: number;
  fetchedAt: string;
  requestUrl: string;
}

export type PolicyResult = PolicySuccess | PolicyFailure;

/** 온통청년 대분류(lclsfNm) */
export const CATEGORIES = ["일자리", "주거", "교육", "복지문화", "참여권리"] as const;

/** API가 내려주는 실제 lclsfNm은 "교육･직업훈련", "금융･복지･문화", "참여･기반"처럼 길다 */
const CATEGORY_TONE: [RegExp, string][] = [
  [/일자리/, "bg-emerald-500"],
  [/주거/, "bg-sky-500"],
  [/교육/, "bg-violet-500"],
  [/복지|금융|문화/, "bg-rose-500"],
  [/참여|권리|기반/, "bg-amber-500"],
];

export function categoryDotClass(lclsf: string) {
  return CATEGORY_TONE.find(([re]) => re.test(lclsf))?.[1] ?? "bg-neutral-400";
}

/** "교육･직업훈련" → "교육" 처럼 짧은 표시용 라벨 */
export function shortCategory(lclsf: string) {
  return lclsf.split(/[･·,]/)[0].trim() || lclsf;
}

export function formatYmd(ymd: string) {
  const s = ymd.trim();
  if (!/^\d{8}$/.test(s)) return s;
  return `${s.slice(0, 4)}.${s.slice(4, 6)}.${s.slice(6, 8)}`;
}

export type ApplyStatus = {
  label: "접수중" | "상시" | "마감" | "기간확인";
  tone: "open" | "always" | "closed" | "muted";
  period?: string;
};

/** aplyPrdSeCd: 0057001 특정기간 / 0057002 상시 / 0057003 마감 */
export function applyStatus(p: Policy): ApplyStatus {
  if (p.aplyPrdSeCd === "0057002") return { label: "상시", tone: "always" };
  if (p.aplyPrdSeCd === "0057003") return { label: "마감", tone: "closed" };

  // "20260401 ~ 20260430\N20260801 ~ 20260831" 처럼 여러 회차가 올 수 있음
  const ranges = p.aplyYmd
    .split(/\\N|\n/)
    .map((r) => r.trim())
    .filter(Boolean);
  if (ranges.length === 0) return { label: "기간확인", tone: "muted" };

  const today = Number(new Date().toISOString().slice(0, 10).replace(/-/g, ""));
  const parsed = ranges.map((r) => r.match(/\d{8}/g) ?? []);
  const isOpen = parsed.some(([a, b]) => a && b && Number(a) <= today && today <= Number(b));
  const [first] = parsed;
  const period = first?.length === 2 ? `${formatYmd(first[0])} – ${formatYmd(first[1])}` : ranges[0];
  const hasFuture = parsed.some(([, b]) => b && Number(b) >= today);
  return isOpen
    ? { label: "접수중", tone: "open", period }
    : hasFuture
      ? { label: "기간확인", tone: "muted", period }
      : { label: "마감", tone: "closed", period };
}

export function ageLabel(p: Policy) {
  if (p.sprtTrgtAgeLmtYn === "Y") return null;
  const min = Number(p.sprtTrgtMinAge);
  const max = Number(p.sprtTrgtMaxAge);
  if (!min && !max) return null;
  if (min && max) return `만 ${min}–${max}세`;
  return min ? `만 ${min}세 이상` : `만 ${max}세 이하`;
}

export function keywords(p: Policy) {
  return p.plcyKywdNm
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, 4);
}

/** 온통청년 상세 페이지 (aplyUrlAddr가 없어도 항상 존재) */
export function youthcenterDetailUrl(p: Policy) {
  return `https://www.youthcenter.go.kr/youthPolicy/ythPlcyTotalSearch/ythPlcyDetail/${p.plcyNo}`;
}

/** 소득 조건 (earnCndSeCd): 0043001 무관 / 0043002 연소득 구간(만원) / 0043003 기타(earnEtcCn 텍스트) */
export function incomeLabel(p: Policy): string | null {
  const code = p.earnCndSeCd.trim();
  const etc = p.earnEtcCn.trim();
  if (code === "0043002") {
    const min = Number(p.earnMinAmt) || 0;
    const max = Number(p.earnMaxAmt) || 0;
    const fmt = (n: number) => `${n.toLocaleString()}만원`;
    if (min && max) return `연소득 ${fmt(min)} ~ ${fmt(max)}`;
    if (max) return `연소득 ${fmt(max)} 이하`;
    if (min) return `연소득 ${fmt(min)} 이상`;
  }
  if (code === "0043003") return etc || "소득 조건 있음 (내용 미기재)";
  return etc || null; // 0043001 무관
}

export interface CodeField {
  label: string;
  values: string[];
  noLimit: boolean;
}

/** 취업상태/학력/전공/특화분야/혼인 — 공식 코드표(docs/API코드정보.xlsx)로 라벨 변환 */
export function codeFields(p: Policy): CodeField[] {
  const defs: [string, string, Record<string, string>][] = [
    ["취업 상태", p.jobCd, JOB],
    ["학력", p.schoolCd, SCHOOL],
    ["전공", p.plcyMajorCd, MAJOR],
    ["특화 분야", p.sbizCd, SPECIAL],
    ["혼인 여부", p.mrgSttsCd, MARRIAGE],
  ];
  return defs
    .map(([label, raw, table]) => {
      const values = decodeCodes(raw, table);
      return { label, values, noLimit: values.length > 0 && values.every((v) => v === "제한없음") };
    })
    .filter((f) => f.values.length > 0);
}

/** 제공기관 구분 + 제공 방법 (예: "지자체 · 보조금") */
export function provisionLabel(p: Policy): string | null {
  const parts = [PROVIDER_GROUP[p.pvsnInstGroupCd.trim()], PROVISION_METHOD[p.plcyPvsnMthdCd.trim()]].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/** 상세 패널에 순서대로 보여줄 긴 텍스트 섹션 */
export function textSections(p: Policy): { title: string; field: keyof Policy; text: string }[] {
  const defs: [string, keyof Policy][] = [
    ["정책 설명", "plcyExplnCn"],
    ["지원 내용", "plcySprtCn"],
    ["추가 자격 조건", "addAplyQlfcCndCn"],
    ["참여 제한 대상", "ptcpPrpTrgtCn"],
    ["신청 방법", "plcyAplyMthdCn"],
    ["심사 방법", "srngMthdCn"],
    ["제출 서류", "sbmsnDcmntCn"],
    ["기타", "etcMttrCn"],
  ];
  return defs
    .map(([title, field]) => ({ title, field, text: String(p[field] ?? "").trim() }))
    .filter((s) => s.text);
}
