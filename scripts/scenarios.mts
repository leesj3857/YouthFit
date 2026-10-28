// 페르소나 시나리오 테스트: npx tsx scripts/scenarios.ts [번호...]
// 추천된 정책이 최종 프로필 기준으로 '자격 불가'가 아닌지 자동 검사한다.
import { answer, followUp, start } from "../src/lib/rag/engine";
import { getPolicy } from "../src/lib/rag/data";
import { judge } from "../src/lib/rag/profile";
import type { AnswerValue, ChatReply, QuestionKey, Turn } from "../src/lib/rag/types";

const PERSONAS: [string, Partial<Record<QuestionKey, AnswerValue>>][] = [
  ["서울 사는 26살 취준생인데 월세 지원이랑 적금 추천해줘", { income: "0", housing: "rent", marital: "미혼", education: "대졸", household_head: true, target_group: ["none"], monthly: 30 }],
  ["부산에서 회사 다니는 31살이야. 결혼 준비 중인데 전세 대출 이자 지원 같은 거 있어?", { income: "3600", housing: "parents", marital: "미혼", household_head: false, assets: "10000", target_group: ["none"] }],
  ["광주 사는 대학생인데 자격증 응시료나 교육비 지원 받을 수 있는 거 알려줘", { age: 22, income: "0", education: "대학재학", target_group: ["none"] }],
  ["경기도 수원에서 작은 카페 창업하려는 29살인데 창업 지원금 있을까", { income: "2400", education: "대졸", target_group: ["창업자·예비창업자"] }],
  ["사회초년생인데 목돈 모으기 좋은 적금 추천해줘", { age: 25, monthly: 50, region: "경기", employment: "employed" }],
  ["나 돈 많이 벌고 싶어", { age: 24, region: "서울", employment: "unemployed", income: "0", housing: "rent", target_group: ["none"], assets: "10000", monthly: 30, benefit_type: ["any"] }],
];
/** 추천 이후 후속 대화 (페르소나 번호 → 메시지들) */
const FOLLOW: Record<number, string[]> = { 5: ["다른건 없어?", "그거 방금 너가 알려준거잖아", "현금으로 주는 지원금만 보여줘"] };

const show = (r: ChatReply) => {
  if (r.type === "text") return console.log("  (답변)", r.text.slice(0, 200).replace(/\n/g, " "));
  if (r.type === "questions") return console.log("  (역질문)", r.questions.map((q) => q.key));
  for (const p of r.policies) console.log(`   - [${p.status}] ${p.type} | ${p.name}`);
  for (const s of r.savings) console.log(`   - [적금] ${s.company} ${s.name} ${s.maxRate}%`);
};

const ids = process.argv.slice(2).map(Number);
let ok = true;
for (const [i, [text, auto]] of PERSONAS.entries()) {
  if (ids.length && !ids.includes(i)) continue;
  const t0 = Date.now();
  let { state, reply } = await start(text);
  const rounds: string[][] = [];
  while (reply.type === "questions") {
    rounds.push(reply.questions.map((q) => `${q.key}(${q.affects ?? "-"})`));
    ({ state, reply } = await answer(state, Object.fromEntries(reply.questions.map((q) => [q.key, auto[q.key] ?? "skip"]))));
  }
  if (reply.type !== "result") { console.log(text, reply); continue; }
  const bad = reply.policies.filter((p) => judge(getPolicy(p.id)!, state.profile).status === "fail");
  ok &&= bad.length === 0;
  console.log(`\n### ${text}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  console.log("역질문:", JSON.stringify(rounds));
  console.log("요약:", reply.summary);
  for (const p of reply.policies) console.log(` - [${p.status}] ${p.type} | ${p.name} | ${p.org} | ${p.checks.map((c) => `${c.text}${c.status === "pass" ? "✓" : "?"}`).join(", ")}\n     → ${p.reason}`);
  for (const s of reply.savings) console.log(` - [적금] ${s.company} ${s.name} ${s.maxRate}% → ${s.reason}`);
  console.log("자격 불가 포함:", bad.length ? bad.map((b) => b.name) : "없음");
  const hist: Turn[] = [{ role: "user", text }, { role: "assistant", text: reply.summary }];
  for (const m of FOLLOW[i] ?? []) {
    let r: ChatReply;
    ({ state, reply: r } = await followUp(state, m, hist));
    while (r.type === "questions") ({ state, reply: r } = await answer(state, Object.fromEntries(r.questions.map((q) => [q.key, auto[q.key] ?? "skip"]))));
    console.log(`\n  > ${m}`); show(r);
    hist.push({ role: "user", text: m }, { role: "assistant", text: r.type === "text" ? r.text : r.type === "result" ? r.summary : "" });
  }
}
console.log(ok ? "\n통과" : "\n실패");
