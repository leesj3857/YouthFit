import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

export const metadata: Metadata = { title: "이용안내·개인정보 처리방침 — 청핏" };

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "청핏은 이런 서비스예요",
    body: [
      "청핏은 온통청년(한국고용정보원)의 청년정책 공고와 금융감독원 금융상품통합비교공시의 적금 정보를 AI로 정리해, 입력하신 상황에 맞는 정책과 상품을 안내하는 정보 서비스예요.",
      "추천 결과는 공고·공시 내용을 바탕으로 한 참고 정보예요. 실제 지원 자격과 금액은 각 운영 기관의 심사로 결정되고, 금리와 가입 조건은 가입 시점에 금융회사에서 다시 확인해야 해요.",
      "청핏은 특정 금융상품의 가입을 권유하거나 중개·자문하지 않아요. 공시된 정보를 비교해 보여드릴 뿐이에요.",
      "정책 공고 원문을 AI가 요약·분류하는 과정에서 오류가 있을 수 있어요. 상세 화면의 '공고 원문' 문장과 공식 사이트를 꼭 함께 확인해주세요.",
    ],
  },
  {
    title: "어떤 정보를 어떻게 다루나요",
    body: [
      "회원가입·로그인이 없고, 이름·연락처·주민등록번호 같은 식별 정보를 받지 않아요. 대화창에 민감한 개인정보를 입력하지 말아주세요.",
      "대화 내용(입력한 문장과 선택한 답)은 추천을 만들기 위해 AI 모델 제공사(Anthropic)의 API로 전송되어 처리돼요. 청핏 서버에는 대화 내용을 저장하지 않아요. Anthropic의 데이터 처리는 Anthropic 개인정보 처리방침을 따라요.",
      "대화 내용은 이용 중인 브라우저의 세션 저장소에만 보관돼요(상세 화면을 다녀와도 대화를 이어가기 위해서예요). 탭을 닫으면 지워지고, '새로 찾기'를 누르면 바로 지워져요.",
      "과도한 이용을 막기 위해 접속 IP를 원문이 아닌 암호화된 값(해시)으로 바꿔 하루 동안만 이용 횟수를 세요.",
      "추천 결과에 👍/👎 평가를 남기면 평가, 선택한 이유, 추천된 항목 번호, 나이대·지역·상황·관심 분야 요약을 서비스 개선을 위해 최대 1년간 보관해요. 입력한 문장 원문은 포함되지 않아요.",
      "쿠키나 광고·추적 도구는 쓰지 않아요.",
    ],
  },
  {
    title: "데이터 출처",
    body: [
      "청년정책: 온통청년 Open API (한국고용정보원) — 원문은 각 정책 상세 화면의 '온통청년 원문' 링크에서 볼 수 있어요.",
      "적금: 금융감독원 금융상품통합비교공시 Open API — 공시 기준월은 상품 상세 화면에 표시돼요.",
      "정책 데이터는 매일 자동으로 갱신하고, 마감일이 지난 정책은 추천에서 제외해요.",
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
        <p className="mt-2 text-[14px] text-grey-500">시행일 2026년 10월 28일 · 2026-2 산학캡스톤디자인 프로젝트(팀 취뽀)</p>
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
