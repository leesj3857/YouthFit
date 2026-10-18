"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * RAG 검색 단계 표시. 진행 중엔 현재 단계 이름이 반짝이고 끝난 단계가 아래에 쌓인다.
 * 끝나면 목록이 부드럽게 접히고 "n단계로 찾아봤어요" 한 줄만 남는다 (누르면 다시 펼침).
 */
export function Thinking({ steps, active, done }: { steps: string[]; active: number; done: boolean }) {
  const [open, setOpen] = useState(false);
  const finished = steps.slice(0, Math.min(active, steps.length));

  return (
    <div className="text-[14px]">
      {done ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1 text-grey-500 hover:text-grey-700"
          aria-expanded={open}
        >
          {steps.length}단계로 찾아봤어요
          <ChevronDown className={cn("size-4 transition-transform duration-300", open && "rotate-180")} />
        </button>
      ) : (
        <p className="text-shimmer font-medium">{steps[active] ?? steps.at(-1)}…</p>
      )}

      <div className="reveal" data-closed={done && !open ? "" : undefined}>
        <div>
          {finished.length > 0 && (
            <ol className="mt-2 space-y-1.5 border-l-2 border-grey-100 pl-3.5">
              {finished.map((s) => (
                <li key={s} className="flex animate-fade-up items-center gap-2">
                  <span className="flex size-4 items-center justify-center rounded-full bg-brand-soft text-brand">
                    <Check className="size-2.5" strokeWidth={3.5} />
                  </span>
                  <span className="text-grey-600">{s}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
