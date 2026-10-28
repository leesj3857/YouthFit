import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Check, X } from "lucide-react";
import { getPolicy, isExpired } from "@/lib/rag/data";
import type { PolicyRecord } from "@/lib/rag/types";
import { daysLeft, formatDate, formatManwon } from "@/lib/format";
import { InterestIcon } from "@/components/catalog-icons";
import { BottomCta, DetailTopBar, InfoRow, SectionGap } from "@/components/detail/detail-shell";
import { cn } from "@/lib/utils";

export async function generateMetadata(props: PageProps<"/policies/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const p = getPolicy(id);
  return { title: p ? `${p.name} — 청핏` : "정책을 찾을 수 없어요" };
}

const EMP: Record<string, string> = { unemployed: "미취업·구직 중", employed: "재직 중", student: "학생", self_employed: "창업·자영업" };
const regionLabel = (r: string | null) => (r === "전남광주" ? "광주·전남" : r);

function conditions(p: PolicyRecord) {
  const c = p.cond, ev = p.evidence, out: { label: string; evidence?: string }[] = [];
  if (c.min_age != null || c.max_age != null)
    out.push({ label: c.min_age != null && c.max_age != null ? `만 ${c.min_age}~${c.max_age}세` : c.max_age != null ? `만 ${c.max_age}세 이하` : `만 ${c.min_age}세 이상`, evidence: ev.age });
  if (p.region) {
    const sg = p.sigungus?.filter((s) => s !== "일부 시·군·구");
    out.push({ label: `${regionLabel(p.region)}${sg?.length ? ` ${sg.slice(0, 4).join("·")}${sg.length > 4 ? " 등" : ""}` : p.sigungus ? " 일부 시·군·구" : ""} 거주${c.residence_min_months ? ` (${c.residence_min_months}개월 이상)` : ""}`, evidence: ev.residence });
  }
  if (c.employment?.length) out.push({ label: c.employment.map((e) => EMP[e] ?? e).join(" 또는 "), evidence: ev.employment });
  if (c.education?.length) out.push({ label: `학력: ${c.education.join(", ")}`, evidence: ev.education });
  if (c.income_median_pct_max) out.push({ label: `기준 중위소득 ${c.income_median_pct_max}% 이하`, evidence: ev.income });
  if (c.income_annual_max_manwon) out.push({ label: `연소득 ${formatManwon(c.income_annual_max_manwon)} 이하${c.income_basis ? ` (${c.income_basis})` : ""}`, evidence: ev.income });
  if (c.income_other && !c.income_median_pct_max && !c.income_annual_max_manwon) out.push({ label: c.income_other, evidence: ev.income });
  if (c.asset_max_manwon) out.push({ label: `자산 ${formatManwon(c.asset_max_manwon)} 이하`, evidence: ev.asset });
  if (c.marital) out.push({ label: c.marital, evidence: ev.marital });
  if (c.homeless_required) out.push({ label: "무주택자", evidence: ev.homeless });
  if (c.household_head_required) out.push({ label: "세대주", evidence: ev.household_head });
  if (c.target_groups?.length) out.push({ label: `대상: ${c.target_groups.join(", ")}` });
  for (const x of p.extra) out.push({ label: x });
  return out;
}

function period(p: PolicyRecord) {
  if (p.alwaysOpen) return "상시 접수";
  if (p.applyStart || p.applyEnd) return `${formatDate(p.applyStart) ?? ""} – ${formatDate(p.applyEnd) ?? ""}`.trim();
  return "공고 확인";
}

export default async function PolicyPage(props: PageProps<"/policies/[id]">) {
  const { id } = await props.params;
  const p = getPolicy(id);
  if (!p) notFound();
  const conds = conditions(p);
  const d = daysLeft(p.applyEnd);
  const badge = isExpired(p)
    ? { t: "마감", c: "bg-grey-100 text-grey-500" }
    : p.alwaysOpen
      ? { t: "상시", c: "bg-grey-100 text-grey-600" }
      : d != null && d <= 14
        ? { t: `D-${Math.max(d, 0)}`, c: "bg-[#ffeef0] text-[#f04452]" }
        : { t: "접수 중", c: "bg-brand-soft text-brand" };
  const texts = [
    { title: "지원 내용", text: p.detail.support },
    { title: "신청 방법", text: p.detail.applyMethod },
    { title: "심사·선정", text: p.detail.screening },
    { title: "제출 서류", text: p.detail.documents },
  ].filter((x) => x.text && x.text !== "-");

  return (
    <div className="min-h-svh bg-background">
      <DetailTopBar title={p.name} />

      <main className="mx-auto max-w-[720px] px-5 pb-40">
        <section className="pt-4 pb-8">
          <div className="flex items-center gap-3">
            <InterestIcon interest={p.interest} className="size-10" />
            <span className="text-[15px] text-grey-600">{p.org}</span>
          </div>
          <h1 className="mt-5 text-[26px] font-bold leading-snug tracking-tight text-grey-900">{p.name}</h1>
          {p.summary && <p className="mt-2 text-[16px] leading-relaxed text-grey-600">{p.summary}</p>}

          {p.benefit && (
            <>
              <p className="mt-7 text-[14px] text-grey-500">받을 수 있는 혜택</p>
              <p className="mt-1 text-[21px] font-bold leading-snug tracking-tight text-brand">{p.benefit}</p>
            </>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2 text-[14px]">
            <span className={cn("rounded-lg px-2 py-1 font-semibold", badge.c)}>{badge.t}</span>
            {p.type && <span className="rounded-lg bg-grey-100 px-2 py-1 text-grey-600">{p.type}</span>}
            {p.firstCome && <span className="rounded-lg bg-[#fff4e5] px-2 py-1 text-[#fe9800]">선착순·예산 소진 시 마감</span>}
            <span className="tabular-nums text-grey-500">{period(p)}</span>
          </div>
        </section>

        <SectionGap />

        <section className="py-8">
          <h2 className="mb-3 text-[19px] font-bold text-grey-900">한눈에 보기</h2>
          <dl>
            <InfoRow label="지역">{p.region ? regionLabel(p.region) : "전국"}</InfoRow>
            <InfoRow label="신청 기간">{period(p)}</InfoRow>
            {p.channels.length > 0 && <InfoRow label="신청 방법">{p.channels.join(" · ")}</InfoRow>}
            {p.benefitAmount != null && <InfoRow label="최대 지원 금액">{formatManwon(p.benefitAmount)}</InfoRow>}
            {p.applicant && <InfoRow label="신청 주체">{p.applicant}</InfoRow>}
            <InfoRow label="운영 기관">{p.org}</InfoRow>
          </dl>
          {p.detail.description && <p className="mt-5 whitespace-pre-line text-[15px] leading-[1.75] text-grey-700">{p.detail.description}</p>}
        </section>

        <SectionGap />

        <section className="py-8">
          <h2 className="mb-4 text-[19px] font-bold text-grey-900">이런 분이 받을 수 있어요</h2>
          {conds.length ? (
            <ul className="space-y-3.5">
              {conds.map((c) => (
                <li key={c.label} className="flex gap-3">
                  <Check className="mt-1 size-4 shrink-0 text-brand" strokeWidth={3} />
                  <div>
                    <p className="text-[16px] leading-relaxed text-grey-800">{c.label}</p>
                    {c.evidence && <p className="mt-0.5 text-[13px] leading-snug text-grey-400">공고 원문: “{c.evidence}”</p>}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[15px] text-grey-600">공고에 별도 자격 조건이 적혀 있지 않아요. 기관에 확인해보세요.</p>
          )}

          {p.exclusions.length > 0 && (
            <>
              <h3 className="mt-8 mb-3 text-[16px] font-semibold text-grey-900">이런 분은 받을 수 없어요</h3>
              <ul className="space-y-2">
                {p.exclusions.map((x) => (
                  <li key={x} className="flex gap-3 text-[15px] leading-relaxed text-grey-700">
                    <X className="mt-1 size-4 shrink-0 text-[#f04452]" strokeWidth={3} />
                    {x}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {texts.map((t) => (
          <div key={t.title}>
            <SectionGap />
            <section className="py-8">
              <h2 className="mb-3 text-[19px] font-bold text-grey-900">{t.title}</h2>
              <p className="whitespace-pre-line text-[15px] leading-[1.75] text-grey-700">{t.text}</p>
            </section>
          </div>
        ))}

        <p className="text-[12px] leading-relaxed text-grey-400">
          온통청년 공고를 AI로 정리한 내용이에요. 조건 옆의 원문 문장을 함께 확인하고, 최종 자격은{" "}
          <a href={p.youthcenterUrl} target="_blank" rel="noreferrer" className="underline">
            온통청년 원문
          </a>
          과 운영 기관에서 확인해주세요.
        </p>
      </main>

      <BottomCta href={p.url} label="신청하러 가기" sub={`${p.org ?? "운영 기관"} 사이트로 이동해요`} />
    </div>
  );
}
