import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSaving } from "@/lib/rag/data";
import { formatManwon } from "@/lib/format";
import { BankMark } from "@/components/catalog-icons";
import { BottomCta, DetailTopBar, InfoRow, SectionGap } from "@/components/detail/detail-shell";
import { MaturityCalculator } from "@/components/detail/maturity-calculator";

export async function generateMetadata(props: PageProps<"/products/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const p = getSaving(id);
  return { title: p ? `${p.name} — 청핏` : "상품을 찾을 수 없어요" };
}

export default async function ProductPage(props: PageProps<"/products/[id]">) {
  const { id } = await props.params;
  const p = getSaving(id);
  if (!p) notFound();
  const best = p.options.reduce((a, b) => (b.max > a.max ? b : a));
  const terms = [...new Set(p.options.map((o) => o.term))];
  const maxMonthly = p.maxLimit && p.maxLimit >= 10000 ? Math.min(Math.floor(p.maxLimit / 10000), 300) : 100;

  return (
    <div className="min-h-svh bg-background">
      <DetailTopBar title={p.name} />

      <main className="mx-auto max-w-[720px] px-5 pb-40">
        <section className="pt-4 pb-8">
          <div className="flex items-center gap-3">
            <BankMark bank={p.company} className="size-10" />
            <span className="text-[15px] text-grey-600">
              {p.company} · {p.bank ? "은행" : "저축은행"} 적금{p.youth && " · 청년"}
            </span>
          </div>
          <h1 className="mt-5 text-[26px] font-bold leading-snug tracking-tight text-grey-900">{p.name}</h1>

          <div className="mt-7 flex items-end gap-8">
            <div>
              <p className="text-[14px] text-grey-500">최고 금리 ({best.term}개월)</p>
              <p className="mt-1 text-[30px] font-bold tracking-tight text-brand tabular-nums">연 {best.max.toFixed(2)}%</p>
            </div>
            <div className="pb-1">
              <p className="text-[14px] text-grey-500">기본 금리</p>
              <p className="mt-1 text-[20px] font-semibold text-grey-700 tabular-nums">연 {best.base.toFixed(2)}%</p>
            </div>
          </div>
        </section>

        <SectionGap />

        <section className="py-8">
          <h2 className="mb-5 text-[19px] font-bold text-grey-900">얼마나 모을 수 있을까요?</h2>
          <MaturityCalculator options={p.options} maxMonthly={maxMonthly} />
        </section>

        <SectionGap />

        <section className="py-8">
          <h2 className="mb-3 text-[19px] font-bold text-grey-900">기간별 금리</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-[15px]">
              <thead>
                <tr className="text-left text-[13px] text-grey-500">
                  <th className="py-2 font-medium">기간</th><th className="py-2 font-medium">방식</th>
                  <th className="py-2 text-right font-medium">기본</th><th className="py-2 text-right font-medium">최고</th>
                </tr>
              </thead>
              <tbody>
                {p.options.map((o, i) => (
                  <tr key={i} className="border-t border-grey-100">
                    <td className="py-2.5 text-grey-800">{o.term}개월</td>
                    <td className="py-2.5 text-grey-600">{o.type ?? "-"} · {o.rateType ?? "-"}</td>
                    <td className="py-2.5 text-right tabular-nums text-grey-700">{o.base.toFixed(2)}%</td>
                    <td className="py-2.5 text-right font-semibold tabular-nums text-brand">{o.max.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[12px] text-grey-400">가입 가능 기간: {terms.join(", ")}개월</p>
        </section>

        {p.special && (
          <>
            <SectionGap />
            <section className="py-8">
              <h2 className="mb-3 text-[19px] font-bold text-grey-900">우대금리 받는 법</h2>
              <p className="whitespace-pre-line text-[15px] leading-[1.75] text-grey-700">{p.special}</p>
            </section>
          </>
        )}

        <SectionGap />

        <section className="py-8">
          <h2 className="mb-3 text-[19px] font-bold text-grey-900">상품 정보</h2>
          <dl>
            <InfoRow label="가입 대상">{p.joinMember || "-"}</InfoRow>
            {p.joinWay && <InfoRow label="가입 방법">{p.joinWay}</InfoRow>}
            {p.maxLimit ? <InfoRow label="월 납입 한도">{formatManwon(p.maxLimit / 10000)}</InfoRow> : null}
            {p.disclosed && <InfoRow label="공시 기준">{p.disclosed.slice(0, 4)}년 {Number(p.disclosed.slice(4))}월</InfoRow>}
          </dl>
          {p.note && <p className="mt-5 whitespace-pre-line text-[14px] leading-relaxed text-grey-600">{p.note}</p>}
        </section>

        <p className="text-[12px] leading-relaxed text-grey-400">금융감독원 금융상품통합비교공시 데이터예요. 실제 금리와 조건은 가입 시점에 금융사에서 확인해주세요.</p>
      </main>

      <BottomCta href={p.homepage ?? "https://finlife.fss.or.kr"} label="가입하러 가기" sub={`${p.company} 사이트로 이동해요`} />
    </div>
  );
}
