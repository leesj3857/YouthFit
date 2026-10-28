/** 청핏 RAG 추천 — 서버·클라이언트가 함께 쓰는 타입 */

export type Interest = "housing" | "job" | "asset" | "edu" | "life";

export type Option = { value: string; label: string; desc?: string };
export type Widget =
  | { type: "single"; layout: "chips" | "list"; options: Option[] }
  | { type: "multi"; options: Option[]; defaults?: string[] }
  | { type: "slider"; min: number; max: number; step: number; defaultValue: number; unit: "age" | "manwon"; presets?: number[] }
  | { type: "confirm"; yes: string; no: string };

export type QuestionKey =
  | "age" | "region" | "sigungu" | "employment" | "education" | "income" | "assets"
  | "marital" | "housing" | "household_head" | "target_group" | "monthly" | "benefit_type";

export interface Question {
  key: QuestionKey;
  text: string;
  widget: Widget;
  skippable?: boolean;
  /** 이 질문 답에 따라 자격 판정이 갈리는 상위 후보 수 */
  affects?: number;
}
export type AnswerValue = string | string[] | number | boolean;

export type Employment = "unemployed" | "employed" | "student" | "self_employed";
export interface Profile {
  age?: number;
  sido?: string;
  sigungu?: string;
  employment?: Employment;
  education?: string;
  annualIncome?: number;     // 만원
  incomePct?: number;        // 1인가구 기준중위소득 대비 %
  assets?: number;           // 만원
  marital?: "미혼" | "신혼부부" | "기혼";
  housing?: "parents" | "rent" | "own";
  homeless?: boolean;
  householdHead?: boolean;
  targetGroups?: string[];
  monthlySaving?: number;    // 만원
  /** 원하는 혜택 형태 (비어 있으면 전부) — 현금지원·비용·바우처지원·대출·이자지원·교육·프로그램·공간·시설 */
  benefitTypes?: string[];
  asked: QuestionKey[];
  skipped: QuestionKey[];
}

export interface ChatState {
  profile: Profile;
  query: string;
  domains: string[];
  wantPolicies: boolean;
  wantSavings: boolean;
  round: number;
  /** 이미 보여준 추천 항목 id ("다른 건 없어?"에서 제외) */
  shown?: string[];
}

export type CheckStatus = "pass" | "unknown" | "fail";
export interface Check { key: QuestionKey; status: CheckStatus; text: string; evidence?: string }

export interface RecPolicy {
  id: string; name: string; org: string; interest: Interest; type: string | null;
  benefit: string | null; benefitAmount: number | null;
  applyEnd: string | null; alwaysOpen: boolean | null; firstCome: boolean | null;
  status: "pass" | "unknown"; checks: Check[];
  reason: string; caution: string | null;
}
export interface RecSaving {
  id: string; name: string; company: string; bank: boolean; youth: boolean;
  term: number; baseRate: number; maxRate: number; reserveType: string | null;
  reason: string; caution: string | null;
}

export type ChatReply =
  | { type: "questions"; intro: string; questions: Question[]; candidateCount: number }
  | { type: "result"; summary: string; policies: RecPolicy[]; savings: RecSaving[]; candidateCount: number; monthly?: number }
  | { type: "text"; text: string };

/** 추천 이후 자유 대화 기록 (최근 몇 턴만 서버로 보냄) */
export interface Turn { role: "user" | "assistant"; text: string }

/* ---------- 데이터 (export_web.py 출력) ---------- */
export interface PolicyRecord {
  id: string; name: string; org: string | null; url: string; youthcenterUrl: string;
  applicable: boolean; applicant: string | null; type: string | null; domains: string[]; interest: Interest;
  region: string | null; sigungus: string[] | null; nationwide: boolean;
  applyStart: string | null; applyEnd: string | null; alwaysOpen: boolean | null; firstCome: boolean | null; expired: boolean;
  benefit: string | null; benefitAmount: number | null; benefitMonths: number | null;
  summary: string | null; channels: string[]; exclusions: string[]; extra: string[];
  cond: {
    min_age?: number; max_age?: number; employment?: Employment[]; education?: string[];
    income_median_pct_max?: number; income_annual_max_manwon?: number; income_basis?: string; income_other?: string;
    asset_max_manwon?: number; residence_sido?: string; residence_sigungu?: string; residence_min_months?: number;
    marital?: "미혼" | "신혼부부" | "기혼"; homeless_required?: boolean; household_head_required?: boolean; target_groups?: string[];
  };
  evidence: Record<string, string>;
  confidence: number | null;
  detail: { description: string | null; support: string | null; applyMethod: string | null; screening: string | null; documents: string | null };
}
export interface SavingOption { term: number; base: number; max: number; type: string | null; rateType: string | null }
export interface SavingRecord {
  id: string; company: string; name: string; joinMember: string; joinWay: string | null; special: string | null;
  note: string | null; maxLimit: number | null; bank: boolean; youth: boolean; age: [number, number] | null;
  disclosed: string | null; homepage: string | null; options: SavingOption[];
}
