"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { daysLeft, estimateMaturity, formatDate, formatManwon } from "@/lib/format";
import type { ChatReply, RecPolicy } from "@/lib/rag/types";
import { BankMark, InterestIcon } from "@/components/catalog-icons";
import { cn } from "@/lib/utils";

export type ResultReply = Extract<ChatReply, { type: "result" }>;

const stagger = (i: number): CSSProperties => ({ animationDelay: `${i * 70}ms` });

function useCountUp(target: number, animate: boolean, ms = 900) {
  const [v, setV] = useState(animate ? 0 : target);
  useEffect(() => {
    if (!animate) return;
    let raf = 0;
    const t0 = performance.now();
    const loop = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [target, animate, ms]);
  return v;
}

function deadline(p: RecPolicy): { label: string; tone: string } {
  if (p.alwaysOpen) return { label: "상시", tone: "text-grey-500" };
  const d = daysLeft(p.applyEnd);
  if (d == null) return { label: p.firstCome ? "선착순" : "기간 확인", tone: "text-grey-500" };
  if (d <= 14) return { label: `D-${Math.max(0, d)}`, tone: "text-[#f04452]" };
  return { label: `~${formatDate(p.applyEnd)!.slice(5)}`, tone: "text-brand" };
}

/** animate=false: 상세 페이지에서 돌아와 복원된 경우 — 숫자 카운트업·등장 애니메이션 없이 바로 */
export function RecommendationView({ rec, animate = true }: { rec: ResultReply; animate?: boolean }) {
  // 대출은 갚아야 하는 돈이라 '받을 수 있는 지원금' 합계에서 뺀다
  const total = rec.policies.filter((p) => p.type !== "대출·이자지원").reduce((s, p) => s + (p.benefitAmount ?? 0), 0);
  const shown = useCountUp(total, animate);
  const monthly = rec.monthly ?? 30;

  return (
    <div className="mt-6">
      {total > 0 && (
        <div className="animate-fade-up">
          <p className="text-[15px] text-grey-600">추천 정책 지원금을 모두 받으면</p>
          <p className="mt-1 text-[32px] font-bold leading-tight tracking-tight text-grey-900">
            최대 <span className="tabular-nums text-brand">{formatManwon(shown)}</span>
          </p>
          <p className="mt-1 text-[12px] text-grey-400">대출을 빼고 공고에 금액이 적힌 정책만 더한 값이에요 · 정책 후보 {rec.candidateCount}건 중에서 골랐어요</p>
        </div>
      )}

      {rec.policies.length > 0 && (
        <section className="mt-8">
          <SectionHead title="청년 정책" count={rec.policies.length} />
          <ul className="-mx-3 mt-1">
            {rec.policies.map((p, i) => {
              const dl = deadline(p);
              return (
                <li key={p.id} className="animate-fade-up" style={stagger(i + 1)}>
                  <Link href={`/policies/${p.id}`} className="pressable group flex items-start gap-3.5 rounded-2xl px-3 py-3.5 hover:bg-grey-50">
                    <InterestIcon interest={p.interest} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-[13px]">
                        <span className={cn("font-semibold", dl.tone)}>{dl.label}</span>
                        <span className="text-grey-300">·</span>
                        <span className={cn("font-medium", p.status === "pass" ? "text-[#03b26c]" : "text-[#fe9800]")}>
                          {p.status === "pass" ? "자격 충족" : "확인 필요"}
                        </span>
                        <span className="text-grey-300">·</span>
                        <span className="truncate text-grey-500">{p.org}</span>
                      </span>
                      <span className="mt-0.5 block text-[16px] font-semibold leading-snug text-grey-900">{p.name}</span>
                      {p.benefit && <span className="mt-1 line-clamp-2 block text-[14px] leading-snug text-grey-700">{p.benefit}</span>}
                      <span className="mt-1.5 block text-[13px] leading-snug text-brand">{p.reason}</span>
                      {p.caution && <span className="mt-1 block text-[12px] leading-snug text-grey-500">⚠ {p.caution}</span>}
                      {p.checks.length > 0 && (
                        <span className="mt-2 flex flex-wrap gap-1">
                          {p.checks.map((c) => (
                            <span
                              key={c.key + c.text}
                              className={cn(
                                "rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                                c.status === "pass" ? "bg-[#e5f8f1] text-[#03b26c]" : "bg-[#fff4e5] text-[#fe9800]",
                              )}
                            >
                              {c.status === "pass" ? "✓" : "?"} {c.text}
                            </span>
                          ))}
                        </span>
                      )}
                    </span>
                    <ChevronRight className="mt-6 size-5 shrink-0 text-grey-300 transition-colors group-hover:text-grey-500" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {rec.savings.length > 0 && (
        <section className="mt-6">
          <SectionHead title="예적금" count={rec.savings.length} />
          <ul className="-mx-3 mt-1">
            {rec.savings.map((p, i) => {
              const exp = monthly > 0 ? estimateMaturity(monthly, p.term, p.maxRate).total : null;
              return (
                <li key={p.id} className="animate-fade-up" style={stagger(rec.policies.length + i + 1)}>
                  <Link href={`/products/${p.id}`} className="pressable group flex items-center gap-3.5 rounded-2xl px-3 py-3.5 hover:bg-grey-50">
                    <BankMark bank={p.company} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-grey-500">
                        {p.company} · {p.reserveType ?? "적금"} {p.term}개월{p.youth && " · 청년"}
                      </span>
                      <span className="mt-0.5 block truncate text-[16px] font-semibold text-grey-900">{p.name}</span>
                      <span className="mt-0.5 block text-[13px] leading-snug text-grey-600">
                        {p.reason}
                        {exp && <span className="text-grey-400"> · 월 {monthly}만원이면 만기 약 {formatManwon(exp)}</span>}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-[17px] font-bold tabular-nums text-brand">{p.maxRate.toFixed(2)}%</span>
                      <span className="block text-[12px] tabular-nums text-grey-400">기본 {p.baseRate.toFixed(2)}%</span>
                    </span>
                    <ChevronRight className="size-5 shrink-0 text-grey-300 transition-colors group-hover:text-grey-500" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <p className="mt-4 text-[12px] leading-relaxed text-grey-400">
        온통청년·금융감독원 공시 데이터를 AI로 정리해 자격 조건을 대조했어요 · 실제 자격은 기관 심사에 따라 달라질 수 있어요
      </p>
    </div>
  );
}

function SectionHead({ title, count }: { title: string; count: number }) {
  return (
    <h3 className="flex items-baseline gap-1.5 text-[17px] font-bold text-grey-900">
      {title}
      <span className="text-brand">{count}</span>
    </h3>
  );
}
