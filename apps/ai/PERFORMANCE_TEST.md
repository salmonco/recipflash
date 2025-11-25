# 성능 개선 테스트 가이드

## 변경 사항 요약

### 1. 병렬 페이지 처리 (apps/ai/src/main.py:252-267)
- **변경 전**: 순차 처리 (for loop)
- **변경 후**: 병렬 처리 (asyncio.gather)
- **예상 효과**: 10페이지 PDF 처리 시간 ~6배 단축

### 2. 병렬 번역 처리 (apps/ai/src/main.py:167-198)
- **변경 전**: 각 메뉴/재료를 순차적으로 번역
- **변경 후**: 모든 번역 작업을 병렬 실행
- **예상 효과**: 번역 시간 ~50% 이상 단축

---

## 테스트 방법

### 0. 가상환경 활성화 (필수)

먼저 Python 가상환경을 활성화해야 합니다:

```bash
cd apps/ai

# 가상환경 활성화
source venv/bin/activate

# 활성화 확인 (프롬프트 앞에 (venv)가 표시됨)
# (venv) user@machine:~/recipflash/apps/ai$

# 필요한 패키지 설치 확인 (최초 1회)
pip install -r requirements.txt
```

### 1. AI 서버 재시작

```bash
cd apps/ai

# 가상환경 활성화 (아직 안 했다면)
source venv/bin/activate

# 기존 프로세스 종료
pkill -f "uvicorn.*main:app"

# 서버 재시작
uvicorn src.main:app --reload --port 8000
```

### 2. 자동 성능 테스트 (추천)

Python 테스트 스크립트를 사용하면 쉽게 성능을 측정할 수 있습니다:

```bash
cd apps/ai

# 가상환경 활성화 (필수)
source venv/bin/activate

# 테스트 실행
python test_performance.py <PDF_또는_이미지_파일_경로>

# 예시
python test_performance.py sample_recipe.pdf
```

**💡 팁**: 새 터미널을 열었다면 반드시 `source venv/bin/activate`를 먼저 실행하세요!

**출력 예시:**
```
============================================================
📄 파일: sample_recipe.pdf
📊 크기: 2.45MB
============================================================

✅ 서버 연결 성공: AI server is running

⏱️  성능 테스트 시작...

============================================================
✅ 테스트 성공!
============================================================
⏱️  총 처리 시간: 32.45초
📋 생성된 메뉴 개수: 47개
⚡ 메뉴당 평균 시간: 0.69초
============================================================

📈 성능 비교:
  변경 전 예상 시간: 180.00초 (순차 처리)
  변경 후 실제 시간: 32.45초 (병렬 처리)
  개선율: 5.55배 빠름
  시간 단축: 147.55초
```

### 3. 수동 테스트 시나리오

#### 시나리오 A: 다중 페이지 PDF (10페이지)
**예상 성능 개선:**
- 변경 전: ~180초 (3분)
- 변경 후: ~30-40초
- 개선율: **약 5-6배 향상**

**테스트 방법:**
1. 앱에서 10페이지 이상의 레시피 PDF 업로드
2. 시작 시간 기록
3. 메뉴 생성 완료까지 시간 측정
4. 서버 로그 확인:
   ```
   Processing 10 pages in parallel...
   Page 1 generated X menus
   Page 2 generated Y menus
   ...
   Total menus generated: Z
   ```

#### 시나리오 B: 단일 페이지 이미지
**예상 성능 개선:**
- 변경 전: ~18-20초
- 변경 후: ~15-18초 (번역 최적화 효과)
- 개선율: **약 20% 향상**

#### 시나리오 C: 영어 메뉴가 많은 경우
**예상 성능 개선:**
- 변경 전: 50개 메뉴 번역에 ~100초 (순차)
- 변경 후: 50개 메뉴 번역에 ~20-30초 (병렬)
- 개선율: **약 3-5배 향상**

---

## 성능 모니터링

### 서버 로그 확인

서버를 실행한 터미널에서 실시간으로 성능 지표를 확인할 수 있습니다.

**주요 로그 메시지:**

```
############################################################
[PERF] NEW REQUEST - File type: application/pdf
############################################################

[PERF] File read took 0.05s (size: 2.45MB)
[PERF] Starting PDF to image conversion...
[PERF] PDF to image conversion took 3.21s for 10 pages
[PERF] OCR for page 1 took 2.45s
[PERF] OCR for page 2 took 2.38s
...
[PERF] Total OCR time: 24.56s
[PERF] Total PDF extraction time: 27.77s

============================================================
[PERF] Starting parallel processing of 10 pages
============================================================

[PERF] LLM parsing took 12.34s, parsed 5 menus
[PERF] Translation took 0.00s
[PERF] Total page processing took 12.34s
...
[PERF] Page 1 generated 5 menus
[PERF] Page 2 generated 4 menus
...

============================================================
[PERF] SUMMARY:
[PERF] Total pages: 10
[PERF] Total menus generated: 47
[PERF] Parallel processing time: 15.23s
[PERF] Total time: 15.25s
[PERF] Average per page: 1.53s
[PERF] Estimated sequential time: 153.00s
[PERF] Speedup: 10.03x
============================================================

############################################################
[PERF] TOTAL REQUEST TIME: 43.02s
[PERF] Total menus in response: 47
############################################################
```

**로그 해석:**
- `File read`: 파일 업로드 시간
- `PDF to image conversion`: PDF를 이미지로 변환하는 시간
- `OCR`: 이미지에서 텍스트 추출하는 시간
- `LLM parsing`: OpenAI로 메뉴 생성하는 시간
- `Translation`: 번역하는 시간
- `Speedup`: 병렬 처리로 얻은 속도 향상 배수

### 성능 측정 팁

#### 1. 간단한 시간 측정 스크립트
```bash
#!/bin/bash
START=$(date +%s)
curl -X POST "http://localhost:8000/generate/menus" \
  -F "file=@test_recipe.pdf"
END=$(date +%s)
DIFF=$((END - START))
echo "처리 시간: ${DIFF}초"
```

#### 2. Python 테스트 스크립트
```python
import time
import requests

start = time.time()
with open('test_recipe.pdf', 'rb') as f:
    response = requests.post(
        'http://localhost:8000/generate/menus',
        files={'file': f}
    )
end = time.time()

print(f"처리 시간: {end - start:.2f}초")
print(f"생성된 메뉴: {len(response.json()['menus'])}개")
```

---

## 예상 성능 비교표

| 페이지 수 | 변경 전 | 변경 후 | 개선율 |
|----------|--------|--------|--------|
| 1페이지  | ~18초   | ~15초   | 20% ↑  |
| 5페이지  | ~90초   | ~20초   | 4.5배 ↑|
| 10페이지 | ~180초  | ~35초   | 5배 ↑  |
| 20페이지 | ~360초  | ~60초   | 6배 ↑  |

*실제 결과는 서버 성능, 네트워크 속도, OpenAI API 응답 시간에 따라 달라질 수 있습니다.*

---

## 주의 사항

### 1. OpenAI API Rate Limit
병렬 처리로 인해 API 호출이 동시에 많이 발생할 수 있습니다:
- GPT-3.5-turbo 기본 제한: 60 RPM (분당 요청)
- 10페이지 PDF = ~20-30개 동시 API 호출
- 제한 초과 시 에러 발생 가능

**해결책:**
- OpenAI API tier 업그레이드
- 또는 페이지 수가 많을 경우 배치 처리 (예: 5페이지씩)

### 2. 메모리 사용량
병렬 처리 시 메모리 사용량이 증가합니다:
- 변경 전: 순차 처리로 메모리 사용 일정
- 변경 후: 모든 페이지 동시 처리로 메모리 사용 증가
- 서버 메모리가 부족한 경우 주의

### 3. 롤백 방법
문제가 발생할 경우:
```bash
git checkout HEAD~1 apps/ai/src/main.py
```

---

## 다음 단계 (Phase 2)

성능 개선 효과 확인 후:
1. **실시간 스트리밍 구현** - WebSocket/SSE로 진행 상황 실시간 전달
2. **알림 기능** - 메뉴 생성 완료 시 푸시 알림
3. **진행률 표시** - 프론트엔드에 진행 바 추가

---

## 문제 발생 시 체크리스트

- [ ] AI 서버가 정상적으로 재시작되었는가?
- [ ] OpenAI API 키가 올바르게 설정되었는가?
- [ ] 서버 로그에 에러 메시지가 있는가?
- [ ] OpenAI API rate limit에 걸리지 않았는가?
- [ ] 서버 메모리가 충분한가?

---

## 피드백

테스트 결과를 기록해주세요:
- 변경 전 평균 처리 시간: ___초
- 변경 후 평균 처리 시간: ___초
- 개선율: ___배 / ___%
- 발견된 이슈: ___
