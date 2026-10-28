# 청핏 (YouthFit)

LLM 기반 역질문 대화로 완성하는 청년 정책·금융상품 통합 추천 서비스 — 프론트엔드.

## 실행

```bash
pnpm install
cp .env.example .env.local   # YOUTHCENTER_API_KEY, ANTHROPIC_API_KEY 입력
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
│   ├── api/chat/route.ts         # POST /api/chat — RAG 역질문 추천 (start / answer / ask)
│   └── api/policies/route.ts     # GET /api/policies — 온통청년 실시간 조회
├── data/                         # youthfit-enrich/export_web.py 가 만든 정형화 데이터
│   ├── policies.json             # 정책 1,687건 (자격 조건 + 원문 근거)
│   ├── savings.json              # 금감원 적금 337개 + 기간별 금리
│   └── policies.emb              # 정책 임베딩 (scripts/build-embeddings.mjs)
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
    ├── chat-flow.ts              # 답변 표시·검색 단계 문구 (UI 헬퍼)
    ├── format.ts                 # 금액·날짜·만기 계산
    └── rag/                      # 서버: 추천 엔진
        ├── types.ts              # Question·ChatState·추천 결과 타입 (프론트 공용)
        ├── data.ts               # 데이터·임베딩 로드
        ├── search.ts             # BM25 + 임베딩 하이브리드 검색
        ├── profile.ts            # 역질문 템플릿·응답 반영·자격 판정(규칙)
        ├── llm.ts                # Claude: 의도 파싱·추천 이유·추천 후 질문 답변
        └── engine.ts             # start / answer / ask
```

## 온통청년 API 메모

- 엔드포인트: `https://www.youthcenter.go.kr/go/ythip/getPlcy` (`apiKeyNm`, `pageNum`, `pageSize`, `rtnType=json`)
- 검색 파라미터: `plcyKywdNm`(키워드), `plcyNm`(정책명), `lclsfNm`(대분류), `zipCd`(시군구 5자리)
- 대분류 실제 값: `일자리`, `주거`, `교육･직업훈련`, `금융･복지･문화`, `참여･기반` — 필터는 `주거`, `교육`처럼 앞 단어만 넣어도 동작
- 접수 구분 `aplyPrdSeCd`: `0057001` 특정기간(`aplyYmd` = `YYYYMMDD ~ YYYYMMDD`, 회차가 여러 개면 `\N` 구분), `0057002` 상시, `0057003` 마감
- 연령: `sprtTrgtAgeLmtYn=N`일 때만 `sprtTrgtMinAge/MaxAge` 유효
- 상세 페이지: `https://www.youthcenter.go.kr/youthPolicy/ythPlcyTotalSearch/ythPlcyDetail/{plcyNo}`

## AI 추천 구조

```
"서울 사는 26살 취준생인데 월세 지원이랑 적금 추천해줘"
 ① 의도 파싱 (Claude Haiku 5.5) — 나이·지역·취업상태·관심 분야·검색어
 ② 하이브리드 검색 — BM25(한글 2-gram) + 의미 검색(multilingual-e5-small, 서버에서 로컬 실행) → RRF
 ③ 자격 판정 — LLM이 아닌 규칙(profile.ts). 조건별 충족/불가/확인 필요, '불가'는 제외
 ④ 역질문 — 상위 40개 후보에서 '확인 필요'를 가장 많이 만드는 항목부터 최대 3문항 × 2라운드
    (시·군·구, 대상 집단 질문의 선택지는 후보 데이터에서 동적으로 만듦)
 ⑤ 추천 (Claude Sonnet 5.5) — 판정이 끝난 후보 중 순위·이유·주의사항. 후보에 없는 id는 버림
 ⑥ 추천 후 질문 — 추천된 정책·적금의 공고 원문을 근거로 답변
```

- 상태(프로필·검색어·라운드)는 클라이언트가 들고 매 요청에 보냄 → 서버 세션 저장소 없이 Vercel에서 동작
- 질문은 `Question` 스키마(`question-widgets.tsx`가 렌더)로 내려옴
- 한 번 추천받는 데 API 비용 약 $0.03

### 데이터 갱신
`~/dev/youthfit-enrich` (Python)에서 정형화한 결과를 내보낸다.
```bash
python export_web.py ~/Desktop/youthfit/src/data    # DB(읽기 전용) + 정형화 결과 → JSON
cd ~/Desktop/youthfit && node scripts/build-embeddings.mjs
npx tsx scripts/scenarios.mts                       # 페르소나 5개로 '자격 불가 정책 추천' 여부 검사
```

## 아직 없는 것

- 금융감독원 정기예금 — 적금만 수집 중
- 온통청년 데이터 자동 갱신 — 지금은 수동 (위 '데이터 갱신')

## 상세 패널 (`policy-detail.tsx`)

피드·채팅 결과의 정책을 클릭하면 오른쪽 시트로 상세가 열림. 파싱 규칙 설계용으로 필드명(`plcySprtCn` 등)과 원본 JSON도 함께 노출.

공식 코드표: `docs/API코드정보.xlsx` → `src/lib/youthcenter-codes.ts` 로 옮김 (취업상태·학력·전공·특화분야·혼인·소득조건·제공방법 등).
- `earnCndSeCd`: `0043001` 무관 / `0043002` 연소득(`earnMinAmt`~`earnMaxAmt`, 만원) / `0043003` 기타 → `earnEtcCn` 텍스트("기준 중위소득 150% 이하" 등)
- 코드 필드는 콤마로 여러 값이 올 수 있음 (예: `jobCd=0013003,0013006` → 미취업자, (예비)창업자)
- 공식 키워드(`plcyKywdNm`) 17개: 대출, 보조금, 바우처, 금리혜택, 교육지원, 맞춤형상담서비스, 인턴, 벤처, 중소기업, 청년가장, 장기미취업청년, 공공임대주택, 신용회복, 육아, 출산, 해외진출, 주거지원 — 검색은 부분 일치
- 실제 자격(무주택, 소득 상한, 거주 요건 등)은 대부분 `plcySprtCn` 자유 텍스트 안에만 있음
