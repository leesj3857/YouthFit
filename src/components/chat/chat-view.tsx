"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import Link from "next/link";
import { ArrowUp, RotateCcw } from "lucide-react";
import {
  RAG_STEPS_FINAL,
  STORE_KEY,
  RAG_STEPS_INTRO,
  followUpReply,
  formatAnswer,
  nextQuestion,
  parseQuery,
  recommend,
  summaryText,
  type AnswerKey,
  type Answers,
  type Question,
  type Recommendation,
} from "@/lib/chat-flow";
import { INTEREST_LABEL, type Interest } from "@/lib/catalog";
import { StreamingText } from "./streaming-text";
import { QuestionWidget, type AnswerValue } from "./question-widgets";
import { Thinking } from "./thinking";
import { RecommendationView } from "./recommendation";
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
      rec?: Recommendation;
      followUps?: string[];
    }
) & {
  /** 상세 페이지에서 돌아와 복원된 메시지는 다시 스트리밍하지 않는다 */
  restored?: boolean;
};

type Snapshot = { query?: string; messages: Msg[]; answers: Answers; hinted: Answers; asked: AnswerKey[]; rec: Recommendation | null };

const isThinking = (m?: Msg) => m?.role === "assistant" && m.kind === "thinking";

let seq = 0;
const nid = () => `m${Date.now().toString(36)}${seq++}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const SUGGESTIONS = [
  "서울 사는 취준생인데 받을 수 있는 지원금이랑 적금 알려줘",
  "자취 중인데 월세 지원 받을 수 있을까?",
  "사회초년생인데 목돈 모으기 좋은 적금 추천해줘",
  "자격증 공부하는데 교육비 지원되는 거 있어?",
];

const ACKS = ["알겠어요.", "좋아요.", "확인했어요.", "네, 반영할게요."];

const FOLLOW_UPS = ["1순위 정책 신청 방법 알려줘", "적금 금리 더 자세히 비교해줘", "조건 바꿔서 다시 찾기"];

function interestPhrase(a: Answers) {
  if (!a.interests?.length) return "받을 수 있는 혜택을";
  return `${a.interests.map((i: Interest) => INTEREST_LABEL[i]).join(", ")} 관련 혜택을`;
}

/* ---------- 컴포넌트 ---------- */

export function ChatView({ initialQuery }: { initialQuery?: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  // 비동기 흐름에서 최신 값을 읽기 위한 ref들
  const answers = useRef<Answers>({});
  const hinted = useRef<Answers>({});
  const asked = useRef(new Set<AnswerKey>());
  const pendingId = useRef<string | null>(null);
  const rec = useRef<Recommendation | null>(null);
  const runToken = useRef(0);
  const startedOnce = useRef(false);
  const firstQuery = useRef<string | undefined>(undefined);

  const lastUserSeen = useRef<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const push = (m: Msg) => setMessages((ms) => [...ms, m]);
  const patch = (id: string, p: Partial<Msg>) =>
    setMessages((ms) => ms.map((m) => (m.id === id ? ({ ...m, ...p } as Msg) : m)));

  /* ----- 대화 엔진 ----- */

  const think = useCallback(async (steps: string[], token: number) => {
    const id = nid();
    push({ id, role: "assistant", kind: "thinking", steps, active: 0, done: false });
    for (let i = 1; i <= steps.length; i++) {
      await sleep(650 + Math.random() * 450);
      if (token !== runToken.current) return false;
      patch(id, { active: i });
    }
    await sleep(250);
    if (token !== runToken.current) return false;
    patch(id, { done: true });
    // 단계 목록이 다 접힌 다음에 답변이 시작되도록 (접히는 중에 글자가 올라붙으면 화면이 출렁임)
    await sleep(420);
    return token === runToken.current;
  }, []);

  const finish = useCallback(
    async (token: number) => {
      if (!(await think(RAG_STEPS_FINAL, token))) return;
      const r = recommend(answers.current);
      rec.current = r;
      push({ id: nid(), role: "assistant", kind: "text", text: summaryText(answers.current, r), rec: r, followUps: FOLLOW_UPS });
      setBusy(false);
    },
    [think],
  );

  const askNext = useCallback(
    async (prefix: string, token: number) => {
      const q = nextQuestion(answers.current, asked.current, hinted.current);
      if (!q) return finish(token);
      const id = nid();
      pendingId.current = id;
      const text = !prefix ? q.text : prefix.endsWith("\n") ? prefix + q.text : `${prefix} ${q.text}`;
      push({ id, role: "assistant", kind: "text", text, question: q });
      setBusy(false);
    },
    [finish],
  );

  const start = useCallback(
    async (query: string) => {
      const token = ++runToken.current;
      setBusy(true);
      push({ id: nid(), role: "user", text: query });
      firstQuery.current = query;
      hinted.current = parseQuery(query);
      answers.current = { ...hinted.current };
      if (!(await think(RAG_STEPS_INTRO, token))) return;
      const known = [hinted.current.region && `${hinted.current.region}에 사시는`, hinted.current.age && `만 ${hinted.current.age}세`]
        .filter(Boolean)
        .join(" ");
      const intro = `${known ? `${known} 분께 맞는 ` : ""}${interestPhrase(hinted.current)} 찾아드릴게요. 정확하게 추천하려면 몇 가지만 더 여쭤볼게요.\n\n`;
      await askNext(intro, token);
    },
    [think, askNext],
  );

  function applyAnswer(q: Question, value: AnswerValue | null) {
    asked.current.add(q.key);
    if (value === null) return;
    const a = answers.current;
    switch (q.key) {
      case "status":
        a.status = value as Answers["status"];
        break;
      case "age":
        a.age = Number(value);
        break;
      case "region":
        a.region = value as Answers["region"];
        break;
      case "interests":
        a.interests = value as Interest[];
        break;
      case "independent":
        a.independent = Boolean(value);
        break;
      case "monthly":
        a.monthly = Number(value);
        break;
    }
  }

  async function answer(msgId: string, q: Question, value: AnswerValue | null) {
    if (pendingId.current !== msgId) return;
    pendingId.current = null;
    const token = runToken.current;
    setBusy(true);
    patch(msgId, { answered: true });
    push({ id: nid(), role: "user", text: value === null ? "잘 모르겠어요" : formatAnswer(q, value) });
    applyAnswer(q, value);
    await sleep(500);
    if (token !== runToken.current) return;
    await askNext(ACKS[asked.current.size % ACKS.length], token);
  }

  /** 질문이 떠 있는 상태에서 직접 입력한 경우: 문장에서 뽑을 수 있는 정보만 반영하고 다음으로 */
  async function freeAnswer(text: string) {
    const id = pendingId.current!;
    const q = messages.find((m): m is Extract<Msg, { kind: "text" }> => m.id === id && m.role === "assistant" && m.kind === "text")?.question;
    pendingId.current = null;
    const token = runToken.current;
    setBusy(true);
    patch(id, { answered: true });
    push({ id: nid(), role: "user", text });
    Object.assign(answers.current, parseQuery(text));
    const num = text.match(/\d+/);
    if (q?.widget.type === "slider" && num) applyAnswer(q, Number(num[0]));
    else if (q) asked.current.add(q.key);
    await sleep(500);
    if (token !== runToken.current) return;
    await askNext("말씀하신 내용 반영했어요.", token);
  }

  async function followUp(text: string) {
    if (text === "조건 바꿔서 다시 찾기") return reset();
    const token = runToken.current;
    setBusy(true);
    push({ id: nid(), role: "user", text });
    if (!(await think(["추천 결과 다시 살펴보기", "답변 정리"], token))) return;
    push({ id: nid(), role: "assistant", kind: "text", text: followUpReply(text, rec.current), followUps: FOLLOW_UPS });
    setBusy(false);
  }

  function send(raw: string) {
    const text = raw.trim();
    if (!text || busy) return;
    setInput("");
    if (messages.length === 0) start(text);
    else if (pendingId.current) freeAnswer(text);
    else followUp(text);
  }

  function reset() {
    runToken.current++;
    answers.current = {};
    hinted.current = {};
    asked.current = new Set();
    pendingId.current = null;
    rec.current = null;
    firstQuery.current = undefined;
    setMessages([]);
    setBusy(false);
    setInput("");
    window.scrollTo({ top: 0 });
    textareaRef.current?.focus();
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
    // ?q= 없이 들어왔거나, 같은 질문으로 시작한 대화에서 뒤로 가기로 돌아온 경우엔 복원
    if (snap && (!initialQuery || snap.query === initialQuery)) {
      answers.current = snap.answers;
      hinted.current = snap.hinted;
      asked.current = new Set(snap.asked);
      rec.current = snap.rec;
      firstQuery.current = snap.query;
      const last = snap.messages.at(-1);
      if (last?.role === "assistant" && last.kind === "text" && last.question && !last.answered) pendingId.current = last.id;
      // sessionStorage는 서버 렌더링 중엔 읽을 수 없어서 마운트 직후 한 번만 복원한다
      setMessages(snap.messages.map((m) => ({ ...m, restored: true })));
      return;
    }
    if (initialQuery) start(initialQuery);
  }, [initialQuery, start]);

  /* ----- 상세 페이지 갔다 돌아와도 대화가 남아 있도록 ----- */
  useEffect(() => {
    if (busy) return;
    try {
      if (messages.length === 0) sessionStorage.removeItem(STORE_KEY);
      else {
        const snap: Snapshot = {
          query: firstQuery.current,
          messages,
          answers: answers.current,
          hinted: hinted.current,
          asked: [...asked.current],
          rec: rec.current,
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
    window.scrollTo({ top: Math.max(0, anchor - collapsing - TOP_GAP), behavior: restored ? "instant" : "smooth" });
  }, [messages]);

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
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-background from-60% to-transparent pt-8 sm:pt-10">
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
                    ? "직접 입력해도 괜찮아요"
                    : "더 궁금한 점을 물어보세요"
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
            청핏은 공공데이터를 바탕으로 안내하지만, 최종 자격은 각 기관에서 확인해주세요.
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
        편하게 한 문장으로 말해주세요. 몇 가지만 여쭤보고 딱 맞는 정책과 예적금을 골라드릴게요.
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
      <div data-msg={msg.id} className="flex animate-fade-up justify-end">
        <p className="max-w-[80%] whitespace-pre-wrap rounded-[22px] rounded-br-md bg-brand px-4 py-2.5 text-[16px] leading-relaxed text-white">
          {msg.text}
        </p>
      </div>
    );
  }

  return (
    // 검색 단계 바로 다음 답변은 같은 덩어리처럼 붙여서 보여준다
    <div className={cn(afterThinking && "-mt-4")}>
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
              <RecommendationView rec={msg.rec} />
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

/** 상단 바(56px) + 여유 16px — 내 메시지가 멈추는 위치 */
const TOP_GAP = 72;

/** transform(등장 애니메이션)에 영향받지 않는 문서 기준 y 좌표 */
function docTop(el: HTMLElement) {
  let y = 0;
  for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) y += n.offsetTop;
  return y;
}
