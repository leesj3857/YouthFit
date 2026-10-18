import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { POLICIES, getPolicy } from "@/lib/catalog";
import { InterestIcon } from "@/components/catalog-icons";
import { BottomCta, DetailTopBar, InfoRow, SectionGap } from "@/components/detail/detail-shell";
import { cn } from "@/lib/utils";

export function generateStaticParams() {
  return POLICIES.map((p) => ({ id: p.id }));
}

export async function generateMetadata(props: PageProps<"/policies/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const p = getPolicy(id);
  return { title: p ? `${p.name} — 청핏` : "정책을 찾을 수 없어요" };
}

const STATUS_TONE = {
  접수중: "bg-brand-soft text-brand",
  마감임박: "bg-[#ffeef0] text-[#f04452]",
  상시: "bg-grey-100 text-grey-600",
} as const;

export default async function PolicyPage(props: PageProps<"/policies/[id]">) {
  const { id } = await props.params;
  const p = getPolicy(id);
  if (!p) notFound();

  return (
    <div className="min-h-svh bg-background">
      <DetailTopBar title={p.name} />

      <main className="mx-auto max-w-[720px] px-5 pb-40">
        {/* 히어로 */}
        <section className="pt-4 pb-8">
          <div className="flex items-center gap-3">
            <InterestIcon interest={p.interest} className="size-10" />
            <span className="text-[15px] text-grey-600">{p.org}</span>
          </div>
          <h1 className="mt-5 text-[26px] font-bold leading-snug tracking-tight text-grey-900">{p.name}</h1>
          <p className="mt-2 text-[16px] leading-relaxed text-grey-600">{p.headline}</p>

          <p className="mt-7 text-[14px] text-grey-500">받을 수 있는 혜택</p>
          <p className="mt-1 text-[30px] font-bold tracking-tight text-brand">{p.benefit}</p>

          <div className="mt-5 flex flex-wrap items-center gap-2 text-[14px]">
            <span className={cn("rounded-lg px-2 py-1 font-semibold", STATUS_TONE[p.status])}>{p.status}</span>
            <span className="tabular-nums text-grey-500">{p.period}</span>
          </div>
        </section>

        <SectionGap />

        {/* 한눈에 */}
        <section className="py-8">
          <h2 className="mb-3 text-[19px] font-bold text-grey-900">한눈에 보기</h2>
          <dl>
            <InfoRow label="대상 나이">
              만 {p.ageMin}~{p.ageMax}세
            </InfoRow>
            <InfoRow label="지역">{p.region ?? "전국"}</InfoRow>
            <InfoRow label="신청 기간">{p.period}</InfoRow>
            <InfoRow label="운영 기관">{p.org}</InfoRow>
          </dl>
          <p className="mt-5 text-[15px] leading-[1.75] text-grey-700">{p.description}</p>
        </section>

        <SectionGap />

        {/* 대상 */}
        <section className="py-8">
          <h2 className="mb-4 text-[19px] font-bold text-grey-900">이런 분이 받을 수 있어요</h2>
          <ul className="space-y-3">
            {p.targets.map((t) => (
              <li key={t} className="flex gap-3 text-[16px] leading-relaxed text-grey-800">
                <Check className="mt-1 size-4 shrink-0 text-brand" strokeWidth={3} />
                {t}
              </li>
            ))}
          </ul>

          <h3 className="mt-8 mb-3 text-[16px] font-semibold text-grey-900">지원 내용</h3>
          <ul className="space-y-2">
            {p.benefits.map((b) => (
              <li key={b} className="text-[15px] leading-relaxed text-grey-700 before:mr-2 before:text-grey-400 before:content-['•']">
                {b}
              </li>
            ))}
          </ul>
        </section>

        <SectionGap />

        {/* 신청 방법 */}
        <section className="py-8">
          <h2 className="mb-5 text-[19px] font-bold text-grey-900">신청은 이렇게 해요</h2>
          <ol className="relative">
            {p.steps.map((s, i) => (
              <li key={s.title} className="relative flex gap-4 pb-6 last:pb-0">
                {i < p.steps.length - 1 && (
                  <span className="absolute top-8 bottom-0 left-[13px] w-0.5 bg-grey-100" aria-hidden />
                )}
                <span className="z-10 flex size-7 shrink-0 items-center justify-center rounded-full bg-brand text-[13px] font-bold text-white">
                  {i + 1}
                </span>
                <div className="pt-0.5">
                  <p className="text-[16px] font-semibold text-grey-900">{s.title}</p>
                  <p className="mt-1 text-[14px] leading-relaxed text-grey-600">{s.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <SectionGap />

        <section className="py-8">
          <h2 className="mb-3 text-[19px] font-bold text-grey-900">준비할 서류</h2>
          <ul className="flex flex-wrap gap-2">
            {p.documents.map((d) => (
              <li key={d} className="rounded-xl bg-grey-100 px-3 py-2 text-[14px] text-grey-700">
                {d}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-[14px] text-grey-500">문의 · {p.contact}</p>
        </section>

        <p className="text-[12px] leading-relaxed text-grey-400">
          온통청년 공고를 바탕으로 정리한 내용이에요. 중간점검용 샘플 데이터라 실제 공고와 다를 수 있어요.
        </p>
      </main>

      <BottomCta href={p.applyUrl} label="신청하러 가기" sub={`${p.org} 공식 사이트로 이동해요`} />
    </div>
  );
}
