# Recipflash

Recipflash는 알바에서 잘리기 않기 위해 제작한 레시피 외우기 게임입니다. 레시피와 메뉴를 관리하고, 플래시카드 방식으로 메뉴를 암기할 수 있도록 돕습니다.

## 주요 기능

- **레시피 관리:**
  - PDF 파일을 업로드하면 레시피를 자동으로 생성해줍니다.
  - 레시피 수동 생성 또한 가능합니다.
- **메뉴 관리:**
  - 각 레시피에 대해 메뉴를 생성하여 관리합니다.
- **플래시카드 암기:**
  - 레시피에 등록된 메뉴들을 플래시카드 형태로 랜덤하게 학습합니다.

## 기술 스택

| 카테고리                | 기술 스택                                      | 선택 이유                                                      |
| ----------------------- | ---------------------------------------------- | -------------------------------------------------------------- |
| **프론트엔드 (모바일)** | React Native (CLI)                             | 크로스 플랫폼 개발 및 빠른 개발 속도                           |
|                         | React Query (tRPC 연동)                        | 효율적인 데이터 fetching, 캐싱, 동기화 및 tRPC와의 강력한 통합 |
|                         | React Navigation                               | 유연하고 확장 가능한 내비게이션 솔루션                         |
|                         | Firebase Authentication                        | 간편하고 안전한 사용자 인증 (Google, Apple 로그인 포함)        |
|                         | `react-native-vector-icons`                    | 일관된 UI/UX                                                   |
|                         | `@invertase/react-native-apple-authentication` | Apple 로그인 기능 통합                                         |
| **백엔드 (서버)**       | Node.js                                        | 비동기 처리 및 확장성, JavaScript 생태계 활용                  |
|                         | Express.js                                     | 빠르고 최소화된 웹 애플리케이션 프레임워크                     |
|                         | tRPC                                           | 타입 안전성을 보장하는 엔드투엔드 API 개발                     |
|                         | PostgreSQL (Supabase)                          | 안정적이고 강력한 관계형 데이터베이스                          |
|                         | Prisma                                         | 현대적인 ORM으로 데이터베이스 접근 및 마이그레이션 관리        |
|                         | Firebase Admin SDK                             | Firebase 서비스와의 안전한 서버 측 상호작용 및 인증 관리       |
| **AI 서버**             | Python                                         | AI/ML 라이브러리 및 생태계의 풍부함                            |
|                         | LangChain                                      | LLM 애플리케이션 개발을 위한 프레임워크                        |
|                         | Ollama                                         | 로컬 LLM 모델 실행 및 관리                                     |
| **개발 환경**             | TurboRepo                                      | 모노레포 구성                                           |
|                         | pnpm                                         | 패키지 매니저                                                    |

## 시작하기

### 전제 조건

- Node.js (v18 이상)
- pnpm
- Docker (PostgreSQL 데이터베이스 실행용)
- Firebase 프로젝트 설정 (Authentication 활성화, Admin SDK 서비스 계정 키 발급)

### 설치

1.  **저장소 복제:**

    ```bash
    git clone <저장소-URL>
    cd recipflash
    ```

2.  **의존성 설치:**
    ```bash
    pnpm install
    ```

### 환경 변수 설정

각 `apps/server` 및 `apps/mobile` 디렉토리에 `.env` 파일을 생성하고 다음 변수들을 설정해야 합니다.

#### `apps/server/.env`

```env
DATABASE_URL="postgresql://{USER}:{PASSWORD}@{HOST}:{PORT}/{DATABASE}?sslmode=require"
FIREBASE_SERVICE_ACCOUNT_KEY='{Firebase Admin SDK 서비스 계정 키 JSON 내용}'
AWS_S3_BUCKET_URL="https://{BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com"
```

- `DATABASE_URL`: PostgreSQL 데이터베이스 연결 문자열.
- `FIREBASE_SERVICE_ACCOUNT_KEY`: Firebase Admin SDK에서 발급받은 서비스 계정 키 JSON 파일의 내용을 직접 붙여넣습니다. (줄바꿈 포함)
- `AWS_S3_BUCKET_URL`: 업로드한 파일이 저장되길 원하는 경로. (여기에선 AWS S3 이용)

#### `apps/mobile/.env`

```env
API_URL=http://localhost:4000
WEB_CLIENT_ID=~~~.apps.googleusercontent.com
```

- `API_URL`: 백엔드 서버의 URL입니다. 개발 환경에서는 `http://localhost:4000`을 사용합니다.
- `WEB_CLIENT_ID`: Firebase > Authentication > 로그인 제공업체 > 구글 > 웹 SDK 구성 > 웹 클라이언트 ID

### 데이터베이스 설정

1.  **PostgreSQL 실행 (Docker):**

    ```bash
    docker run --name recipflash-db -e POSTGRES_USER=user -e POSTGRES_PASSWORD=password -e POSTGRES_DB=recipflash -p 5432:5432 -d postgres
    ```

    (위 명령어는 예시이며, 실제 환경에 맞게 사용자, 비밀번호, 데이터베이스 이름 등을 변경하세요.)

2.  **Prisma 마이그레이션 적용:**
    `apps/server` 디렉토리로 이동하여 마이그레이션을 적용합니다.
    ```bash
    cd apps/server
    npx prisma migrate dev
    cd ../..
    ```

### 애플리케이션 실행

1.  **AI 서버 실행:**
    우선 Ollama를 설치하고, 모델을 설치하여 실행합니다.

    ```bash
    ollama run llama3
    ```
    
    그 다음 `apps/ai` 디렉토리에서 다음 명령어를 실행합니다.

    ```bash
    cd apps/ai
    pnpm dev
    ```

2.  **백엔드 서버 실행:**
    `apps/server` 디렉토리에서 다음 명령어를 실행합니다.

    ```bash
    cd apps/server
    pnpm dev
    ```

    서버는 기본적으로 `http://localhost:4000`에서 실행됩니다.

3.  **모바일 애플리케이션 실행:**
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
