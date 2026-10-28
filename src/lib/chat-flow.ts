/**
 * 채팅 화면 공통 헬퍼. 질문·추천 로직은 서버(/api/chat, src/lib/rag)에 있고
 * 프론트는 서버가 내려준 Question 스키마를 그대로 렌더한다.
 */
import type { AnswerValue, Question } from "./rag/types";
export type { Option, Widget, Question, AnswerValue } from "./rag/types";

export function formatAnswer(q: Question, raw: AnswerValue): string {
  const w = q.widget;
  if (w.type === "slider") {
    const n = Number(raw);
    return w.unit === "age" ? `만 ${n}세예요` : n === 0 ? "지금은 저축이 어려워요" : `월 ${n}만원 정도요`;
  }
  if (w.type === "confirm") return raw ? w.yes : w.no;
  if (w.type === "multi") {
    const values = raw as string[];
    if (!values.length) return "해당 없어요";
    return values.map((v) => w.options.find((o) => o.value === v)?.label ?? v).join(", ");
  }
  return w.options.find((o) => o.value === raw)?.label ?? String(raw);
}

/** 상세 페이지를 다녀와도 대화를 복원하기 위한 sessionStorage 키 */
export const STORE_KEY = "youthfit-chat-v2";

export const RAG_STEPS_INTRO = ["질문 이해하기", "정책 1,687건 검색", "자격 조건 대조", "추가로 필요한 정보 정리"];
export const RAG_STEPS_NEXT = ["답변 반영하기", "자격 조건 다시 대조", "후보 좁히기"];
export const RAG_STEPS_FINAL = ["자격 조건 대조", "예적금 금리 비교", "추천 이유 정리"];
export const RAG_STEPS_ASK = ["이전 대화와 질문 이해하기", "공고 원문·후보 다시 찾기", "답변 정리"];

export const FOLLOW_UPS = ["다른 것도 더 보여줘", "현금으로 주는 지원금만 보여줘", "1순위 정책 신청 방법이랑 서류 알려줘", "적금 우대금리 조건 자세히 알려줘", "조건 바꿔서 다시 찾기"];

/** 추천 결과에 있는 항목에 맞춰 후속 질문 칩을 고른다 */
export function followUpsFor(rec: { policies: unknown[]; savings: unknown[] } | null) {
  return FOLLOW_UPS.filter((f) =>
    f.startsWith("1순위") || f.startsWith("현금") ? !!rec?.policies.length : f.startsWith("적금") ? !!rec?.savings.length : true,
  );
}
