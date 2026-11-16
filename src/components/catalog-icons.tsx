import { Briefcase, GraduationCap, HeartHandshake, Home, PiggyBank, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = [
  { match: "주거", Icon: Home, tone: "bg-[#e8f3ff] text-[#3182f6]" },
  { match: "일자리", Icon: Briefcase, tone: "bg-[#e5f8f1] text-[#03b26c]" },
  { match: "교육", Icon: GraduationCap, tone: "bg-[#f3eefe] text-[#7c4dff]" },
  { match: "금융", Icon: PiggyBank, tone: "bg-[#fff4e5] text-[#fe9800]" },
  { match: "참여", Icon: Users, tone: "bg-[#eef1f4] text-[#4e5968]" },
];
const FALLBACK = { Icon: HeartHandshake, tone: "bg-[#ffeef0] text-[#f04452]" };

/** 정책 카테고리(백엔드 categories 문자열)에 맞는 아이콘 */
export function CategoryIcon({ categories, className }: { categories: string[]; className?: string }) {
  const first = categories[0] ?? "";
  const { Icon, tone } = ICONS.find((c) => first.includes(c.match)) ?? FALLBACK;
  return (
    <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-full", tone, className)}>
      <Icon className="size-5" strokeWidth={2.2} />
    </span>
  );
}
