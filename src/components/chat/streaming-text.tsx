"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Char = { ch: string; bold: boolean };

/** "**굵게**"만 지원하는 아주 작은 마크다운 파서 */
function parse(text: string): Char[] {
  const out: Char[] = [];
  let bold = false;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "*" && text[i + 1] === "*") {
      bold = !bold;
      i++;
      continue;
    }
    out.push({ ch: text[i], bold });
  }
  return out;
}

function Runs({ chars }: { chars: Char[] }) {
  const runs: { text: string; bold: boolean }[] = [];
  for (const c of chars) {
    const last = runs.at(-1);
    if (last && last.bold === c.bold) last.text += c.ch;
    else runs.push({ text: c.ch, bold: c.bold });
  }
  return runs.map((r, i) =>
    r.bold ? (
      <strong key={i} className="font-semibold text-grey-900">
        {r.text}
      </strong>
    ) : (
      <span key={i}>{r.text}</span>
    ),
  );
}

/** 글자 하나가 투명 → 불투명으로 바뀌는 시간(ms). 이 시간 동안의 글자들이 "꼬리"처럼 번지며 나타난다 */
const FADE_MS = 420;
/** 아직 페이드 중인 글자만 span 으로 따로 그리고, 나머지는 평범한 텍스트로 합친다 */
const TRAIL = 56;

/**
 * 일정한 속도로 흘러나오는 텍스트.
 * - requestAnimationFrame 으로 프레임마다 조금씩 진행 → 끊김 없이 일정한 리듬
 * - 시작은 살짝 느리게, 남은 글자가 많으면 조금 빠르게 (긴 답변도 지루하지 않게)
 * - 새로 나온 글자마다 opacity 페이드 → 끝부분이 부드럽게 번지는 느낌
 */
export function StreamingText({
  text,
  animate = true,
  onDone,
  className,
}: {
  text: string;
  animate?: boolean;
  onDone?: () => void;
  className?: string;
}) {
  const chars = useMemo(() => parse(text), [text]);
  const [shown, setShown] = useState(() => (animate ? 0 : chars.length));
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  const done = shown >= chars.length;

  useEffect(() => {
    if (!animate) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let pos = 0;
    let last = performance.now();
    const t0 = last;

    const frame = (now: number) => {
      const dt = Math.min(64, now - last); // 탭 전환 등으로 프레임이 밀려도 한 번에 왈칵 쏟아지지 않게
      last = now;
      const remaining = chars.length - pos;
      // 기본 초당 42자, 남은 양에 따라 최대 110자까지. 첫 0.25초는 살짝 느리게 가속
      const base = Math.min(110, 42 + remaining * 0.35);
      const warm = Math.min(1, (now - t0) / 250);
      // 첫 글자는 바로 띄워서 이름표만 덩그러니 보이는 순간이 없게
      pos = reduced ? chars.length : Math.min(chars.length, Math.max(1, pos + (base * (0.6 + 0.4 * warm) * dt) / 1000));
      setShown(Math.floor(pos));
      if (pos < chars.length) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [animate, chars]);

  useEffect(() => {
    if (done) onDoneRef.current?.();
  }, [done]);

  const settled = done ? chars.length : Math.max(0, shown - TRAIL);

  return (
    <p className={cn("whitespace-pre-wrap break-keep text-[16px] leading-[1.75] text-grey-800", className)}>
      <Runs chars={chars.slice(0, settled)} />
      {!done &&
        chars.slice(settled, shown).map((c, i) => {
          const idx = settled + i;
          const style = { animationDuration: `${FADE_MS}ms` };
          return c.bold ? (
            <strong key={idx} className="animate-char-in font-semibold text-grey-900" style={style}>
              {c.ch}
            </strong>
          ) : (
            <span key={idx} className="animate-char-in" style={style}>
              {c.ch}
            </span>
          );
        })}
    </p>
  );
}
