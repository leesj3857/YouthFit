# 청핏 (YouthFit)

LLM 기반 역질문 대화로 완성하는 청년 정책·금융상품 통합 추천 서비스 — 프론트엔드.

## 실행

```bash
pnpm install
cp .env.example .env.local   # YOUTHCENTER_API_KEY 입력
pnpm dev
```

## 구조

```
src/
├── app/
│   ├── page.tsx                  # 홈: 질문 입력(→ /chat)
│   ├── chat/page.tsx             # 대화형 추천 화면 (?q= 로 첫 질문 전달)
│   ├── policies/[id]/page.tsx    # 추천 정책 상세
│   ├── products/[id]/page.tsx    # 추천 예적금 상세 + 만기 계산기
│   ├── layout.tsx                # Pretendard 폰트, 메타데이터
│   └── api/policies/route.ts     # GET /api/policies — 채팅에서 호출하는 서버 라우트
├── components/
│   ├── chat/chat-composer.tsx    # 홈 입력창 (/chat 으로 이동)
│   ├── chat/chat-view.tsx        # 대화 엔진 + 메시지 렌더 (sessionStorage로 대화 복원)
│   ├── chat/streaming-text.tsx   # 글자 단위 스트리밍 텍스트
│   ├── chat/question-widgets.tsx # 질문 타입: 단일(칩/리스트)·복수·슬라이더·예/아니오
│   ├── chat/thinking.tsx         # RAG 검색 단계 표시
│   ├── chat/recommendation.tsx   # 최종 추천 (정책 + 예적금)
│   ├── policy/policy-feed.tsx    # (현재 미사용) 온통청년 API 최신 정책 피드
│   ├── policy/policy-row.tsx     # 정책 한 줄
│   ├── policy/api-status.tsx     # 응답 코드/건수/응답시간/요청 URL 표시
│   ├── policy/category-tabs.tsx  # 대분류 필터 (?category=)
│   ├── layout/                   # 헤더/푸터
│   └── ui/                       # shadcn/ui
└── lib/
    ├── youthcenter.ts            # server-only: fetchPolicies()
    ├── policy.ts                 # 타입 + 표시용 헬퍼 (client/server 공용)
    ├── chat-flow.ts              # 질문 스키마·시나리오·추천 매칭 (LLM 연동 시 교체)
    └── catalog.ts                # 추천용 정책/예적금 샘플 데이터
```

## 온통청년 API 메모

- 엔드포인트: `https://www.youthcenter.go.kr/go/ythip/getPlcy` (`apiKeyNm`, `pageNum`, `pageSize`, `rtnType=json`)
- 검색 파라미터: `plcyKywdNm`(키워드), `plcyNm`(정책명), `lclsfNm`(대분류), `zipCd`(시군구 5자리)
- 대분류 실제 값: `일자리`, `주거`, `교육･직업훈련`, `금융･복지･문화`, `참여･기반` — 필터는 `주거`, `교육`처럼 앞 단어만 넣어도 동작
- 접수 구분 `aplyPrdSeCd`: `0057001` 특정기간(`aplyYmd` = `YYYYMMDD ~ YYYYMMDD`, 회차가 여러 개면 `\N` 구분), `0057002` 상시, `0057003` 마감
- 연령: `sprtTrgtAgeLmtYn=N`일 때만 `sprtTrgtMinAge/MaxAge` 유효
- 상세 페이지: `https://www.youthcenter.go.kr/youthPolicy/ythPlcyTotalSearch/ythPlcyDetail/{plcyNo}`

## 아직 없는 것

- LLM 역질문 생성 — 현재는 `chat-flow.ts`의 규칙 기반 시나리오. 백엔드가 `Question` 스키마(JSON)로 다음 질문을 내려주면 프론트는 그대로 렌더
- 추천 데이터 — `catalog.ts` 샘플. RAG 결과로 교체 예정
- 금융감독원 금융상품한눈에 API — 헤더 "금융상품" 메뉴는 준비중
- FastAPI 백엔드 연동 — 지금은 Next.js Route Handler가 대신 호출

## 상세 패널 (`policy-detail.tsx`)

피드·채팅 결과의 정책을 클릭하면 오른쪽 시트로 상세가 열림. 파싱 규칙 설계용으로 필드명(`plcySprtCn` 등)과 원본 JSON도 함께 노출.

공식 코드표: `docs/API코드정보.xlsx` → `src/lib/youthcenter-codes.ts` 로 옮김 (취업상태·학력·전공·특화분야·혼인·소득조건·제공방법 등).
- `earnCndSeCd`: `0043001` 무관 / `0043002` 연소득(`earnMinAmt`~`earnMaxAmt`, 만원) / `0043003` 기타 → `earnEtcCn` 텍스트("기준 중위소득 150% 이하" 등)
- 코드 필드는 콤마로 여러 값이 올 수 있음 (예: `jobCd=0013003,0013006` → 미취업자, (예비)창업자)
- 공식 키워드(`plcyKywdNm`) 17개: 대출, 보조금, 바우처, 금리혜택, 교육지원, 맞춤형상담서비스, 인턴, 벤처, 중소기업, 청년가장, 장기미취업청년, 공공임대주택, 신용회복, 육아, 출산, 해외진출, 주거지원 — 검색은 부분 일치
- 실제 자격(무주택, 소득 상한, 거주 요건 등)은 대부분 `plcySprtCn` 자유 텍스트 안에만 있음
