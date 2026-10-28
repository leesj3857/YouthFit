import { NextResponse } from "next/server";
import { checkFeedbackLimit, clientIp, feedbackRedis } from "@/lib/ratelimit";

export const runtime = "nodejs";

const REASONS = ["자격이 안 맞아요", "원하던 분야가 아니에요", "정보가 부정확해요", "더 많은 결과를 원해요", "기타"];

/** POST /api/feedback — 추천 결과 평가 (대화 원문·IP는 저장하지 않음) */
export async function POST(req: Request) {
  if (!(await checkFeedbackLimit(clientIp(req)))) return NextResponse.json({ ok: true });
  const b = await req.json().catch(() => null);
  if (!b || (b.rating !== "up" && b.rating !== "down")) return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  const entry = {
    at: new Date().toISOString(),
    rating: b.rating,
    reason: REASONS.includes(b.reason) ? b.reason : null,
    ids: Array.isArray(b.ids) ? b.ids.slice(0, 12).map(String) : [],
    // 분석용 요약만 (나이대·지역·상황·관심 분야)
    meta: {
      ageBand: typeof b.meta?.age === "number" ? `${Math.floor(b.meta.age / 5) * 5}~${Math.floor(b.meta.age / 5) * 5 + 4}세` : null,
      sido: typeof b.meta?.sido === "string" ? b.meta.sido.slice(0, 10) : null,
      employment: typeof b.meta?.employment === "string" ? b.meta.employment.slice(0, 20) : null,
      domains: Array.isArray(b.meta?.domains) ? b.meta.domains.slice(0, 5).map(String) : [],
    },
  };
  const redis = feedbackRedis();
  if (redis) {
    await redis.lpush("youthfit:feedback", JSON.stringify(entry));
    await redis.ltrim("youthfit:feedback", 0, 4999);
  } else {
    console.log("[feedback]", JSON.stringify(entry));
  }
  return NextResponse.json({ ok: true });
}
