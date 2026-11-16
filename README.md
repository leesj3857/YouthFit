# 청핏 (YouthFit)

LLM 기반 역질문 대화로 완성하는 청년 정책 추천 서비스 — 프론트엔드.
추천은 YouthFit 백엔드 API가 하고, 프론트는 그 응답을 그대로 그린다.

## 실행

```bash
pnpm install
cp .env.example .env.local   # 비워두면 개발 서버(Render) 백엔드를 쓴다
pnpm dev                     # http://localhost:3000 (백엔드 CORS 기본 허용 주소)
```

## 구조

```
src/
├── app/
│   ├── page.tsx                  # 홈: 질문 입력(→ /chat)
│   ├── chat/page.tsx             # 대화형 추천 화면 (?q= 로 첫 질문 전달)
│   ├── privacy/page.tsx          # 이용안내·개인정보 처리방침
│   ├── layout.tsx                # Pretendard 폰트, 메타데이터
│   ├── api/feedback/route.ts     # POST /api/feedback — 추천 평가(👍/👎) 저장 (Upstash)
│   └── api/policies/route.ts     # GET /api/policies — 온통청년 실시간 조회 (현재 화면에서 미사용)
├── components/
│   ├── chat/chat-composer.tsx    # 홈 입력창 (/chat 으로 이동)
│   ├── chat/chat-view.tsx        # 대화 흐름(세션 → 칩 답변 → 추천) + 메시지 렌더, sessionStorage로 복원
│   ├── chat/streaming-text.tsx   # 글자 단위 스트리밍 텍스트
│   ├── chat/question-widgets.tsx # 질문 위젯: 단일(칩/리스트)·복수
│   ├── chat/thinking.tsx         # 진행 단계 표시
│   ├── chat/recommendation.tsx   # 최종 추천 카드 (이유·확인할 점·공식 링크)
│   ├── policy/                   # (현재 미사용) 온통청년 API 정책 피드
│   ├── layout/                   # 헤더/푸터
│   └── ui/                       # shadcn/ui
└── lib/
    ├── api.ts                    # 백엔드 API 클라이언트 + 응답 타입 + 표시용 라벨
    ├── chat-flow.ts              # 서버 질문 → 위젯 변환, 답변 표시, 단계 문구
    ├── format.ts                 # 날짜·D-day
    ├── ratelimit.ts              # 피드백 저장소·호출 제한
    ├── youthcenter.ts            # server-only: fetchPolicies()
    └── policy.ts                 # 타입 + 표시용 헬퍼
```

- 상세 페이지: `https://www.youthcenter.go.kr/youthPolicy/ythPlcyTotalSearch/ythPlcyDetail/{plcyNo}`

## 백엔드 API 연동

필드 정의의 기준은 백엔드 Swagger(`{Base URL}/docs`)다. 주소는 `NEXT_PUBLIC_API_BASE_URL`(기본: 개발 서버).

```
"서울 사는 25살 취준생인데 주거 지원 받을 수 있을까요?"
 ① POST /v1/sessions                       → session_id, 역질문(칩), 1차 후보 수
 ② 질문을 하나씩 보여주고 답을 모음 (건너뛰기 가능, 직접 입력하면 선택지와 맞춰 봄)
 ③ POST /v1/sessions/{id}/answers          → 답 반영 (보낼 때마다 전체 덮어쓰기)
 ④ POST /v1/sessions/{id}/recommendations  → 최대 5건 + reason + check_points
```

- 칩은 `options[].value`만 보내고, 화면 문구는 `label`/`text`를 쓴다. 질문 `id`·선택지는 바꾸지 않는다.
- 카드의 링크·신청 기간·자격 표시는 `items[].policy`(DB 값)에서만 만든다. `reason`·`check_points`는 문구로만 보여준다.
- `reason_source: "template"`도 정상 응답으로 그대로 보여준다.
- 오류: 404(세션 만료) → 처음부터 다시, 429 → `Retry-After` 안내 + 다시 시도, 연결 실패·5xx → 다시 시도.
- 개발 서버(Render 무료)는 잠들어 있으면 첫 응답이 1분쯤 걸려서, 6초가 넘으면 "서버를 깨우는 중" 문구를 보여준다.
- "답변 다시 고르기"는 같은 세션에서 질문을 다시 묻고 답을 통째로 다시 보낸다. 새 문장을 입력하면 새 세션으로 찾는다.
- 배포 도메인은 백엔드 CORS(`CORS_ORIGINS`)에 등록돼 있어야 한다.

## 아직 없는 것

- 예·적금 추천 — 백엔드에 적금 API가 없어 정책만 추천
- 추천 뒤 자유 질문(꼬리 질문) — 백엔드에 대화 API가 없음
- 정책 상세 화면 — 카드에서 공식 페이지로 바로 연결

## 상세 패널 (`policy-detail.tsx`)

피드·채팅 결과의 정책을 클릭하면 오른쪽 시트로 상세가 열림. 파싱 규칙 설계용으로 필드명(`plcySprtCn` 등)과 원본 JSON도 함께 노출.

공식 코드표: `docs/API코드정보.xlsx` → `src/lib/youthcenter-codes.ts` 로 옮김 (취업상태·학력·전공·특화분야·혼인·소득조건·제공방법 등).
- `earnCndSeCd`: `0043001` 무관 / `0043002` 연소득(`earnMinAmt`~`earnMaxAmt`, 만원) / `0043003` 기타 → `earnEtcCn` 텍스트("기준 중위소득 150% 이하" 등)
- 코드 필드는 콤마로 여러 값이 올 수 있음 (예: `jobCd=0013003,0013006` → 미취업자, (예비)창업자)
- 공식 키워드(`plcyKywdNm`) 17개: 대출, 보조금, 바우처, 금리혜택, 교육지원, 맞춤형상담서비스, 인턴, 벤처, 중소기업, 청년가장, 장기미취업청년, 공공임대주택, 신용회복, 육아, 출산, 해외진출, 주거지원 — 검색은 부분 일치
- 실제 자격(무주택, 소득 상한, 거주 요건 등)은 대부분 `plcySprtCn` 자유 텍스트 안에만 있음
