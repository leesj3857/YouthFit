/**
 * /api/chat 호출 제한 — 공개 서비스에서 API 비용이 새지 않도록.
 * - IP당 하루 RATE_LIMIT_PER_IP회 (기본 40회 ≈ 추천 10번)
 * - 서비스 전체 하루 RATE_LIMIT_GLOBAL회 (기본 400회) — 예산 안전장치
 * UPSTASH_REDIS_REST_URL/TOKEN 이 있으면 Upstash Redis(서버가 여러 대여도 공유),
 * 없으면 메모리(로컬 개발용, 서버 재시작 시 초기화)를 쓴다.
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const PER_IP = Number(process.env.RATE_LIMIT_PER_IP ?? 40);
const GLOBAL = Number(process.env.RATE_LIMIT_GLOBAL ?? 400);

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN ? Redis.fromEnv() : null;
const ipLimiter = redis && new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(PER_IP, "1 d"), prefix: "youthfit:ip" });
const globalLimiter = redis && new Ratelimit({ redis, limiter: Ratelimit.fixedWindow(GLOBAL, "1 d"), prefix: "youthfit:all" });

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

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

export async function checkLimit(ip: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const ipOk = ipLimiter ? (await ipLimiter.limit(ip)).success : memHit(`ip:${ip}`, PER_IP);
  if (!ipOk) return { ok: false, message: "오늘 이용 가능한 횟수를 모두 썼어요. 내일 다시 이용해주세요." };
  const allOk = globalLimiter ? (await globalLimiter.limit("all")).success : memHit("all", GLOBAL);
  if (!allOk) return { ok: false, message: "오늘 이용자가 많아 잠시 쉬어가요. 내일 다시 이용해주세요." };
  return { ok: true };
}
