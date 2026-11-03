/** 서버 전용: 정형화된 정책·적금 데이터와 임베딩 로드 */
import { readFileSync } from "node:fs";
import path from "node:path";
import policiesJson from "@/data/policies.json";
import savingsJson from "@/data/savings.json";
import type { PolicyRecord, SavingRecord } from "./types";

export const POLICIES = policiesJson as unknown as PolicyRecord[];
export const SAVINGS = savingsJson as unknown as SavingRecord[];
const BY_ID = new Map(POLICIES.map((p, i) => [p.id, i]));
const SAVING_BY_ID = new Map(SAVINGS.map((s) => [s.id, s]));

/** 오늘 날짜(한국 시간, YYYY-MM-DD) */
export const todayKST = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
/** 신청 마감 여부 — 데이터를 만든 날이 아니라 요청이 들어온 날 기준으로 판단 */
export const isExpired = (p: PolicyRecord) => !p.alwaysOpen && !!p.applyEnd && p.applyEnd < todayKST();

export const getPolicy = (id: string) => (BY_ID.has(id) ? POLICIES[BY_ID.get(id)!] : undefined);
export const getSaving = (id: string) => SAVING_BY_ID.get(id);

/** 임베딩 메타 (scripts/build-embeddings.mjs 가 생성) */
export interface EmbMeta { provider: "voyage"; model: string; dim: number; count: number }
let emb: { vectors: Float32Array; meta: EmbMeta } | null | undefined;
/** 정책 임베딩 (없거나 정책 수와 안 맞으면 null → 키워드 검색만) */
export function policyEmbeddings() {
  if (emb !== undefined) return emb;
  try {
    const dir = path.join(process.cwd(), "src/data");
    const meta = JSON.parse(readFileSync(path.join(dir, "policies.emb.json"), "utf8")) as EmbMeta;
    const buf = readFileSync(path.join(dir, "policies.emb"));
    const vectors = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
    emb = meta.count === POLICIES.length && vectors.length === POLICIES.length * meta.dim ? { vectors, meta } : null;
    if (!emb) console.warn("[rag] 임베딩이 정책 데이터와 맞지 않아 키워드 검색만 사용합니다. node scripts/build-embeddings.mjs 를 다시 실행하세요.");
  } catch {
    emb = null;
  }
  return emb;
}
