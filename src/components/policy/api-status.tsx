import { CheckCircle2, XCircle } from "lucide-react";
import type { PolicyResult } from "@/lib/policy";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Seoul",
  });
}

/** 서버에서 온통청년 API를 실제로 호출한 결과를 한 줄로 보여준다 */
export function ApiStatus({ result }: { result: PolicyResult }) {
  return (
    <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {result.ok ? (
          <span className="flex items-center gap-1.5 font-medium text-brand-strong">
            <CheckCircle2 className="size-3.5" />
            온통청년 API 연결됨
          </span>
        ) : (
          <span className="flex items-center gap-1.5 font-medium text-destructive">
            <XCircle className="size-3.5" />
            API 호출 실패
          </span>
        )}
        <span className="text-border">|</span>
        {result.ok ? (
          <>
            <span>resultCode {result.resultCode}</span>
            <span className="text-border">·</span>
            <span>
              총 <b className="font-medium text-foreground">{result.total.toLocaleString()}</b>건 중{" "}
              {result.policies.length}건 표시
            </span>
          </>
        ) : (
          <span className="text-destructive/80">{result.error}</span>
        )}
        <span className="text-border">·</span>
        <span className="tabular-nums">{result.elapsedMs}ms</span>
        <span className="text-border">·</span>
        <span className="tabular-nums">{fmtTime(result.fetchedAt)} 기준</span>
      </div>
      <details className="group/url">
        <summary className="cursor-pointer select-none text-muted-foreground/70 hover:text-muted-foreground">
          요청 URL 보기
        </summary>
        <code className="mt-1 block break-all font-mono text-[11px] leading-relaxed text-muted-foreground/80">
          {result.requestUrl}
        </code>
      </details>
    </div>
  );
}
