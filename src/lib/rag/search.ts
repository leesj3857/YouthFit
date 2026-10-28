/** 하이브리드 검색: BM25(한글 2-gram) + 임베딩 의미검색(multilingual-e5-small), RRF로 결합 */
import { DIM, POLICIES, policyEmbeddings } from "./data";

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

/* ---------- 임베딩 (서버에서 로컬 모델로 쿼리만 임베딩) ---------- */
type Extractor = (t: string[], o: object) => Promise<{ data: Float32Array }>;
let extractor: Promise<Extractor | null> | null = null;
function getExtractor() {
  extractor ??= (async () => {
    if (process.env.RAG_EMBEDDINGS === "off") return null;
    try {
      const { pipeline } = await import("@huggingface/transformers");
      return (await pipeline("feature-extraction", "Xenova/multilingual-e5-small", { dtype: "q8" })) as unknown as Extractor;
    } catch (e) {
      console.warn("[rag] 임베딩 모델을 불러오지 못해 키워드 검색만 사용합니다:", (e as Error).message);
      return null;
    }
  })();
  return extractor;
}
async function semantic(query: string): Promise<number[] | null> {
  const E = policyEmbeddings();
  const ext = E && (await getExtractor());
  if (!E || !ext) return null;
  const q = (await ext([`query: ${query}`], { pooling: "mean", normalize: true })).data;
  const out = new Array<number>(POLICIES.length);
  for (let i = 0; i < POLICIES.length; i++) {
    let s = 0;
    for (let k = 0; k < DIM; k++) s += E[i * DIM + k] * q[k];
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
  void getExtractor();
}
