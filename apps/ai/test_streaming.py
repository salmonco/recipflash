#!/usr/bin/env python3
"""
스트리밍 테스트 스크립트

사용 전 준비:
    1. 가상환경 활성화:
       source venv/bin/activate

    2. 서버 실행 (다른 터미널):
       uvicorn src.main:app --reload --port 8000

사용법:
    python test_streaming.py <파일경로>

예시:
    python test_streaming.py test_recipe.pdf
"""

import sys
import time
import requests
from pathlib import Path

def test_streaming(file_path: str, server_url: str = "http://localhost:8000"):
    """
    스트리밍 엔드포인트를 테스트합니다.
    """
    file_path = Path(file_path)

    if not file_path.exists():
        print(f"❌ 파일을 찾을 수 없습니다: {file_path}")
        return

    # 파일 크기 확인
    file_size_mb = file_path.stat().st_size / (1024 * 1024)
    print(f"\n{'='*60}")
    print(f"📄 파일: {file_path.name}")
    print(f"📊 크기: {file_size_mb:.2f}MB")
    print(f"{'='*60}\n")

    # 서버 연결 확인
    try:
        response = requests.get(f"{server_url}/")
        if response.status_code != 200:
            print(f"❌ 서버에 연결할 수 없습니다: {server_url}")
            return
        print(f"✅ 서버 연결 성공: {response.json()['status']}")
    except Exception as e:
        print(f"❌ 서버 연결 실패: {e}")
        print(f"💡 서버를 실행하세요: uvicorn src.main:app --reload --port 8000")
        return

    # 스트리밍 테스트 시작
    print(f"\n⏱️  스트리밍 테스트 시작...\n")

    start_time = time.time()
    total_menus = 0
    total_pages = 0

    try:
        with open(file_path, 'rb') as f:
            files = {'file': (file_path.name, f, 'application/pdf' if file_path.suffix == '.pdf' else 'image/jpeg')}

            # SSE 스트리밍 연결
            response = requests.post(
                f"{server_url}/generate/menus/stream",
                files=files,
                stream=True,  # 스트리밍 활성화
                timeout=300
            )

            if response.status_code != 200:
                print(f"❌ 오류 발생: {response.status_code}")
                print(f"메시지: {response.text}")
                return

            # SSE 이벤트 파싱
            for line in response.iter_lines():
                if line:
                    line = line.decode('utf-8')
                    if line.startswith('data: '):
                        data_str = line[6:]  # 'data: ' 제거
                        try:
                            import json
                            data = json.loads(data_str)

                            if data['type'] == 'init':
                                total_pages = data['total_pages']
                                print(f"📋 총 페이지: {total_pages}")
                                print(f"{'='*60}")

                            elif data['type'] == 'progress':
                                page_num = data['page']
                                progress = data['progress']
                                menus = data['menus']
                                page_time = data['page_time']
                                total_menus += len(menus)

                                print(f"📄 페이지 {page_num}/{total_pages} 완료 ({progress}%)")
                                print(f"   ⏱️  시간: {page_time}초")
                                print(f"   📋 메뉴: {len(menus)}개")
                                if menus:
                                    print(f"   🍽️  예시: {menus[0]['name']}")
                                print()

                            elif data['type'] == 'complete':
                                elapsed_time = time.time() - start_time
                                print(f"{'='*60}")
                                print(f"✅ 스트리밍 완료!")
                                print(f"{'='*60}")
                                print(f"⏱️  총 시간: {elapsed_time:.2f}초")
                                print(f"📋 총 메뉴: {total_menus}개")
                                print(f"📄 총 페이지: {data['total_pages']}")
                                print(f"⚡ 페이지당 평균: {elapsed_time/data['total_pages']:.2f}초")
                                print(f"{'='*60}\n")

                            elif data['type'] == 'error':
                                print(f"❌ 오류: {data['message']}")

                        except json.JSONDecodeError:
                            print(f"⚠️  파싱 실패: {data_str}")

    except requests.exceptions.Timeout:
        print(f"\n❌ 타임아웃: 5분 이상 소요됨")
        return
    except Exception as e:
        print(f"\n❌ 예상치 못한 오류: {e}")
        return


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("사용법: python test_streaming.py <파일경로>")
        print("예시: python test_streaming.py test_recipe.pdf")
        sys.exit(1)

    file_path = sys.argv[1]
    server_url = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:8000"

    test_streaming(file_path, server_url)

    print(f"\n💡 팁: 서버 로그를 확인하면 더 자세한 정보를 볼 수 있습니다.")
    print(f"   로그에서 [STREAM] 태그를 찾아보세요!")
