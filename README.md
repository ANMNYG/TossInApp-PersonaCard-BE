# AI Persona Card Backend

`ai-persona-card` 프론트엔드(앱인토스 미니앱)를 위한 AI 페르소나 카드 이미지 생성 백엔드입니다. 사용자가 선택한 원소(element), 페르소나 타이틀, 색상 정보를 받아 [Pollinations.ai](https://pollinations.ai/) 무료 이미지 생성 API로 판타지 스타일의 트레이딩 카드 일러스트를 만들어 반환합니다.

## 주요 기능

### `POST /api/generate-card`

카드 일러스트 이미지를 생성합니다.

**요청 (Request Body, JSON)**

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `element` | `"fire" \| "water" \| "earth" \| "air"` | 카드의 속성 |
| `personaTitle` | `string` (1~80자) | 페르소나 이름/타이틀 |
| `colorPrimary` | `string` (`#RGB` 또는 `#RRGGBB`) | 주 색상 |
| `colorSecondary` | `string` (`#RGB` 또는 `#RRGGBB`) | 보조 색상 |

```json
{
  "element": "fire",
  "personaTitle": "Flameheart Warden",
  "colorPrimary": "#FF4500",
  "colorSecondary": "#1A1A1A"
}
```

**응답 (200 OK)**

```json
{
  "image": {
    "mimeType": "image/png",
    "base64": "..."
  },
  "prompt": "A fantasy trading card illustration for a character named ..."
}
```

- `image.base64`: 생성된 이미지의 base64 인코딩 데이터
- `prompt`: Pollinations에 실제로 전달된 프롬프트 (디버깅/확인용)

**에러 응답**

| 상태 코드 | 상황 |
| --- | --- |
| 400 | 요청 바디 검증 실패 (`element`, `personaTitle`, `colorPrimary`, `colorSecondary` 누락/형식 오류) |
| 405 | POST/OPTIONS 이외의 메서드 |
| 500 | 서버 내부 오류 (예상치 못한 예외) |
| 502 | Pollinations API 호출 실패 (네트워크 오류, 실패 응답, 이미지가 아닌 응답 등) |
| 504 | Pollinations API 호출 타임아웃 (45초) |

에러 응답 형식은 공통으로 `{ "error": string }` 입니다.

CORS: `OPTIONS` 프리플라이트를 지원하며, `Access-Control-Allow-Origin` 헤더는 `ALLOWED_ORIGIN` 환경변수 값을 사용합니다.

### `POST /api/chemistry/generate-code`

카드를 완성한 사용자에게 6자리 공유 코드를 발급합니다. `sharers` 테이블에 `{ code, type }`을 저장합니다.

**요청**

```json
{ "sharerType": "fire-water" }
```

**응답 (200 OK)**

```json
{ "sharerCode": "K7X9M2", "sharerType": "fire-water" }
```

### `POST /api/chemistry/visit`

공유 링크(`?ref={sharerCode}`)로 들어온 방문자가 자기 카드를 완성했을 때 호출합니다. `sharerCode`로 `sharers`를 조회해 `sharer_type`을 찾고, `visits` 테이블에 방문 기록을 남긴 뒤 두 타입의 궁합을 계산해 반환합니다.

**요청**

```json
{ "sharerCode": "K7X9M2", "visitorType": "earth-air" }
```

**응답 (200 OK)**

```json
{
  "sharerCode": "K7X9M2",
  "sharerType": "fire-water",
  "visitorType": "earth-air",
  "compatibility": { "score": 71, "description": "손발이 잘 맞는 좋은 궁합이에요." }
}
```

### `GET /api/chemistry/my-visitors?code={sharerCode}`

특정 공유 코드로 남겨진 모든 방문 기록을 최신순으로 반환하며, 각 방문자와 공유자 간의 궁합도 함께 계산합니다.

**응답 (200 OK)**

```json
{
  "sharerCode": "K7X9M2",
  "sharerType": "fire-water",
  "visitorCount": 2,
  "visitors": [
    {
      "visitorType": "earth-air",
      "visitedAt": "2026-08-20T03:00:00.000Z",
      "compatibility": { "score": 71, "description": "손발이 잘 맞는 좋은 궁합이에요." }
    }
  ]
}
```

**케미 API 공통 에러 응답**

| 상태 코드 | 상황 |
| --- | --- |
| 400 | 요청 바디/쿼리 파라미터 검증 실패 |
| 404 | 존재하지 않는 `sharerCode` 조회 |
| 405 | 지원하지 않는 HTTP 메서드 |
| 500 | Supabase 환경변수 미설정 등 서버 설정 오류 |
| 502 | Supabase 연결/쿼리 실패 |

에러 응답 형식은 공통으로 `{ "error": string }` 입니다. CORS는 `/api/generate-card`와 동일하게 `ALLOWED_ORIGIN` 환경변수를 사용합니다.

## 기술 스택

- [Vercel Serverless Functions](https://vercel.com/docs/functions) (`@vercel/node`)
- TypeScript
- [Pollinations.ai 이미지 생성 API](https://pollinations.ai/) (API 키 불필요, `https://image.pollinations.ai/prompt/{인코딩된 프롬프트}`)
- [Supabase](https://supabase.com/) (`@supabase/supabase-js`) — 케미(궁합) 기능의 `sharers`/`visits` 데이터 저장

## 프로젝트 구조

```
.
├── api/
│   ├── generate-card.ts             # 카드 이미지 생성 API 핸들러 (요청 검증, 프롬프트 구성, Pollinations 호출)
│   └── chemistry/
│       ├── generate-code.ts         # 공유 코드 발급
│       ├── visit.ts                 # 방문 기록 저장 + 궁합 계산
│       └── my-visitors.ts           # 방문자 목록 + 궁합 조회
├── lib/
│   ├── compatibility.ts             # 원소 기반 궁합 점수/설명 계산 로직
│   ├── cors.ts                      # 공통 CORS 헤더 설정
│   └── supabase.ts                  # Supabase 클라이언트 생성(환경변수 검증 포함)
├── supabase/
│   └── migrations/
│       └── 0001_create_chemistry_tables.sql   # sharers / visits 테이블 생성 SQL
├── .env.local.example       # 로컬 개발용 환경변수 예시
├── .gitignore
├── package.json
├── package-lock.json
├── tsconfig.json             # api/**/*.ts, lib/**/*.ts 대상 타입 체크 설정
└── vercel.json                # Vercel 함수 런타임(@vercel/node@3), 타임아웃(maxDuration) 설정
```

## Supabase 프로젝트 생성 및 키 발급

케미 기능(`/api/chemistry/*`)을 사용하려면 Supabase 프로젝트가 필요합니다.

1. [supabase.com](https://supabase.com/)에 가입하고 **New Project**로 새 프로젝트를 만듭니다. (리전은 가까운 곳, DB 비밀번호는 임의로 설정)
2. 프로젝트가 생성되면 좌측 메뉴 **SQL Editor**를 열고, 이 저장소의 `supabase/migrations/0001_create_chemistry_tables.sql` 파일 내용을 그대로 붙여넣어 실행합니다. `sharers`, `visits` 테이블이 생성됩니다.
3. 좌측 메뉴 **Project Settings → API**에서 아래 값을 확인합니다.
   - `Project URL` → `SUPABASE_URL`
   - `service_role` 시크릿 키 → `SUPABASE_SERVICE_ROLE_KEY` (권장: 서버 전용, 절대 프론트엔드에 노출하지 말 것)
   - 또는 `anon` `public` 키 → `SUPABASE_ANON_KEY` (이 경우 마이그레이션 SQL 하단의 anon 정책 주석을 해제해서 함께 실행해야 합니다)

## 로컬 개발 방법

1. 의존성 설치

   ```bash
   npm install
   ```

2. 환경변수 설정: `.env.local.example`을 복사해 `.env.local`을 만들고 값을 채웁니다.

   ```bash
   cp .env.local.example .env.local
   ```

   | 변수 | 설명 |
   | --- | --- |
   | `ALLOWED_ORIGIN` | CORS 허용 origin. 로컬 개발 시 `*` 사용 가능 |
   | `SUPABASE_URL` | Supabase 프로젝트 URL (위 "Supabase 프로젝트 생성 및 키 발급" 참고) |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase 서비스 롤 키 (권장) |
   | `SUPABASE_ANON_KEY` | `SUPABASE_SERVICE_ROLE_KEY` 대신 사용할 수 있는 anon 키 |

   Pollinations API(`/api/generate-card`)는 별도 키가 필요 없습니다. 케미 API(`/api/chemistry/*`)는 `SUPABASE_URL`과 두 키 중 하나가 반드시 있어야 하며, 없으면 500 에러를 반환합니다.

3. 개발 서버 실행

   ```bash
   npx vercel dev
   ```

   기본적으로 `http://localhost:3000`에서 API를 확인할 수 있습니다.

4. 타입 체크

   ```bash
   npm run type-check
   ```

### curl로 케미 API 테스트하기

`npx vercel dev` 실행 후 (기본 포트 3000 기준):

```bash
# 1. 공유 코드 발급
curl -s -X POST http://localhost:3000/api/chemistry/generate-code \
  -H "Content-Type: application/json" \
  -d '{"sharerType": "fire-water"}'
# => {"sharerCode":"K7X9M2","sharerType":"fire-water"}

# 2. 방문 기록 저장 + 궁합 계산 (위에서 받은 sharerCode로 교체)
curl -s -X POST http://localhost:3000/api/chemistry/visit \
  -H "Content-Type: application/json" \
  -d '{"sharerCode": "K7X9M2", "visitorType": "earth-air"}'
# => {"sharerCode":"K7X9M2","sharerType":"fire-water","visitorType":"earth-air","compatibility":{...}}

# 3. 방문자 목록 조회
curl -s "http://localhost:3000/api/chemistry/my-visitors?code=K7X9M2"
# => {"sharerCode":"K7X9M2","sharerType":"fire-water","visitorCount":1,"visitors":[...]}

# 4. 존재하지 않는 코드 조회 시 404 확인
curl -s -i "http://localhost:3000/api/chemistry/my-visitors?code=NOTFOUND"
```

## 배포 방법 (Vercel)

1. [Vercel 대시보드](https://vercel.com/)에서 이 GitHub 저장소를 Import 하거나, CLI로 연결합니다.

   ```bash
   npx vercel        # 최초 1회, 프로젝트 연결
   npx vercel --prod # 프로덕션 배포
   ```

2. Vercel 프로젝트 설정 → **Environment Variables**에서 아래 값을 등록합니다.

   - `ALLOWED_ORIGIN` (프로덕션 프론트엔드의 실제 origin으로 설정)
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (케미 API 사용 시 필수, 위 "Supabase 프로젝트 생성 및 키 발급" 참고)

3. GitHub 연동 시 `main` 브랜치에 머지되면 Vercel이 자동으로 프로덕션 배포를 수행합니다.

## 프론트엔드(ai-persona-card)와의 관계

이 저장소는 `ai-persona-card` 프론트엔드(앱인토스 미니앱)의 백엔드 API 서버입니다. 프론트엔드에서 사용자가 선택한 원소/타이틀/색상 정보를 이 백엔드의 `/api/generate-card`로 전송하면, 이 백엔드가 Pollinations API를 호출해 이미지를 생성하고 base64로 인코딩된 이미지를 반환합니다. 프론트엔드는 이를 받아 카드 UI에 렌더링합니다.

두 저장소는 독립적으로 배포되며, 프론트엔드 API 클라이언트의 base URL을 이 백엔드의 배포 도메인으로 설정해 연동합니다.

## TODO / 미완성 사항

- [ ] **CORS origin 제한**: 현재 `ALLOWED_ORIGIN` 기본값이 `*`로 열려 있습니다. 프로덕션에서는 앱인토스 미니앱의 실제 origin으로 좁혀야 합니다 (`api/generate-card.ts`의 `ALLOWED_ORIGIN` 관련 TODO 참고).
- [ ] **프로덕션 미배포**: 아직 Vercel 프로덕션 배포 및 환경변수 등록이 완료되지 않았습니다.
- [ ] 요청 rate limiting / 어뷰징 방지 로직 없음.
- [ ] 프론트엔드와 에러 응답 스펙 최종 합의 필요.
- [ ] Pollinations.ai는 무료지만 SLA/가동률 보장이 없는 서드파티 서비스입니다. 장애/속도 이슈 시 대체 이미지 생성 API 검토 필요.
- [ ] **Supabase 프로젝트 미생성**: 케미 API(`/api/chemistry/*`)는 Supabase 프로젝트 생성 및 `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` 환경변수 등록 전까지 500 에러를 반환합니다.
- [ ] `sharers` 코드에 만료(TTL)나 정리(cleanup) 정책이 없어 데이터가 계속 누적됩니다. 필요 시 주기적 삭제 배치 검토.
