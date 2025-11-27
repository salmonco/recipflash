<img width="400" alt="Instagram post - 1" src="https://github.com/user-attachments/assets/ee41b439-37ec-4b32-80d0-8e2f35ff8eae" />
<img width="400" alt="Instagram post - 2" src="https://github.com/user-attachments/assets/e2524f65-f3bc-4f36-8c28-8494a76ed18b" />
<img width="400" alt="Instagram post - 3" src="https://github.com/user-attachments/assets/04e4828e-43cb-440d-bb4e-1222b6b61b61" />
<img width="400" alt="Instagram post - 4" src="https://github.com/user-attachments/assets/2ae752bf-a6a5-4ff9-8cc1-2e5a0df2dc6b" />

<br/>
<br/>

### [iOS 앱 다운로드](https://apps.apple.com/kr/app/%EB%A0%88%EC%8B%9C%ED%94%BC-%EC%99%B8%EC%9A%B0%EA%B8%B0/id6755034677)

<br/>

🍳 레시피북 PDF를 업로드하면 레시피 자동 생성!

🍎 플래시카드 게임으로 재밌게 외우기!

🧑‍🍳 신입 알바생이 내딛는 첫걸음, 레시피 암기 앱으로 시작해보세요!

<br/>
<br/>

## 기술 스택

| 카테고리                | 기술 스택               | 선택 이유                                                                                                        |
| ----------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **프론트엔드 (모바일)** | React Native (CLI)      | 크로스 플랫폼 개발 및 빠른 개발 속도                                                                             |
|                         | React Query (tRPC 연동) | 효율적인 데이터 fetching, 캐싱, 동기화 및 tRPC와의 강력한 통합                                                   |
|                         | React Navigation        | 유연하고 확장 가능한 내비게이션 솔루션                                                                           |
|                         | Firebase Authentication | 간편하고 안전한 사용자 인증 (Google, Apple 로그인 포함)                                                          |
|                         | Amplitude               | 주요 지표 측정, 사용자 행동 분석을 위한 이벤트 기반 로그 태깅                                                    |
|                         | hot-updater             | OTA 업데이트 - 앱스토어를 거치지 않고 JS 번들을 교체해 즉시 반영 (네이티브 단의 변경은 앱스토어에 심사요청 필요) |
| **백엔드 서버 (Node)**  | Node.js                 | 비동기 처리 및 확장성, JavaScript 생태계 활용                                                                    |
|                         | Express.js              | 빠르고 최소화된 웹 애플리케이션 프레임워크                                                                       |
|                         | tRPC                    | 타입 안전성을 보장하는 엔드투엔드 API 개발                                                                       |
|                         | PostgreSQL (Supabase)   | 안정적이고 강력한 관계형 데이터베이스                                                                            |
|                         | Prisma                  | 현대적인 ORM으로 데이터베이스 접근 및 마이그레이션 관리                                                          |
|                         | Firebase Admin SDK      | Firebase 서비스와의 안전한 서버 측 상호작용 및 인증 관리                                                         |
| **AI 서버 (Python)**    | Python                  | AI/ML 라이브러리 및 생태계의 풍부함                                                                              |
|                         | LangChain               | LLM 애플리케이션 개발을 위한 프레임워크                                                                          |
|                         | Ollama                  | 로컬 LLM 모델 실행 및 관리                                                                                       |
|                         | OpenAI API              | 외부 서버에서 실행 중인 LLM 모델을 API 요청해서 사용 (로컬 LLM 배포 비용 부담으로 인한 대안)                     |
| **개발 환경**           | TurboRepo               | 모노레포 구성                                                                                                    |
|                         | pnpm                    | 패키지 매니저                                                                                                    |

<br/>
<br/>

# 시작하기

## 전제 조건

- Node.js (v18 이상)
- pnpm
- Firebase 프로젝트 설정 (Authentication 활성화, Admin SDK 서비스 계정 키 발급)

## 설치

1.  **저장소 복제:**

    ```bash
    git clone <저장소-URL>
    cd recipflash
    ```

2.  **의존성 설치:**
    ```bash
    pnpm install
    ```

## 환경 변수 설정

각 `apps/ai`, `apps/server` 및 `apps/mobile` 디렉토리에 `.env` 파일을 생성하고 다음 변수들을 설정해야 합니다.

### `apps/ai/.env`

```env
OLLAMA_HOST=http://localhost:11434
OPENAI_API_KEY={채워넣기}
```

- `OLLAMA_HOST`: Ollama 로컬 LLM 서버를 사용할 경우에 해당합니다. 로컬 ollama 서버의 URL입니다. 개발 환경에서는 `http://localhost:11434`을 사용합니다.
- `OPENAI_API_KEY`: OpenAI API를 사용할 경우에 해당합니다. OpenAI 플랫폼에서 secret key를 생성한 후 복사하여 붙여넣습니다. (OpenAI API 사용을 위해 최소 $5 결제가 요구됩니다.)

### `apps/server/.env`

```env
API_URL=http://localhost:8000

# Connect to Supabase via connection pooling
DATABASE_URL="postgresql://{USER}:{PASSWORD}@{HOST}:{PORT}/{DATABASE}?pgbouncer=true&connect_timeout=30&pool_timeout=30"

# Direct connection to the database. Used for migrations
DIRECT_URL="postgresql://{USER}:{PASSWORD}@{HOST}:{PORT}/{DATABASE}?connect_timeout=30"

FIREBASE_SERVICE_ACCOUNT_KEY='{Firebase Admin SDK 서비스 계정 키 JSON 내용}'

AWS_S3_BUCKET_URL="https://{BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com"
```

- `API_URL`: python 서버의 URL입니다. 개발 환경에서는 `http://localhost:8000`을 사용합니다.
- `DATABASE_URL`: PostgreSQL 데이터베이스 연결 문자열입니다.
- `FIREBASE_SERVICE_ACCOUNT_KEY`: Firebase Admin SDK에서 발급받은 서비스 계정 키 JSON 파일의 내용을 직접 붙여넣습니다. (줄바꿈 포함)
- `AWS_S3_BUCKET_URL`: 업로드한 파일이 저장되길 원하는 경로입니다. (여기에선 AWS S3 이용)

### `apps/mobile/.env`

```env
API_URL=http://localhost:4000
WEB_CLIENT_ID={채워넣기}.apps.googleusercontent.com

# Amplitude
AMPLITUDE_API_KEY={채워넣기}
```

- `API_URL`: node 서버의 URL입니다. 개발 환경에서는 `http://localhost:4000`을 사용합니다.
- `WEB_CLIENT_ID`: Firebase > Authentication > 로그인 제공업체 > 구글 > 웹 SDK 구성 > 웹 클라이언트 ID 복사해서 붙여 넣습니다.
- `AMPLITUDE_API_KEY`: Amplitude > 조직 설정 > 프로젝트 > 프로젝트 선택 > API 키 복사해서 붙여 넣습니다.

## 데이터베이스 설정

1.  **Supabase 프로젝트 생성 (PostgreSQL):**

2.  **Prisma 적용:**
    `apps/server` 디렉토리로 이동하여 prisma를 생성합니다.
    ```bash
    cd apps/server
    npx prisma generate
    ```

## 애플리케이션 실행

1.  **AI (Python) 서버 실행:**
    우선 Ollama를 설치하고, 모델을 설치하여 실행합니다. (로컬 LLM 서버 사용을 원할 시)

    ```bash
    ollama run llama3
    ```

    OCR 기능을 사용하기 위해 본인의 컴퓨터에 다음 라이브러리를 설치합니다.

    ```bash
    brew install tesseract
    ```

    그 다음 `apps/ai` 디렉토리에서 다음 명령어를 실행합니다.

    ```bash
    cd apps/ai
    source venv/bin/activate
    pip install -r requirements.txt
    pnpm dev
    ```

2.  **백엔드 (Node) 서버 실행:**
    `apps/server` 디렉토리에서 다음 명령어를 실행합니다.

    ```bash
    cd apps/server
    pnpm dev
    ```

    서버는 기본적으로 `http://localhost:4000`에서 실행됩니다.

3.  **모바일 (React-Native) 애플리케이션 실행:**
    `apps/mobile` 디렉토리에서 다음 명령어를 실행합니다.

    ```bash
    cd apps/mobile
    cd ios
    pod install
    cd ../

    npx react-native run-ios # iOS 시뮬레이터 실행
    # 또는
    npx react-native run-android # Android 에뮬레이터 실행
    ```

    (React Native CLI 환경 설정이 필요할 수 있습니다. 공식 문서를 참조하세요.)
