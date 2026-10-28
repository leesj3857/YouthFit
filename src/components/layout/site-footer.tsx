import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-5 py-10 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>© 2026 청핏 · 산학캡스톤디자인 (팀 취뽀)</p>
        <p>
          데이터 출처: 온통청년(한국고용정보원) · 금융감독원 금융상품통합비교공시
          <span className="mx-2 text-border">|</span>
          <Link href="/privacy" className="underline underline-offset-2">
            이용안내·개인정보 처리방침
          </Link>
        </p>
      </div>
    </footer>
  );
}
