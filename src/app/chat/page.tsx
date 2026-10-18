import type { Metadata } from "next";
import { ChatView } from "@/components/chat/chat-view";

export const metadata: Metadata = {
  title: "맞춤 혜택 찾기 — 청핏",
};

export default async function ChatPage(props: PageProps<"/chat">) {
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : undefined;
  return <ChatView key={q ?? "restore"} initialQuery={q || undefined} />;
}
