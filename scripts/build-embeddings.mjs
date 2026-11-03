// 정책 검색용 임베딩 생성 (Voyage AI): VOYAGE_API_KEY=... node scripts/build-embeddings.mjs
// src/data/policies.json 순서대로 float32 벡터를 src/data/policies.emb 에, 모델 정보를 policies.emb.json 에 저장한다.
import { readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const MODEL = "voyage-4-lite";
const DIM = 512;
const KEY = process.env.VOYAGE_API_KEY ?? (existsSync(".env.local") && readFileSync(".env.local", "utf8").match(/^VOYAGE_API_KEY=(.+)$/m)?.[1]?.trim());
if (!KEY) throw new Error("VOYAGE_API_KEY가 필요해요 (.env.local 또는 환경변수)");

const pols = JSON.parse(readFileSync("src/data/policies.json", "utf8"));
const docs = pols.map((p) => `${p.name}. ${p.summary ?? p.benefit ?? ""} 분야: ${p.domains.join(", ")}`);
const out = new Float32Array(docs.length * DIM);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function embed(batch, attempt = 0) {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ input: batch, model: MODEL, input_type: "document", output_dimension: DIM }),
  });
  if (res.status === 429 && attempt < 40) {
    // 요청 한도 초과 (결제수단 미등록 계정은 분당 3회·1만 토큰) → 잠시 기다렸다 재시도
    if (attempt === 0) console.log("  요청 한도에 걸려 기다리는 중…");
    await sleep(21_000);
    return embed(batch, attempt + 1);
  }
  if (!res.ok) throw new Error(`Voyage ${res.status}: ${await res.text()}`);
  return (await res.json()).data.map((d) => d.embedding);
}

// 중간에 끊겨도 이어서 만들 수 있게 진행 상황을 임시 파일에 저장
const CK = path.join(tmpdir(), `youthfit-emb-${docs.length}-${DIM}.bin`);
let start = 0;
if (existsSync(CK)) {
  const prev = new Float32Array(readFileSync(CK).buffer.slice(0));
  out.set(prev.subarray(0, out.length));
  start = Number(readFileSync(`${CK}.n`, "utf8")) || 0;
  console.log(`이어서 시작: ${start}/${docs.length}`);
}
const B = 40;
for (let i = start; i < docs.length; i += B) {
  const vecs = await embed(docs.slice(i, i + B));
  vecs.forEach((v, k) => out.set(v, (i + k) * DIM));
  writeFileSync(CK, Buffer.from(out.buffer));
  writeFileSync(`${CK}.n`, String(Math.min(i + B, docs.length)));
  console.log(`${Math.min(i + B, docs.length)}/${docs.length}`);
}
writeFileSync("src/data/policies.emb", Buffer.from(out.buffer));
writeFileSync("src/data/policies.emb.json", JSON.stringify({ provider: "voyage", model: MODEL, dim: DIM, count: docs.length }));
rmSync(CK, { force: true });
rmSync(`${CK}.n`, { force: true });
console.log(`done ${docs.length} x ${DIM} (${MODEL})`);
