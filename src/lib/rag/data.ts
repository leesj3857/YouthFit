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

export const DIM = 384;
let emb: Float32Array | null | undefined;
/** scripts/build-embeddings.mjs 가 만든 정책 임베딩 (없으면 null → 키워드 검색만) */
export function policyEmbeddings(): Float32Array | null {
  if (emb !== undefined) return emb;
  try {
    const buf = readFileSync(path.join(process.cwd(), "src/data/policies.emb"));
    const arr = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
    emb = arr.length === POLICIES.length * DIM ? arr : null;
  } catch {
    emb = null;
  }
  return emb;
}
