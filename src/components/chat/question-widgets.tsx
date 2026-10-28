"use client";

import { useState, type CSSProperties } from "react";
import { Check, ChevronRight } from "lucide-react";
import type { Widget } from "@/lib/chat-flow";
import { cn } from "@/lib/utils";

export type AnswerValue = string | string[] | number | boolean;

/** 선택지가 하나씩 차례로 떠오르도록 */
const stagger = (i: number): CSSProperties => ({ animationDelay: `${60 + i * 45}ms` });

export function QuestionWidget({
  widget,
  onAnswer,
  onSkip,
}: {
  widget: Widget;
  onAnswer: (v: AnswerValue) => void;
  onSkip?: () => void;
}) {
  return (
    <div className="mt-4">
      {widget.type === "single" && widget.layout === "chips" && <ChipSelect widget={widget} onAnswer={onAnswer} />}
      {widget.type === "single" && widget.layout === "list" && <ListSelect widget={widget} onAnswer={onAnswer} />}
      {widget.type === "multi" && <MultiSelect widget={widget} onAnswer={onAnswer} />}
      {widget.type === "slider" && <SliderInput widget={widget} onAnswer={onAnswer} />}
      {widget.type === "confirm" && <Confirm widget={widget} onAnswer={onAnswer} />}
      {onSkip && (
        <button
          type="button"
          onClick={onSkip}
          className="mt-3 animate-fade-up text-[13px] text-grey-500 underline-offset-4 hover:text-grey-700 hover:underline"
          style={stagger(6)}
        >
          잘 모르겠어요, 건너뛸게요
        </button>
      )}
    </div>
  );
}

/* ---------- 단일 선택: 칩 ---------- */

function ChipSelect({
  widget,
  onAnswer,
}: {
  widget: Extract<Widget, { type: "single" }>;
  onAnswer: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {widget.options.map((o, i) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onAnswer(o.value)}
          style={stagger(i)}
          className="pressable animate-fade-up rounded-full bg-grey-100 px-4 py-2.5 text-[15px] font-medium text-grey-700 hover:bg-brand-soft hover:text-brand"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- 단일 선택: 설명이 있는 리스트 ---------- */

function ListSelect({
  widget,
  onAnswer,
}: {
  widget: Extract<Widget, { type: "single" }>;
  onAnswer: (v: string) => void;
}) {
  return (
    <ul className="-mx-3">
      {widget.options.map((o, i) => (
        <li key={o.value} className="animate-fade-up" style={stagger(i)}>
          <button
            type="button"
            onClick={() => onAnswer(o.value)}
            className="pressable group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-grey-50"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-medium text-grey-900">{o.label}</span>
              {o.desc && <span className="mt-0.5 block text-[13px] text-grey-500">{o.desc}</span>}
            </span>
            <ChevronRight className="size-5 text-grey-300 transition-colors group-hover:text-brand" />
          </button>
        </li>
      ))}
    </ul>
  );
}

/* ---------- 복수 선택 ---------- */

function MultiSelect({
  widget,
  onAnswer,
}: {
  widget: Extract<Widget, { type: "multi" }>;
  onAnswer: (v: string[]) => void;
}) {
  const [picked, setPicked] = useState<string[]>(widget.defaults ?? []);
  const toggle = (v: string) => setPicked((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));

  return (
    <div>
      <ul className="-mx-3">
        {widget.options.map((o, i) => {
          const on = picked.includes(o.value);
          return (
            <li key={o.value} className="animate-fade-up" style={stagger(i)}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggle(o.value)}
                className="pressable flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-grey-50"
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full transition-colors",
                    on ? "bg-brand text-white" : "bg-grey-200 text-white",
                  )}
                >
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
                <span className={cn("text-[16px] transition-colors", on ? "font-semibold text-grey-900" : "text-grey-700")}>
                  {o.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 animate-fade-up" style={stagger(widget.options.length)}>
        <PrimaryButton disabled={picked.length === 0} onClick={() => onAnswer(picked)}>
          {picked.length ? `${picked.length}개 선택 완료` : "하나 이상 골라주세요"}
        </PrimaryButton>
      </div>
    </div>
  );
}

/* ---------- 슬라이더 (나이·금액) ---------- */

function SliderInput({
  widget,
  onAnswer,
}: {
  widget: Extract<Widget, { type: "slider" }>;
  onAnswer: (v: number) => void;
}) {
  const [value, setValue] = useState(widget.defaultValue);
  const pct = ((value - widget.min) / (widget.max - widget.min)) * 100;
  const display =
    widget.unit === "age" ? (
      <>
        만 <b className="font-bold tabular-nums">{value}</b>세
      </>
    ) : (
      <>
        월 <b className="font-bold tabular-nums">{value}</b>만원
      </>
    );
  const minLabel = widget.unit === "age" ? `${widget.min}세` : "0원";
  const maxLabel = widget.unit === "age" ? `${widget.max}세` : `${widget.max}만원`;
  const outOfRange = widget.unit === "age" && (value < 19 || value > 34);

  return (
    <div className="animate-fade-up" style={stagger(0)}>
      <p className="text-[28px] leading-tight tracking-tight text-grey-900">{display}</p>
      <p className={cn("mt-1 h-5 text-[13px]", outOfRange ? "text-[#f04452]" : "text-grey-500")}>
        {outOfRange ? "청년 정책 대부분은 만 19~34세 대상이에요. 그래도 찾아볼게요." : widget.unit === "manwon" ? "대략적인 금액이면 충분해요" : ""}
      </p>

      <input
        type="range"
        min={widget.min}
        max={widget.max}
        step={widget.step}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        aria-label={widget.unit === "age" ? "나이" : "월 저축 금액"}
        className="toss-range mt-4 w-full"
        style={{ "--fill": `${pct}%` } as CSSProperties}
      />
      <div className="mt-1.5 flex justify-between text-[12px] text-grey-400">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>

      {widget.presets && (
        <div className="mt-4 flex flex-wrap gap-2">
          {widget.presets.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setValue(p)}
              className={cn(
                "pressable rounded-full px-3.5 py-1.5 text-[14px] font-medium",
                value === p ? "bg-brand-soft text-brand" : "bg-grey-100 text-grey-600 hover:bg-grey-200",
              )}
            >
              {widget.unit === "age" ? `${p}세` : `${p}만원`}
            </button>
          ))}
        </div>
      )}

      <div className="mt-5">
        <PrimaryButton onClick={() => onAnswer(value)}>이대로 할게요</PrimaryButton>
      </div>
    </div>
  );
}

/* ---------- 예 / 아니오 ---------- */

function Confirm({
  widget,
  onAnswer,
}: {
  widget: Extract<Widget, { type: "confirm" }>;
  onAnswer: (v: boolean) => void;
}) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onAnswer(false)}
        style={stagger(0)}
        className="pressable flex-1 animate-fade-up rounded-2xl bg-grey-100 py-3.5 text-[16px] font-semibold text-grey-700 hover:bg-grey-200"
      >
        {widget.no}
      </button>
      <button
        type="button"
        onClick={() => onAnswer(true)}
        style={stagger(1)}
        className="pressable flex-1 animate-fade-up rounded-2xl bg-brand py-3.5 text-[16px] font-semibold text-white hover:bg-brand-strong"
      >
        {widget.yes}
      </button>
    </div>
  );
}

export function PrimaryButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="pressable w-full rounded-2xl bg-brand py-3.5 text-[16px] font-semibold text-white hover:bg-brand-strong disabled:bg-grey-100 disabled:text-grey-400 sm:w-auto sm:px-8"
    >
      {children}
    </button>
  );
}
