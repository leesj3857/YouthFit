"use client";

import { useState, type CSSProperties } from "react";
import { estimateMaturity, formatManwon } from "@/lib/format";
import type { SavingOption } from "@/lib/rag/types";
import { cn } from "@/lib/utils";

/** 기간을 고르고 월 납입액을 움직이면 만기 예상 금액이 바로 바뀌는 계산기 (세전·단리 기준) */
export function MaturityCalculator({ options, maxMonthly }: { options: SavingOption[]; maxMonthly: number }) {
  const terms = [...new Set(options.map((o) => o.term))].sort((a, b) => a - b);
  const [term, setTerm] = useState(terms.includes(12) ? 12 : terms[0]);
  const rate = Math.max(...options.filter((o) => o.term === term).map((o) => o.max));
  const step = 5, max = Math.max(maxMonthly, step * 2);
  const [amount, setAmount] = useState(Math.min(30, max));
  const est = estimateMaturity(amount, term, rate);
  const pct = ((amount - step) / (max - step)) * 100;

  return (
    <div>
      {terms.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {terms.map((t) => (
            <button key={t} type="button" onClick={() => setTerm(t)}
              className={cn("pressable rounded-full px-3.5 py-1.5 text-[14px] font-medium", t === term ? "bg-brand text-white" : "bg-grey-100 text-grey-700")}>
              {t}개월
            </button>
          ))}
        </div>
      )}
      <p className="text-[15px] text-grey-600">
        매달 <b className="font-semibold text-grey-900 tabular-nums">{formatManwon(amount)}</b>씩 넣으면 {term}개월 뒤
      </p>
      <p className="mt-1 text-[30px] font-bold tracking-tight text-grey-900 tabular-nums">
        {formatManwon(est.total)}
        <span className="ml-1 text-[16px] font-medium text-grey-500">받아요</span>
      </p>
      <input type="range" min={step} max={max} step={step} value={amount} onChange={(e) => setAmount(Number(e.target.value))}
        aria-label="월 납입 금액" className="toss-range mt-6 w-full" style={{ "--fill": `${pct}%` } as CSSProperties} />
      <dl className="mt-6 space-y-2 text-[15px]">
        <Row label="원금" value={formatManwon(est.principal)} />
        <Row label={`이자 (연 ${rate}% 적용)`} value={`+${formatManwon(est.interest)}`} accent />
      </dl>
      <p className="mt-3 text-[12px] text-grey-400">우대금리를 모두 채웠을 때의 세전·단리 예상 금액이에요.</p>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-grey-500">{label}</dt>
      <dd className={accent ? "font-semibold text-brand tabular-nums" : "font-medium text-grey-800 tabular-nums"}>{value}</dd>
    </div>
  );
}
