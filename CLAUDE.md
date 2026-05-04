# 양심치과 찾기 — 프로젝트 컨텍스트

## 프로젝트 개요
- **앱 이름**: 우리동네 양심치과
- **목적**: 과잉진료 없는 양심치과를 찾아주는 웹앱 (유저 직접 제보 기반)
- **핵심 지표**: `extra_recommended=false` 비율 → 양심치과 판별
- **URL**: https://dental-finder-six.vercel.app
- **호스팅**: Vercel (GitHub 연동 자동 배포)

## 기술 스택
- Next.js 15 (App Router, TypeScript, Tailwind CSS)
- Supabase (PostgreSQL + RLS) — `lib/supabase.ts`에 클라이언트
- Kakao Maps JavaScript API
- 배포: Vercel

## 주요 파일
```
app/
  layout.tsx          — 헤더(🦷 우리동네 양심치과), max-w-4xl 레이아웃
  page.tsx            — 루트 리다이렉트 → /clinics
  clinics/
    page.tsx          — 치과 목록 (탭1: 내 위치 근처, 탭2: 지역 검색)
    [id]/page.tsx     — 치과 상세 (지도, 제보 통계, 제보 폼)
components/
  KakaoMap.tsx        — 카카오 지도 (마커 표시)
  PriceReportForm.tsx — 제보 폼 (치료종류, 가격, 추가권유여부, 후기, 친절도, PIN)
lib/
  supabase.ts         — Supabase 클라이언트
```

## Supabase DB 구조

**clinics** — 심평원 치과 전국 데이터
```
clinic_id UUID PK, hira_code, name, address, city, district,
phone, lat, lng FLOAT8, is_active BOOLEAN
```

**treatment_types** — 진료유형 10개
```
treatment_id INT PK, name TEXT
```

**user_price_reports** — 유저 직접 제보 (핵심 테이블)
```
report_id UUID PK
clinic_id UUID FK → clinics
treatment_id INT FK → treatment_types
visit_id UUID          -- 같은 방문의 복수 치료 묶음
price INTEGER          -- nullable
visit_date DATE        -- nullable
extra_recommended BOOLEAN NOT NULL  -- 추가권유 여부 (핵심!)
extra_note VARCHAR(200)  -- 권유 내용
review_text VARCHAR(500) -- 후기
friendliness_score INTEGER  -- 1~5
nickname VARCHAR(30)
pin VARCHAR(60)        -- 수정/삭제용 4자리 숫자
created_at TIMESTAMPTZ
```
- RLS: SELECT/INSERT 공개 (로그인 불필요)

**price_reports** — 뽐뿌 크롤링 데이터
```
raw_text, post_url, post_date, clinic_id (null 가능)
```

## 환경변수 (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=https://xshjpypkaohmqdmymcho.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...  ← JWT 포맷이어야 함 (sb_publishable_ 아님)
NEXT_PUBLIC_KAKAO_JS_KEY=...
```

## UX 결정사항
- 추가권유없음 비율 배지: ≥80% → green, ≥50% → yellow, <50% → red
- 치과 목록 카드에 배지 표시, 상세 페이지에 치료별 통계 표시
- 제보 폼: 치료종류 복수 선택 → visit_id로 묶어서 insert
- PIN 4자리: 나중에 수정/삭제 시 인증 용도

## 다음 개발 단계
1. PIN으로 제보 수정/삭제 기능
2. 리뷰 작성 기능 (Supabase Auth)
3. 전국 치과로 지역 확대 (현재 서울/경기만)
