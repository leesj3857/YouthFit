/**
 * 추천 결과·상세 페이지에서 쓰는 정책/예적금 카탈로그.
 * 중간점검용 샘플 데이터 — 백엔드(RAG + 온통청년/금융감독원 API) 연동 시 이 모듈을 API 호출로 교체.
 * 금액·금리·조건은 화면 확인용 예시 값이며 실제 공고와 다를 수 있음.
 */

export type Interest = "housing" | "job" | "asset" | "edu" | "life";

export const INTEREST_LABEL: Record<Interest, string> = {
  housing: "주거·월세",
  job: "일자리·취업",
  asset: "목돈 마련",
  edu: "교육·자격증",
  life: "생활·교통비",
};

export type Region = "서울" | "경기" | "인천" | "부산" | "대구" | "광주" | "대전" | "기타";
export type JobStatus = "seeker" | "worker" | "student" | "self" | "etc";

export interface CatalogPolicy {
  id: string;
  name: string;
  org: string;
  interest: Interest;
  /** 한 줄 요약 (목록용) */
  headline: string;
  /** 큰 숫자로 보여줄 혜택 (예: "월 최대 20만원") */
  benefit: string;
  /** 연간 환산 혜택(만원) — 추천 합계 계산용 */
  yearlyValue: number;
  status: "접수중" | "상시" | "마감임박";
  period: string;
  ageMin: number;
  ageMax: number;
  /** 지정 시 해당 지역 거주자만 */
  region?: Region;
  /** 지정 시 해당 상태일 때만 */
  jobStatus?: JobStatus[];
  /** 무주택·독립 가구 조건 */
  needsIndependent?: boolean;
  description: string;
  targets: string[];
  benefits: string[];
  steps: { title: string; desc: string }[];
  documents: string[];
  contact: string;
  applyUrl: string;
}

export interface CatalogProduct {
  id: string;
  name: string;
  bank: string;
  kind: "적금" | "예금" | "청약";
  baseRate: number;
  maxRate: number;
  termMonths: number;
  /** 월 납입 한도(만원), 예금이면 최소 가입금액 */
  monthlyMax: number;
  ageMin: number;
  ageMax: number;
  headline: string;
  description: string;
  perks: { label: string; rate: number }[];
  extras: string[];
  notes: string[];
  /** 정부 기여금 등 이자 외 혜택(월, 만원) */
  govMatchMonthly?: number;
  url: string;
}

export const POLICIES: CatalogPolicy[] = [
  {
    id: "youth-rent",
    name: "청년월세 특별지원",
    org: "국토교통부",
    interest: "housing",
    headline: "독립해서 사는 청년에게 월세를 매달 지원해요",
    benefit: "월 최대 20만원",
    yearlyValue: 240,
    status: "접수중",
    period: "2026.03.02 – 2026.12.31",
    ageMin: 19,
    ageMax: 34,
    needsIndependent: true,
    description:
      "부모님과 따로 사는 무주택 청년의 주거비 부담을 덜어주기 위해 실제 내는 월세를 최대 24개월 동안 지원하는 사업이에요.",
    targets: [
      "만 19~34세 무주택 청년",
      "부모님과 따로 거주 중인 청년 (주민등록 분리)",
      "청년가구 기준 중위소득 60% 이하",
      "원가구 기준 중위소득 100% 이하",
    ],
    benefits: ["실제 납부 월세 범위 안에서 월 최대 20만원", "최대 24개월 분할 지급"],
    steps: [
      { title: "복지로 또는 주민센터 신청", desc: "온라인은 복지로, 방문은 주소지 행정복지센터에서 신청해요." },
      { title: "소득·재산 조사", desc: "신청 후 약 30일 동안 가구 소득과 재산을 확인해요." },
      { title: "결과 통보 후 매월 지급", desc: "선정되면 신청한 다음 달부터 매월 계좌로 들어와요." },
    ],
    documents: ["임대차계약서 사본", "월세 이체 내역 (최근 3개월)", "가족관계증명서"],
    contact: "마이홈 콜센터 1600-1004",
    applyUrl: "https://www.bokjiro.go.kr",
  },
  {
    id: "seoul-youth-allowance",
    name: "서울 청년수당",
    org: "서울특별시",
    interest: "job",
    headline: "구직 중인 서울 청년에게 활동비를 드려요",
    benefit: "월 50만원 × 6개월",
    yearlyValue: 300,
    status: "마감임박",
    period: "2026.10.01 – 2026.10.24",
    ageMin: 19,
    ageMax: 34,
    region: "서울",
    jobStatus: ["seeker", "etc"],
    description:
      "서울에 사는 미취업 청년이 구직 활동에 집중할 수 있도록 매달 활동 지원금과 함께 진로 상담 프로그램을 제공해요.",
    targets: ["서울 거주 만 19~34세", "미취업자 또는 주 30시간 미만 근로자", "기준 중위소득 150% 이하"],
    benefits: ["월 50만원, 최대 6개월 (클린카드 지급)", "1:1 진로 상담·멘토링 프로그램"],
    steps: [
      { title: "청년몽땅정보통 신청", desc: "온라인으로 신청서와 활동 계획서를 작성해요." },
      { title: "자격 검증", desc: "건강보험료 기준으로 소득을 확인해요." },
      { title: "약정 후 지급 시작", desc: "참여 약정을 하면 다음 달부터 지원금이 나와요." },
    ],
    documents: ["활동 계획서", "건강보험 자격득실확인서"],
    contact: "서울청년센터 02-120",
    applyUrl: "https://youth.seoul.go.kr",
  },
  {
    id: "national-employment",
    name: "국민취업지원제도",
    org: "고용노동부",
    interest: "job",
    headline: "취업 준비 기간 동안 수당과 취업 서비스를 함께 받아요",
    benefit: "월 50만원 × 6개월",
    yearlyValue: 300,
    status: "상시",
    period: "상시 신청",
    ageMin: 18,
    ageMax: 34,
    jobStatus: ["seeker", "student", "etc"],
    description:
      "취업을 원하는 청년에게 1:1 취업 상담, 직업 훈련, 일 경험을 연결해주고 구직 활동 기간 동안 구직촉진수당을 지급해요.",
    targets: ["만 18~34세 구직자", "가구 기준 중위소득 120% 이하 (청년 특례)", "재산 합계 5억원 이하"],
    benefits: ["구직촉진수당 월 50만원 × 6개월", "취업 성공 시 최대 150만원 성공수당"],
    steps: [
      { title: "고용24 온라인 신청", desc: "본인 인증 후 신청서를 제출해요." },
      { title: "수급 자격 심사", desc: "약 한 달 안에 소득·재산 요건을 확인해요." },
      { title: "취업활동계획 수립", desc: "상담사와 함께 계획을 세우고 수당 지급이 시작돼요." },
    ],
    documents: ["신분증", "통장 사본"],
    contact: "고용노동부 고객상담센터 1350",
    applyUrl: "https://www.work24.go.kr",
  },
  {
    id: "naeil-card",
    name: "국민내일배움카드",
    org: "고용노동부",
    interest: "edu",
    headline: "자격증·직업훈련 수강료를 최대 500만원까지 지원해요",
    benefit: "최대 500만원",
    yearlyValue: 100,
    status: "상시",
    period: "상시 신청",
    ageMin: 15,
    ageMax: 75,
    description:
      "직업 능력을 키우고 싶은 누구나 카드를 발급받아 정부가 인정한 훈련 과정을 저렴하게 들을 수 있어요. 훈련비의 45~85%를 지원해요.",
    targets: ["국민 누구나 (공무원·재학생 일부 제외)", "대학 졸업 예정자 포함"],
    benefits: ["5년간 최대 500만원 훈련비", "훈련 장려금 월 최대 11.6만원"],
    steps: [
      { title: "고용24에서 카드 신청", desc: "온라인으로 신청하면 약 2주 안에 발급돼요." },
      { title: "훈련 과정 선택", desc: "고용24에서 원하는 과정을 검색하고 수강 신청해요." },
      { title: "카드로 결제", desc: "자부담금만 결제하고 나머지는 정부가 지원해요." },
    ],
    documents: ["신분증"],
    contact: "고용노동부 고객상담센터 1350",
    applyUrl: "https://www.work24.go.kr",
  },
  {
    id: "naeil-savings",
    name: "청년내일저축계좌",
    org: "보건복지부",
    interest: "asset",
    headline: "매달 10만원 저축하면 정부가 같은 금액을 더 넣어줘요",
    benefit: "3년 뒤 최대 1,440만원",
    yearlyValue: 120,
    status: "접수중",
    period: "2026.10.06 – 2026.10.31",
    ageMin: 19,
    ageMax: 34,
    jobStatus: ["worker", "self"],
    description:
      "일하는 저소득 청년이 매달 10만원을 3년간 저축하면 정부지원금 월 10~30만원을 함께 적립해 목돈 마련을 돕는 사업이에요.",
    targets: ["만 19~34세 근로·사업소득이 있는 청년", "가구 기준 중위소득 100% 이하", "월 소득 50만원 이상 250만원 이하"],
    benefits: ["본인 저축 월 10만원 + 정부 매칭 월 10만원", "기초·차상위 가구는 월 30만원 매칭"],
    steps: [
      { title: "복지로 또는 주민센터 신청", desc: "모집 기간 안에 신청해야 해요." },
      { title: "자격 확인", desc: "소득·재산 조사를 거쳐 약 2개월 뒤 결과가 나와요." },
      { title: "계좌 개설 후 저축 시작", desc: "지정 은행에서 계좌를 만들고 3년 동안 저축해요." },
    ],
    documents: ["재직증명서 또는 사업자등록증", "소득 확인 서류"],
    contact: "보건복지상담센터 129",
    applyUrl: "https://www.bokjiro.go.kr",
  },
  {
    id: "gyeonggi-basic-income",
    name: "경기도 청년기본소득",
    org: "경기도",
    interest: "life",
    headline: "경기도에 사는 만 24세 청년에게 지역화폐로 드려요",
    benefit: "연 100만원",
    yearlyValue: 100,
    status: "접수중",
    period: "2026.10.01 – 2026.12.31",
    ageMin: 24,
    ageMax: 24,
    region: "경기",
    description: "경기도에 3년 이상 살았거나 합산 10년 이상 거주한 만 24세 청년에게 분기별로 지역화폐를 지급해요.",
    targets: ["경기도 거주 만 24세 청년", "연속 3년 또는 합산 10년 이상 거주"],
    benefits: ["분기별 25만원, 연 최대 100만원 지역화폐"],
    steps: [
      { title: "경기도 일자리재단 신청", desc: "분기마다 온라인으로 신청해요." },
      { title: "거주 요건 확인", desc: "주민등록 이력으로 자동 확인해요." },
      { title: "지역화폐 지급", desc: "등록한 카드로 지역화폐가 충전돼요." },
    ],
    documents: ["주민등록초본 (자동 조회 동의 시 생략)"],
    contact: "경기도 콜센터 120",
    applyUrl: "https://apply.jobaba.net",
  },
  {
    id: "k-pass",
    name: "K-패스 청년 할인",
    org: "국토교통부",
    interest: "life",
    headline: "대중교통을 타면 쓴 금액의 30%를 돌려줘요",
    benefit: "교통비 30% 환급",
    yearlyValue: 30,
    status: "상시",
    period: "상시 신청",
    ageMin: 19,
    ageMax: 34,
    description: "한 달에 15번 이상 대중교통을 이용하면 쓴 금액의 일부를 다음 달에 돌려받는 교통카드예요. 청년은 30%를 환급받아요.",
    targets: ["만 19~34세 청년", "월 15회 이상 대중교통 이용"],
    benefits: ["대중교통비 30% 환급 (월 최대 60회)", "전국 지하철·버스·광역버스 적용"],
    steps: [
      { title: "K-패스 카드 발급", desc: "카드사 앱이나 홈페이지에서 신청해요." },
      { title: "K-패스 앱 회원가입", desc: "카드를 등록해야 환급이 시작돼요." },
      { title: "다음 달 자동 환급", desc: "카드 포인트나 청구 할인으로 돌려받아요." },
    ],
    documents: ["없음"],
    contact: "K-패스 고객센터 1544-7766",
    applyUrl: "https://korea-pass.kr",
  },
  {
    id: "beotimmok",
    name: "청년전용 버팀목 전세자금대출",
    org: "주택도시기금",
    interest: "housing",
    headline: "전세 보증금을 연 2%대 낮은 금리로 빌려줘요",
    benefit: "최대 2억원 · 연 2.2%~",
    yearlyValue: 80,
    status: "상시",
    period: "상시 신청",
    ageMin: 19,
    ageMax: 34,
    needsIndependent: true,
    description: "무주택 청년이 전셋집을 구할 때 시중보다 낮은 금리로 보증금을 빌릴 수 있는 정책 대출이에요.",
    targets: ["만 19~34세 무주택 세대주 (예비 포함)", "연소득 5천만원 이하", "순자산 3.45억원 이하"],
    benefits: ["보증금의 80% 이내 최대 2억원", "연 2.2~3.3% 금리 (소득 구간별)"],
    steps: [
      { title: "기금e든든 자격 확인", desc: "온라인으로 대출 가능 여부를 먼저 확인해요." },
      { title: "수탁은행 방문 신청", desc: "계약서를 들고 은행에서 신청해요." },
      { title: "심사 후 실행", desc: "잔금일에 맞춰 대출이 실행돼요." },
    ],
    documents: ["임대차계약서", "소득 증빙 서류", "주민등록등본"],
    contact: "주택도시보증공사 1566-9009",
    applyUrl: "https://enhuf.molit.go.kr",
  },
];

export const PRODUCTS: CatalogProduct[] = [
  {
    id: "doyak",
    name: "청년도약계좌",
    bank: "서민금융진흥원",
    kind: "적금",
    baseRate: 4.5,
    maxRate: 6.0,
    termMonths: 60,
    monthlyMax: 70,
    ageMin: 19,
    ageMax: 34,
    headline: "5년 동안 모으면 정부 기여금에 비과세까지",
    description:
      "매달 최대 70만원을 5년 동안 자유롭게 넣으면 은행 이자와 함께 정부 기여금을 받을 수 있는 청년 전용 자산형성 상품이에요.",
    perks: [
      { label: "급여 이체 실적", rate: 0.6 },
      { label: "카드 결제 실적", rate: 0.3 },
      { label: "첫 거래 고객", rate: 0.3 },
      { label: "소득 플러스 우대", rate: 0.3 },
    ],
    extras: ["정부 기여금 월 최대 3.3만원", "이자소득 비과세"],
    notes: ["개인소득 7,500만원 이하, 가구소득 중위 250% 이하", "중도 해지 시 기여금과 비과세 혜택이 사라질 수 있어요"],
    govMatchMonthly: 2.4,
    url: "https://ylaccount.kinfa.or.kr",
  },
  {
    id: "dream-subscription",
    name: "청년주택드림 청약통장",
    bank: "주택도시기금",
    kind: "청약",
    baseRate: 2.8,
    maxRate: 4.5,
    termMonths: 24,
    monthlyMax: 100,
    ageMin: 19,
    ageMax: 34,
    headline: "청약 자격도 챙기고 일반 청약보다 높은 금리로",
    description: "내 집 마련을 준비하는 무주택 청년을 위한 청약통장이에요. 당첨되면 분양가의 최대 80%까지 저금리 대출로 이어져요.",
    perks: [{ label: "청년 우대 (가입 후 2년 이상 유지)", rate: 1.7 }],
    extras: ["연 납입액 40% 소득공제 (최대 300만원)", "당첨 시 연 2%대 청년주택드림 대출 연계"],
    notes: ["연소득 5천만원 이하 무주택자", "우대금리는 최대 10년, 원금 5천만원까지 적용돼요"],
    url: "https://nhuf.molit.go.kr",
  },
  {
    id: "hana-young-plus",
    name: "청년 희망플러스 적금",
    bank: "하나은행",
    kind: "적금",
    baseRate: 3.0,
    maxRate: 5.5,
    termMonths: 12,
    monthlyMax: 50,
    ageMin: 19,
    ageMax: 34,
    headline: "1년 만기로 짧게, 우대 조건은 쉽게",
    description: "앱에서 바로 가입하는 1년짜리 청년 전용 적금이에요. 급여 이체나 자동이체만 해도 우대금리를 받을 수 있어요.",
    perks: [
      { label: "급여 이체 6개월 이상", rate: 1.0 },
      { label: "오픈뱅킹 등록", rate: 0.5 },
      { label: "마케팅 수신 동의", rate: 0.5 },
      { label: "만기 해지 시 재예치", rate: 0.5 },
    ],
    extras: ["자동이체 날짜 자유 변경"],
    notes: ["1인 1계좌", "중도 해지 시 기본금리의 50%만 적용돼요"],
    url: "https://www.kebhana.com",
  },
  {
    id: "woori-first-saving",
    name: "우리 첫거래 적금",
    bank: "우리은행",
    kind: "적금",
    baseRate: 3.2,
    maxRate: 6.0,
    termMonths: 12,
    monthlyMax: 30,
    ageMin: 18,
    ageMax: 39,
    headline: "우리은행이 처음이라면 최고 연 6.0%",
    description: "우리은행과 처음 거래하는 고객에게 높은 우대금리를 주는 소액 적금이에요. 적은 금액으로 저축 습관을 들이기 좋아요.",
    perks: [
      { label: "첫 거래 고객", rate: 2.0 },
      { label: "우리카드 월 30만원 이상 사용", rate: 0.5 },
      { label: "자동이체 6회 이상", rate: 0.3 },
    ],
    extras: ["가입 기간 6~12개월 선택"],
    notes: ["최근 1년간 우리은행 예적금 보유 이력이 없어야 해요"],
    url: "https://spot.wooribank.com",
  },
  {
    id: "kbank-deposit",
    name: "코드K 정기예금",
    bank: "케이뱅크",
    kind: "예금",
    baseRate: 3.1,
    maxRate: 3.1,
    termMonths: 12,
    monthlyMax: 100,
    ageMin: 17,
    ageMax: 99,
    headline: "조건 없이 연 3.1%, 모아둔 돈을 굴리기 좋아요",
    description: "우대 조건 없이 누구나 같은 금리를 받는 정기예금이에요. 이미 모아둔 목돈이 있다면 맡겨두기 좋아요.",
    perks: [],
    extras: ["1백만원부터 가입", "만기 자동 연장 선택"],
    notes: ["예금자보호법에 따라 1인당 1억원까지 보호돼요"],
    url: "https://www.kbanknow.com",
  },
];

export function getPolicy(id: string) {
  return POLICIES.find((p) => p.id === id);
}

export function getProduct(id: string) {
  return PRODUCTS.find((p) => p.id === id);
}

/** 적금 만기 예상 수령액(세전, 단리, 만원) — 상세 페이지 계산기·추천 요약용 */
export function estimateMaturity(p: CatalogProduct, monthly: number, rate = p.maxRate) {
  const n = p.termMonths;
  if (p.kind === "예금") {
    const principal = monthly;
    const interest = principal * (rate / 100) * (n / 12);
    return { principal, interest, gov: 0, total: principal + interest };
  }
  const principal = monthly * n;
  // 매달 납입한 금액이 남은 개월 수만큼 이자를 받는 단리 적금 공식
  const interest = monthly * (rate / 100 / 12) * ((n * (n + 1)) / 2);
  const gov = (p.govMatchMonthly ?? 0) * n;
  return { principal, interest, gov, total: principal + interest + gov };
}

export function formatManwon(v: number) {
  const rounded = Math.round(v);
  if (rounded >= 10000) {
    const eok = Math.floor(rounded / 10000);
    const rest = rounded % 10000;
    return rest ? `${eok}억 ${rest.toLocaleString()}만원` : `${eok}억원`;
  }
  return `${rounded.toLocaleString()}만원`;
}
