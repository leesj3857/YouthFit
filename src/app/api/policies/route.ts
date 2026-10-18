import { NextResponse } from "next/server";
import { fetchPolicies } from "@/lib/youthcenter";

/**
 * GET /api/policies?q=취업&category=일자리&zipCd=11110&size=5
 * q가 있으면 키워드 검색을 먼저 시도하고, 결과가 없으면 정책명 검색 → 조건만으로 재시도.
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const q = sp.get("q")?.trim() || undefined;
  const category = sp.get("category")?.trim() || undefined;
  const zipCd = sp.get("zipCd")?.trim() || undefined;
  const size = Math.min(Number(sp.get("size") ?? 5) || 5, 50);
  const page = Number(sp.get("page") ?? 1) || 1;

  const base = { category, zipCd, size, page };
  let result = await fetchPolicies({ ...base, keyword: q });
  if (result.ok && result.total === 0 && q) {
    result = await fetchPolicies({ ...base, name: q });
  }
  if (result.ok && result.total === 0 && q) {
    result = await fetchPolicies(base);
  }
  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
