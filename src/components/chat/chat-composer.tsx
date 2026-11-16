"use client";

import { useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp } from "lucide-react";
import { STORE_KEY } from "@/lib/chat-flow";

const SUGGESTIONS = [
  "서울 사는 26살 취준생인데 지원금 알려줘",
  "자취 중인데 월세 지원 받을 수 있을까?",
  "부산 사는 직장인 목돈 마련 지원",
  "광주 사는 대학생 교육비 지원",
];

/** 홈 히어로 입력창 — 보내면 /chat 으로 넘어가 대화가 시작된다 */
export function ChatComposer() {
  const router = useRouter();
  const [input, setInput] = useState("");

  function go(text: string) {
    const q = text.trim();
    if (!q) return;
    // 홈에서 새로 물어보면 이전 대화를 이어붙이지 않고 새로 시작
    try {
      sessionStorage.removeItem(STORE_KEY);
    } catch {}
    router.push(`/chat?q=${encodeURIComponent(q)}`);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      go(input);
    }
  }

  return (
    <div className="w-full">
      <p className="text-[15px] font-semibold text-brand">온통청년 청년정책 데이터 기반</p>
      <h1 className="mt-3 text-[32px] font-bold leading-[1.3] tracking-tight text-grey-900 sm:text-[40px]">
        나에게 맞는 청년 혜택,
        <br />
        물어보면 찾아드려요
      </h1>
      <p className="mt-4 break-keep text-[17px] leading-relaxed text-grey-600">
        한 문장으로 말하면 몇 가지만 여쭤보고,
        <br />
        지금 신청할 수 있는 청년 정책을 골라드려요.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(input);
        }}
        className="mt-10 flex items-end gap-2 rounded-[26px] bg-grey-100 py-2 pr-2 pl-5 transition-shadow focus-within:bg-white focus-within:shadow-[0_0_0_2px_var(--brand),0_8px_24px_-8px_rgba(49,130,246,0.25)]"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder="예) 서울 사는 취준생인데 지원금 알려줘"
          aria-label="질문 입력"
          className="field-sizing-content max-h-40 min-h-[40px] flex-1 resize-none bg-transparent py-2 text-[16px] leading-6 text-grey-900 outline-none placeholder:text-grey-400"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          aria-label="보내기"
          className="pressable flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-white hover:bg-brand-strong disabled:bg-grey-300"
        >
          <ArrowUp className="size-5" strokeWidth={2.5} />
        </button>
      </form>

      <ul className="mt-4 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => go(s)}
              className="pressable rounded-full bg-grey-100 px-3.5 py-2 text-[14px] text-grey-700 hover:bg-brand-soft hover:text-brand"
            >
              {s}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
