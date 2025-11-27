# hot-updater 설정 가이드 (Supabase)

## 초기 상태

- Supabase 프로젝트 생성됨
- hot-updater 패키지 설치됨 (`@hot-updater/react-native`, `@hot-updater/supabase`)
- `hot-updater.config.ts` 작성됨
- **하지만 데이터베이스 테이블과 Edge Function이 없음**

## 1. Supabase 설정

### 1.1 데이터베이스 테이블 생성

**Supabase Dashboard → SQL Editor**에서 다음 SQL 실행:

```sql
-- UUID 확장 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- bundles 테이블 생성
CREATE TABLE public.bundles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  should_force_update BOOLEAN DEFAULT false,
  file_hash TEXT,
  git_commit_hash TEXT,
  message TEXT,
  platform TEXT NOT NULL,
  target_app_version TEXT NOT NULL,
  fingerprint_hash TEXT,
  storage_uri TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_bundles_lookup
  ON bundles(channel, platform, target_app_version, enabled);

-- get_channels RPC 함수 생성
CREATE OR REPLACE FUNCTION get_channels()
RETURNS TABLE(channel TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT b.channel
  FROM bundles b
  ORDER BY b.channel;
END;
$$ LANGUAGE plpgsql;

-- RLS 비활성화 (service_role이 관리)
ALTER TABLE bundles DISABLE ROW LEVEL SECURITY;

-- 권한 부여
GRANT ALL ON TABLE public.bundles TO service_role;
GRANT SELECT ON TABLE public.bundles TO anon;
GRANT EXECUTE ON FUNCTION get_channels() TO service_role;
GRANT EXECUTE ON FUNCTION get_channels() TO anon;
```

### 1.2 Storage Bucket 생성

**Supabase Dashboard → Storage:**

1. "New bucket" 클릭
2. Name: `hot-updator` (설정 파일의 `HOT_UPDATER_SUPABASE_BUCKET_NAME`과 일치)
3. **Public bucket** 체크 또는 RLS 정책 설정:

```sql
-- Public read access
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'hot-updator' );
```

## 2. Edge Function 생성

### 2.1 Supabase CLI 설치

```bash
brew install supabase/tap/supabase
```

### 2.2 프로젝트 연결

```bash
cd apps/mobile
supabase init
supabase link --project-ref YOUR_PROJECT_REF
```

### 2.3 Edge Function 생성

```bash
supabase functions new update-server
```

### 2.4 Edge Function 코드 작성

`apps/mobile/supabase/functions/update-server/index.ts`:

```typescript
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

interface UpdateRequest {
  appVersion: string;
  platform: 'ios' | 'android';
  fingerprint?: string;
}

Deno.serve(async req => {
  console.log('=== Request Details ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
        Deno.env.get('SUPABASE_ANON_KEY') ??
        '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      },
    );

    let appVersion: string;
    let platform: string;
    let channel: string;
    let bundleId: string | undefined;
    let minBundleId: string | undefined;

    // Parse URL path parameters
    // URL format: /app-version/{platform}/{appVersion}/{channel}/{minBundleId}/{bundleId}
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const appVersionIndex = pathParts.indexOf('app-version');

    if (appVersionIndex !== -1 && pathParts.length >= appVersionIndex + 5) {
      platform = pathParts[appVersionIndex + 1];
      appVersion = pathParts[appVersionIndex + 2];
      channel = pathParts[appVersionIndex + 3];
      minBundleId = pathParts[appVersionIndex + 4];
      bundleId = pathParts[appVersionIndex + 5];
    } else {
      platform = req.headers.get('x-app-platform') || '';
      appVersion = req.headers.get('x-app-version') || '';
      channel = req.headers.get('x-channel') || 'production';
      bundleId = req.headers.get('x-bundle-id') || undefined;
      minBundleId = req.headers.get('x-min-bundle-id') || undefined;
    }

    if (!appVersion || !platform) {
      return new Response(JSON.stringify(null), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Request params:', {
      appVersion,
      platform,
      channel,
      bundleId,
      minBundleId,
    });

    // Query bundles table
    const { data, error } = await supabase
      .from('bundles')
      .select('*')
      .eq('target_app_version', appVersion)
      .eq('platform', platform)
      .eq('channel', channel)
      .eq('enabled', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // ⚠️ 중요: minBundleId도 체크 (무한 로딩 방지)
    if (data && (data.id === bundleId || data.id === minBundleId)) {
      console.log('✓ Bundle is up to date');
      return new Response(JSON.stringify(null), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (error || !data?.storage_uri) {
      console.log('No update available');
      return new Response(JSON.stringify(null), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create signed URL
    const storagePath = data.storage_uri.replace('supabase-storage://', '');
    const [bucketName, ...pathParts2] = storagePath.split('/');
    const filePath = pathParts2.join('/');

    const { data: signedData, error: signError } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(filePath, 3600);

    if (signError || !signedData?.signedUrl) {
      console.error('Failed to create signed URL:', signError);
      return new Response(JSON.stringify(null), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ⚠️ 중요: hot-updater가 기대하는 형식으로 반환
    const response = {
      id: data.id,
      fileUrl: signedData.signedUrl, // bundleUrl 아님!
      fileHash: data.file_hash,
      status: data.should_force_update ? 'required' : 'available',
    };

    console.log('Returning update response:', response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify(null), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

### 2.5 Edge Function 배포

```bash
supabase functions deploy update-server --no-verify-jwt
```

**⚠️ 중요: `--no-verify-jwt` 플래그**

- hot-updater는 JWT 없이 요청을 보내므로 필수

## 3. 앱 설정

### 3.1 환경 변수 설정

`.env.hotupdater`:

```
HOT_UPDATER_SUPABASE_ANON_KEY=your_service_role_key_here
HOT_UPDATER_SUPABASE_BUCKET_NAME=hot-updator
HOT_UPDATER_SUPABASE_URL=https://your-project.supabase.co
```

**⚠️ 중요: service_role 키 사용**

- anon key가 아닌 **service_role** key를 사용해야 bundles 테이블에 쓰기 가능

### 3.2 hot-updater.config.ts

```typescript
import { bare } from '@hot-updater/bare';
import { supabaseDatabase, supabaseStorage } from '@hot-updater/supabase';
import { config } from 'dotenv';
import { defineConfig } from 'hot-updater';

config({ path: '.env.hotupdater' });

export default defineConfig({
  build: bare({ enableHermes: true }),
  storage: supabaseStorage({
    supabaseUrl: process.env.HOT_UPDATER_SUPABASE_URL!,
    supabaseAnonKey: process.env.HOT_UPDATER_SUPABASE_ANON_KEY!,
    bucketName: process.env.HOT_UPDATER_SUPABASE_BUCKET_NAME!,
  }),
  database: supabaseDatabase({
    supabaseUrl: process.env.HOT_UPDATER_SUPABASE_URL!,
    supabaseAnonKey: process.env.HOT_UPDATER_SUPABASE_ANON_KEY!,
  }),
  updateStrategy: 'appVersion',
});
```

### 3.3 App.tsx 설정

```typescript
import { getUpdateSource, HotUpdater } from '@hot-updater/react-native';

export default HotUpdater.wrap({
  source: getUpdateSource(
    'https://your-project.supabase.co/functions/v1/update-server',
    {
      updateStrategy: 'appVersion',
    },
  ),
  requestHeaders: {},
  fallbackComponent: ({ progress, status }) => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>
        {status === 'UPDATING' ? 'Updating...' : 'Checking for Update....'}
      </Text>
      {progress > 0 && <Text>{Math.round(progress * 100)}%</Text>}
    </View>
  ),
})(App);
```

## 4. 테스트

### 4.1 첫 배포

```bash
npx hot-updater deploy --platform ios -t 1.0.3
```

**예상 결과:**

```
✅ Build Complete (bare)
✅ Upload Complete (supabaseStorage)
✅ Update Complete (supabaseDatabase)
🚀 Deployment Successful
```

### 4.2 앱 테스트

**⚠️ 중요: Release 모드로 테스트**

```bash
# XCode에서:
# Product → Scheme → Edit Scheme → Run → Build Configuration → Release

# 또는 터미널에서:
npx react-native run-ios --mode Release
```

**개발 모드(`__DEV__`)에서는 hot-updater가 비활성화됨!**

### 4.3 업데이트 확인

1. 앱 시작 → "Checking for Update...." 표시
2. 업데이트 있으면 → "Updating..." + 진행률 표시
3. 다운로드 완료 → 앱 종료
4. 앱 재시작 → 새 bundle 적용!

## 5. 문제 해결

### 문제 1: "무한 로딩"

**증상:** "Checking for Update...." 화면에서 벗어나지 못함

**원인:** Edge Function이 `minBundleId`를 체크하지 않아 이미 다운로드한 bundle을 계속 반환

**해결:** Edge Function에서 다음 체크 추가:

```typescript
if (data && (data.id === bundleId || data.id === minBundleId)) {
  return new Response(JSON.stringify(null), ...);
}
```

### 문제 2: "업데이트가 적용되지 않음"

**증상:** 배포했는데 앱에 반영 안 됨

**원인:**

1. 개발 모드로 실행 (`__DEV__ = true`)
2. Metro bundler가 연결되어 있음

**해결:**

1. Release 모드로 빌드
2. Metro bundler 종료: `kill -9 $(lsof -ti:8081)`

### 문제 3: "Database error: relation does not exist"

**증상:** bundles 테이블을 찾을 수 없음

**해결:** 1.1절의 SQL을 Supabase Dashboard에서 실행

### 문제 4: "Storage upload failed"

**증상:** bundle 업로드 실패

**원인:**

1. bucket이 없거나 이름이 다름
2. service_role key를 사용하지 않음

**해결:**

1. Storage bucket 이름 확인
2. `.env.hotupdater`에서 service_role key 사용 확인

### 문제 5: "응답 형식 오류"

**증상:** 업데이트를 찾았지만 다운로드 안 됨

**원인:** hot-updater가 기대하는 응답 형식과 다름

**올바른 형식:**

```json
{
  "id": "uuid",
  "fileUrl": "signed-url",
  "fileHash": "hash",
  "status": "available"
}
```

**잘못된 형식:**

```json
{
  "updateAvailable": true,
  "bundleUrl": "...", // fileUrl이어야 함
  "version": "...", // id여야 함
  "fingerprint": "..."
}
```

**업데이트 없을 때:** `null` 반환 (not `{updateAvailable: false}`)

## 6. 디버깅

### Edge Function 로그 확인

**Supabase Dashboard → Edge Functions → update-server → Logs**

확인할 내용:

- Request params (bundleId, minBundleId)
- Database query result
- "✓ Bundle is up to date" vs "Returning update response"

### 앱 로그 확인

XCode 콘솔에서:

- `[HotUpdater]` 키워드로 필터링
- bundleId 확인
- download/update 진행 상황 확인

## 7. 운영

### 정상적인 업데이트 플로우

1. **코드 수정**
2. **배포:** `npx hot-updater deploy --platform ios -t 1.0.3`
3. **사용자 앱 시작** → 업데이트 체크 → 다운로드
4. **사용자 앱 재시작** → 새 bundle 적용

### 주의사항

- ✅ JavaScript/TypeScript 코드 변경: hot-updater로 즉시 배포 가능
- ❌ 네이티브 코드 변경: 스토어 배포 필요
- ❌ package.json 변경 (새 라이브러리 추가): 스토어 배포 필요
- ⚠️ 앱 버전 변경 시: `target_app_version` 업데이트 필요

### 버전 관리 전략

**앱 버전 업그레이드 시:**

```bash
# 기존 버전 1.0.3 사용자를 위한 마지막 업데이트
npx hot-updater deploy --platform ios -t 1.0.3

# 네이티브 빌드 버전 업그레이드 (1.0.3 → 1.0.4)
# iOS: ios/mobile/Info.plist의 CFBundleShortVersionString 변경
# Android: android/app/build.gradle의 versionName 변경

# 스토어 배포 (1.0.4)

# 새 버전을 위한 hot-updater 배포
npx hot-updater deploy --platform ios -t 1.0.4
```

## 8. 보안

### 권장 사항

1. **service_role key 보안:**

   - `.env.hotupdater`를 `.gitignore`에 추가
   - CI/CD 환경 변수로 관리

2. **Storage bucket:**

   - Public bucket 사용 또는
   - Signed URL로 접근 제한 (현재 구현)

3. **Edge Function:**

   - Rate limiting 고려
   - IP 화이트리스트 고려 (필요시)

4. **Bundle 검증:**
   - `fileHash` 검증 활성화
   - `should_force_update` 플래그 활용
