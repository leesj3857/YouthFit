"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowUpRight, ThumbsDown, ThumbsUp } from "lucide-react";
import { SIDO_NAME, type PolicyCandidate, type Recommendation } from "@/lib/api";
import { daysLeft, formatDate } from "@/lib/format";
import { CategoryIcon } from "@/components/catalog-icons";
import { cn } from "@/lib/utils";

/** 최종 추천 결과 (백엔드 /recommendations 응답 + 좁혀진 후보 수) */
export type RecResult = { asOf: string; total: number; items: Recommendation[] };
/** 피드백 분석용 요약 (원문 대화는 보내지 않음) */
export type FeedbackMeta = { age?: number; sido?: string; employment?: string; domains?: string[] };

const stagger = (i: number): CSSProperties => ({ animationDelay: `${i * 70}ms` });

/* 카드의 링크·기간·자격 표시는 모두 policy(공고 DB 값)에서만 만든다. reason·check_points 는 문구로만 보여준다. */

function deadline(p: PolicyCandidate): { label: string; tone: string } {
  if (p.availability === "upcoming") {
    const start = formatDate(p.apply_start);
    return { label: start ? `${start.slice(5)} 접수 시작` : "접수 예정", tone: "text-brand" };
  }
  const d = daysLeft(p.apply_end);
  if (d != null && d >= 0) {
    if (d <= 14) return { label: `D-${d}`, tone: "text-[#f04452]" };
    return { label: `~${formatDate(p.apply_end)!.slice(5)}`, tone: "text-brand" };
  }
  if (p.availability === "open") return { label: "신청 중", tone: "text-[#03b26c]" };
  return { label: "기간 확인 필요", tone: "text-grey-500" };
}

function ageLabel(p: PolicyCandidate) {
  const { age_limited, min_age: min, max_age: max } = p.eligibility;
  if (!age_limited || (min == null && max == null)) return "나이 제한 없음";
  if (min != null && max != null) return `만 ${min}~${max}세`;
  return min != null ? `만 ${min}세 이상` : `만 ${max}세 이하`;
}

function regionLabel(p: PolicyCandidate): { text: string; warn: boolean } {
  const e = p.eligibility;
  if (e.region_scope === "national") return { text: "전국", warn: false };
  const names = e.sido_codes.map((c) => SIDO_NAME[c]).filter(Boolean);
  const sido = names.length === 0 ? "지역" : names.length <= 2 ? names.join("·") : `${names[0]} 외 ${names.length - 1}곳`;
  return e.region_scope === "sigungu" ? { text: `${sido} 일부 시군구만`, warn: true } : { text: `${sido} 거주`, warn: false };
}

const LINK_LABEL = { apply: "신청 페이지", reference: "안내 페이지", ontong_detail: "온통청년 상세" } as const;
/** DB에서 온 값이라도 http(s) 주소일 때만 링크로 쓴다 */
const safeUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : null);

/** animate=false: 복원된 대화 — 등장 애니메이션 없이 바로 */
export function RecommendationView({ rec, animate = true, meta }: { rec: RecResult; animate?: boolean; meta?: FeedbackMeta }) {
  return (
    <div className="mt-6">
      <section>
        <SectionHead title="추천 정책" count={rec.items.length} />
        <ul className="-mx-3 mt-1">
          {rec.items.map((item, i) => (
            <li key={item.policy.plcy_no} className={cn(animate && "animate-fade-up")} style={animate ? stagger(i + 1) : undefined}>
              <PolicyCard item={item} />
            </li>
          ))}
        </ul>
      </section>

      <FeedbackBar ids={rec.items.map((x) => x.policy.plcy_no)} meta={meta} />

      <p className="mt-4 text-[12px] leading-relaxed text-grey-400">
        온통청년 공고 데이터로 자격 조건을 대조했어요({formatDate(rec.asOf)} 기준) · 링크와 신청 기간은 공고에 등록된 값이에요 · 실제 자격은 기관
        심사에 따라 달라질 수 있어요 ·{" "}
        <Link href="/privacy" className="underline underline-offset-2">
          이용안내·개인정보
        </Link>
      </p>
    </div>
  );
}

function PolicyCard({ item }: { item: Recommendation }) {
  const p = item.policy;
  const dl = deadline(p);
  const region = regionLabel(p);
  const url = safeUrl(p.official_url);
  const chips: { text: string; warn?: boolean }[] = [
    { text: ageLabel(p) },
    region,
    ...(p.eligibility.employment.length
      ? [{ text: p.eligibility.employment.length <= 2 ? p.eligibility.employment.join("·") : `${p.eligibility.employment[0]} 외 ${p.eligibility.employment.length - 1}` }]
      : []),
  ];
  const body = (
    <>
      <CategoryIcon categories={p.categories} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[13px]">
          <span className={cn("shrink-0 font-semibold", dl.tone)}>{dl.label}</span>
          {p.org_name && (
            <>
              <span className="text-grey-300">·</span>
              <span className="truncate text-grey-500">{p.org_name}</span>
            </>
          )}
        </span>
        <span className="mt-0.5 block text-[16px] font-semibold leading-snug text-grey-900">{p.name}</span>
        <span className="mt-1.5 block text-[14px] leading-snug text-grey-700">{item.reason}</span>
        <span className="mt-2 flex flex-wrap gap-1">
          {chips.map((c) => (
            <span
              key={c.text}
              className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-medium", c.warn ? "bg-[#fff4e5] text-[#fe9800]" : "bg-grey-100 text-grey-600")}
            >
              {c.text}
            </span>
          ))}
        </span>
        {item.check_points.length > 0 && (
          <span className="mt-2.5 block rounded-xl bg-grey-50 px-3 py-2.5">
            <span className="block text-[12px] font-semibold text-grey-600">신청 전에 확인하세요</span>
            {item.check_points.map((c) => (
              <span key={c} className="mt-1 flex gap-1.5 text-[13px] leading-snug text-grey-700">
                <span aria-hidden className="mt-[3px] size-3 shrink-0 rounded-[4px] border-[1.5px] border-grey-300" />
                {c}
              </span>
            ))}
          </span>
        )}
        {url && (
          <span className="mt-2.5 flex items-center gap-0.5 text-[13px] font-semibold text-brand">
            {LINK_LABEL[p.url_source] ?? "공식 페이지"} 열기
            <ArrowUpRight className="size-3.5" strokeWidth={2.4} />
          </span>
        )}
      </span>
    </>
  );
  const cls = "flex items-start gap-3.5 rounded-2xl px-3 py-3.5";
  return url ? (
    <a href={url} target="_blank" rel="noopener noreferrer" className={cn(cls, "pressable hover:bg-grey-50")}>
      {body}
    </a>
  ) : (
    <div className={cls}>{body}</div>
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

const REASONS = ["자격이 안 맞아요", "원하던 분야가 아니에요", "정보가 부정확해요", "더 많은 결과를 원해요", "기타"];

/** 추천 결과 평가 — 👍/👎 (👎이면 이유 한 번 더) */
function FeedbackBar({ ids, meta }: { ids: string[]; meta?: FeedbackMeta }) {
  const [state, setState] = useState<"idle" | "why" | "done">("idle");
  const send = (rating: "up" | "down", reason?: string) => {
    setState("done");
    void fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, reason, ids, meta }),
    }).catch(() => {});
  };
  return (
    <div className="mt-6 rounded-2xl bg-grey-50 px-4 py-3.5">
      {state === "done" ? (
        <p className="text-[14px] text-grey-600">의견 고마워요. 더 정확한 추천을 만드는 데 쓸게요.</p>
      ) : state === "why" ? (
        <>
          <p className="text-[14px] font-medium text-grey-800">어떤 점이 아쉬웠나요?</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <button key={r} type="button" onClick={() => send("down", r)}
                className="pressable rounded-full bg-white px-3 py-1.5 text-[13px] text-grey-700 hover:bg-brand-soft hover:text-brand">
                {r}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-[14px] font-medium text-grey-800">추천이 도움이 됐나요?</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => send("up")} aria-label="도움이 됐어요"
              className="pressable flex size-9 items-center justify-center rounded-full bg-white text-grey-600 hover:text-brand">
              <ThumbsUp className="size-4" />
            </button>
            <button type="button" onClick={() => setState("why")} aria-label="아쉬워요"
              className="pressable flex size-9 items-center justify-center rounded-full bg-white text-grey-600 hover:text-[#f04452]">
              <ThumbsDown className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
