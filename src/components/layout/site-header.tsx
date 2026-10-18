import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-transparent bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
          <span className="flex size-6 items-center justify-center rounded-lg bg-brand">
            <span className="size-2.5 rounded-full bg-white" />
          </span>
          <span>청핏</span>
          <span className="hidden text-xs font-normal text-muted-foreground sm:inline">
            YouthFit
          </span>
        </Link>

        <nav className="flex items-center gap-0.5 text-sm">
          <Link
            href="/chat"
            className="rounded-full px-3 py-1.5 font-medium text-brand transition-colors hover:bg-brand-soft"
          >
            혜택 찾기
          </Link>
          <span
            aria-disabled
            className="hidden cursor-not-allowed items-center gap-1.5 sm:flex rounded-full px-3 py-1.5 text-muted-foreground/60"
          >
            금융상품
            <Badge variant="outline" className="h-4 px-1.5 text-[10px] text-muted-foreground">
              준비중
            </Badge>
          </span>
        </nav>
      </div>
    </header>
  );
}
