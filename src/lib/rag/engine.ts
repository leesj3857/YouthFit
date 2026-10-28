/** 추천 세션 (stateless): 상태는 클라이언트가 보관하고 매 요청에 함께 보낸다.
 *  자연어 → 의도 파싱 → 하이브리드 검색 + 규칙 기반 자격 판정 → 역질문(정보이득) → LLM 순위·이유 */
import { getPolicy, getSaving, isExpired, POLICIES, SAVINGS } from "./data";
import { answerQuestion, parseIntent, recommendLLM, type Intent } from "./llm";
import { applyAnswer, judge, makeQuestion, RESTRICTIVE } from "./profile";
import { searchPolicies } from "./search";
import type { AnswerValue, ChatReply, ChatState, Check, PolicyRecord, Profile, Question, QuestionKey, RecPolicy, RecSaving, SavingRecord } from "./types";

const MAX_ROUNDS = 2;
const MAX_Q = 3;
const TOP_K = 40;
const SAVING_TERM = 12;

type Cand = { p: PolicyRecord; status: "pass" | "unknown"; checks: Check[] };

export const emptyProfile = (): Profile => ({ asked: [], skipped: [] });

function mergeIntent(state: ChatState, it: Intent): ChatState {
  const p: Profile = { ...state.profile };
  if (it.age != null) p.age = it.age;
  if (it.sido) p.sido = it.sido;
  if (it.sigungu) p.sigungu = it.sigungu;
  if (it.employment) p.employment = it.employment;
  if (it.education) p.education = it.education;
  if (it.marital) p.marital = it.marital;
  if (it.housing) { p.housing = it.housing; p.homeless = it.housing !== "own"; }
  if (it.target_groups?.length) p.targetGroups = [...new Set([...(p.targetGroups ?? []), ...it.target_groups])];
  if (it.monthly_saving_manwon != null) p.monthlySaving = it.monthly_saving_manwon;
  let profile = p;
  if (it.annual_income_manwon != null) profile = { ...applyAnswer(p, "income", it.annual_income_manwon), asked: p.asked };
  return {
    ...state, profile,
    query: [state.query, it.search_query].filter(Boolean).join(" "),
    domains: [...new Set([...state.domains, ...(it.domains ?? [])])],
    wantPolicies: state.wantPolicies || it.want_policies,
    wantSavings: state.wantSavings || it.want_savings,
  };
}

export async function start(text: string): Promise<{ state: ChatState; reply: ChatReply }> {
  const it = await parseIntent(text);
  const base: ChatState = { profile: emptyProfile(), query: "", domains: [], wantPolicies: false, wantSavings: false, round: 0 };
  const state = mergeIntent(base, it);
  if (!state.wantPolicies && !state.wantSavings) state.wantPolicies = true;
  if (!state.query) state.query = text;
  return step(state);
}

export async function answer(state: ChatState, answers: Partial<Record<QuestionKey, AnswerValue | null>>, text?: string) {
  let s = state;
  if (text?.trim()) s = mergeIntent({ ...s, query: s.query }, await parseIntent(text));
  let profile = s.profile;
  for (const [k, v] of Object.entries(answers)) profile = applyAnswer(profile, k as QuestionKey, v ?? null);
  return step({ ...s, profile });
}

async function candidates(state: ChatState): Promise<Cand[]> {
  if (!state.wantPolicies) return [];
  const out: Cand[] = [];
  for (const { i } of await searchPolicies(state.query, state.domains)) {
    const p = POLICIES[i];
    if (!p.applicable || isExpired(p)) continue;
    const j = judge(p, state.profile);
    if (j.status !== "fail") out.push({ p, status: j.status, checks: j.checks });
  }
  return out;
}

function nextQuestions(cands: Cand[], state: ChatState): Question[] {
  const p = state.profile;
  const done = new Set<QuestionKey>([...p.asked, ...p.skipped]);
  const weight = new Map<QuestionKey, number>(), affects = new Map<QuestionKey, number>(), groups = new Map<string, number>(), sggs = new Map<string, number>();
  cands.slice(0, TOP_K).forEach((c, r) => {
    for (const ch of c.checks) {
      if (ch.status !== "unknown" || done.has(ch.key)) continue;
      weight.set(ch.key, (weight.get(ch.key) ?? 0) + 1 / (1 + r / 10));   // 상위 후보일수록 가중
      affects.set(ch.key, (affects.get(ch.key) ?? 0) + 1);
      if (ch.key === "target_group") for (const g of ch.text.split("·")) if (RESTRICTIVE.has(g)) groups.set(g, (groups.get(g) ?? 0) + 1);
      if (ch.key === "sigungu") for (const g of c.p.sigungus ?? []) if (g !== "일부 시·군·구") sggs.set(g, (sggs.get(g) ?? 0) + 1);
    }
  });
  if (!sggs.size) weight.delete("sigungu");
  const qs: Question[] = [...weight].filter(([, w]) => w >= 1).sort((a, b) => b[1] - a[1]).slice(0, MAX_Q).map(([key]) => {
    if (key === "sigungu") {
      const opts = [...sggs].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([g]) => ({ value: g, label: g }));
      return makeQuestion(key, { affects: affects.get(key), widget: { type: "single", layout: "chips", options: [...opts, { value: "기타", label: "그 외 지역" }] } });
    }
    if (key !== "target_group") return makeQuestion(key, { affects: affects.get(key) });
    const opts = [...groups].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([g]) => ({ value: g, label: g }));
    return makeQuestion(key, { affects: affects.get(key), widget: { type: "multi", options: [...opts, { value: "none", label: "해당 없음" }] } });
  });
  if (state.wantSavings) {
    if (p.age == null && !done.has("age") && !qs.some((q) => q.key === "age")) qs.unshift(makeQuestion("age"));
    if (p.monthlySaving == null && !done.has("monthly") && qs.length < MAX_Q + 1) qs.push(makeQuestion("monthly"));
  }
  return qs;
}

/** 같은 사업이 두 번 등록된 경우(이름이 거의 같음)를 걸러내기 위한 2-gram 유사도 */
function similar(a: string, b: string) {
  const g = (s: string) => {
    const t = s.replace(/[^가-힣A-Za-z0-9]/g, "").replace(/20\d\d년?/g, "");
    return new Set(Array.from({ length: Math.max(t.length - 1, 0) }, (_, i) => t.slice(i, i + 2)));
  };
  const A = g(a), B = g(b);
  const inter = [...A].filter((x) => B.has(x)).length;
  return inter / Math.max(1, Math.min(A.size, B.size)) >= 0.8;
}

const EMP: Record<string, string> = { unemployed: "취업 준비 중", employed: "재직 중", student: "학생", self_employed: "창업·자영업" };
export function profileLine(p: Profile) {
  return [p.sido && `${p.sido}${p.sigungu ? ` ${p.sigungu}` : ""}`, p.age != null && `만 ${p.age}세`, p.employment && EMP[p.employment]].filter(Boolean).join(" · ");
}

function intro(state: ChatState, count: number) {
  const who = profileLine(state.profile);
  const what = state.domains.length ? `${state.domains.slice(0, 2).join(", ")} 관련 혜택` : "받을 수 있는 혜택";
  if (state.round === 1)
    return `${who ? `**${who}**인 분께 맞는 ` : ""}${what}${state.wantSavings ? "과 예적금" : ""}을 찾고 있어요. 지금 조건으로 정책 후보가 **${count}건**이에요.\n자격을 정확히 따지려면 몇 가지만 여쭤볼게요.`;
  return `반영했어요. 후보가 **${count}건**으로 좁혀졌어요. 조금만 더 여쭤볼게요.`;
}

async function step(state: ChatState): Promise<{ state: ChatState; reply: ChatReply }> {
  const cands = await candidates(state);
  if (state.round < MAX_ROUNDS) {
    const qs = nextQuestions(cands, state);
    if (qs.length) {
      const s = { ...state, round: state.round + 1 };
      return { state: s, reply: { type: "questions", intro: intro(s, cands.length), questions: qs, candidateCount: cands.length } };
    }
  }
  return { state, reply: await recommend(state, cands) };
}

function eligibleSavings(p: Profile): (SavingRecord & { best: SavingRecord["options"][number] })[] {
  const monthlyWon = (p.monthlySaving ?? 0) * 10000;
  return SAVINGS.filter((s) => !s.age || p.age == null || (p.age >= s.age[0] && p.age <= s.age[1]))
    .filter((s) => !s.maxLimit || !monthlyWon || s.maxLimit >= monthlyWon || s.maxLimit < 100000)
    .map((s) => {
      const opts = s.options.filter((o) => o.term === SAVING_TERM);
      const best = (opts.length ? opts : s.options).reduce((a, b) => (b.max > a.max ? b : a));
      return { ...s, best };
    })
    .sort((a, b) => Number(b.youth) - Number(a.youth) || b.best.max - a.best.max)
    .slice(0, 8);
}

async function recommend(state: ChatState, cands: Cand[]): Promise<ChatReply> {
  const order = { pass: 0, unknown: 1 };
  const top = cands.slice(0, TOP_K)
    .map((c, r) => ({ c, r }))
    .sort((a, b) => order[a.c.status] - order[b.c.status] || a.c.checks.filter((x) => x.status === "unknown").length - b.c.checks.filter((x) => x.status === "unknown").length || a.r - b.r)
    .map(({ c }) => c)
    .filter((c, i, arr) => !arr.slice(0, i).some((d) => similar(d.p.name, c.p.name)))
    .slice(0, 12);
  const savs = state.wantSavings ? eligibleSavings(state.profile) : [];
  const cards = [
    ...top.map((c) => ({ id: c.p.id, kind: "정책", name: c.p.name, org: c.p.org, benefit: c.p.benefit, status: c.status,
      conditions: c.checks.map((x) => `${x.text}:${x.status}`), extra_requirements: c.p.extra.slice(0, 5), exclusions: c.p.exclusions.slice(0, 4),
      apply_end: c.p.applyEnd, first_come: c.p.firstCome })),
    ...savs.map((s) => ({ id: s.id, kind: "적금", name: s.name, company: s.company, youth: s.youth,
      rate: `${s.best.term}개월 최고 ${s.best.max}% (기본 ${s.best.base}%)`, join_member: s.joinMember.slice(0, 120),
      special_condition: (s.special ?? "").slice(0, 300), max_limit_won: s.maxLimit })),
  ];
  if (!cards.length) return { type: "result", summary: "지금 조건으로는 맞는 결과를 찾지 못했어요. 조건을 바꿔서 다시 찾아볼까요?", policies: [], savings: [], candidateCount: 0 };

  const userView = { ...state.profile, asked: undefined, skipped: undefined };
  let rec;
  try {
    rec = await recommendLLM({ 요청: state.query, 사용자: userView, 후보: cards });
  } catch {
    rec = { summary: `**${profileLine(state.profile) || "입력하신 조건"}** 기준으로 자격 조건을 대조해 골랐어요.`,
      policies: top.slice(0, 6).map((c) => ({ id: c.p.id, reason: "입력하신 조건에 맞는 후보예요.", caution: null })), savings: [] };
  }
  const byP = new Map(top.map((c) => [c.p.id, c])), byS = new Map(savs.map((s) => [s.id, s]));
  const policies: RecPolicy[] = [], savings: RecSaving[] = [];
  for (const it of [...(rec.policies ?? []), ...(rec.savings ?? [])]) {
    const c = byP.get(it.id), s = byS.get(it.id);
    if (c && policies.length < 6) policies.push({
      id: c.p.id, name: c.p.name, org: c.p.org ?? "", interest: c.p.interest, type: c.p.type,
      benefit: c.p.benefit, benefitAmount: c.p.benefitAmount, applyEnd: c.p.applyEnd, alwaysOpen: c.p.alwaysOpen, firstCome: c.p.firstCome,
      status: c.status, checks: c.checks, reason: it.reason, caution: it.caution,
    });
    else if (s && savings.length < 3) savings.push({
      id: s.id, name: s.name, company: s.company, bank: s.bank, youth: s.youth, term: s.best.term,
      baseRate: s.best.base, maxRate: s.best.max, reserveType: s.best.type, reason: it.reason, caution: it.caution,
    });
  }
  // LLM이 적금을 빠뜨리면 금리 순 상위 상품으로 채운다
  for (const s of savs) {
    if (!state.wantSavings || savings.length >= Math.min(3, savs.length) || savings.some((x) => x.id === s.id)) continue;
    savings.push({ id: s.id, name: s.name, company: s.company, bank: s.bank, youth: s.youth, term: s.best.term,
      baseRate: s.best.base, maxRate: s.best.max, reserveType: s.best.type,
      reason: `${s.best.term}개월 기준 최고 연 ${s.best.max}%로 금리가 높은 편이에요.`, caution: "우대금리 조건을 모두 채워야 최고 금리를 받을 수 있어요." });
  }
  return { type: "result", summary: rec.summary, policies, savings, candidateCount: cands.length, monthly: state.profile.monthlySaving };
}

/** 추천 이후 자유 질문: 추천된 항목들의 원문을 근거로 답변 */
export async function ask(state: ChatState, question: string, ids: string[]) {
  const docs = ids.map((id) => {
    const p = getPolicy(id);
    if (p) return { 종류: "정책", 이름: p.name, 기관: p.org, 요약: p.summary, 혜택: p.benefit, 신청기간: [p.applyStart, p.applyEnd],
      상시: p.alwaysOpen, 선착순: p.firstCome, 신청방법: p.detail.applyMethod, 신청채널: p.channels, 서류: p.detail.documents,
      심사: p.detail.screening, 지원내용: p.detail.support, 기타요건: p.extra, 제외대상: p.exclusions, 근거: p.evidence, 링크: p.url };
    const s = getSaving(id);
    if (s) return { 종류: "적금", 이름: s.name, 회사: s.company, 가입대상: s.joinMember, 가입방법: s.joinWay, 우대조건: s.special,
      유의사항: s.note, 월한도_원: s.maxLimit, 금리: s.options };
    return null;
  }).filter(Boolean);
  return answerQuestion(question, { ...state.profile, asked: undefined, skipped: undefined }, docs);
}
