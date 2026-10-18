/**
 * 대화 시나리오 + 추천 매칭 (프론트 데모용).
 * 실제 서비스에선 LLM이 RAG 결과를 보고 다음 질문(타입·선택지)을 JSON으로 내려주고,
 * 프론트는 아래 Question 스키마 그대로 렌더하면 된다.
 */
import {
  INTEREST_LABEL,
  POLICIES,
  PRODUCTS,
  estimateMaturity,
  type CatalogPolicy,
  type CatalogProduct,
  type Interest,
  type JobStatus,
  type Region,
} from "./catalog";

/* ---------- 질문 스키마 ---------- */

export type Option = { value: string; label: string; desc?: string };

export type Widget =
  | { type: "single"; layout: "chips" | "list"; options: Option[] }
  | { type: "multi"; options: Option[]; defaults?: string[] }
  | {
      type: "slider";
      min: number;
      max: number;
      step: number;
      defaultValue: number;
      unit: "age" | "manwon";
      presets?: number[];
    }
  | { type: "confirm"; yes: string; no: string };

export type AnswerKey = "status" | "age" | "region" | "interests" | "independent" | "monthly";

export interface Question {
  key: AnswerKey;
  text: string;
  widget: Widget;
  skippable?: boolean;
}

export interface Answers {
  status?: JobStatus;
  age?: number;
  region?: Region;
  interests?: Interest[];
  independent?: boolean;
  monthly?: number;
}

export const REGIONS: Region[] = ["서울", "경기", "인천", "부산", "대구", "광주", "대전", "기타"];

const STATUS_OPTIONS: Option[] = [
  { value: "seeker", label: "취업 준비 중이에요", desc: "구직 활동이나 시험을 준비하고 있어요" },
  { value: "worker", label: "회사에 다니고 있어요", desc: "정규직·계약직·아르바이트 모두 포함" },
  { value: "student", label: "대학생이에요", desc: "휴학 중이어도 괜찮아요" },
  { value: "self", label: "자영업·프리랜서예요", desc: "사업자 등록 여부와 관계없어요" },
];

export function formatAnswer(q: Question, raw: string | string[] | number | boolean): string {
  const w = q.widget;
  if (w.type === "slider") {
    const n = Number(raw);
    return w.unit === "age" ? `만 ${n}세예요` : n === 0 ? "지금은 저축이 어려워요" : `월 ${n}만원 정도요`;
  }
  if (w.type === "confirm") return raw ? w.yes : w.no;
  if (w.type === "multi") {
    const values = raw as string[];
    return values.map((v) => w.options.find((o) => o.value === v)?.label ?? v).join(", ");
  }
  return w.options.find((o) => o.value === raw)?.label ?? String(raw);
}

/* ---------- 첫 문장에서 미리 알 수 있는 정보 ---------- */

const INTEREST_RULES: [RegExp, Interest][] = [
  [/월세|전세|주거|집|보증금|임대/, "housing"],
  [/취업|취준|구직|일자리|면접|채용/, "job"],
  [/적금|예금|저축|목돈|자산|통장|금리/, "asset"],
  [/자격증|교육|훈련|공부|학원|강의/, "edu"],
  [/교통|생활비|용돈|지역화폐/, "life"],
];

export function parseQuery(text: string): Answers {
  const a: Answers = {};
  const region = REGIONS.find((r) => r !== "기타" && text.includes(r));
  if (region) a.region = region;
  if (/취준|취업 준비|구직|백수|미취업/.test(text)) a.status = "seeker";
  else if (/직장|회사|재직|사회초년생|월급/.test(text)) a.status = "worker";
  else if (/대학생|학생|휴학/.test(text)) a.status = "student";
  const age = text.match(/(\d{2})\s*살|만\s*(\d{2})/);
  if (age) a.age = Number(age[1] ?? age[2]);
  const interests = INTEREST_RULES.filter(([re]) => re.test(text)).map(([, i]) => i);
  if (interests.length) a.interests = interests;
  return a;
}

/* ---------- 다음 질문 결정 ---------- */

/** 아직 모르는 정보만 순서대로 물어본다. 첫 문장에서 알게 된 관심사는 복수 선택의 기본값으로 체크해둔다. */
export function nextQuestion(a: Answers, asked: Set<AnswerKey>, hinted: Answers): Question | null {
  if (!asked.has("status") && !hinted.status) {
    return {
      key: "status",
      text: "먼저 지금 어떤 상황이신지 알려주세요. 상황에 따라 받을 수 있는 정책이 꽤 달라져요.",
      widget: { type: "single", layout: "list", options: STATUS_OPTIONS },
    };
  }
  if (!asked.has("age") && !hinted.age) {
    return {
      key: "age",
      text: "만 나이로 몇 살이세요? 대부분의 청년 정책은 **만 19~34세**를 기준으로 해요.",
      widget: { type: "slider", min: 17, max: 39, step: 1, defaultValue: 26, unit: "age" },
    };
  }
  if (!asked.has("region") && !hinted.region) {
    return {
      key: "region",
      text: "어디에 살고 계세요? 지자체에서 따로 주는 혜택도 함께 찾아볼게요.",
      widget: {
        type: "single",
        layout: "chips",
        options: REGIONS.map((r) => ({ value: r, label: r === "기타" ? "그 외 지역" : r })),
      },
    };
  }
  if (!asked.has("interests")) {
    return {
      key: "interests",
      text: "관심 있는 분야를 **모두** 골라주세요. 여러 개 골라도 괜찮아요.",
      widget: {
        type: "multi",
        options: (Object.keys(INTEREST_LABEL) as Interest[]).map((k) => ({ value: k, label: INTEREST_LABEL[k] })),
        defaults: hinted.interests,
      },
    };
  }
  if (!asked.has("independent") && a.interests?.includes("housing")) {
    return {
      key: "independent",
      text: "주거 지원은 조건이 까다로운 편이라 하나만 더 여쭤볼게요. 지금 **집이 없고, 부모님과 따로** 살고 계신가요?",
      widget: { type: "confirm", yes: "네, 따로 살아요", no: "아니요, 같이 살아요" },
    };
  }
  if (!asked.has("monthly")) {
    return {
      key: "monthly",
      text: "마지막이에요. 한 달에 저축할 수 있는 금액은 어느 정도예요? 여기에 맞춰 예적금을 골라드릴게요.",
      widget: {
        type: "slider",
        min: 0,
        max: 100,
        step: 5,
        defaultValue: 30,
        unit: "manwon",
        presets: [10, 30, 50, 70],
      },
      skippable: true,
    };
  }
  return null;
}

/* ---------- 추천 ---------- */

export interface PolicyPick {
  policy: CatalogPolicy;
  reasons: string[];
}
export interface ProductPick {
  product: CatalogProduct;
  reason: string;
  expected?: number;
}
export interface Recommendation {
  policies: PolicyPick[];
  products: ProductPick[];
  yearlyTotal: number;
  scanned: number;
}

export function recommend(a: Answers): Recommendation {
  const age = a.age ?? 26;
  const interests = a.interests?.length ? a.interests : (Object.keys(INTEREST_LABEL) as Interest[]);

  const policies = POLICIES.filter((p) => age >= p.ageMin && age <= p.ageMax)
    .filter((p) => !p.region || p.region === a.region)
    .filter((p) => !p.jobStatus || !a.status || p.jobStatus.includes(a.status))
    // 주거 조건은 직접 "따로 산다"고 답했을 때만 — 묻지 않았으면 추천하지 않는다
    .filter((p) => !p.needsIndependent || a.independent === true)
    .map((p) => {
      let score = interests.includes(p.interest) ? 10 : 0;
      if (p.region) score += 4; // 지자체 전용 혜택은 경쟁이 적어 우선
      if (p.status === "마감임박") score += 3;
      score += p.yearlyValue / 100;
      const reasons = [`만 ${age}세`];
      if (p.region) reasons.push(`${p.region} 거주`);
      if (p.jobStatus && a.status) reasons.push(STATUS_SHORT[a.status]);
      if (p.needsIndependent && a.independent) reasons.push("무주택 독립 가구");
      return { policy: p, reasons, score };
    })
    .sort((x, y) => y.score - x.score)
    .slice(0, 4)
    .map(({ policy, reasons }) => ({ policy, reasons }));

  const monthly = a.monthly ?? 30;
  const products = PRODUCTS.filter((p) => age >= p.ageMin && age <= p.ageMax)
    .filter((p) => (p.kind === "예금" ? monthly === 0 || interests.includes("asset") : monthly > 0))
    .map((p) => {
      const amount = p.kind === "예금" ? 1000 : Math.min(monthly, p.monthlyMax);
      const expected = p.kind === "예금" ? undefined : estimateMaturity(p, amount).total;
      let score = p.maxRate;
      if (p.govMatchMonthly) score += 2;
      if (p.kind === "청약" && interests.includes("housing")) score += 2;
      if (p.termMonths > 24 && monthly < 20) score -= 3;
      const reason =
        p.kind === "예금"
          ? "모아둔 목돈을 맡기기 좋아요"
          : p.monthlyMax >= monthly
            ? `월 ${monthly}만원 전부 넣을 수 있어요`
            : `월 ${p.monthlyMax}만원까지 넣을 수 있어요`;
      return { product: p, reason, expected, score };
    })
    .sort((x, y) => y.score - x.score)
    .slice(0, 3)
    .map(({ product, reason, expected }) => ({ product, reason, expected }));

  return {
    policies,
    products,
    yearlyTotal: policies.reduce((s, p) => s + p.policy.yearlyValue, 0),
    scanned: 2431,
  };
}

const STATUS_SHORT: Record<JobStatus, string> = {
  seeker: "구직 중",
  worker: "재직 중",
  student: "대학생",
  self: "자영업·프리랜서",
  etc: "기타",
};

export function profileLine(a: Answers) {
  return [
    a.age && `만 ${a.age}세`,
    a.region && (a.region === "기타" ? "지방 거주" : a.region),
    a.status && STATUS_SHORT[a.status],
  ]
    .filter(Boolean)
    .join(" · ");
}

export function summaryText(a: Answers, r: Recommendation) {
  const who = profileLine(a);
  const monthly = a.monthly ?? 0;
  return [
    `**${who}** 조건으로 정책 문서 ${r.scanned.toLocaleString()}건과 예적금 상품을 살펴봤어요.`,
    `지금 바로 신청할 수 있는 정책 **${r.policies.length}개**와${
      monthly > 0 ? ` 월 ${monthly}만원 저축에 맞는` : ""
    } 금융상품 **${r.products.length}개**를 골랐어요. 항목을 누르면 자격 조건과 신청 방법을 자세히 볼 수 있어요.`,
  ].join("\n");
}

/** 상세 페이지를 다녀와도 대화를 복원하기 위한 sessionStorage 키 */
export const STORE_KEY = "youthfit-chat-v1";

export const RAG_STEPS_INTRO = ["질문 이해하기", "온통청년 정책 문서 검색", "추가로 필요한 정보 정리"];
export const RAG_STEPS_FINAL = ["자격 조건 대조", "금융상품 금리 비교", "추천 이유 정리"];

/** 추천 이후 자유 질문에 대한 데모 응답 */
export function followUpReply(text: string, r: Recommendation | null): string {
  if (/신청|방법|어떻게/.test(text) && r?.policies[0]) {
    const p = r.policies[0].policy;
    return `**${p.name}**은 ${p.steps.map((s, i) => `${i + 1}) ${s.title}`).join(", ")} 순서로 진행돼요.\n필요한 서류는 ${p.documents.join(", ")}이에요. 상세 페이지에서 바로 신청 사이트로 이동할 수 있어요.`;
  }
  if (/적금|예금|금리|통장/.test(text) && r?.products[0]) {
    const p = r.products[0].product;
    return `지금 조건에서는 **${p.name}**이 가장 유리해요. 기본 연 ${p.baseRate}%에 우대 조건을 채우면 최고 연 ${p.maxRate}%까지 받을 수 있어요. 상세 페이지에서 월 납입액별 만기 금액을 계산해볼 수 있어요.`;
  }
  return "좋은 질문이에요. 지금은 중간점검용 데모라 정해진 답변만 드릴 수 있어요. 실제 서비스에서는 추천 결과를 바탕으로 더 자세히 답변해드릴게요.";
}
