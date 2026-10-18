import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { PRODUCTS, getProduct } from "@/lib/catalog";
import { BankMark } from "@/components/catalog-icons";
import { BottomCta, DetailTopBar, InfoRow, SectionGap } from "@/components/detail/detail-shell";
import { MaturityCalculator } from "@/components/detail/maturity-calculator";

export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ id: p.id }));
}

export async function generateMetadata(props: PageProps<"/products/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const p = getProduct(id);
  return { title: p ? `${p.name} — 청핏` : "상품을 찾을 수 없어요" };
}

export default async function ProductPage(props: PageProps<"/products/[id]">) {
  const { id } = await props.params;
  const p = getProduct(id);
  if (!p) notFound();

  const perkTotal = p.perks.reduce((s, x) => s + x.rate, 0);

  return (
    <div className="min-h-svh bg-background">
      <DetailTopBar title={p.name} />

      <main className="mx-auto max-w-[720px] px-5 pb-40">
        {/* 히어로 */}
        <section className="pt-4 pb-8">
          <div className="flex items-center gap-3">
            <BankMark bank={p.bank} className="size-10" />
            <span className="text-[15px] text-grey-600">
              {p.bank} · {p.kind}
            </span>
          </div>
          <h1 className="mt-5 text-[26px] font-bold leading-snug tracking-tight text-grey-900">{p.name}</h1>
          <p className="mt-2 text-[16px] leading-relaxed text-grey-600">{p.headline}</p>

          <div className="mt-7 flex items-end gap-8">
            <div>
              <p className="text-[14px] text-grey-500">최고 금리</p>
              <p className="mt-1 text-[30px] font-bold tracking-tight text-brand tabular-nums">연 {p.maxRate.toFixed(1)}%</p>
            </div>
            <div className="pb-1">
              <p className="text-[14px] text-grey-500">기본 금리</p>
              <p className="mt-1 text-[20px] font-semibold text-grey-700 tabular-nums">연 {p.baseRate.toFixed(1)}%</p>
            </div>
          </div>
        </section>

        <SectionGap />

        <section className="py-8">
          <h2 className="mb-5 text-[19px] font-bold text-grey-900">얼마나 모을 수 있을까요?</h2>
          <MaturityCalculator productId={p.id} />
        </section>

        {p.perks.length > 0 && (
          <>
            <SectionGap />
            <section className="py-8">
              <h2 className="text-[19px] font-bold text-grey-900">우대금리 받는 법</h2>
              <p className="mt-1 mb-4 text-[14px] text-grey-500">모두 채우면 최대 +{perkTotal.toFixed(1)}%p</p>
              <ul>
                {p.perks.map((x) => (
                  <li key={x.label} className="flex items-center justify-between gap-4 py-3 text-[16px]">
                    <span className="flex items-center gap-3 text-grey-800">
                      <Check className="size-4 text-grey-300" strokeWidth={3} />
                      {x.label}
                    </span>
                    <span className="font-semibold text-brand tabular-nums">+{x.rate.toFixed(1)}%p</span>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}

        <SectionGap />

        <section className="py-8">
          <h2 className="mb-3 text-[19px] font-bold text-grey-900">상품 정보</h2>
          <dl>
            <InfoRow label="가입 기간">{p.termMonths}개월</InfoRow>
            <InfoRow label={p.kind === "예금" ? "가입 금액" : "월 납입 한도"}>
              {p.kind === "예금" ? "100만원부터" : `최대 ${p.monthlyMax}만원`}
            </InfoRow>
            <InfoRow label="가입 나이">
              {p.ageMax >= 99 ? `만 ${p.ageMin}세 이상` : `만 ${p.ageMin}~${p.ageMax}세`}
            </InfoRow>
          </dl>
          <p className="mt-5 text-[15px] leading-[1.75] text-grey-700">{p.description}</p>
          {p.extras.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-2">
              {p.extras.map((e) => (
                <li key={e} className="rounded-xl bg-brand-soft px-3 py-2 text-[14px] font-medium text-brand">
                  {e}
                </li>
              ))}
            </ul>
          )}
        </section>

        <SectionGap />

        <section className="py-8">
          <h2 className="mb-3 text-[19px] font-bold text-grey-900">꼭 확인하세요</h2>
          <ul className="space-y-2">
            {p.notes.map((n) => (
              <li key={n} className="text-[14px] leading-relaxed text-grey-600 before:mr-2 before:text-grey-400 before:content-['•']">
                {n}
              </li>
            ))}
          </ul>
        </section>

        <p className="text-[12px] leading-relaxed text-grey-400">
          금융감독원 금융상품한눈에 연동 전 샘플 데이터예요. 금리와 조건은 실제와 다를 수 있어요.
        </p>
      </main>

      <BottomCta href={p.url} label="가입하러 가기" sub={`${p.bank} 사이트로 이동해요`} />
    </div>
  );
}
