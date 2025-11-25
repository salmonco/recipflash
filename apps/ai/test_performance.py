#!/usr/bin/env python3
"""
성능 테스트 스크립트

사용 전 준비:
    1. 가상환경 활성화:
       source venv/bin/activate

    2. 서버 실행 (다른 터미널):
       uvicorn src.main:app --reload --port 8000

사용법:
    python test_performance.py <파일경로>

예시:
    python test_performance.py test_recipe.pdf
    python test_performance.py test_image.jpg
"""

import sys
import time
import requests
from pathlib import Path

def test_performance(file_path: str, server_url: str = "http://localhost:8000"):
    """
    주어진 파일로 성능 테스트를 실행합니다.

    Args:
        file_path: 테스트할 PDF 또는 이미지 파일 경로
        server_url: AI 서버 URL (기본값: http://localhost:8000)
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

    # 성능 테스트 시작
    print(f"\n⏱️  성능 테스트 시작...\n")

    start_time = time.time()

    try:
        with open(file_path, 'rb') as f:
            files = {'file': (file_path.name, f, 'application/pdf' if file_path.suffix == '.pdf' else 'image/jpeg')}
            response = requests.post(
                f"{server_url}/generate/menus",
                files=files,
                timeout=300  # 5분 타임아웃
            )

        end_time = time.time()
        elapsed_time = end_time - start_time

        if response.status_code == 200:
            result = response.json()
            menu_count = len(result.get('menus', []))

            print(f"\n{'='*60}")
            print(f"✅ 테스트 성공!")
            print(f"{'='*60}")
            print(f"⏱️  총 처리 시간: {elapsed_time:.2f}초")
            print(f"📋 생성된 메뉴 개수: {menu_count}개")
            print(f"⚡ 메뉴당 평균 시간: {elapsed_time/menu_count:.2f}초" if menu_count > 0 else "")
            print(f"{'='*60}\n")

            # 메뉴 샘플 출력
            if menu_count > 0:
                print("📝 생성된 메뉴 샘플 (최대 5개):")
                for i, menu in enumerate(result['menus'][:5]):
                    print(f"  {i+1}. {menu['name']}")
                    print(f"     재료: {menu['ingredients'][:50]}..." if len(menu['ingredients']) > 50 else f"     재료: {menu['ingredients']}")
                if menu_count > 5:
                    print(f"  ... 외 {menu_count - 5}개")
                print()

            return {
                'success': True,
                'elapsed_time': elapsed_time,
                'menu_count': menu_count,
                'file_size_mb': file_size_mb
            }
        else:
            print(f"\n❌ 오류 발생: {response.status_code}")
            print(f"메시지: {response.text}")
            return None

    except requests.exceptions.Timeout:
        print(f"\n❌ 타임아웃: 5분 이상 소요됨")
        return None
    except Exception as e:
        print(f"\n❌ 예상치 못한 오류: {e}")
        return None


def compare_with_baseline(elapsed_time: float, page_count: int = 10):
    """
    기준 성능과 비교합니다.

    Args:
        elapsed_time: 실제 처리 시간 (초)
        page_count: 페이지 수 (기본값: 10)
    """
    # 변경 전 예상 시간 (순차 처리)
    baseline_time_per_page = 18  # 페이지당 약 18초
    baseline_total = baseline_time_per_page * page_count

    improvement = baseline_total / elapsed_time if elapsed_time > 0 else 0

    print(f"📈 성능 비교:")
    print(f"  변경 전 예상 시간: {baseline_total:.2f}초 (순차 처리)")
    print(f"  변경 후 실제 시간: {elapsed_time:.2f}초 (병렬 처리)")
    print(f"  개선율: {improvement:.2f}배 빠름" if improvement > 1 else f"  개선율: {improvement:.2f}배")
    print(f"  시간 단축: {baseline_total - elapsed_time:.2f}초")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("사용법: python test_performance.py <파일경로>")
        print("예시: python test_performance.py test_recipe.pdf")
        sys.exit(1)

    file_path = sys.argv[1]
    server_url = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:8000"

    result = test_performance(file_path, server_url)

    if result and result['success']:
        # 페이지 수 추정 (1페이지당 약 5개 메뉴 가정)
        estimated_pages = max(1, result['menu_count'] // 5)
        compare_with_baseline(result['elapsed_time'], estimated_pages)

        print(f"\n💡 팁: 서버 로그를 확인하면 더 자세한 성능 지표를 볼 수 있습니다.")
        print(f"   로그에서 [PERF] 태그를 찾아보세요!")
