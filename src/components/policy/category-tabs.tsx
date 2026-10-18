import Link from "next/link";
import { CATEGORIES, categoryDotClass } from "@/lib/policy";
import { cn } from "@/lib/utils";

export function CategoryTabs({ active }: { active?: string }) {
  const items = [{ label: "전체", value: undefined }, ...CATEGORIES.map((c) => ({ label: c, value: c }))];
  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto text-sm" aria-label="정책 분류">
      {items.map(({ label, value }) => {
        const isActive = (active ?? undefined) === value;
        return (
          <Link
            key={label}
            href={value ? `/?category=${encodeURIComponent(value)}#feed` : "/#feed"}
            scroll={false}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors",
              isActive
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {value && (
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  isActive ? "bg-background/80" : categoryDotClass(value),
                )}
              />
            )}
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
