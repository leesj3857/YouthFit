import "server-only";
import type { Policy, PolicyResult } from "@/lib/policy";

const ENDPOINT = "https://www.youthcenter.go.kr/go/ythip/getPlcy";

export interface PolicyQuery {
  page?: number;
  size?: number;
  /** plcyKywdNm — 정책 키워드 검색 */
  keyword?: string;
  /** plcyNm — 정책명 검색 */
  name?: string;
  /** lclsfNm — 대분류 (일자리/주거/교육/복지문화/참여권리) */
  category?: string;
  /** zipCd — 법정동 코드(시군구 5자리) */
  zipCd?: string;
  /** 캐시 초 (기본 5분). 0이면 매번 새로 호출 */
  revalidate?: number;
}

interface RawResponse {
  resultCode: number;
  resultMessage: string;
  result?: {
    pagging: { totCount: number; pageNum: number; pageSize: number };
    youthPolicyList: Policy[];
  };
}

/**
 * 온통청년 청년정책 목록 API 호출.
 * 서버 컴포넌트/Route Handler에서만 사용 (키 노출 방지).
 */
export async function fetchPolicies(q: PolicyQuery = {}): Promise<PolicyResult> {
  const apiKey = process.env.YOUTHCENTER_API_KEY ?? "";
  const params = new URLSearchParams({
    apiKeyNm: apiKey,
    pageNum: String(q.page ?? 1),
    pageSize: String(q.size ?? 10),
    rtnType: "json",
  });
  if (q.keyword) params.set("plcyKywdNm", q.keyword);
  if (q.name) params.set("plcyNm", q.name);
  if (q.category) params.set("lclsfNm", q.category);
  if (q.zipCd) params.set("zipCd", q.zipCd);

  const url = `${ENDPOINT}?${params.toString()}`;
  const requestUrl = apiKey ? url.replace(apiKey, "••••••••") : url;
  const fetchedAt = new Date().toISOString();
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);

  if (!apiKey) {
    return {
      ok: false,
      error: "YOUTHCENTER_API_KEY가 설정되지 않았습니다. .env.local을 확인하세요.",
      elapsedMs: 0,
      fetchedAt,
      requestUrl,
    };
  }

  try {
    const res = await fetch(url, {
      next: { revalidate: q.revalidate ?? 300 },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const json = (await res.json()) as RawResponse;
    if (json.resultCode !== 200 || !json.result) {
      return {
        ok: false,
        error: `API 오류 (${json.resultCode}): ${json.resultMessage}`,
        elapsedMs: elapsed(),
        fetchedAt,
        requestUrl,
      };
    }
    return {
      ok: true,
      policies: json.result.youthPolicyList ?? [],
      total: json.result.pagging.totCount,
      page: json.result.pagging.pageNum,
      size: json.result.pagging.pageSize,
      resultCode: json.resultCode,
      resultMessage: json.resultMessage,
      elapsedMs: elapsed(),
      fetchedAt,
      requestUrl,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      elapsedMs: elapsed(),
      fetchedAt,
      requestUrl,
    };
  }
}
