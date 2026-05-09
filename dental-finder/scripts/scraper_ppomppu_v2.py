"""
뽐뿌 건강게시판 치과 후기/가격 정보 수집 v2
- 치과 이름이 명확한 게시글만 수집
- Supabase clinics DB와 매칭하여 clinic_id 연결
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

# 후기/추천/가격 언급이 있을 법한 키워드
SEARCH_KEYWORDS = [
    "치과 후기", "치과 추천", "치과 가격", "치과 비용",
    "임플란트 후기", "교정 후기", "스케일링 후기",
    "크라운 후기", "신경치료 후기",
]

TREATMENT_PATTERNS = {
    "임플란트": ["임플란트"],
    "교정":     ["교정", "브라켓", "인비절라인"],
    "스케일링":  ["스케일링"],
    "크라운":   ["크라운", "씌우"],
    "신경치료":  ["신경치료", "근관"],
    "충치치료":  ["충치", "레진", "아말감", "인레이"],
    "잇몸치료":  ["잇몸", "치주"],
    "라미네이트": ["라미네이트"],
    "틀니":     ["틀니", "의치"],
}

# 무의미한 치과명 필터 (매칭 불가한 일반 표현)
INVALID_CLINIC_PREFIXES = [
    "동네", "근처", "집근처", "주변", "다른", "이전", "기존",
    "진료받던", "그", "이", "저", "우리", "담당", "인근",
    "대학", "대형", "싼", "비싼", "좋은", "유명한",
]


def get_post_list(keyword: str, pages: int = 10) -> list[dict]:
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
                date_el = row.select_one("time.baseList-time")
                if not title_el:
                    continue
                href = title_el.get("href", "")
                posts.append({
                    "title":    title_el.get_text(strip=True),
                    "url":      f"{BASE_URL}/{href}" if href else "",
                    "date_str": date_el.get_text(strip=True) if date_el else "",
                })
            time.sleep(0.5)
        except Exception as e:
            print(f"  목록 수집 오류: {e}")
    return posts


def get_post_content(url: str) -> str:
    try:
        res = requests.get(url, headers=HEADERS, timeout=10)
        soup = BeautifulSoup(res.text, "html.parser")
        content_el = soup.select_one("div.JS_ContentMain")
        return content_el.get_text(separator="\n", strip=True) if content_el else ""
    except Exception:
        return ""


# 조사/어미로 끝나는 접두어는 고유명사가 아님
INVALID_ENDINGS = set("은는이가을를에서로된한인른운쪽전후중외내상하기식형등적")

def extract_clinic_names(text: str) -> list[str]:
    """텍스트에서 구체적 치과명 추출 (복수 가능)"""
    pattern = r'([가-힣]{2,10})\s*치과(?:의원|병원)?'
    found = set()
    for m in re.finditer(pattern, text):
        prefix = m.group(1).strip()
        # 어미/조사로 끝나면 고유명사 아님
        if prefix[-1] in INVALID_ENDINGS:
            continue
        # 일반적 표현 필터
        if any(prefix.startswith(inv) for inv in INVALID_CLINIC_PREFIXES):
            continue
        if len(prefix) < 2:
            continue
        full_name = m.group(0).strip()
        found.add(full_name)
    return list(found)


def extract_price(text: str):
    patterns = [
        r'(\d+(?:\.\d+)?)[\s]?만[\s]?원',
        r'(\d+(?:\.\d+)?)[\s]?만',
        r'(\d{1,3}(?:,\d{3})+)[\s]?원',
    ]
    for pattern in patterns:
        m = re.search(pattern, text)
        if m:
            val = m.group(1).replace(",", "")
            price = float(val)
            if "만" in pattern:
                price = int(price * 10000)
            else:
                price = int(price)
            if 1000 <= price <= 100_000_000:
                return price
    return None


def extract_treatment(text: str):
    for treatment, keywords in TREATMENT_PATTERNS.items():
        for kw in keywords:
            if kw in text:
                return treatment
    return None


def extract_location(text: str):
    loc_patterns = [
        r'(강남|강북|강서|강동|서초|송파|마포|용산|종로|중구|성동|광진|동대문|중랑|성북|도봉|노원|은평|서대문|양천|구로|금천|영등포|동작|관악)',
        r'(수원|성남|의정부|안양|부천|광명|안산|고양|구리|남양주|오산|시흥|군포|하남|용인|파주|김포|화성|광주|양주)',
    ]
    for pattern in loc_patterns:
        m = re.search(pattern, text)
        if m:
            return m.group(1)
    return None


def fetch_clinics_from_db() -> list[dict]:
    """DB에서 전체 치과 목록 가져오기"""
    print("DB에서 치과 목록 로딩...")
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
    }
    all_clinics = []
    offset = 0
    limit = 1000
    while True:
        res = requests.get(
            f"{SUPABASE_URL}/rest/v1/clinics",
            params={"select": "clinic_id,name,district,city", "is_active": "eq.true",
                    "limit": limit, "offset": offset},
            headers=headers,
            timeout=15,
        )
        batch = res.json()
        if not batch:
            break
        all_clinics.extend(batch)
        if len(batch) < limit:
            break
        offset += limit
    print(f"  {len(all_clinics)}개 치과 로드 완료")
    return all_clinics


def match_clinic(clinic_name_raw: str, location_raw, clinics: list):
    """치과명 + 지역으로 DB 매칭"""
    # 치과명에서 '치과의원', '치과병원', '치과' 제거한 핵심 이름 추출
    core = re.sub(r'치과(?:의원|병원)?', '', clinic_name_raw).strip()
    if len(core) < 2:
        return None

    candidates = []
    for c in clinics:
        db_name = c["name"]
        db_core = re.sub(r'치과(?:의원|병원)?', '', db_name).strip()

        # DB 핵심명도 최소 2자 이상이어야 매칭 의미 있음
        if len(db_core) < 2:
            continue

        # 핵심 이름이 DB 이름에 포함되거나 DB 이름이 핵심 이름에 포함
        if core in db_core or db_core in core:
            score = 0
            # 지역 일치 보너스
            if location_raw and (location_raw in c.get("district", "") or location_raw in c.get("city", "")):
                score += 10
            # 공통 이름 길이 (길수록 정확)
            score += len(min([core, db_core], key=len))
            candidates.append((score, c["clinic_id"], db_name))

    if not candidates:
        return None

    candidates.sort(reverse=True)
    best_score, best_id, best_name = candidates[0]

    # 지역 정보 없이 짧은 이름(3자 이하)은 오매칭 위험 — 스킵
    if len(core) <= 3 and best_score < 10:
        return None

    print(f"    매칭: '{clinic_name_raw}' → '{best_name}' (score={best_score})")
    return best_id


def clear_old_data():
    """기존 price_reports 전체 삭제"""
    print("기존 price_reports 데이터 삭제 중...")
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    res = requests.delete(
        f"{SUPABASE_URL}/rest/v1/price_reports",
        params={"report_id": "neq.00000000-0000-0000-0000-000000000000"},  # 전체 삭제
        headers=headers,
        timeout=15,
    )
    print(f"  삭제 완료 ({res.status_code})")


def save_to_supabase(records: list[dict]):
    if not records:
        return
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    res = requests.post(
        f"{SUPABASE_URL}/rest/v1/price_reports",
        json=records,
        headers=headers,
        timeout=15,
    )
    if res.status_code in (200, 201):
        print(f"  저장 완료: {len(records)}건")
    else:
        print(f"  저장 오류 ({res.status_code}): {res.text[:200]}")


def run():
    clinics = fetch_clinics_from_db()

    all_records = []
    seen_urls = set()

    for keyword in SEARCH_KEYWORDS:
        print(f"\n[{keyword}] 게시글 수집 중...")
        posts = get_post_list(keyword, pages=10)
        print(f"  {len(posts)}개 게시글 발견")

        for post in posts:
            if not post["url"] or post["url"] in seen_urls:
                continue
            seen_urls.add(post["url"])

            content = get_post_content(post["url"])
            full_text = post["title"] + "\n" + content

            clinic_names = extract_clinic_names(full_text)
            if not clinic_names:
                continue  # 치과 이름이 없으면 스킵

            price = extract_price(full_text)
            treatment = extract_treatment(full_text)
            location = extract_location(full_text)

            if not price or not treatment:
                continue

            try:
                post_date = datetime.strptime("20" + post["date_str"], "%Y/%m/%d").date().isoformat()
            except Exception:
                post_date = None

            for clinic_name in clinic_names:
                clinic_id = match_clinic(clinic_name, location, clinics)

                all_records.append({
                    "clinic_id":       clinic_id,
                    "clinic_name_raw": clinic_name,
                    "treatment_name":  treatment,
                    "price":           price,
                    "location_raw":    location,
                    "source":          "ppomppu",
                    "post_url":        post["url"],
                    "post_date":       post_date,
                    "raw_text":        full_text[:500],
                })

        time.sleep(1)

    matched = [r for r in all_records if r["clinic_id"]]
    print(f"\n총 {len(all_records)}건 추출 / 매칭 성공 {len(matched)}건")

    if all_records:
        clear_old_data()
        save_to_supabase(all_records)

    print("완료!")


if __name__ == "__main__":
    if not SUPABASE_KEY:
        print("오류: SUPABASE_KEY 환경변수가 설정되지 않았습니다.")
        exit(1)
    run()
