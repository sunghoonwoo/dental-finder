"""
심평원 전국 병의원 현황 → Supabase clinics 테이블 적재
"""
import pandas as pd
import requests
import os

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://xshjpypkaohmqdmymcho.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

DATA_FILE = "/Users/sunghoon/woo_project/dental-finder/data/전국_병의원_및_약국_현황_2026.3/1.병원정보서비스(2026.3.).xlsx"

CITY_MAP = {
    "서울": "서울", "경기": "경기", "부산": "부산", "인천": "인천",
    "대구": "대구", "광주": "광주", "대전": "대전", "울산": "울산",
    "세종시": "세종", "강원": "강원", "충북": "충북", "충남": "충남",
    "전북": "전북", "전남": "전남", "경북": "경북", "경남": "경남",
    "제주": "제주",
}

def load_and_filter() -> pd.DataFrame:
    print("파일 로딩 중...")
    df = pd.read_excel(DATA_FILE)

    # 치과의원 + 치과병원만
    df = df[df['종별코드명'].str.contains('치과', na=False)]

    # 알려진 시도 중 신규 지역만 (서울/경기는 이미 적재됨)
    df = df[df['시도코드명'].isin(CITY_MAP.keys())]
    df = df[~df['시도코드명'].isin(['서울', '경기'])]

    print(f"필터 결과: {len(df)}개 치과")
    return df.reset_index(drop=True)


def transform(df: pd.DataFrame) -> list[dict]:
    records = []
    for _, row in df.iterrows():
        city = CITY_MAP.get(str(row['시도코드명']).strip(), str(row['시도코드명']).strip())

        lat = float(row['좌표(Y)']) if pd.notna(row['좌표(Y)']) else None
        lng = float(row['좌표(X)']) if pd.notna(row['좌표(X)']) else None

        records.append({
            "hira_code":  str(row['암호화요양기호']).strip(),
            "name":       str(row['요양기관명']).strip(),
            "address":    str(row['주소']).strip() if pd.notna(row['주소']) else "",
            "city":       city,
            "district":   str(row['시군구코드명']).strip(),
            "phone":      str(row['전화번호']).strip() if pd.notna(row['전화번호']) else None,
            "lat":        lat,
            "lng":        lng,
        })
    return records


def load_to_supabase(records: list[dict], batch_size: int = 500):
    headers = {
        "apikey":        SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type":  "application/json",
        "Prefer":        "resolution=ignore-duplicates",
    }
    url = f"{SUPABASE_URL}/rest/v1/clinics"
    total = len(records)

    for i in range(0, total, batch_size):
        batch = records[i:i + batch_size]
        res = requests.post(url, json=batch, headers=headers)
        if res.status_code in (200, 201):
            print(f"  적재 완료: {min(i + batch_size, total)}/{total}")
        else:
            print(f"  오류 ({res.status_code}): {res.text[:200]}")
            break


if __name__ == "__main__":
    if not SUPABASE_KEY:
        print("오류: SUPABASE_KEY 환경변수가 설정되지 않았습니다.")
        exit(1)

    df = load_and_filter()
    records = transform(df)
    print(f"\nSupabase 적재 시작 ({len(records)}건)...")
    load_to_supabase(records)
    print("완료!")
