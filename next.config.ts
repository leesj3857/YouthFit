import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 정책 임베딩 파일을 API 함수 배포 번들에 포함
  outputFileTracingIncludes: { "/api/chat": ["./src/data/policies.emb", "./src/data/policies.emb.json"] },
};

export default nextConfig;
