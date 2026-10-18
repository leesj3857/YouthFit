import { Briefcase, Bus, GraduationCap, Home, PiggyBank } from "lucide-react";
import type { Interest } from "@/lib/catalog";
import { cn } from "@/lib/utils";

const INTEREST_ICON = {
  housing: { Icon: Home, tone: "bg-[#e8f3ff] text-[#3182f6]" },
  job: { Icon: Briefcase, tone: "bg-[#e5f8f1] text-[#03b26c]" },
  asset: { Icon: PiggyBank, tone: "bg-[#fff4e5] text-[#fe9800]" },
  edu: { Icon: GraduationCap, tone: "bg-[#f3eefe] text-[#7c4dff]" },
  life: { Icon: Bus, tone: "bg-[#ffeef0] text-[#f04452]" },
} satisfies Record<Interest, unknown>;

export function InterestIcon({ interest, className }: { interest: Interest; className?: string }) {
  const { Icon, tone } = INTEREST_ICON[interest];
  return (
    <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-full", tone, className)}>
      <Icon className="size-5" strokeWidth={2.2} />
    </span>
  );
}

const BANK_TONE: Record<string, string> = {
  서민금융진흥원: "bg-[#3182f6]",
  주택도시기금: "bg-[#00a3c4]",
  하나은행: "bg-[#00857a]",
  우리은행: "bg-[#0067ac]",
  케이뱅크: "bg-[#1e1e5a]",
};

/** 실제 로고 대신 기관 첫 글자를 담은 원형 마크 */
export function BankMark({ bank, className }: { bank: string; className?: string }) {
  return (
    <span
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-white",
        BANK_TONE[bank] ?? "bg-grey-500",
        className,
      )}
      aria-hidden
    >
      {bank[0]}
    </span>
  );
}
