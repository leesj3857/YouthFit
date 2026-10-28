/** Claude 호출: 의도 파싱(Haiku) · 추천 순위/이유(Sonnet) · 추천 후 질문 답변(Sonnet) */
import Anthropic from "@anthropic-ai/sdk";
import { SIDO } from "./profile";

const PARSE_MODEL = process.env.PARSE_MODEL ?? "claude-haiku-5-5";
const REC_MODEL = process.env.REC_MODEL ?? "claude-sonnet-5-5";
let client: Anthropic | null = null;
const c = () => (client ??= new Anthropic());

type Tool = { name: string; description: string; input_schema: Record<string, unknown> };

async function callTool<T>(model: string, system: string, user: string, tool: Tool, maxTokens: number): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await c().messages.create({
      model,
      max_tokens: maxTokens,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      tools: [tool as Anthropic.Tool],
      tool_choice: { type: "auto" },
      messages: [{ role: "user", content: `${user}\n\n반드시 ${tool.name} 도구를 한 번 호출해 답하라.` }],
    });
    const t = r.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (t) return t.input as T;
  }
  throw new Error("LLM이 도구 응답을 주지 않았어요");
}

const N = (type: string, description?: string) => ({ type: [type, "null"], ...(description ? { description } : {}) });

/* ---------- 1) 의도 파싱 ---------- */
export interface Intent {
  age: number | null; sido: string | null; sigungu: string | null;
  employment: "unemployed" | "employed" | "student" | "self_employed" | null;
  education: string | null; annual_income_manwon: number | null;
  marital: "미혼" | "신혼부부" | "기혼" | null; housing: "parents" | "rent" | "own" | null;
  target_groups: string[]; domains: string[];
  want_policies: boolean; want_savings: boolean; monthly_saving_manwon: number | null; search_query: string;
}
const DOMAINS = ["주거", "일자리·취업", "창업", "교육·자격증", "금융·자산형성", "생활·복지", "건강·심리", "문화·여가", "결혼·출산·육아", "참여·권리", "교통·통신", "농어업"];
const PARSE_TOOL: Tool = {
  name: "save_intent", description: "사용자 요청 해석",
  input_schema: {
    type: "object",
    properties: {
      age: N("integer", "만 나이"), sido: { type: ["string", "null"], enum: [...SIDO, null] }, sigungu: N("string", "시·군·구"),
      employment: { type: ["string", "null"], enum: ["unemployed", "employed", "student", "self_employed", null] },
      education: { type: ["string", "null"], enum: ["고졸이하", "대학재학", "대학휴학", "졸업예정", "대졸", "대학원", null] },
      annual_income_manwon: N("integer", "본인 연소득(만원)"),
      marital: { type: ["string", "null"], enum: ["미혼", "신혼부부", "기혼", null] },
      housing: { type: ["string", "null"], enum: ["parents", "rent", "own", null] },
      target_groups: { type: "array", items: { type: "string" } },
      domains: { type: "array", items: { type: "string", enum: DOMAINS } },
      want_policies: { type: "boolean" }, want_savings: { type: "boolean" },
      monthly_saving_manwon: N("integer", "월 저축 가능액(만원)"),
      search_query: { type: "string", description: "정책 검색용 핵심어 문장 (예: 청년 월세 주거비 지원)" },
    },
    required: ["age", "sido", "sigungu", "employment", "education", "annual_income_manwon", "marital", "housing", "target_groups", "domains", "want_policies", "want_savings", "monthly_saving_manwon", "search_query"],
  },
};
const PARSE_SYSTEM = `청년이 쓴 문장에서 맞춤 추천에 필요한 정보를 뽑는다.
- 문장에 명시된 것만 채우고 나머지는 null. 추측 금지.
- 예: '취준생'→unemployed, '대학생'→student, '직장인·사회초년생'→employed, '자취'→housing=rent, '서울 사는'→sido=서울, '수원'→sido=경기·sigungu=수원시.
- target_groups는 신혼부부·장애인·농어업인·예술인·한부모·군장병·자립준비청년·저소득 등 명시된 것만.
- 지원금·정책·혜택 요청이면 want_policies=true, 적금·예금·저축·목돈이면 want_savings=true. 불분명하면 둘 다 true.`;

export const parseIntent = (text: string) => callTool<Intent>(PARSE_MODEL, PARSE_SYSTEM, text, PARSE_TOOL, 800);

/* ---------- 2) 추천 ---------- */
type RecItem = { id: string; reason: string; caution: string | null };
export interface RecOut { summary: string; policies: RecItem[]; savings: RecItem[] }
const ITEM = {
  type: "object",
  properties: {
    id: { type: "string" },
    reason: { type: "string", description: "이 사용자에게 맞는 이유 1문장 (사용자 조건과 연결, 40자 내외)" },
    caution: { type: ["string", "null"], description: "확인이 필요한 조건·주의사항 1문장" },
  },
  required: ["id", "reason", "caution"],
};
const REC_TOOL: Tool = {
  name: "save_recommendation", description: "추천 결과",
  input_schema: {
    type: "object",
    properties: {
      summary: { type: "string", description: "사용자 상황 요약과 추천 방향 2문장. 마크다운 **굵게** 가능" },
      policies: { type: "array", items: ITEM, description: "추천 순서대로 정책 최대 6개 (정책 후보가 없으면 [])" },
      savings: { type: "array", items: ITEM, description: "추천 순서대로 적금 최대 3개 (적금 후보가 있으면 1~3개 필수)" },
    },
    required: ["summary", "policies", "savings"],
  },
};
const REC_SYSTEM = `너는 청년 금융·정책 상담사 '청핏'이다. 서버가 자격 판정을 마친 후보만 받는다.
- 후보 목록의 id만 쓴다. 후보에 없는 정책·금액·조건을 지어내지 않는다.
- status=pass(자격 충족)를 먼저, unknown(확인 필요)은 무엇을 확인해야 하는지 caution에 쓴다.
- 사용자 요청 분야와의 관련성, 혜택 크기, 마감 임박 여부로 순서를 정한다. 요청과 무관한 후보는 빼도 된다.
- extra_requirements·exclusions에 사용자가 해당하는지 알 수 없는 특수 요건(예: 전세사기 피해자, 특정 자격 보유, 특정 기업 재직)이 있으면 그 요건을 caution에 꼭 적고, 요청과 직접 관련이 없으면 제외한다.
- 적금 후보가 있으면 1~3개를 반드시 포함한다. 사용자의 월 저축액과 우대조건 충족 가능성을 고려한다.
- 존댓말, 짧고 구체적으로.`;

export const recommendLLM = (payload: unknown) =>
  callTool<RecOut>(REC_MODEL, REC_SYSTEM, JSON.stringify(payload), REC_TOOL, 2500);

/* ---------- 3) 추천 후 질문 (추천된 항목 원문 기반 RAG) ---------- */
const ASK_SYSTEM = `너는 청년 금융·정책 상담사 '청핏'이다. 아래 '자료'(추천된 정책·적금의 공고 원문 요약)만 근거로 답한다.
- 자료에 없는 내용은 "공고에 나와 있지 않아요"라고 말하고 공식 사이트 확인을 권한다.
- 3~6문장, 필요하면 '• '로 시작하는 짧은 목록. 정책 이름은 **굵게**. 제목(#)·표·링크 문법은 쓰지 않는다. 존댓말.`;
export async function answerQuestion(question: string, profile: unknown, docs: unknown): Promise<string> {
  const r = await c().messages.create({
    model: REC_MODEL,
    max_tokens: 1200,
    system: [{ type: "text", text: ASK_SYSTEM }],
    messages: [{ role: "user", content: `사용자 정보: ${JSON.stringify(profile)}\n\n자료:\n${JSON.stringify(docs)}\n\n질문: ${question}` }],
  });
  return r.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
}
