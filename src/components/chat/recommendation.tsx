"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatManwon } from "@/lib/catalog";
import type { Recommendation } from "@/lib/chat-flow";
import { BankMark, InterestIcon } from "@/components/catalog-icons";
import { cn } from "@/lib/utils";

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

const STATUS_TONE = {
  접수중: "text-brand",
  마감임박: "text-[#f04452]",
  상시: "text-grey-500",
} as const;

/** animate=false: 상세 페이지에서 돌아와 복원된 경우 — 숫자 카운트업·등장 애니메이션 없이 바로 */
export function RecommendationView({ rec, animate = true }: { rec: Recommendation; animate?: boolean }) {
  const total = useCountUp(rec.yearlyTotal, animate);

  return (
    <div className="mt-6">
      {/* 요약 숫자 */}
      <div className="animate-fade-up">
        <p className="text-[15px] text-grey-600">추천 정책으로 받을 수 있는 혜택</p>
        <p className="mt-1 text-[32px] font-bold leading-tight tracking-tight text-grey-900">
          연 최대 <span className="tabular-nums text-brand">{formatManwon(total)}</span>
        </p>
      </div>

      {/* 정책 */}
      <section className="mt-8">
        <SectionHead title="청년 정책" count={rec.policies.length} />
        <ul className="-mx-3 mt-1">
          {rec.policies.map(({ policy: p, reasons }, i) => (
            <li key={p.id} className="animate-fade-up" style={stagger(i + 1)}>
              <Link
                href={`/policies/${p.id}`}
                className="pressable group flex items-center gap-3.5 rounded-2xl px-3 py-3.5 hover:bg-grey-50"
              >
                <InterestIcon interest={p.interest} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-[13px]">
                    <span className={cn("font-semibold", STATUS_TONE[p.status])}>{p.status}</span>
                    <span className="text-grey-300">·</span>
                    <span className="truncate text-grey-500">{p.org}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-[16px] font-semibold text-grey-900">{p.name}</span>
                  <span className="mt-0.5 block text-[14px] font-semibold text-brand sm:hidden">{p.benefit}</span>
                  <span className="mt-0.5 block truncate text-[13px] text-grey-500">{reasons.join(" · ")} 조건 충족</span>
                </span>
                <span className="hidden shrink-0 text-right text-[15px] font-semibold text-grey-800 sm:block">
                  {p.benefit}
                </span>
                <ChevronRight className="size-5 shrink-0 text-grey-300 transition-colors group-hover:text-grey-500" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* 예적금 */}
      {rec.products.length > 0 && (
        <section className="mt-6">
          <SectionHead title="예적금" count={rec.products.length} />
          <ul className="-mx-3 mt-1">
            {rec.products.map(({ product: p, reason, expected }, i) => (
              <li key={p.id} className="animate-fade-up" style={stagger(rec.policies.length + i + 1)}>
                <Link
                  href={`/products/${p.id}`}
                  className="pressable group flex items-center gap-3.5 rounded-2xl px-3 py-3.5 hover:bg-grey-50"
                >
                  <BankMark bank={p.bank} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-grey-500">
                      {p.bank} · {p.kind} {p.termMonths}개월
                    </span>
                    <span className="mt-0.5 block truncate text-[16px] font-semibold text-grey-900">{p.name}</span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-grey-500 sm:truncate">
                      {reason}
                      {expected && ` · 만기 약 ${formatManwon(expected)}`}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[17px] font-bold tabular-nums text-brand">{p.maxRate.toFixed(1)}%</span>
                    <span className="block text-[12px] tabular-nums text-grey-400">기본 {p.baseRate.toFixed(1)}%</span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-grey-300 transition-colors group-hover:text-grey-500" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-4 text-[12px] leading-relaxed text-grey-400">
        온통청년·금융감독원 데이터 기반 · 실제 자격은 기관 심사에 따라 달라질 수 있어요
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
