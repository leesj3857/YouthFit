"use client";

import { ChevronRight } from "lucide-react";
import {
  ageLabel,
  applyStatus,
  categoryDotClass,
  keywords,
  shortCategory,
  type Policy,
} from "@/lib/policy";
import { cn } from "@/lib/utils";
import { usePolicyDetail } from "./policy-detail";

const STATUS_CLASS = {
  open: "text-brand-strong",
  always: "text-muted-foreground",
  closed: "text-muted-foreground/60 line-through decoration-muted-foreground/40",
  muted: "text-muted-foreground",
} as const;

export function PolicyRow({ policy, compact = false }: { policy: Policy; compact?: boolean }) {
  const status = applyStatus(policy);
  const age = ageLabel(policy);
  const org = policy.operInstCdNm.trim() || policy.sprvsnInstCdNm.trim();
  const tags = keywords(policy);
  const openDetail = usePolicyDetail();

  return (
    <li>
      <button
        type="button"
        onClick={() => openDetail(policy)}
        className={cn(
          "group -mx-3 grid w-[calc(100%+1.5rem)] gap-2 rounded-xl px-3 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none",
          compact ? "py-3 sm:grid-cols-[1fr_auto]" : "py-4 sm:grid-cols-[6.5rem_1fr_auto] sm:gap-x-6",
        )}
      >
        {!compact && (
          <div className="flex items-baseline gap-2 text-xs sm:flex-col sm:gap-0.5 sm:pt-1">
            <span className="flex items-center gap-2 text-foreground/80">
              <span className={cn("size-1.5 shrink-0 rounded-full", categoryDotClass(policy.lclsfNm))} />
              {shortCategory(policy.lclsfNm)}
            </span>
            {policy.mclsfNm && (
              <span className="truncate text-muted-foreground/70 sm:pl-3.5">{policy.mclsfNm}</span>
            )}
          </div>
        )}

        <div className="min-w-0">
          <h3 className="flex items-start gap-1 font-medium leading-snug text-foreground group-hover:text-brand-strong">
            <span className="text-pretty">{policy.plcyNm}</span>
            <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-brand-strong/70" />
          </h3>
          {!compact && policy.plcyExplnCn && (
            <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              {policy.plcyExplnCn}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
            {org && <span>{org}</span>}
            {age && (
              <>
                <span className="text-border">·</span>
                <span>{age}</span>
              </>
            )}
            {compact && (
              <>
                <span className="text-border">·</span>
                <span>{shortCategory(policy.lclsfNm)}</span>
              </>
            )}
            {tags.length > 0 && (
              <>
                <span className="text-border">·</span>
                {tags.map((t) => (
                  <span key={t} className="text-muted-foreground/80">
                    #{t}
                  </span>
                ))}
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs sm:flex-col sm:items-end sm:gap-0.5 sm:pt-1">
          <span className={cn("font-medium", STATUS_CLASS[status.tone])}>{status.label}</span>
          {status.period && (
            <span className="tabular-nums text-muted-foreground/80">{status.period}</span>
          )}
        </div>
      </button>
    </li>
  );
}
