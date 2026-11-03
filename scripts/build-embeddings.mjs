// 정책 검색용 임베딩 생성 (학교 BAZE API Gateway): node scripts/build-embeddings.mjs
// src/data/policies.json 순서대로 단위 길이로 정규화한 float32 벡터를 src/data/policies.emb 에,
// 모델 정보와 정책별 텍스트 해시를 policies.emb.json 에 저장한다.
// 이전 결과와 모델·차원이 같으면 텍스트가 바뀐 정책만 새로 임베딩한다 (토큰 절약).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

const MODEL = process.env.EMBED_MODEL ?? "gemini-embedding-2";
const DIM = 512;
const URL = (process.env.BAZE_EMBED_URL ?? "https://api.baze.co/v1/gateway/embeddings");
const KEY = process.env.BAZE_API_KEY ?? (existsSync(".env.local") && readFileSync(".env.local", "utf8").match(/^BAZE_API_KEY=(.+)$/m)?.[1]?.trim());
if (!KEY) throw new Error("BAZE_API_KEY가 필요해요 (.env.local 또는 환경변수)");

const pols = JSON.parse(readFileSync("src/data/policies.json", "utf8"));
const docs = pols.map((p) => `${p.name}. ${p.summary ?? p.benefit ?? ""} 분야: ${p.domains.join(", ")}`);
const hashes = docs.map((d) => createHash("sha1").update(d).digest("hex").slice(0, 12));
const out = new Float32Array(docs.length * DIM);

// 이전 임베딩 재사용
const reuse = new Map();
try {
  const meta = JSON.parse(readFileSync("src/data/policies.emb.json", "utf8"));
  if (meta.provider === "baze" && meta.model === MODEL && meta.dim === DIM && Array.isArray(meta.hashes)) {
    const buf = readFileSync("src/data/policies.emb");
    const prev = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
    meta.hashes.forEach((h, i) => reuse.set(h, prev.subarray(i * DIM, (i + 1) * DIM)));
  }
} catch {}
const todo = [];
hashes.forEach((h, i) => (reuse.has(h) ? out.set(reuse.get(h), i * DIM) : todo.push(i)));
console.log(`재사용 ${docs.length - todo.length}건, 새로 임베딩 ${todo.length}건 (${MODEL})`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function embed(texts, attempt = 0) {
  const res = await fetch(URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, input: texts, dimensions: DIM }),
  });
  if ((res.status === 429 || res.status >= 500) && attempt < 5) {
    await sleep(3000 * (attempt + 1));
    return embed(texts, attempt + 1);
  }
  if (!res.ok) throw new Error(`BAZE embeddings ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return { vecs: j.data.sort((a, b) => a.index - b.index).map((d) => d.embedding), tokens: j.usage?.total_tokens ?? 0 };
}

const B = 100, PAR = 4;
const chunks = [];
for (let k = 0; k < todo.length; k += B) chunks.push(todo.slice(k, k + B));
let done = 0, tokens = 0;
for (let c = 0; c < chunks.length; c += PAR) {
  await Promise.all(chunks.slice(c, c + PAR).map(async (idx) => {
    const r = await embed(idx.map((i) => docs[i]));
    tokens += r.tokens;
    r.vecs.forEach((v, k) => {
      let n = 0; for (const x of v) n += x * x; n = Math.sqrt(n) || 1;
      out.set(v.map((x) => x / n), idx[k] * DIM);
    });
    done += idx.length;
  }));
  console.log(`${done}/${todo.length}`);
}
writeFileSync("src/data/policies.emb", Buffer.from(out.buffer));
writeFileSync("src/data/policies.emb.json", JSON.stringify({ provider: "baze", model: MODEL, dim: DIM, count: docs.length, hashes }));
console.log(`done ${docs.length} x ${DIM} (${MODEL}), 사용 토큰 ${tokens}`);
