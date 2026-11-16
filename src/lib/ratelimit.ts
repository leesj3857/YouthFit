/**
 * /api/feedback 저장소·호출 제한 (추천 API의 호출 제한은 백엔드가 한다).
 * UPSTASH_REDIS_REST_URL/TOKEN 이 있으면 Upstash Redis, 없으면 메모리(로컬 개발용)를 쓴다.
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { createHash } from "node:crypto";

/** 환경변수가 잘못돼도 빌드·서비스가 죽지 않도록 첫 요청 때 만들고, 실패하면 메모리 카운터로 대신한다 */
let limiters: { fb: Ratelimit; redis: Redis } | null | undefined;
function getLimiters() {
  if (limiters !== undefined) return limiters;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim().replace(/^["']|["']$/g, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim().replace(/^["']|["']$/g, "");
  limiters = null;
  if (!url || !token) return limiters;
  if (!url.startsWith("https://")) {
    console.error("[ratelimit] UPSTASH_REDIS_REST_URL은 https:// 로 시작하는 REST URL이어야 해요. 메모리 카운터로 대신합니다.");
    return limiters;
  }
  try {
    const redis = new Redis({ url, token });
    limiters = {
      fb: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, "1 d"), prefix: "youthfit:fb" }),
      redis,
    };
  } catch (e) {
    console.error("[ratelimit] Upstash 연결 설정 실패, 메모리 카운터로 대신합니다:", (e as Error).message);
  }
  return limiters;
}

const mem = new Map<string, { n: number; reset: number }>();
function memHit(key: string, limit: number) {
  const now = Date.now();
  const e = mem.get(key);
  if (!e || e.reset < now) {
    mem.set(key, { n: 1, reset: now + 86_400_000 });
    return true;
  }
  e.n += 1;
  return e.n <= limit;
}

/** IP는 원문 그대로 저장하지 않고 해시값만 쓴다 (개인정보 최소화) */
export function clientIp(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
  return createHash("sha256").update(`${process.env.RATE_LIMIT_SALT ?? "youthfit"}:${ip}`).digest("hex").slice(0, 32);
}

/** 피드백 저장용 Redis (없으면 null) */
export const feedbackRedis = () => getLimiters()?.redis ?? null;

export async function checkFeedbackLimit(ip: string) {
  const l = getLimiters();
  return l ? (await l.fb.limit(ip)).success : memHit(`fb:${ip}`, 20);
}
