export function SiteFooter() {
  return (
    <footer className="mt-auto">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-5 py-10 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>© 2026 청핏 · 산학캡스톤디자인 (팀 취뽀)</p>
        <p>
          데이터 출처: 온통청년 Open API
          <span className="mx-2 text-border">|</span>
          금융감독원 금융상품한눈에 (연동 예정)
        </p>
      </div>
    </footer>
  );
}
