import { NextResponse } from "next/server";
import { answer, ask, start } from "@/lib/rag/engine";
import { warmup } from "@/lib/rag/search";
import type { AnswerValue, ChatState, QuestionKey } from "@/lib/rag/types";

export const runtime = "nodejs";
export const maxDuration = 60;
warmup();

type Body =
  | { action: "start"; text: string }
  | { action: "answer"; state: ChatState; answers: Partial<Record<QuestionKey, AnswerValue | null>>; text?: string }
  | { action: "ask"; state: ChatState; question: string; ids: string[] };

/** POST /api/chat — 청핏 RAG 대화 (상태는 클라이언트가 보관) */
export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "서버에 ANTHROPIC_API_KEY가 설정되지 않았어요." }, { status: 500 });
  }
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  try {
    if (body.action === "start" && body.text?.trim()) return NextResponse.json(await start(body.text.slice(0, 500)));
    if (body.action === "answer" && body.state) return NextResponse.json(await answer(body.state, body.answers ?? {}, body.text?.slice(0, 500)));
    if (body.action === "ask" && body.state && body.question?.trim())
      return NextResponse.json({ text: await ask(body.state, body.question.slice(0, 500), (body.ids ?? []).slice(0, 10)) });
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  } catch (e) {
    console.error("[api/chat]", e);
    return NextResponse.json({ error: "추천을 만드는 중 문제가 생겼어요. 잠시 후 다시 시도해주세요." }, { status: 502 });
  }
}
