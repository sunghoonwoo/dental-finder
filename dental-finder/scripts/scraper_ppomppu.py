"""
뽐뿌 건강게시판에서 치과 가격 정보 수집
"""
import re
import time
import requests
import os
from bs4 import BeautifulSoup
from datetime import datetime

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://xshjpypkaohmqdmymcho.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

BASE_URL = "https://www.ppomppu.co.kr/zboard"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Accept-Language": "ko-KR,ko;q=0.9",
}

DENTAL_KEYWORDS = ["치과", "임플란트", "교정", "스케일링", "크라운", "신경치료", "잇몸치료"]

TREATMENT_PATTERNS = {
    "임플란트": ["임플란트"],
    "교정":    ["교정", "브라켓", "인비절라인"],
    "스케일링": ["스케일링"],
    "크라운":  ["크라운", "씌우"],
    "신경치료": ["신경치료", "근관"],
    "충치치료": ["충치", "레진", "아말감"],
    "잇몸치료": ["잇몸", "치주"],
    "라미네이트": ["라미네이트"],
    "틀니":    ["틀니", "의치"],
}


def get_post_list(keyword: str, pages: int = 5) -> list[dict]:
    """키워드로 게시글 목록 수집"""
    posts = []
    for page in range(pages):
        url = f"{BASE_URL}/zboard.php"
        params = {
            "id": "health",
            "search_type": "sub_memo",
            "keyword": keyword,
            "page": page,
        }
        try:
            res = requests.get(url, params=params, headers=HEADERS, timeout=10)
            soup = BeautifulSoup(res.text, "html.parser")

            rows = soup.select("tr.baseList")
            for row in rows:
                title_el = row.select_one("a.baseList-title")
                date_el  = row.select_one("time.baseList-time")

                if not title_el:
                    continue

                href = title_el.get("href", "")
                post_url = f"{BASE_URL}/{href}" if href else ""
                title = title_el.get_text(strip=True)
                date_str = date_el.get_text(strip=True) if date_el else ""

                posts.append({
                    "title":    title,
                    "url":      post_url,
                    "date_str": date_str,
                })

            time.sleep(0.5)
        except Exception as e:
            print(f"  목록 수집 오류: {e}")

    return posts


def get_post_content(url: str) -> str:
    """게시글 본문 수집"""
    try:
        res = requests.get(url, headers=HEADERS, timeout=10)
        soup = BeautifulSoup(res.text, "html.parser")
        content_el = soup.select_one("div.JS_ContentMain")
        return content_el.get_text(separator="\n", strip=True) if content_el else ""
    except Exception:
        return ""


def extract_price(text: str):
    """텍스트에서 가격 추출 (원 단위)"""
    # 패턴: 150만원, 150만 원, 1,500,000원, 150만
    patterns = [
        r'(\d+(?:\.\d+)?)[\s]?만[\s]?원',   # X만원
        r'(\d+(?:\.\d+)?)[\s]?만',            # X만
        r'(\d{1,3}(?:,\d{3})+)[\s]?원',      # X,XXX,XXX원
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            val = match.group(1).replace(",", "")
            price = float(val)
            if "만" in pattern:
                price = int(price * 10000)
            else:
                price = int(price)
            if 1000 <= price <= 100_000_000:
                return price
    return None


def extract_treatment(text: str):
    """텍스트에서 진료 유형 추출"""
    for treatment, keywords in TREATMENT_PATTERNS.items():
        for kw in keywords:
            if kw in text:
                return treatment
    return None


def extract_clinic_name(text: str):
    """텍스트에서 치과명 추출 (간단한 패턴)"""
    patterns = [
        r'([가-힣]+치과(?:의원|병원)?)',
        r'([가-힣]{2,10})\s*치과',
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(0).strip()
    return None


def extract_location(text: str):
    """텍스트에서 지역 추출"""
    loc_patterns = [
        r'(강남|강북|강서|강동|서초|송파|마포|용산|종로|중구|성동|광진|동대문|중랑|성북|도봉|노원|은평|서대문|양천|구로|금천|영등포|동작|관악|강남구|서초구)',
        r'(수원|성남|의정부|안양|부천|광명|평택|동두천|안산|고양|과천|구리|남양주|오산|시흥|군포|의왕|하남|용인|파주|이천|안성|김포|화성|광주|양주|포천|여주)',
    ]
    for pattern in loc_patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(1)
    return None


def save_to_supabase(records: list[dict]):
    """Supabase price_reports 테이블에 저장"""
    if not records:
        return
    headers = {
        "apikey":        SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type":  "application/json",
    }
    url = f"{SUPABASE_URL}/rest/v1/price_reports"
    res = requests.post(url, json=records, headers=headers)
    if res.status_code in (200, 201):
        print(f"  저장 완료: {len(records)}건")
    else:
        print(f"  저장 오류 ({res.status_code}): {res.text[:200]}")


def run():
    all_records = []
    seen_urls = set()

    for keyword in DENTAL_KEYWORDS:
        print(f"\n[{keyword}] 게시글 수집 중...")
        posts = get_post_list(keyword, pages=5)
        print(f"  {len(posts)}개 게시글 발견")

        for post in posts:
            if post["url"] in seen_urls:
                continue
            seen_urls.add(post["url"])

            content = get_post_content(post["url"])
            full_text = post["title"] + "\n" + content

            price     = extract_price(full_text)
            treatment = extract_treatment(full_text)
            clinic    = extract_clinic_name(full_text)
            location  = extract_location(full_text)

            if not price or not treatment:
                continue

            try:
                post_date = datetime.strptime("20" + post["date_str"], "%Y/%m/%d").date().isoformat()
            except Exception:
                post_date = None

            all_records.append({
                "clinic_name_raw": clinic or "알수없음",
                "treatment_name":  treatment,
                "price":           price,
                "location_raw":    location,
                "source":          "ppomppu",
                "post_url":        post["url"],
                "post_date":       post_date,
                "raw_text":        full_text[:500],
            })

        time.sleep(1)

    print(f"\n총 {len(all_records)}건 추출")
    if all_records:
        save_to_supabase(all_records)
    print("완료!")


if __name__ == "__main__":
    if not SUPABASE_KEY:
        print("오류: SUPABASE_KEY 환경변수가 설정되지 않았습니다.")
        exit(1)
    run()
