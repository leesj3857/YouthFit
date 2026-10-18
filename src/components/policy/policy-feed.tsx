import { fetchPolicies } from "@/lib/youthcenter";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiStatus } from "./api-status";
import { PolicyRow } from "./policy-row";

/** 서버 컴포넌트 — 렌더 시점에 온통청년 API를 직접 호출 */
export async function PolicyFeed({ category }: { category?: string }) {
  const result = await fetchPolicies({ category, size: 12 });

  return (
    <div className="space-y-5">
      <ApiStatus result={result} />
      {result.ok ? (
        result.policies.length > 0 ? (
          <ol className="divide-y divide-border/70">
            {result.policies.map((p) => (
              <PolicyRow key={p.plcyNo} policy={p} />
            ))}
          </ol>
        ) : (
          <p className="py-12 text-center text-sm text-muted-foreground">해당 분류의 정책이 없습니다.</p>
        )
      ) : (
        <p className="py-12 text-center text-sm text-muted-foreground">
          정책을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
        </p>
      )}
    </div>
  );
}

export function PolicyFeedSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-4 w-80 max-w-full" />
      <ol className="divide-y divide-border/70">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="grid gap-2 py-4 sm:grid-cols-[6.5rem_1fr_auto] sm:gap-x-6">
            <Skeleton className="h-3.5 w-16" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-3.5 w-12" />
          </li>
        ))}
      </ol>
    </div>
  );
}
