import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 쿼리 임베딩용 로컬 모델(transformers.js + onnxruntime)은 번들하지 않고 node_modules에서 그대로 쓴다
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node"],
  // 정책 임베딩 파일을 API 함수 배포 번들에 포함
  outputFileTracingIncludes: { "/api/chat": ["./src/data/policies.emb"] },
};

export default nextConfig;
