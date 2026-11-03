/** 하이브리드 검색: BM25(한글 2-gram) + 임베딩 의미검색(Voyage AI), RRF로 결합 */
import { POLICIES, policyEmbeddings } from "./data";

const tokens = (s: string) => {
  const words = (s ?? "").replace(/[^0-9A-Za-z가-힣 ]/g, " ").split(/\s+/).filter(Boolean);
  const out = [...words];
  for (const w of words) for (let i = 0; i < w.length - 1; i++) out.push(w.slice(i, i + 2));
  return out;
};

/* ---------- BM25 ---------- */
const K1 = 1.5, B = 0.75;
let bm: { tf: Map<string, number>[]; len: number[]; avg: number; idf: Map<string, number> } | null = null;
function bm25Index() {
  if (bm) return bm;
  const tf = POLICIES.map((p) => {
    const m = new Map<string, number>();
    for (const t of tokens(`${p.name} ${p.name} ${p.summary ?? ""} ${p.domains.join(" ")} ${p.extra.join(" ")}`)) m.set(t, (m.get(t) ?? 0) + 1);
    return m;
  });
  const len = tf.map((m) => [...m.values()].reduce((a, b) => a + b, 0));
  const df = new Map<string, number>();
  for (const m of tf) for (const t of m.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  const N = tf.length;
  const idf = new Map([...df].map(([t, n]) => [t, Math.log(1 + (N - n + 0.5) / (n + 0.5))]));
  bm = { tf, len, avg: len.reduce((a, b) => a + b, 0) / N, idf };
  return bm;
}
function bm25(query: string) {
  const { tf, len, avg, idf } = bm25Index();
  const q = [...new Set(tokens(query))];
  return tf.map((m, i) =>
    q.reduce((s, t) => {
      const f = m.get(t);
      if (!f) return s;
      return s + (idf.get(t) ?? 0) * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * len[i]) / avg)));
    }, 0),
  );
}

/* ---------- 임베딩 의미검색: 질문만 Voyage API로 임베딩 (정책 쪽은 미리 계산) ---------- */
const queryCache = new Map<string, Float32Array>();
async function embedQuery(query: string, model: string, dim: number): Promise<Float32Array | null> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key || process.env.RAG_EMBEDDINGS === "off") return null;
  const hit = queryCache.get(query);
  if (hit) return hit;
  try {
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ input: [query], model, input_type: "query", output_dimension: dim }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`Voyage ${res.status}`);
    const v = Float32Array.from((await res.json()).data[0].embedding as number[]);
    if (queryCache.size > 500) queryCache.clear();
    queryCache.set(query, v);
    return v;
  } catch (e) {
    console.warn("[rag] 질문 임베딩 실패, 키워드 검색만 사용:", (e as Error).message);
    return null;
  }
}
async function semantic(query: string): Promise<number[] | null> {
  const E = policyEmbeddings();
  if (!E) return null;
  const q = await embedQuery(query, E.meta.model, E.meta.dim);
  if (!q) return null;
  const { vectors, meta: { dim } } = E;
  const out = new Array<number>(POLICIES.length);
  for (let i = 0; i < POLICIES.length; i++) {
    let s = 0;
    for (let k = 0; k < dim; k++) s += vectors[i * dim + k] * q[k];
    out[i] = s;
  }
  return out;
}

/** 관련도 순 정책 인덱스 */
export async function searchPolicies(query: string, domains: string[] = []): Promise<{ i: number; score: number }[]> {
  const score = new Array<number>(POLICIES.length).fill(0);
  const lists = [bm25(query), await semantic(query)].filter(Boolean) as number[][];
  for (const s of lists) {
    const order = s.map((v, i) => [v, i] as const).sort((a, b) => b[0] - a[0]);
    order.forEach(([, i], rank) => (score[i] += 1 / (60 + rank)));
  }
  if (domains.length) POLICIES.forEach((p, i) => { if (p.domains.some((d) => domains.includes(d))) score[i] += 0.01; });
  return score.map((s, i) => ({ i, score: s })).sort((a, b) => b.score - a.score);
}

/** 서버 기동 직후 첫 요청이 느리지 않도록 미리 로드 */
export function warmup() {
  bm25Index();
  policyEmbeddings();
}
