"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, ChevronLeft } from "lucide-react";

/** 상세 페이지 상단 바 — 대화에서 왔으면 뒤로, 직접 들어왔으면 대화 화면으로 */
export function DetailTopBar({ title }: { title: string }) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[720px] items-center gap-1 px-2">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? router.back() : router.push("/chat"))}
          className="pressable flex size-10 items-center justify-center rounded-full text-grey-800 hover:bg-grey-100"
          aria-label="뒤로 가기"
        >
          <ChevronLeft className="size-6" />
        </button>
        <span className="truncate text-[17px] font-semibold text-grey-900">{title}</span>
      </div>
    </header>
  );
}

/** 화면 아래에 붙는 큰 CTA 버튼 */
export function BottomCta({ href, label, sub }: { href: string; label: string; sub?: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-background from-80% to-transparent pt-6">
      <div className="mx-auto max-w-[720px] px-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {sub && <p className="mb-2 text-center text-[13px] text-grey-500">{sub}</p>}
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="pressable flex w-full items-center justify-center gap-1 rounded-2xl bg-brand py-4 text-[17px] font-semibold text-white hover:bg-brand-strong"
        >
          {label}
          <ArrowUpRight className="size-5" />
        </a>
      </div>
    </div>
  );
}

/** 토스식 섹션 구분: 테두리 박스 대신 두꺼운 회색 띠 */
export function SectionGap() {
  return <div className="-mx-5 h-3 bg-grey-50 sm:mx-0 sm:h-px sm:bg-grey-100" />;
}

export function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-6 py-2.5 text-[15px]">
      <dt className="shrink-0 text-grey-500">{label}</dt>
      <dd className="text-right font-medium text-grey-800">{children}</dd>
    </div>
  );
}
