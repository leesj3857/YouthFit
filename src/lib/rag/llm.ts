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
  benefit_types: string[];
}
export const BENEFIT_TYPES = ["현금지원", "비용·바우처지원", "대출·이자지원", "교육·프로그램", "공간·시설"];
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
      benefit_types: { type: "array", items: { type: "string", enum: ["현금지원", "비용·바우처지원", "대출·이자지원", "교육·프로그램", "공간·시설"] },
        description: "사용자가 혜택 '형태'를 명시할 때만 채운다. '현금으로 주는 거','지원금만','수당'→[현금지원, 비용·바우처지원], '대출만'→[대출·이자지원], '교육·상담 프로그램'→[교육·프로그램]. '월세 지원','취업 지원'처럼 분야만 말하면 [] (분야는 domains로)" },
    },
    required: ["age", "sido", "sigungu", "employment", "education", "annual_income_manwon", "marital", "housing", "target_groups", "domains", "want_policies", "want_savings", "monthly_saving_manwon", "search_query", "benefit_types"],
  },
};
const PARSE_SYSTEM = `청년이 쓴 문장에서 맞춤 추천에 필요한 정보를 뽑는다.
- 문장에 명시된 것만 채우고 나머지는 null. 추측 금지.
- 예: '취준생'→unemployed, '대학생'→student, '직장인·사회초년생'→employed, '자취'→housing=rent, '서울 사는'→sido=서울, '수원'→sido=경기·sigungu=수원시.
- target_groups는 신혼부부·장애인·농어업인·예술인·한부모·군장병·자립준비청년·저소득 등 명시된 것만.
- 지원금·정책·혜택 요청이면 want_policies=true, 적금·예금·저축·목돈이면 want_savings=true. 불분명하면 둘 다 true.`;

export const parseIntent = (text: string) => callTool<Intent>(PARSE_MODEL, PARSE_SYSTEM, text, PARSE_TOOL, 800);

/* ---------- 1-2) 추천 이후 후속 메시지 해석 ---------- */
export interface FollowUp extends Intent { intent: "more" | "refine" | "answer" }
const FOLLOW_TOOL: Tool = {
  name: "save_followup", description: "추천을 받은 뒤 사용자가 보낸 메시지 해석",
  input_schema: {
    ...PARSE_TOOL.input_schema,
    properties: {
      intent: { type: "string", enum: ["more", "refine", "answer"],
        description: "more=같은 조건으로 다른/추가 추천을 원함('다른 건 없어?','더 보여줘') / refine=조건·분야·혜택 형태를 바꿔 다시 찾기('현금 지원만','부산으로 바꿀게','적금도 보여줘') / answer=추천된 항목에 대한 질문(신청 방법, 서류, 비교 등)" },
      ...(PARSE_TOOL.input_schema as { properties: object }).properties,
    },
    required: ["intent", ...((PARSE_TOOL.input_schema as { required: string[] }).required)],
  },
};
const FOLLOW_SYSTEM = `청년 정책·적금 추천을 받은 사용자의 후속 메시지를 해석한다. 직전 대화를 참고해 '그거', '다른 거' 같은 지시어를 이해한다.
- intent를 고르고, 메시지에 새로 드러난 조건만 나머지 필드에 채운다(없으면 null 또는 []). search_query는 새로 찾을 주제가 있을 때만, 없으면 "".
${PARSE_SYSTEM.split("\n").slice(1).join("\n")}`;
export const parseFollowUp = (history: string, text: string) =>
  callTool<FollowUp>(PARSE_MODEL, FOLLOW_SYSTEM, `직전 대화:\n${history || "(없음)"}\n\n사용자 메시지: ${text}`, FOLLOW_TOOL, 900);

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
- 사용자가 고른 혜택 형태(benefitTypes)가 있으면 그 형태만, 없으면 현금 지원·비용 지원처럼 직접 받는 혜택을 행사·센터 안내·정보 제공보다 앞에 둔다.
- '이미_보여준_항목'과 비슷한 내용은 반복하지 않는다.
- extra_requirements·exclusions에 사용자가 해당하는지 알 수 없는 특수 요건(예: 전세사기 피해자, 특정 자격 보유, 특정 기업 재직)이 있으면 그 요건을 caution에 꼭 적고, 요청과 직접 관련이 없으면 제외한다.
- 적금 후보가 있으면 1~3개를 반드시 포함한다. 사용자의 월 저축액과 우대조건 충족 가능성을 고려한다.
- 존댓말, 짧고 구체적으로.`;

export const recommendLLM = (payload: unknown) =>
  callTool<RecOut>(REC_MODEL, REC_SYSTEM, JSON.stringify(payload), REC_TOOL, 2500);

/* ---------- 3) 추천 후 질문 (추천된 항목 원문 기반 RAG) ---------- */
const ASK_SYSTEM = `너는 청년 금융·정책 상담사 '청핏'이다. 아래 '자료'(추천된 정책·적금의 공고 원문 요약)만 근거로 답한다.
- '직전 대화'를 이어서 이해하고, 이미 한 말을 그대로 반복하지 않는다. 이모지는 쓰지 않는다.
- 자료에 없는 내용은 "공고에 나와 있지 않아요"라고 말하고 공식 사이트 확인을 권한다.
- 3~6문장, 필요하면 '• '로 시작하는 짧은 목록. 정책 이름은 **굵게**. 제목(#)·표·링크 문법은 쓰지 않는다. 존댓말.`;
export async function answerQuestion(question: string, profile: unknown, docs: unknown, history = ""): Promise<string> {
  const r = await c().messages.create({
    model: REC_MODEL,
    max_tokens: 1200,
    system: [{ type: "text", text: ASK_SYSTEM }],
    messages: [{ role: "user", content: `사용자 정보: ${JSON.stringify(profile)}\n\n자료:\n${JSON.stringify(docs)}\n\n직전 대화:\n${history || "(없음)"}\n\n질문: ${question}` }],
  });
  return r.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
}

/* ---------- 4) 긴 대화 요약 (오래된 부분만) ---------- */
export async function summarizeHistory(transcript: string): Promise<string> {
  const r = await c().messages.create({
    model: PARSE_MODEL,
    max_tokens: 600,
    system: [{ type: "text", text: "청년 정책·적금 추천 상담 대화의 앞부분을 요약한다. 사용자가 밝힌 조건(나이·지역·상황·소득·관심사), 원하는 것, 이미 추천·설명한 항목 이름, 사용자의 반응·불만을 빠짐없이 6줄 이내로 적는다." }],
    messages: [{ role: "user", content: transcript }],
  });
  return r.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
}
