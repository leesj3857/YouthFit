// 정책 검색용 임베딩 생성: node scripts/build-embeddings.mjs
// src/data/policies.json 순서대로 384차원 float32를 src/data/policies.emb 에 저장한다.
import { readFileSync, writeFileSync } from "node:fs";
import { pipeline } from "@huggingface/transformers";

const MODEL = "Xenova/multilingual-e5-small";
const pols = JSON.parse(readFileSync("src/data/policies.json", "utf8"));
const ext = await pipeline("feature-extraction", MODEL, { dtype: "q8" });
const docs = pols.map((p) => `passage: ${p.name}. ${p.summary ?? p.benefit ?? ""} 분야: ${p.domains.join(", ")}`);
const out = new Float32Array(docs.length * 384);
const B = 32;
for (let i = 0; i < docs.length; i += B) {
  const t = await ext(docs.slice(i, i + B), { pooling: "mean", normalize: true });
  out.set(t.data, i * 384);
  if (i % 320 === 0) console.log(`${i}/${docs.length}`);
}
writeFileSync("src/data/policies.emb", Buffer.from(out.buffer));
console.log(`done ${docs.length} x 384 (${MODEL})`);
