#!/usr/bin/env python3
"""
세 가지 모드 비교 테스트 스크립트:
1. 병렬 처리 (기존) - /generate/menus
2. 순차 스트리밍 - /generate/menus/stream
3. 병렬 스트리밍 - /generate/menus/stream-parallel
"""

import sys
import time
import requests
from pathlib import Path
import mimetypes

API_URL = "http://localhost:8000"

def get_content_type(file_path):
    """파일 확장자로 MIME 타입 감지"""
    mime_type, _ = mimetypes.guess_type(file_path)
    if mime_type:
        return mime_type
    # 기본값
    ext = Path(file_path).suffix.lower()
    if ext == '.pdf':
        return 'application/pdf'
    elif ext in ['.jpg', '.jpeg']:
        return 'image/jpeg'
    elif ext == '.png':
        return 'image/png'
    else:
        return 'application/octet-stream'

def format_time(seconds):
    """초를 보기 좋게 포맷팅"""
    return f"{seconds:.2f}초"

def print_header(title):
    """섹션 헤더 출력"""
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)

def test_parallel_batch(file_path):
    """
    모드 1: 병렬 처리 (기존 방식)
    - 모든 페이지를 동시에 처리
    - 전체 완료 후 한 번에 응답
    """
    print_header("모드 1: 병렬 처리 (기존 방식)")
    print("📝 설명: 모든 페이지를 동시에 처리하고, 전체 완료 후 한 번에 응답")
    print()

    start_time = time.time()
    first_result_time = None

    content_type = get_content_type(file_path)
    with open(file_path, 'rb') as f:
        files = {'file': (Path(file_path).name, f, content_type)}
        response = requests.post(f"{API_URL}/generate/menus", files=files)

    if response.ok:
        total_time = time.time() - start_time
        first_result_time = total_time  # 한 번에 받으므로 첫 결과 = 전체 시간

        data = response.json()
        total_menus = len(data['menus'])

        print(f"✅ 완료!")
        print(f"⏱️  첫 결과까지: {format_time(first_result_time)}")
        print(f"⏱️  전체 시간: {format_time(total_time)}")
        print(f"📋 총 메뉴: {total_menus}개")

        return {
            "mode": "병렬 처리 (기존)",
            "first_result_time": first_result_time,
            "total_time": total_time,
            "total_menus": total_menus
        }
    else:
        print(f"❌ 오류: {response.status_code}")
        return None

def test_sequential_stream(file_path):
    """
    모드 2: 순차 스트리밍
    - 페이지를 순서대로 처리
    - 각 페이지 완료 시마다 즉시 전송
    - 순서 보장
    """
    print_header("모드 2: 순차 스트리밍")
    print("📝 설명: 페이지 1, 2, 3... 순서대로 처리하며 실시간 전송")
    print()

    start_time = time.time()
    first_result_time = None
    total_menus = 0
    total_pages = 0
    page_times = []
    page_receive_times = {}

    content_type = get_content_type(file_path)
    with open(file_path, 'rb') as f:
        files = {'file': (Path(file_path).name, f, content_type)}
        response = requests.post(
            f"{API_URL}/generate/menus/stream",
            files=files,
            stream=True
        )

    if response.ok:
        buffer = ""
        for chunk in response.iter_content(chunk_size=None, decode_unicode=True):
            if chunk:
                buffer += chunk
                lines = buffer.split('\n')
                buffer = lines.pop()

                for line in lines:
                    if line.startswith('data: '):
                        data_str = line[6:]
                        try:
                            import json
                            data = json.loads(data_str)

                            if data['type'] == 'init':
                                total_pages = data['total_pages']
                                print(f"📋 총 페이지: {total_pages}")

                            elif data['type'] == 'progress':
                                receive_time = time.time() - start_time
                                if first_result_time is None:
                                    first_result_time = receive_time

                                page = data['page']
                                page_time = data['page_time']
                                menus = data['menus']
                                total_menus += len(menus)
                                page_times.append(page_time)
                                page_receive_times[page] = receive_time

                                print(f"📄 페이지 {page}/{total_pages} 완료")
                                print(f"   ⏱️  처리 시간: {format_time(page_time)}")
                                print(f"   🕐 전송 시간: {format_time(receive_time)} (시작 후)")
                                print(f"   📋 메뉴: {len(menus)}개")
                                print()

                            elif data['type'] == 'complete':
                                break
                        except:
                            pass

        total_time = time.time() - start_time
        avg_page_time = sum(page_times) / len(page_times) if page_times else 0

        print("=" * 60)
        print(f"✅ 완료!")
        print(f"⏱️  첫 결과까지: {format_time(first_result_time or 0)}")
        print(f"⏱️  전체 시간: {format_time(total_time)}")
        print(f"⏱️  페이지당 평균: {format_time(avg_page_time)}")
        print(f"📋 총 메뉴: {total_menus}개")

        return {
            "mode": "순차 스트리밍",
            "first_result_time": first_result_time or 0,
            "total_time": total_time,
            "total_menus": total_menus,
            "avg_page_time": avg_page_time
        }
    else:
        print(f"❌ 오류: {response.status_code}")
        return None

def test_parallel_stream(file_path):
    """
    모드 3: 병렬 스트리밍
    - 모든 페이지를 동시에 처리
    - 순서대로 전송 (순서 보장)
    - 빠른 첫 결과 + 빠른 전체 시간
    """
    print_header("모드 3: 병렬 스트리밍")
    print("📝 설명: 모든 페이지를 동시에 처리하고, 순서대로 전송 (빠름 + 순서 보장)")
    print()

    start_time = time.time()
    first_result_time = None
    total_menus = 0
    total_pages = 0
    page_times = []
    completed_pages = []
    page_receive_times = {}  # 각 페이지가 전송된 시간 기록

    content_type = get_content_type(file_path)
    with open(file_path, 'rb') as f:
        files = {'file': (Path(file_path).name, f, content_type)}
        response = requests.post(
            f"{API_URL}/generate/menus/stream-parallel",
            files=files,
            stream=True
        )

    if response.ok:
        buffer = ""
        for chunk in response.iter_content(chunk_size=None, decode_unicode=True):
            if chunk:
                buffer += chunk
                lines = buffer.split('\n')
                buffer = lines.pop()

                for line in lines:
                    if line.startswith('data: '):
                        data_str = line[6:]
                        try:
                            import json
                            data = json.loads(data_str)

                            if data['type'] == 'init':
                                total_pages = data['total_pages']
                                print(f"📋 총 페이지: {total_pages}")
                                print(f"⚡ 모든 페이지를 병렬로 처리 중...\n")

                            elif data['type'] == 'progress':
                                receive_time = time.time() - start_time
                                if first_result_time is None:
                                    first_result_time = receive_time

                                page = data['page']
                                page_time = data['page_time']
                                menus = data['menus']
                                total_menus += len(menus)
                                page_times.append(page_time)
                                completed_pages.append(page)
                                page_receive_times[page] = receive_time

                                # 순서 확인
                                is_in_order = page == len(completed_pages)
                                order_indicator = "✓" if is_in_order else "⚠️"

                                print(f"📄 페이지 {page}/{total_pages} 전송 {order_indicator}")
                                print(f"   ⏱️  처리 시간: {format_time(page_time)}")
                                print(f"   🕐 전송 시간: {format_time(receive_time)} (시작 후)")
                                print(f"   📋 메뉴: {len(menus)}개")
                                print()

                            elif data['type'] == 'complete':
                                break
                        except:
                            pass

        total_time = time.time() - start_time
        avg_page_time = sum(page_times) / len(page_times) if page_times else 0

        print("=" * 60)
        print(f"✅ 완료!")
        print(f"⏱️  첫 결과까지: {format_time(first_result_time or 0)}")
        print(f"⏱️  전체 시간: {format_time(total_time)}")
        print(f"⏱️  페이지당 평균 처리: {format_time(avg_page_time)}")
        print(f"📋 총 메뉴: {total_menus}개")

        # 순서 확인
        is_ordered = completed_pages == list(range(1, total_pages + 1))
        order_status = "✅ 순서 보장됨" if is_ordered else f"⚠️ 순서: {' → '.join(map(str, completed_pages))}"
        print(f"📊 {order_status}")

        # 버퍼링 효과 분석
        if page_receive_times and len(page_receive_times) > 1:
            print()
            print("💡 버퍼링 효과:")
            # 가장 빠르게 완료된 페이지
            fastest_page = min(page_times)
            print(f"   - 가장 빠른 페이지: {format_time(fastest_page)}")
            # 전송 간격 (연속으로 전송되었는지 확인)
            intervals = []
            for i in range(2, total_pages + 1):
                if i in page_receive_times and (i-1) in page_receive_times:
                    interval = page_receive_times[i] - page_receive_times[i-1]
                    intervals.append(interval)
            if intervals:
                avg_interval = sum(intervals) / len(intervals)
                print(f"   - 평균 전송 간격: {format_time(avg_interval)}")
                if avg_interval < 0.5:
                    print(f"   - 🎉 버퍼링 효과 확인! (연속 전송)")

        return {
            "mode": "병렬 스트리밍",
            "first_result_time": first_result_time or 0,
            "total_time": total_time,
            "total_menus": total_menus,
            "avg_page_time": avg_page_time,
            "is_ordered": is_ordered
        }
    else:
        print(f"❌ 오류: {response.status_code}")
        return None

def print_comparison(results):
    """결과 비교 출력"""
    print_header("📊 최종 비교")
    print()

    # 테이블 헤더
    print(f"{'모드':<20} {'첫 결과':<12} {'전체 시간':<12} {'총 메뉴':<10}")
    print("-" * 60)

    # 각 모드 결과
    for result in results:
        if result:
            print(f"{result['mode']:<20} {format_time(result['first_result_time']):<12} {format_time(result['total_time']):<12} {result['total_menus']}개")

    print()
    print_header("💡 각 모드의 장단점")

    print("\n1️⃣  병렬 처리 (기존)")
    print("   장점: 전체 시간이 가장 빠름 (OpenAI 병렬 처리)")
    print("   단점: 결과를 보기까지 오래 기다려야 함 (사용자 체감 느림)")
    print("   추천: 백그라운드 작업, 배치 처리")

    print("\n2️⃣  순차 스트리밍")
    print("   장점: 간단한 구조, 메모리 효율적")
    print("   단점: 전체 시간이 가장 김 (페이지를 하나씩 처리)")
    print("   추천: 메모리가 제한적인 환경")

    print("\n3️⃣  병렬 스트리밍 (버퍼링) ⭐ (추천)")
    print("   장점: 빠름 + 순서 보장 (최고의 조합!)")
    print("   - 병렬 처리로 전체 시간 단축")
    print("   - 페이지 순서대로 전송 (레시피 순서 유지)")
    print("   - 첫 결과가 빠름 (가장 빠른 페이지가 완료되는 즉시)")
    print("   - 버퍼링으로 연속 페이지는 즉시 전송")
    print("   단점: 메모리 사용량 약간 증가")
    print("   추천: 대부분의 경우 (레시피 메뉴는 순서가 중요!)")

    print("\n" + "=" * 60)

def main():
    if len(sys.argv) < 2:
        print("사용법: python test_comparison.py <PDF파일>")
        sys.exit(1)

    file_path = sys.argv[1]

    if not Path(file_path).exists():
        print(f"❌ 파일을 찾을 수 없습니다: {file_path}")
        sys.exit(1)

    print_header("🚀 세 가지 모드 비교 테스트")
    print(f"📄 파일: {Path(file_path).name}")
    print(f"📊 크기: {Path(file_path).stat().st_size / 1024 / 1024:.2f}MB")

    # 서버 연결 확인
    try:
        response = requests.get(f"{API_URL}/")
        if response.ok:
            print(f"✅ 서버 연결 성공: {response.json()['status']}")
        else:
            print(f"❌ 서버 응답 오류: {response.status_code}")
            sys.exit(1)
    except Exception as e:
        print(f"❌ 서버 연결 실패: {e}")
        print(f"서버가 실행 중인지 확인하세요: uvicorn src.main:app --reload --port 8000")
        sys.exit(1)

    results = []

    # 각 모드 테스트
    result1 = test_parallel_batch(file_path)
    if result1:
        results.append(result1)

    input("\n⏸️  다음 테스트를 진행하려면 Enter를 누르세요...")

    result2 = test_sequential_stream(file_path)
    if result2:
        results.append(result2)

    input("\n⏸️  다음 테스트를 진행하려면 Enter를 누르세요...")

    result3 = test_parallel_stream(file_path)
    if result3:
        results.append(result3)

    # 최종 비교
    if results:
        print_comparison(results)

    print("\n✅ 모든 테스트 완료!")

if __name__ == "__main__":
    main()
