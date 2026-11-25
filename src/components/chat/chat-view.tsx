"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import Link from "next/link";
import { ArrowUp, RotateCcw } from "lucide-react";
import {
  ApiError,
  EMPLOYMENT_LABEL,
  INTEREST_LABEL,
  SIDO_NAME,
  createSession,
  extractConditions,
  getRecommendations,
  MAX_EXCLUDE,
  submitAnswers,
  type ApiAnswer,
  type AppliedConditions,
  type ProfileFields,
  type RecommendationResponse,
  type SessionResponse,
} from "@/lib/api";
import {
  CHIP_MORE,
  CHIP_REANSWER,
  CHIP_RESET,
  CHIP_RETRY,
  SLOW_NOTICE,
  STEPS_FINAL,
  STEPS_MORE,
  STEPS_INTRO,
  STORE_KEY,
  formatAnswer,
  matchOption,
  toQuestion,
  toValues,
  wantsMore,
  type AnswerValue,
  type Question,
} from "@/lib/chat-flow";
import { StreamingText } from "./streaming-text";
import { QuestionWidget } from "./question-widgets";
import { Thinking } from "./thinking";
import { RecommendationView, type FeedbackMeta, type RecResult } from "./recommendation";
import { cn } from "@/lib/utils";

/* ---------- 메시지 모델 ---------- */

type Msg = (
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; kind: "thinking"; steps: string[]; active: number; done: boolean }
  | {
      id: string;
      role: "assistant";
      kind: "text";
      text: string;
      question?: Question;
      answered?: boolean;
      rec?: RecResult;
      meta?: FeedbackMeta;
      followUps?: string[];
    }
) & {
  /** 새로고침·뒤로가기로 복원된 메시지는 다시 스트리밍하지 않는다 */
  restored?: boolean;
};

/** 백엔드 세션에서 화면이 계속 쓰는 값 */
type Session = { id: string; questions: Question[]; conditions: AppliedConditions; total: number };
/** 질문 id → 고른 선택지 value 들 (건너뛴 질문은 없음) */
type Answers = Record<string, string[]>;
/**
 * 같은 대화에서 새 문장으로 다시 찾을 때 이어 쓰는 정보.
 * 나이·지역·취업상태·관심사는 새 세션 생성 때 함께 보내고, 칩 답(학력·혼인 등)은 질문 종류(variable)별로 기억해 두었다가
 * 새 세션이 같은 질문을 내면 자동으로 답한다 → 이미 말한 정보를 다시 묻지 않는다.
 */
type Carry = ProfileFields & { byVar: Record<string, string[]> };
type Snapshot = {
  query?: string;
  messages: Msg[];
  session: Session | null;
  queue: Question[];
  acc: Answers;
  rec: RecResult | null;
  carry?: Carry | null;
  shown?: string[];
};

const isThinking = (m?: Msg) => m?.role === "assistant" && m.kind === "thinking";

let seq = 0;
const nid = () => `m${Date.now().toString(36)}${seq++}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const SUGGESTIONS = [
  "서울 사는 26살 취준생인데 받을 수 있는 지원금 알려줘",
  "자취 중인데 월세 지원 받을 수 있을까?",
  "부산 사는 28살 직장인인데 목돈 마련 지원 있어?",
  "광주 사는 대학생인데 교육비 지원되는 거 있어?",
];

const ACKS = ["알겠어요.", "좋아요.", "확인했어요.", "네, 반영할게요."];

/** 서버가 문장에서 읽어낸 조건을 한 줄로 */
function conditionLine(c: AppliedConditions) {
  const parts = [
    c.sido_code ? SIDO_NAME[c.sido_code] : null,
    c.age != null ? `만 ${c.age}세` : null,
    c.employment_status ? EMPLOYMENT_LABEL[c.employment_status] : null,
  ].filter(Boolean);
  const topics = c.interests.map((i) => INTEREST_LABEL[i]).filter(Boolean);
  return { who: parts.join(" · "), topics: topics.join("·") };
}

function introText(s: Session) {
  const { who, topics } = conditionLine(s.conditions);
  const head = who ? `**${who}**인 분께 맞는 ${topics ? `${topics} ` : ""}정책을 찾고 있어요.` : `${topics ? `${topics} ` : ""}정책을 찾고 있어요.`;
  const region = s.conditions.sido_code ? "" : "\n사는 지역을 말씀해주시면(예: “서울 사는 …”) 지역 정책도 함께 찾아드려요. 지금은 전국 정책만 봤어요.";
  return `${head} 지금 조건으로 신청할 수 있는 정책 후보가 **${s.total.toLocaleString()}건**이에요.${region}`;
}

const VAR_LABEL: Record<string, string> = { school: "학력", marriage: "혼인 여부", income_bucket: "소득", sigungu: "사는 시군구" };

/** 서버가 확정한 조건 + 이번 세션에서 고른 칩 답을 다음 질문용으로 정리 */
function toCarry(s: Session, answers: Answers, prev: Carry | null): Carry {
  const c = s.conditions;
  const byVar: Record<string, string[]> = { ...(prev?.byVar ?? {}) };
  // 시도가 바뀌었으면 이전 시군구 답은 의미가 없다
  if (prev && prev.sido_code !== c.sido_code) delete byVar.sigungu;
  for (const q of s.questions) if (answers[q.id]) byVar[q.variable] = answers[q.id];
  return { age: c.age, sido_code: c.sido_code, employment_status: c.employment_status, interests: c.interests, byVar };
}

/** 새 문장에서 읽힌 조건은 새 값으로, 읽히지 않은 조건은 이전 값으로 */
function mergeFields(prev: Carry, ext: AppliedConditions): { fields: ProfileFields; kept: string[] } {
  const f = new Set(ext.from_query);
  const kept: string[] = [];
  const pick = <K extends "age" | "sido_code" | "employment_status">(k: K, label: string) => {
    if (f.has(k)) return ext[k];
    if (prev[k] != null) kept.push(label);
    return prev[k] ?? null;
  };
  const fields: ProfileFields = {
    age: pick("age", "나이"),
    sido_code: pick("sido_code", "지역"),
    employment_status: pick("employment_status", "취업 상태"),
    interests: f.has("interests") && ext.interests.length ? ext.interests : (prev.interests ?? []),
  };
  return { fields, kept };
}

/** 추천 결과 아래 칩: 더 볼 게 남았으면 「더 보기」, 질문이 있었으면 「답변 다시 고르기」, 항상 「처음부터」 */
function afterChips(hasMore: boolean, hasQuestions: boolean, shownCount: number) {
  return [
    ...(hasMore && shownCount < MAX_EXCLUDE ? [CHIP_MORE] : []),
    ...(hasQuestions ? [CHIP_REANSWER] : []),
    CHIP_RESET,
  ];
}

function feedbackMeta(c: AppliedConditions): FeedbackMeta {
  return {
    age: c.age ?? undefined,
    sido: c.sido_code ? SIDO_NAME[c.sido_code] : undefined,
    employment: c.employment_status ?? undefined,
    domains: c.interests,
  };
}

/* ---------- 컴포넌트 ---------- */

export function ChatView({ initialQuery }: { initialQuery?: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  // 비동기 흐름에서 최신 값을 읽기 위한 ref들
  const session = useRef<Session | null>(null);
  const queue = useRef<Question[]>([]);
  const acc = useRef<Answers>({});
  const pendingId = useRef<string | null>(null);
  const rec = useRef<RecResult | null>(null);
  const runToken = useRef(0);
  const startedOnce = useRef(false);
  const firstQuery = useRef<string | undefined>(undefined);
  /** 이 세션에서 지금까지 화면에 보여준 정책 plcy_no — 「더 보기」 때 제외 목록으로 보낸다 */
  const shown = useRef<string[]>([]);
  /** 같은 대화에서 이어 쓸 인적 정보·칩 답 (새로 찾기 전까지 유지) */
  const carry = useRef<Carry | null>(null);
  /** 실패했을 때 "다시 시도"가 다시 실행할 동작 */
  const retry = useRef<(() => void) | null>(null);

  const lastUserSeen = useRef<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);

  const push = (m: Msg) => setMessages((ms) => [...ms, m]);
  const patch = (id: string, p: Partial<Msg>) =>
    setMessages((ms) => ms.map((m) => (m.id === id ? ({ ...m, ...p } as Msg) : m)));

  /* ----- 대화 엔진: 검색 단계 표시를 서버 응답과 함께 진행 ----- */

  /** 단계를 하나씩 켜되, 서버 응답이 올 때까지 마지막 단계에서 기다린다 */
  const thinkWhile = useCallback(async <T,>(steps: string[], work: Promise<T>, token: number): Promise<T | null> => {
    const id = nid();
    push({ id, role: "assistant", kind: "thinking", steps, active: 0, done: false });
    let settled = false;
    const guarded = work.finally(() => { settled = true; });
    guarded.catch(() => {}); // 실패는 아래에서 처리 — 대기 중 미처리 거부 경고 방지
    // 응답이 오래 걸리면(무료 서버가 잠들어 있던 경우) 기다리는 이유를 알려준다
    const slow = setTimeout(() => {
      if (!settled && token === runToken.current) patch(id, { steps: [...steps.slice(0, -1), SLOW_NOTICE], active: steps.length - 1 });
    }, 6000);
    for (let i = 1; i < steps.length; i++) {
      await sleep(settled ? 250 : 600 + Math.random() * 400);
      if (token !== runToken.current) return clearTimeout(slow), null;
      patch(id, { active: i });
    }
    let result: T;
    try {
      result = await guarded;
    } catch (e) {
      clearTimeout(slow);
      if (token !== runToken.current) return null;
      patch(id, { steps, active: steps.length, done: true });
      await sleep(420);
      const err = e instanceof ApiError ? e : new ApiError("잠시 후 다시 시도해주세요.", 0);
      // 만료(404)·잘못된 요청(422)은 다시 시도해도 같으니 처음부터, 나머지는 다시 시도할 수 있게
      const canRetry = err.status !== 404 && err.status !== 422 && !!retry.current;
      push({ id: nid(), role: "assistant", kind: "text", text: `앗, ${err.message}`, followUps: canRetry ? [CHIP_RETRY, CHIP_RESET] : [CHIP_RESET] });
      setBusy(false);
      return null;
    }
    clearTimeout(slow);
    if (token !== runToken.current) return null;
    patch(id, { steps, active: steps.length });
    await sleep(250);
    patch(id, { done: true });
    // 단계 목록이 다 접힌 다음에 답변이 시작되도록 (접히는 중에 글자가 올라붙으면 화면이 출렁임)
    await sleep(420);
    return token === runToken.current ? result : null;
  }, []);

  const askFromQueue = useCallback((prefix: string) => {
    const q = queue.current.shift();
    if (!q) return false;
    const id = nid();
    pendingId.current = id;
    const text = !prefix ? q.text : prefix.endsWith("\n") ? prefix + q.text : `${prefix} ${q.text}`;
    push({ id, role: "assistant", kind: "text", text, question: q });
    setBusy(false);
    return true;
  }, []);

  /** 모은 답을 서버에 반영하고(전체 덮어쓰기) 최종 추천을 받는다 */
  const finish = useCallback(
    async (token: number) => {
      const s = session.current;
      if (!s) return;
      setBusy(true);
      retry.current = () => void finish(runToken.current);
      const answers: ApiAnswer[] = Object.entries(acc.current).map(([question_id, values]) => ({ question_id, values }));
      const work = (async (): Promise<{ total: number; res: RecommendationResponse }> => {
        const narrowed = await submitAnswers(s.id, answers);
        return { total: narrowed.candidates.policies.total, res: await getRecommendations(s.id) };
      })();
      const r = await thinkWhile(STEPS_FINAL, work, token);
      if (!r) return;
      retry.current = null;
      carry.current = toCarry(s, acc.current, carry.current);
      const before = s.total;
      session.current = { ...s, total: r.total };
      const chips = afterChips(r.res.has_more, s.questions.length > 0, r.res.items.length);
      shown.current = r.res.items.map((x) => x.policy.plcy_no);
      if (r.res.items.length === 0) {
        rec.current = null;
        push({
          id: nid(), role: "assistant", kind: "text",
          text: "지금 조건에 맞는 정책을 찾지 못했어요. 답변을 바꾸거나, 지역·나이·상황을 넣어 다시 물어봐 주세요.",
          followUps: chips,
        });
        setBusy(false);
        return;
      }
      const result: RecResult = { asOf: r.res.as_of, total: r.total, items: r.res.items, hasMore: r.res.has_more, page: 1 };
      rec.current = result;
      const narrowedText = answers.length && r.total < before ? `답변을 반영하니 후보가 **${r.total.toLocaleString()}건**으로 좁혀졌어요. ` : `후보 **${r.total.toLocaleString()}건** 가운데 `;
      push({
        id: nid(), role: "assistant", kind: "text",
        text: `${narrowedText}${answers.length && r.total < before ? "그중 " : ""}지금 조건에 가장 잘 맞는 **${r.res.items.length}건**을 골랐어요.`,
        rec: result, meta: feedbackMeta(s.conditions), followUps: chips,
      });
      setBusy(false);
    },
    [thinkWhile],
  );

  const start = useCallback(
    async (query: string) => {
      const token = ++runToken.current;
      setBusy(true);
      session.current = null;
      queue.current = [];
      acc.current = {};
      pendingId.current = null;
      rec.current = null;
      shown.current = [];
      push({ id: nid(), role: "user", text: query });
      if (!firstQuery.current) {
        firstQuery.current = query;
        syncUrl(query);
      }
      const prev = carry.current;
      const run = async (t: number) => {
        retry.current = () => void run(runToken.current);
        // 같은 대화의 두 번째 질문부터: 문장에 없는 인적 정보는 앞에서 받은 값을 함께 보낸다
        const work = (async (): Promise<{ res: SessionResponse; kept: string[] }> => {
          if (!prev) return { res: await createSession(query), kept: [] };
          const { fields, kept } = mergeFields(prev, await extractConditions(query));
          return { res: await createSession(query, fields), kept };
        })();
        const out = await thinkWhile(STEPS_INTRO, work, t);
        if (!out) return;
        retry.current = null;
        const r = out.res;
        const s: Session = {
          id: r.session_id,
          questions: r.questions.map(toQuestion),
          conditions: r.candidates.conditions,
          total: r.candidates.policies.total,
        };
        session.current = s;
        // 이전에 답한 칩과 같은 질문은 자동으로 답하고 묻지 않는다 (선택지에 있는 값일 때만)
        const known: Record<string, string[]> = { ...(prev?.byVar ?? {}) };
        if (!prev || prev.sido_code !== s.conditions.sido_code) delete known.sigungu;
        const reused: string[] = [];
        const ask: Question[] = [];
        for (const q of s.questions) {
          const v = known[q.variable];
          const opts = q.widget.type === "single" || q.widget.type === "multi" ? q.widget.options : [];
          if (v?.length && v.every((x) => opts.some((o) => o.value === x))) {
            acc.current[q.id] = v;
            reused.push(VAR_LABEL[q.variable] ?? q.variable);
          } else ask.push(q);
        }
        carry.current = toCarry(s, acc.current, prev);
        const keptAll = [...out.kept, ...reused];
        const keptLine = keptAll.length ? `앞에서 알려주신 ${keptAll.join("·")}은 그대로 반영했어요.\n` : "";
        if (s.total === 0) {
          push({
            id: nid(), role: "assistant", kind: "text",
            text: "지금 조건에 맞는 정책을 찾지 못했어요. 지역·나이·상황을 조금 바꿔서 다시 물어봐 주세요.",
            followUps: [CHIP_RESET],
          });
          setBusy(false);
          return;
        }
        queue.current = ask;
        if (!ask.length) {
          if (keptLine) push({ id: nid(), role: "assistant", kind: "text", text: `${introText(s)}\n${keptLine.trim()}` });
          await finish(t);
          return;
        }
        if (!askFromQueue(`${introText(s)}\n${keptLine}더 정확히 고르려고 몇 가지만 여쭤볼게요.\n\n`)) await finish(t);
      };
      await run(token);
    },
    [thinkWhile, askFromQueue, finish],
  );

  async function answer(msgId: string, q: Question, value: AnswerValue | null) {
    if (pendingId.current !== msgId) return;
    pendingId.current = null;
    const token = runToken.current;
    setBusy(true);
    patch(msgId, { answered: true });
    push({ id: nid(), role: "user", text: value === null ? "잘 모르겠어요" : formatAnswer(q, value) });
    if (value === null) delete acc.current[q.id];
    else acc.current[q.id] = toValues(value);
    await sleep(450);
    if (token !== runToken.current) return;
    if (!askFromQueue(ACKS[Object.keys(acc.current).length % ACKS.length])) await finish(token);
  }

  /** 질문이 떠 있는 상태에서 직접 입력한 경우: 선택지와 맞으면 그 답으로, 아니면 선택지를 다시 안내한다 */
  function freeAnswer(text: string) {
    const id = pendingId.current!;
    const msg = messages.find((m) => m.id === id);
    const q = msg?.role === "assistant" && msg.kind === "text" ? msg.question : undefined;
    if (!q) return;
    const hit = matchOption(q, text);
    if (hit) return void answer(id, q, hit);
    patch(id, { answered: true });
    push({ id: nid(), role: "user", text });
    const next = nid();
    pendingId.current = next;
    push({ id: next, role: "assistant", kind: "text", text: `아래 선택지 중에서 골라주세요. 해당하는 게 없으면 건너뛰어도 괜찮아요.\n\n${q.text}`, question: q });
  }

  /** 같은 세션에서 질문에 다시 답한다 (서버가 이전 답을 전부 덮어쓴다) */
  /** 같은 세션에서 이미 본 정책을 빼고 다음 묶음을 받는다 */
  async function more(userText = "다른 정책도 더 보여줘") {
    const s = session.current;
    if (!s) return reset();
    const token = runToken.current;
    setBusy(true);
    push({ id: nid(), role: "user", text: userText });
    const run = async (t: number) => {
      retry.current = () => void run(runToken.current);
      const r = await thinkWhile(STEPS_MORE, getRecommendations(s.id, shown.current), t);
      if (!r) return;
      retry.current = null;
      const hasQ = s.questions.length > 0;
      if (r.items.length === 0) {
        push({
          id: nid(), role: "assistant", kind: "text",
          text: "지금 조건으로 더 보여드릴 정책이 없어요. 답변을 바꾸거나 다른 분야를 물어봐 주세요.",
          followUps: afterChips(false, hasQ, 0),
        });
        setBusy(false);
        return;
      }
      shown.current = [...shown.current, ...r.items.map((x) => x.policy.plcy_no)];
      const page = (rec.current?.page ?? 1) + 1;
      const result: RecResult = { asOf: r.as_of, total: s.total, items: r.items, hasMore: r.has_more, page };
      rec.current = result;
      push({
        id: nid(), role: "assistant", kind: "text",
        text: `이어서 **${r.items.length}건** 더 골랐어요. 지금까지 **${shown.current.length}건**을 보여드렸어요.`,
        rec: result, meta: feedbackMeta(s.conditions), followUps: afterChips(r.has_more, hasQ, shown.current.length),
      });
      setBusy(false);
    };
    await run(token);
  }

  function reanswer() {
    const s = session.current;
    if (!s?.questions.length) return reset();
    push({ id: nid(), role: "user", text: "답변을 다시 고를게요" });
    acc.current = {};
    rec.current = null;
    shown.current = [];
    queue.current = [...s.questions];
    askFromQueue("좋아요, 처음부터 다시 여쭤볼게요.\n\n");
  }

  function followUp(text: string) {
    if (busy) return;
    if (text === CHIP_RESET) return reset();
    if (text === CHIP_REANSWER) return reanswer();
    if (text === CHIP_MORE) return void more();
    if (text === CHIP_RETRY && retry.current) {
      setBusy(true);
      return retry.current();
    }
  }

  function send(raw: string) {
    const text = raw.trim();
    if (!text || busy) return;
    setInput("");
    if (pendingId.current) freeAnswer(text);
    // 추천을 본 뒤 "더 보여줘" 같은 짧은 말 → 같은 세션에서 다음 묶음
    else if (rec.current?.hasMore && wantsMore(text)) {
      void more(text);
    }
    // 추천 뒤에(또는 처음에) 새 문장을 보내면 그 문장으로 새로 찾는다
    else void start(text);
  }

  function reset() {
    runToken.current++;
    session.current = null;
    queue.current = [];
    acc.current = {};
    pendingId.current = null;
    rec.current = null;
    shown.current = [];
    retry.current = null;
    carry.current = null;
    firstQuery.current = undefined;
    setMessages([]);
    setBusy(false);
    setInput("");
    syncUrl();
    window.scrollTo({ top: 0 });
  }

  /* ----- URL ?q= 로 들어오면 바로 시작, 아니면 이전 대화 복원 ----- */
  useEffect(() => {
    if (startedOnce.current) return;
    startedOnce.current = true;
    let snap: Snapshot | null = null;
    try {
      const raw = sessionStorage.getItem(STORE_KEY);
      if (raw) snap = JSON.parse(raw) as Snapshot;
    } catch {
      // 저장소 접근 불가(시크릿 모드 등) — 새 대화로 시작
    }
    // 다른 화면에서 돌아왔거나(상단 뒤로가기·브라우저 뒤로가기 모두), ?q= 없이 들어왔거나, 같은 질문이면 이전 대화를 복원
    const returning = readSession(RETURN_KEY) === "1";
    try {
      sessionStorage.removeItem(RETURN_KEY);
    } catch {}
    if (snap && (returning || !initialQuery || snap.query === initialQuery)) {
      session.current = snap.session;
      queue.current = snap.queue;
      acc.current = snap.acc;
      rec.current = snap.rec;
      shown.current = snap.shown ?? [];
      carry.current = snap.carry ?? null;
      firstQuery.current = snap.query;
      const last = snap.messages.at(-1);
      if (last?.role === "assistant" && last.kind === "text" && last.question && !last.answered) pendingId.current = last.id;
      // sessionStorage는 서버 렌더링 중엔 읽을 수 없어서 마운트 직후 한 번만 복원한다
      setMessages(
        snap.messages
          .filter((m) => !(m.role === "assistant" && m.kind === "thinking" && !m.done))
          // "다시 시도"는 복원 후엔 실행할 동작이 없으니 뺀다
          .map((m) => ({ ...m, restored: true, ...("followUps" in m && m.followUps ? { followUps: m.followUps.filter((f) => f !== CHIP_RETRY) } : {}) }) as Msg),
      );
      return;
    }
    if (initialQuery) start(initialQuery);
  }, [initialQuery, start]);

  /* ----- 새로고침하거나 다른 화면을 다녀와도 대화가 남아 있도록 ----- */
  useEffect(() => {
    if (busy) return;
    try {
      if (messages.length === 0) sessionStorage.removeItem(STORE_KEY);
      else {
        const snap: Snapshot = {
          query: firstQuery.current,
          messages,
          session: session.current,
          queue: queue.current,
          acc: acc.current,
          rec: rec.current,
          carry: carry.current,
          shown: shown.current,
        };
        sessionStorage.setItem(STORE_KEY, JSON.stringify(snap));
      }
    } catch {
      // 저장 실패는 무시
    }
  }, [messages, busy]);

  /* ----- 스크롤: 매 프레임 따라가지 않는다 (모바일에서 떨림의 원인) -----
   * 사용자가 메시지를 보내면 그 말풍선을 상단 바 바로 아래로 한 번만 부드럽게 올리고,
   * 답변은 그 아래 빈 공간으로 자라나게 한다. 마지막 묶음의 min-height(CSS)가 그 공간을 확보한다. */
  useEffect(() => {
    const lastUser = messages.findLast((m) => m.role === "user");
    if (!lastUser || lastUser.id === lastUserSeen.current) return;
    const first = lastUserSeen.current === null;
    lastUserSeen.current = lastUser.id;
    const el = document.querySelector<HTMLElement>(`[data-msg="${lastUser.id}"]`);
    if (!el) return;
    // 방금 답한 선택지는 이제 막 접히기 시작했다 → 다 접힌 뒤의 위치를 목표로 잡는다
    const anchor = docTop(el);
    let collapsing = 0;
    for (const r of document.querySelectorAll<HTMLElement>(".reveal[data-closed]")) {
      if (docTop(r) < anchor) collapsing += r.offsetHeight;
    }
    const restored = first && messages.some((m) => "restored" in m && m.restored);
    // 다른 화면에서 돌아온 경우엔 떠나기 전에 보던 위치로
    const saved = restored ? Number(readSession(SCROLL_KEY) ?? NaN) : NaN;
    if (!Number.isNaN(saved)) window.scrollTo({ top: saved, behavior: "instant" });
    else window.scrollTo({ top: Math.max(0, anchor - collapsing - TOP_GAP), behavior: restored ? "instant" : "smooth" });
  }, [messages]);

  /* ----- 모바일 키보드: 화면 아래 고정된 입력창을 키보드 바로 위로 올린다 -----
   * iOS 는 키보드가 열려도 fixed 요소의 기준(레이아웃 뷰포트)이 그대로라 입력창이 키보드에 가려진다.
   * 실제로 보이는 영역(visualViewport)과의 차이만큼 띄운다. */
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      composerRef.current?.style.setProperty("--kb", `${Math.round(kb)}px`);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  /* ----- 보던 스크롤 위치 기억: 링크를 누르는 순간에 저장한다 -----
   * (스크롤할 때마다 저장하면 페이지를 떠나며 맨 위로 올라가는 순간의 0이 덮어써 버린다) */
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>("a[href]") : null;
      // 새 탭으로 여는 공식 사이트 링크는 이 화면을 떠나지 않는다
      if (!a || a.target === "_blank") return;
      try {
        sessionStorage.setItem(SCROLL_KEY, String(Math.round(window.scrollY)));
        sessionStorage.setItem(RETURN_KEY, "1");
      } catch {
        // 저장 실패는 무시
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(input);
    }
  }

  const empty = messages.length === 0;
  const lastId = messages.at(-1)?.id;
  const waitingAnswer = messages.some((m) => m.role === "assistant" && m.kind === "text" && m.question && !m.answered);

  return (
    <div className="flex min-h-svh flex-col bg-background [overflow-anchor:none]">
      {/* ---------- 상단 바 ---------- */}
      <header className="sticky top-0 z-30 bg-background/95 sm:bg-background/85 sm:backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[720px] items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2 text-[17px] font-bold tracking-tight text-grey-900">
            <span className="flex size-6 items-center justify-center rounded-lg bg-brand">
              <span className="size-2.5 rounded-full bg-white" />
            </span>
            청핏
          </Link>
          {!empty && (
            <button
              type="button"
              onClick={reset}
              className="pressable flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[14px] font-medium text-grey-600 hover:bg-grey-100"
            >
              <RotateCcw className="size-3.5" />
              새로 찾기
            </button>
          )}
        </div>
      </header>

      {/* ---------- 대화 ---------- */}
      <main className="mx-auto w-full max-w-[720px] flex-1 px-5 pb-40 sm:pb-44">
        {empty ? (
          <EmptyState onPick={send} />
        ) : (
          <div className="space-y-7 pt-6">
            {groupTurns(messages).map((turn, g, turns) => (
              <div
                key={turn[0].msg.id}
                // 마지막 묶음은 최소 한 화면 높이 → 내 메시지를 위에 올려둔 채 답변이 아래로 자라도 화면이 움직이지 않는다
                className={cn("space-y-7", g === turns.length - 1 && "min-h-[calc(100svh-72px-10rem)] sm:min-h-[calc(100svh-72px-11rem)]")}
              >
                {turn.map(({ msg: m, i }) => (
                  <MessageView
                    key={m.id}
                    msg={m}
                    showName={m.role === "assistant" && messages[i - 1]?.role === "user"}
                    afterThinking={isThinking(messages[i - 1])}
                    isLast={m.id === lastId}
                    onAnswer={answer}
                    onFollowUp={followUp}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ---------- 입력창 ---------- */}
      <div
        ref={composerRef}
        style={{ bottom: "var(--kb, 0px)" }}
        className="pointer-events-none fixed inset-x-0 z-20 bg-gradient-to-t from-background from-60% to-transparent pt-8 sm:pt-10">
        <div className="pointer-events-auto mx-auto max-w-[720px] px-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-end gap-2 rounded-[26px] bg-grey-100 py-2 pr-2 pl-5 transition-shadow focus-within:bg-white focus-within:shadow-[0_0_0_2px_var(--brand),0_8px_24px_-8px_rgba(49,130,246,0.25)]"
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder={
                empty
                  ? "어떤 혜택이 궁금하세요?"
                  : waitingAnswer
                    ? "선택지를 고르거나 직접 입력해도 괜찮아요"
                    : "다른 분야도 물어보세요 (나이·지역은 그대로 써요)"
              }
              aria-label="메시지 입력"
              className="field-sizing-content max-h-40 min-h-[40px] flex-1 resize-none bg-transparent py-2 text-[16px] leading-6 text-grey-900 outline-none placeholder:text-grey-400"
            />
            <button
              type="submit"
              disabled={!input.trim() || busy}
              aria-label="보내기"
              className="pressable flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-white hover:bg-brand-strong disabled:bg-grey-300"
            >
              <ArrowUp className="size-5" strokeWidth={2.5} />
            </button>
          </form>
          <p className="mt-2 hidden text-center text-[11px] text-grey-400 sm:block">
            주민등록번호 같은 민감한 정보는 입력하지 마세요 · 최종 자격은 각 기관에서 확인해주세요 ·{" "}
            <Link href="/privacy" className="underline underline-offset-2">
              이용안내
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------- 빈 화면 ---------- */

function EmptyState({ onPick }: { onPick: (s: string) => void }) {
  return (
    <div className="pt-[14vh]">
      <h1 className="animate-fade-up text-[28px] font-bold leading-snug tracking-tight text-grey-900 sm:text-[32px]">
        어떤 혜택을
        <br />
        찾고 계세요?
      </h1>
      <p className="mt-3 animate-fade-up text-[16px] text-grey-600" style={{ animationDelay: "60ms" }}>
        편하게 한 문장으로 말해주세요. 몇 가지만 여쭤보고 지금 신청할 수 있는 청년 정책을 골라드릴게요.
      </p>
      <ul className="-mx-3 mt-10">
        <li className="px-3 pb-2 text-[13px] font-medium text-grey-500">이렇게 물어볼 수 있어요</li>
        {SUGGESTIONS.map((s, i) => (
          <li key={s} className="animate-fade-up" style={{ animationDelay: `${120 + i * 50}ms` } as CSSProperties}>
            <button
              type="button"
              onClick={() => onPick(s)}
              className="pressable w-full rounded-2xl px-3 py-3 text-left text-[16px] text-grey-800 hover:bg-grey-50"
            >
              {s}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- 메시지 ---------- */

function MessageView({
  msg,
  showName,
  afterThinking,
  isLast,
  onAnswer,
  onFollowUp,
}: {
  msg: Msg;
  showName: boolean;
  afterThinking: boolean;
  isLast: boolean;
  onAnswer: (id: string, q: Question, v: AnswerValue | null) => void;
  onFollowUp: (text: string) => void;
}) {
  const [streamed, setStreamed] = useState(!!msg.restored);

  if (msg.role === "user") {
    return (
      <div data-msg={msg.id} data-restored={msg.restored ? "" : undefined} className="flex animate-fade-up justify-end">
        <p className="max-w-[80%] whitespace-pre-wrap rounded-[22px] rounded-br-md bg-brand px-4 py-2.5 text-[16px] leading-relaxed text-white">
          {msg.text}
        </p>
      </div>
    );
  }

  return (
    // 검색 단계 바로 다음 답변은 같은 덩어리처럼 붙여서 보여준다
    <div data-restored={msg.restored ? "" : undefined} className={cn(afterThinking && "-mt-4")}>
      {showName && (
        <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-grey-600">
          <span className="flex size-5 items-center justify-center rounded-md bg-brand">
            <span className="size-2 rounded-full bg-white" />
          </span>
          청핏
        </p>
      )}

      {msg.kind === "thinking" && <Thinking steps={msg.steps} active={msg.active} done={msg.done} />}

      {msg.kind === "text" && (
        <>
          <StreamingText text={msg.text} animate={!msg.restored} onDone={() => setStreamed(true)} />

          {/* 답하면 바로 없애지 않고 접히면서 사라진다 */}
          {msg.question && streamed && !(msg.answered && msg.restored) && (
            <Reveal closed={msg.answered} instant={msg.restored}>
              <QuestionWidget
                widget={msg.question.widget}
                onAnswer={(v) => onAnswer(msg.id, msg.question!, v)}
                onSkip={msg.question.skippable ? () => onAnswer(msg.id, msg.question!, null) : undefined}
              />
            </Reveal>
          )}

          {msg.rec && streamed && (
            <Reveal instant={msg.restored}>
              <RecommendationView rec={msg.rec} meta={msg.meta} animate={!msg.restored} />
            </Reveal>
          )}

          {msg.followUps && streamed && (
            <Reveal closed={!isLast} instant={msg.restored}>
              <div className="flex flex-wrap gap-2 pt-6">
                {msg.followUps.map((f, i) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => onFollowUp(f)}
                    style={{ animationDelay: `${600 + i * 60}ms` }}
                    className={cn(
                      "pressable animate-fade-up rounded-full px-4 py-2 text-[14px] font-medium",
                      i === msg.followUps!.length - 1
                        ? "text-grey-500 hover:bg-grey-100"
                        : "bg-grey-100 text-grey-700 hover:bg-brand-soft hover:text-brand",
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </Reveal>
          )}
        </>
      )}
    </div>
  );
}

function Reveal({ closed, instant, children }: { closed?: boolean; instant?: boolean; children: React.ReactNode }) {
  return (
    <div className="reveal" data-closed={closed ? "" : undefined} data-instant={instant ? "" : undefined}>
      <div>{children}</div>
    </div>
  );
}

/** 사용자 메시지 하나와 그에 대한 답변들을 한 묶음으로 */
function groupTurns(messages: Msg[]) {
  const turns: { msg: Msg; i: number }[][] = [];
  messages.forEach((msg, i) => {
    if (msg.role === "user" || turns.length === 0) turns.push([]);
    turns[turns.length - 1].push({ msg, i });
  });
  return turns;
}

const SCROLL_KEY = `${STORE_KEY}:scroll`;
/** 대화 화면에서 링크로 나갔다는 표시 — 돌아오면 무조건 대화를 복원 */
const RETURN_KEY = `${STORE_KEY}:return`;

/** 주소창의 ?q= 를 지금 대화의 첫 질문과 맞춘다 (Next 라우팅 없이 history만 교체) */
function syncUrl(query?: string) {
  const url = query ? `/chat?q=${encodeURIComponent(query)}` : "/chat";
  if (window.location.pathname + window.location.search !== url) window.history.replaceState(window.history.state, "", url);
}

function readSession(key: string) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

/** 상단 바(56px) + 여유 16px — 내 메시지가 멈추는 위치 */
const TOP_GAP = 72;

/** transform(등장 애니메이션)에 영향받지 않는 문서 기준 y 좌표 */
function docTop(el: HTMLElement) {
  let y = 0;
  for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) y += n.offsetTop;
  return y;
}
