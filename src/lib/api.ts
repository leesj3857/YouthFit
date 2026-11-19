/**
 * YouthFit 백엔드 API 클라이언트.
 * 필드 정의의 기준은 백엔드 Swagger({Base URL}/docs)이고, 여기 타입은 그 응답을 그대로 옮긴 것이다.
 * 흐름: 세션 생성 → 칩 답변 → 최종 추천 (정책만, 적금 없음)
 */

/** 백엔드 주소 (공개 API라 브라우저에 노출돼도 된다). 로컬 백엔드를 쓰려면 .env.local 에 http://localhost:8000 */
export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://youthfit-api.onrender.com").replace(/\/+$/, "");

export type EmploymentStatus =
  | "employed" | "self_employed" | "unemployed" | "freelancer" | "day_laborer" | "founder" | "short_term" | "farmer";
export type InterestCode = "housing" | "jobs" | "finance" | "education" | "welfare" | "participation";
export type Availability = "open" | "upcoming" | "closed" | "unverified";
export type LinkSource = "apply" | "reference" | "ontong_detail";

export interface ApiOption { value: string; label: string }
export interface ApiQuestion {
  id: string;
  variable: "marriage" | "school" | "income_bucket" | "sigungu";
  text: string;
  type: "single" | "multi";
  options: ApiOption[];
  /** 답에 따라 남거나 빠지는 후보 수 */
  affected: number;
}
export interface ApiAnswer { question_id: string; values: string[] }

export interface AppliedConditions {
  age: number | null;
  sido_code: string | null;
  employment_status: EmploymentStatus | null;
  interests: InterestCode[];
  /** query 에서 서버가 추출해 채운 필드 이름 */
  from_query: string[];
  sigungu_codes?: string[];
  marriage?: string | null;
  school?: string | null;
  income_bucket?: string | null;
}

export interface PolicyEligibility {
  age_limited: boolean;
  min_age: number | null;
  max_age: number | null;
  region_scope: "national" | "sido" | "sigungu";
  sido_codes: string[];
  sigungu_codes: string[];
  /** 취업상태 조건(한글 라벨). 비어 있으면 제한 없음 */
  employment: string[];
}
export interface PolicyCandidate {
  plcy_no: string;
  name: string;
  org_name: string | null;
  categories: string[];
  availability: Availability;
  apply_start: string | null;
  apply_end: string | null;
  biz_end: string | null;
  eligibility: PolicyEligibility;
  official_url: string;
  url_source: LinkSource;
}
export interface CandidateResponse {
  as_of: string;
  conditions: AppliedConditions;
  policies: { total: number; items: PolicyCandidate[] };
}
export interface SessionResponse {
  session_id: string;
  expires_at: string;
  query: string;
  questions: ApiQuestion[];
  answers: ApiAnswer[];
  candidates: CandidateResponse;
}
export interface Recommendation {
  /** 서술용 문구 — 여기서 링크·날짜를 뽑아 쓰지 않는다 */
  reason: string;
  check_points: string[];
  reason_source: "llm" | "template";
  /** 링크·마감일·자격 표시는 이 DB 값만 쓴다 */
  policy: PolicyCandidate;
}
export interface RecommendationResponse {
  session_id: string;
  as_of: string;
  items: Recommendation[];
}

export class ApiError extends Error {
  constructor(
    message: string,
    /** HTTP 상태 (0 = 연결 실패·시간 초과) */
    public status: number,
    /** 429일 때 다시 시도할 수 있을 때까지 남은 초 */
    public retryAfter?: number,
  ) {
    super(message);
  }
}

/** 화면에 그대로 보여줄 수 있는 안내 문구로 바꾼다 */
function messageFor(status: number, retryAfter?: number) {
  if (status === 404) return "대화가 오래돼서 만료됐어요. 처음부터 다시 찾아주세요.";
  if (status === 429)
    return retryAfter ? `요청이 많아요. ${retryAfter >= 60 ? `${Math.ceil(retryAfter / 60)}분` : `${retryAfter}초`} 뒤에 다시 시도해주세요.` : "요청이 많아요. 잠시 후 다시 시도해주세요.";
  if (status === 422) return "요청을 처리하지 못했어요. 처음부터 다시 찾아주세요.";
  if (status === 0) return "서버에 연결하지 못했어요. 잠시 후 다시 시도해주세요.";
  return "서버에 잠시 문제가 있어요. 잠시 후 다시 시도해주세요.";
}

/** 무료 서버가 잠들어 있으면 첫 응답까지 1분쯤 걸릴 수 있어 넉넉히 기다린다 */
const TIMEOUT_MS = 90_000;

async function request<T>(path: string, init?: { method?: "GET" | "POST"; body?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: init?.method ?? "GET",
      headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new ApiError(messageFor(0), 0);
  }
  if (!res.ok) {
    const retry = Number(res.headers.get("Retry-After"));
    const retryAfter = Number.isFinite(retry) && retry > 0 ? Math.ceil(retry) : undefined;
    throw new ApiError(messageFor(res.status, retryAfter), res.status, retryAfter);
  }
  return (await res.json()) as T;
}

/** 세션 생성 때 함께 보낼 수 있는 인적 조건. 보낸 필드는 문장에서 다시 뽑지 않는다 */
export interface ProfileFields {
  age?: number | null;
  sido_code?: string | null;
  employment_status?: EmploymentStatus | null;
  interests?: InterestCode[];
}

/** 1) 자연어 한 문장으로 세션 생성 → 역질문 + 1차 후보 */
export const createSession = (query: string, fields: ProfileFields = {}) =>
  request<SessionResponse>("/v1/sessions", { method: "POST", body: { ...fields, query: query.slice(0, 500) } });

/** 문장에서 어떤 조건이 읽히는지만 확인 (룰 필터, LLM·세션·호출 제한 없음) */
export const extractConditions = (query: string) =>
  request<CandidateResponse>("/v1/candidates", { method: "POST", body: { query: query.slice(0, 500) } }).then((r) => r.conditions);

/** 2) 칩 답변 반영 → 좁혀진 후보. 보낼 때마다 이전 답 전체를 덮어쓴다 */
export const submitAnswers = (sessionId: string, answers: ApiAnswer[]) =>
  request<SessionResponse>(`/v1/sessions/${encodeURIComponent(sessionId)}/answers`, { method: "POST", body: { answers } });

/** 3) 최종 추천 (최대 5건 + 선정 사유) */
export const getRecommendations = (sessionId: string) =>
  request<RecommendationResponse>(`/v1/sessions/${encodeURIComponent(sessionId)}/recommendations`, { method: "POST" });

/* ---------- 표시용 라벨 ---------- */

export const SIDO_NAME: Record<string, string> = {
  "11": "서울", "26": "부산", "27": "대구", "28": "인천", "30": "대전", "31": "울산", "36": "세종", "41": "경기",
  "43": "충북", "44": "충남", "47": "경북", "48": "경남", "50": "제주", "51": "강원", "52": "전북", "12": "전남·광주",
};
export const EMPLOYMENT_LABEL: Record<EmploymentStatus, string> = {
  employed: "재직 중", self_employed: "자영업", unemployed: "미취업", freelancer: "프리랜서",
  day_laborer: "일용근로", founder: "(예비)창업", short_term: "단기근로", farmer: "영농",
};
export const INTEREST_LABEL: Record<InterestCode, string> = {
  housing: "주거", jobs: "일자리", finance: "금융", education: "교육", welfare: "복지", participation: "참여",
};
