/**
 * 채팅 화면 공통 헬퍼. 질문·후보·추천은 모두 백엔드 API(src/lib/api.ts)가 내려주고
 * 프론트는 그 값을 그대로 렌더한다 (질문 id·선택지 value 는 바꾸지 않는다).
 */
import type { ApiQuestion } from "./api";

export type Option = { value: string; label: string; desc?: string };
export type Widget =
  | { type: "single"; layout: "chips" | "list"; options: Option[] }
  | { type: "multi"; options: Option[]; defaults?: string[] }
  | { type: "slider"; min: number; max: number; step: number; defaultValue: number; unit: "age" | "manwon"; presets?: number[] }
  | { type: "confirm"; yes: string; no: string };
export type AnswerValue = string | string[] | number | boolean;

export interface Question {
  /** 서버가 정한 질문 id — 답을 보낼 때 그대로 쓴다 */
  id: string;
  variable: string;
  text: string;
  widget: Widget;
  skippable: boolean;
  affected: number;
}

/** 서버 질문 → 화면 위젯. 긴 문구 몇 개는 리스트로, 나머지는 칩으로 */
export function toQuestion(q: ApiQuestion): Question {
  const options = q.options.map((o) => ({ value: o.value, label: o.label }));
  const long = options.some((o) => o.label.length > 8);
  const widget: Widget =
    q.type === "multi" ? { type: "multi", options } : { type: "single", layout: long && options.length <= 5 ? "list" : "chips", options };
  return { id: q.id, variable: q.variable, text: q.text, widget, skippable: true, affected: q.affected };
}

/** 고른 답을 서버로 보낼 values 배열로 */
export const toValues = (raw: AnswerValue): string[] => (Array.isArray(raw) ? raw.map(String) : [String(raw)]);

export function formatAnswer(q: Question, raw: AnswerValue): string {
  const w = q.widget;
  if (w.type === "slider") {
    const n = Number(raw);
    return w.unit === "age" ? `만 ${n}세예요` : `${n}만원 정도요`;
  }
  if (w.type === "confirm") return raw ? w.yes : w.no;
  if (w.type === "multi") {
    const values = raw as string[];
    if (!values.length) return "해당 없어요";
    return values.map((v) => w.options.find((o) => o.value === v)?.label ?? v).join(", ");
  }
  return w.options.find((o) => o.value === raw)?.label ?? String(raw);
}

/** 직접 입력한 문장에서 선택지를 찾는다 (딱 하나만 맞을 때) */
export function matchOption(q: Question, text: string): string | null {
  if (q.widget.type !== "single") return null;
  const norm = (s: string) => s.replace(/[\s·~,.]/g, "");
  const t = norm(text);
  if (t.length < 2) return null;
  const hits = q.widget.options.filter((o) => {
    const l = norm(o.label);
    return t.includes(l) || (t.length >= 2 && l.includes(t));
  });
  return hits.length === 1 ? hits[0].value : null;
}

/** 새로고침해도 대화를 복원하기 위한 sessionStorage 키 */
export const STORE_KEY = "youthfit-chat-v3";

export const STEPS_INTRO = ["질문 이해하기", "청년 정책 검색", "자격 조건 대조", "추가로 필요한 정보 정리"];
export const STEPS_FINAL = ["답변 반영하기", "후보 좁히기", "추천 이유 정리"];
/** 무료 서버가 잠들어 있다가 깨어날 때 보여줄 문구 */
export const SLOW_NOTICE = "서버를 깨우는 중이에요. 처음엔 1분쯤 걸릴 수 있어요";

export const CHIP_REANSWER = "답변 다시 고르기";
export const CHIP_RETRY = "다시 시도";
export const CHIP_RESET = "처음부터 다시 찾기";
