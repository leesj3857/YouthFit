import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

export const metadata: Metadata = { title: "이용안내·개인정보 처리방침 — 청핏" };

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "청핏은 이런 서비스예요",
    body: [
      "청핏은 온통청년(한국고용정보원)의 청년정책 공고를 바탕으로, 입력하신 상황에 맞는 정책을 안내하는 정보 서비스예요.",
      "추천 결과는 공고 내용을 바탕으로 한 참고 정보예요. 실제 지원 자격과 금액은 각 운영 기관의 심사로 결정돼요.",
      "추천 이유와 '신청 전에 확인하세요' 문구는 AI가 정리한 설명이라 오류가 있을 수 있어요. 링크와 신청 기간은 공고에 등록된 값을 그대로 보여드리니, 공식 사이트에서 꼭 함께 확인해주세요.",
    ],
  },
  {
    title: "어떤 정보를 어떻게 다루나요",
    body: [
      "회원가입·로그인이 없고, 이름·연락처·주민등록번호 같은 식별 정보를 받지 않아요. 대화창에 민감한 개인정보를 입력하지 말아주세요.",
      "입력한 문장과 선택한 답은 추천을 만들기 위해 청핏 서버로 전송되고, 추천 이유를 정리하는 과정에서 AI 모델로 처리될 수 있어요.",
      "대화 한 건(세션)은 24시간 동안 유효하고, 입력한 문장과 답은 서비스 품질 분석을 위해 최대 약 30일간 보관될 수 있어요.",
      "대화 화면은 이용 중인 브라우저의 세션 저장소에도 보관돼요(새로고침해도 대화를 이어가기 위해서예요). 탭을 닫으면 지워지고, '새로 찾기'를 누르면 바로 지워져요.",
      "과도한 이용을 막기 위해 접속 IP를 기준으로 일정 시간 동안의 요청 횟수를 제한해요.",
      "추천 결과에 👍/👎 평가를 남기면 평가, 선택한 이유, 추천된 정책 번호, 나이대·지역·상황·관심 분야 요약을 서비스 개선을 위해 최대 1년간 보관해요. 입력한 문장 원문은 포함되지 않아요.",
      "쿠키나 광고·추적 도구는 쓰지 않아요.",
    ],
  },
  {
    title: "데이터 출처",
    body: [
      "청년정책: 온통청년 Open API (한국고용정보원) — 각 추천 카드의 링크에서 공식 페이지를 볼 수 있어요.",
      "정책 데이터는 매일 자동으로 갱신하고, 신청이 마감된 정책은 추천에서 제외해요.",
    ],
  },
  {
    title: "문의",
    body: ["잘못된 정보나 개선 의견은 GitHub 저장소(github.com/leesj3857/YouthFit)의 Issues로 알려주세요."],
  },
];

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-[720px] px-5 py-12">
        <h1 className="text-[26px] font-bold tracking-tight text-grey-900">이용안내·개인정보 처리방침</h1>
        <p className="mt-2 text-[14px] text-grey-500">시행일 2026년 11월 16일 · 2026-2 산학캡스톤디자인 프로젝트(팀 취뽀)</p>
        {SECTIONS.map((s) => (
          <section key={s.title} className="mt-10">
            <h2 className="text-[19px] font-bold text-grey-900">{s.title}</h2>
            <ul className="mt-3 space-y-2.5">
              {s.body.map((b) => (
                <li key={b} className="text-[15px] leading-[1.75] text-grey-700 before:mr-2 before:text-grey-400 before:content-['•']">
                  {b}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
      <SiteFooter />
    </>
  );
}
