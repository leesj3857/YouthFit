"use client";

import { useState, type CSSProperties } from "react";
import { estimateMaturity, formatManwon, getProduct } from "@/lib/catalog";

/** 월 납입액을 움직이면 만기 예상 금액이 바로 바뀌는 계산기 (세전·단리 기준) */
export function MaturityCalculator({ productId }: { productId: string }) {
  const p = getProduct(productId)!;
  const isDeposit = p.kind === "예금";
  const max = isDeposit ? 5000 : p.monthlyMax;
  const step = isDeposit ? 100 : 5;
  const [amount, setAmount] = useState(isDeposit ? 1000 : Math.min(30, max));
  const est = estimateMaturity(p, amount);
  const pct = ((amount - step) / (max - step)) * 100;

  return (
    <div>
      <p className="text-[15px] text-grey-600">
        {isDeposit ? "처음에" : "매달"}{" "}
        <b className="font-semibold text-grey-900 tabular-nums">{formatManwon(amount)}</b>씩{" "}
        {isDeposit ? "맡기면" : "넣으면"} {p.termMonths}개월 뒤
      </p>
      <p className="mt-1 text-[30px] font-bold tracking-tight text-grey-900 tabular-nums">
        {formatManwon(est.total)}
        <span className="ml-1 text-[16px] font-medium text-grey-500">받아요</span>
      </p>

      <input
        type="range"
        min={step}
        max={max}
        step={step}
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
        aria-label={isDeposit ? "예치 금액" : "월 납입 금액"}
        className="toss-range mt-6 w-full"
        style={{ "--fill": `${pct}%` } as CSSProperties}
      />

      <dl className="mt-6 space-y-2 text-[15px]">
        <Row label="원금" value={formatManwon(est.principal)} />
        <Row label={`이자 (연 ${p.maxRate}% 적용)`} value={`+${formatManwon(est.interest)}`} accent />
        {est.gov > 0 && <Row label="정부 기여금" value={`+${formatManwon(est.gov)}`} accent />}
      </dl>
      <p className="mt-3 text-[12px] text-grey-400">우대금리를 모두 채웠을 때의 세전 예상 금액이에요.</p>
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
