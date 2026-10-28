# pipeline — 정책 데이터 정형화

온통청년·금감원 DB(팀 백엔드의 Render PostgreSQL, **읽기 전용**)를 읽어 Claude로 자격 조건을 정형화하고,
웹이 쓰는 `../src/data/*.json`을 만든다.

| 파일 | 역할 |
| --- | --- |
| `refresh.py` | **매일 자동 갱신** — 새로 생기거나 원문이 바뀐 정책만 정리 → `export_web.py` 실행 |
| `extract_v2.py` | 정형화 스키마·프롬프트·근거 검증 (Opus 5.5) |
| `export_web.py` | 정형화 결과 + DB → `../src/data/policies.json`, `savings.json` |
| `batch_v2.py` | 전체 재정리 (Batch API, 비용 상한 가드). `python fetch.py` 후 `python batch_v2.py submit all` |
| `eval.py`, `golden.json` | 30건 정답으로 정확도 측정 |
| `data/results_v2.jsonl` | 정책별 정형화 결과 (누적) |
| `data/hashes.json` | 정책 원문 해시 — 바뀐 정책만 다시 정리하는 데 사용 |

## 로컬 실행
```bash
cd pipeline
python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
cp .env.example .env   # DATABASE_URL(…?sslmode=require), ANTHROPIC_API_KEY
python refresh.py
cd .. && node scripts/build-embeddings.mjs
```

## 자동 갱신 (GitHub Actions)
`.github/workflows/refresh-data.yml` — 매일 05:00 KST(팀 백엔드 04:00 수집 이후) 실행.
레포 Settings → Secrets and variables → Actions 에 `DATABASE_URL`, `ANTHROPIC_API_KEY` 등록 필요.
Render 무료 DB는 30일마다 주소가 바뀌므로 그때 `DATABASE_URL` 시크릿도 갱신.
