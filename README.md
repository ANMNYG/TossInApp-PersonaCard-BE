# AI Persona Card Backend

`ai-persona-card` 프론트엔드(앱인토스 미니앱)를 위한 AI 페르소나 카드 이미지 생성 백엔드입니다. 사용자가 선택한 원소(element), 페르소나 타이틀, 색상 정보를 받아 Google Gemini 이미지 생성 API로 판타지 스타일의 트레이딩 카드 일러스트를 만들어 반환합니다.

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
- `prompt`: Gemini에 실제로 전달된 프롬프트 (디버깅/확인용)

**에러 응답**

| 상태 코드 | 상황 |
| --- | --- |
| 400 | 요청 바디 검증 실패 (`element`, `personaTitle`, `colorPrimary`, `colorSecondary` 누락/형식 오류) |
| 405 | POST/OPTIONS 이외의 메서드 |
| 422 | Gemini 안전 정책에 의해 콘텐츠가 차단됨 |
| 500 | `GEMINI_API_KEY` 미설정 등 서버 내부 오류 |
| 502 | Gemini API 호출 실패 (네트워크 오류, 인증 실패 등) |
| 504 | Gemini API 호출 타임아웃 (45초) |

에러 응답 형식은 공통으로 `{ "error": string }` 입니다.

CORS: `OPTIONS` 프리플라이트를 지원하며, `Access-Control-Allow-Origin` 헤더는 `ALLOWED_ORIGIN` 환경변수 값을 사용합니다.

## 기술 스택

- [Vercel Serverless Functions](https://vercel.com/docs/functions) (`@vercel/node`)
- TypeScript
- [Google Gemini 이미지 생성 API](https://ai.google.dev/) (`gemini-2.5-flash-image`)

## 프로젝트 구조

```
.
├── api/
│   └── generate-card.ts     # 카드 이미지 생성 API 핸들러 (요청 검증, 프롬프트 구성, Gemini 호출)
├── .env.local.example       # 로컬 개발용 환경변수 예시
├── .gitignore
├── package.json
├── package-lock.json
├── tsconfig.json             # api/**/*.ts 대상 타입 체크 설정
└── vercel.json                # Vercel 함수 런타임(@vercel/node@3), 타임아웃(maxDuration) 설정
```

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
   | `GEMINI_API_KEY` | [Google AI Studio](https://ai.google.dev/)에서 발급받은 Gemini API 키 |
   | `ALLOWED_ORIGIN` | CORS 허용 origin. 로컬 개발 시 `*` 사용 가능 |

3. 개발 서버 실행

   ```bash
   npx vercel dev
   ```

   기본적으로 `http://localhost:3000/api/generate-card`에서 API를 확인할 수 있습니다.

4. 타입 체크

   ```bash
   npm run type-check
   ```

## 배포 방법 (Vercel)

1. [Vercel 대시보드](https://vercel.com/)에서 이 GitHub 저장소를 Import 하거나, CLI로 연결합니다.

   ```bash
   npx vercel        # 최초 1회, 프로젝트 연결
   npx vercel --prod # 프로덕션 배포
   ```

2. Vercel 프로젝트 설정 → **Environment Variables**에서 아래 값을 등록합니다.

   - `GEMINI_API_KEY`
   - `ALLOWED_ORIGIN` (프로덕션 프론트엔드의 실제 origin으로 설정)

3. GitHub 연동 시 `main` 브랜치에 머지되면 Vercel이 자동으로 프로덕션 배포를 수행합니다.

## 프론트엔드(ai-persona-card)와의 관계

이 저장소는 `ai-persona-card` 프론트엔드(앱인토스 미니앱)의 백엔드 API 서버입니다. 프론트엔드에서 사용자가 선택한 원소/타이틀/색상 정보를 이 백엔드의 `/api/generate-card`로 전송하면, 이 백엔드가 Gemini API를 호출해 이미지를 생성하고 base64로 인코딩된 이미지를 반환합니다. 프론트엔드는 이를 받아 카드 UI에 렌더링합니다.

두 저장소는 독립적으로 배포되며, 프론트엔드 API 클라이언트의 base URL을 이 백엔드의 배포 도메인으로 설정해 연동합니다.

## TODO / 미완성 사항

- [ ] **CORS origin 제한**: 현재 `ALLOWED_ORIGIN` 기본값이 `*`로 열려 있습니다. 프로덕션에서는 앱인토스 미니앱의 실제 origin으로 좁혀야 합니다 (`api/generate-card.ts`의 `ALLOWED_ORIGIN` 관련 TODO 참고).
- [ ] **프로덕션 미배포**: 아직 Vercel 프로덕션 배포 및 환경변수 등록이 완료되지 않았습니다.
- [ ] 요청 rate limiting / 어뷰징 방지 로직 없음.
- [ ] 프론트엔드와 에러 응답 스펙 최종 합의 필요.
