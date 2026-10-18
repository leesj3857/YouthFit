import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { ChatComposer } from "@/components/chat/chat-composer";

export default function Home() {
  return (
    <>
      <SiteHeader />

      {/* ---------- 히어로 + 질문 입력 ---------- */}
      <main className="flex flex-1 items-center">
        <div className="mx-auto w-full max-w-2xl px-5 py-16 sm:py-24">
          <ChatComposer />
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
