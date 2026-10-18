"use client";

import { createContext, Fragment, useContext, useState, type ReactNode } from "react";
import { ArrowUpRight, ExternalLink } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  ageLabel,
  applyStatus,
  categoryDotClass,
  codeFields,
  formatYmd,
  incomeLabel,
  keywords,
  provisionLabel,
  shortCategory,
  textSections,
  youthcenterDetailUrl,
  type Policy,
} from "@/lib/policy";
import { cn } from "@/lib/utils";

/* ---------- 전역 상태: 어디서든 open(policy)로 상세 패널 열기 ---------- */

const DetailContext = createContext<(p: Policy) => void>(() => {});

export function usePolicyDetail() {
  return useContext(DetailContext);
}

export function PolicyDetailProvider({ children }: { children: ReactNode }) {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [open, setOpen] = useState(false);

  const show = (p: Policy) => {
    setPolicy(p);
    setOpen(true);
  };

  return (
    <DetailContext.Provider value={show}>
      {children}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full gap-0 overflow-y-auto p-0 sm:max-w-xl"
        >
          {policy && <PolicyDetail policy={policy} />}
        </SheetContent>
      </Sheet>
    </DetailContext.Provider>
  );
}

/* ---------- 상세 내용 ---------- */

function PolicyDetail({ policy: p }: { policy: Policy }) {
  const status = applyStatus(p);
  const age = ageLabel(p);
  const income = incomeLabel(p);
  const codes = codeFields(p);
  const sections = textSections(p);
  const org = p.operInstCdNm.trim() || p.sprvsnInstCdNm.trim();
  const applyUrl = p.aplyUrlAddr.trim();
  const refUrls = [p.refUrlAddr1, p.refUrlAddr2].map((u) => u.trim()).filter(Boolean);

  const bizPeriod =
    p.bizPrdBgngYmd.trim() && p.bizPrdEndYmd.trim()
      ? `${formatYmd(p.bizPrdBgngYmd)} – ${formatYmd(p.bizPrdEndYmd)}`
      : p.bizPrdEtcCn.trim();

  return (
    <div className="flex flex-col">
      {/* 헤더 */}
      <SheetHeader className="gap-3 border-b border-border/70 px-6 pt-6 pb-5 text-left">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={cn("size-1.5 rounded-full", categoryDotClass(p.lclsfNm))} />
          {shortCategory(p.lclsfNm)}
          {p.mclsfNm && <span className="text-muted-foreground/60">· {p.mclsfNm}</span>}
          <span className="ml-auto font-mono text-[11px] text-muted-foreground/60">{p.plcyNo}</span>
        </div>
        <SheetTitle className="text-balance text-lg leading-snug">{p.plcyNm}</SheetTitle>
        <SheetDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {org && <span>{org}</span>}
          {keywords(p).length > 0 && (
            <>
              <span className="text-border">·</span>
              {keywords(p).map((k) => (
                <span key={k}>#{k}</span>
              ))}
            </>
          )}
        </SheetDescription>
        <div className="flex flex-wrap gap-2 pt-1">
          {applyUrl ? (
            <Button asChild size="sm" className="bg-brand-strong hover:bg-brand-strong/90">
              <a href={applyUrl} target="_blank" rel="noreferrer">
                신청 페이지 <ArrowUpRight data-icon="inline-end" />
              </a>
            </Button>
          ) : (
            <Button size="sm" disabled variant="secondary">
              신청 URL 없음
            </Button>
          )}
          <Button asChild size="sm" variant="outline">
            <a href={youthcenterDetailUrl(p)} target="_blank" rel="noreferrer">
              온통청년에서 보기 <ExternalLink data-icon="inline-end" />
            </a>
          </Button>
        </div>
      </SheetHeader>

      <div className="space-y-8 px-6 py-6">
        {/* 한눈에 보는 조건 */}
        <section>
          <SectionTitle>자격 조건 요약</SectionTitle>
          <dl className="grid grid-cols-[6.5rem_1fr] gap-y-2 text-sm">
            {provisionLabel(p) && (
              <>
                <Dt>제공 구분</Dt>
                <dd>{provisionLabel(p)}</dd>
              </>
            )}
            <Dt>접수</Dt>
            <dd>
              <span
                className={cn(
                  "font-medium",
                  status.tone === "open" && "text-brand-strong",
                  status.tone === "closed" && "text-muted-foreground line-through",
                )}
              >
                {status.label}
              </span>
              {status.period && <span className="ml-2 tabular-nums text-muted-foreground">{status.period}</span>}
              {p.aplyYmd.includes("\\N") && (
                <span className="ml-2 text-xs text-muted-foreground">(여러 회차)</span>
              )}
            </dd>

            {bizPeriod && (
              <>
                <Dt>사업 기간</Dt>
                <dd className="tabular-nums">{bizPeriod}</dd>
              </>
            )}

            <Dt>연령</Dt>
            <dd>{age ?? <Muted>제한 없음</Muted>}</dd>

            <Dt>소득</Dt>
            <dd className="whitespace-pre-line">{income ?? <Muted>무관</Muted>}</dd>

            {codes.map((f) => (
              <Fragment key={f.label}>
                <Dt>{f.label}</Dt>
                <dd>
                  {f.noLimit ? (
                    <Muted>제한 없음</Muted>
                  ) : (
                    <span className="flex flex-wrap gap-1.5">
                      {f.values.map((v) => (
                        <span
                          key={v}
                          className="rounded-md bg-brand-soft px-1.5 py-0.5 text-xs font-medium text-brand-strong"
                        >
                          {v}
                        </span>
                      ))}
                    </span>
                  )}
                </dd>
              </Fragment>
            ))}

            {p.sprtSclLmtYn === "Y" && (
              <>
                <Dt>지원 규모</Dt>
                <dd>
                  {Number(p.sprtSclCnt) ? `${Number(p.sprtSclCnt).toLocaleString()}명` : "제한 있음"}
                  {p.sprtArvlSeqYn === "Y" && <span className="ml-2 text-xs text-muted-foreground">선착순</span>}
                </dd>
              </>
            )}
          </dl>
        </section>

        {/* 긴 텍스트 섹션들 */}
        {sections.map((s) => (
          <section key={s.field}>
            <SectionTitle field={s.field}>{s.title}</SectionTitle>
            <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">{s.text}</p>
          </section>
        ))}

        {refUrls.length > 0 && (
          <section>
            <SectionTitle>참고 링크</SectionTitle>
            <ul className="space-y-1 text-sm">
              {refUrls.map((u) => (
                <li key={u}>
                  <a
                    href={u}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all text-brand-strong underline-offset-4 hover:underline"
                  >
                    {u}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 원본 JSON — 파싱 규칙 잡을 때 참고 */}
        <details className="group">
          <summary className="cursor-pointer select-none text-xs text-muted-foreground hover:text-foreground">
            원본 JSON 보기
          </summary>
          <pre className="mt-2 max-h-96 overflow-auto rounded-lg bg-muted p-3 font-mono text-[11px] leading-relaxed">
            {JSON.stringify({ ...p, zipCd: p.zipCd.length > 60 ? p.zipCd.slice(0, 60) + "…" : p.zipCd }, null, 2)}
          </pre>
        </details>

        <p className="text-[11px] text-muted-foreground/70">
          등록 {p.frstRegDt} · 수정 {p.lastMdfcnDt} · 조회 {Number(p.inqCnt).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

/* ---------- 작은 조각들 ---------- */


function SectionTitle({ children, field }: { children: ReactNode; field?: string }) {
  return (
    <h3 className="mb-2.5 flex items-baseline gap-2 text-sm font-semibold">
      {children}
      {field && <code className="font-mono text-[10px] font-normal text-muted-foreground/60">{field}</code>}
    </h3>
  );
}

function Dt({ children }: { children: ReactNode }) {
  return <dt className="text-muted-foreground">{children}</dt>;
}

function Muted({ children }: { children: ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}
