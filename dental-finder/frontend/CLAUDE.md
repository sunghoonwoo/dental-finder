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
    [id]/page.tsx     — 치과 상세 (지도, 제보 통계, 제보 폼, 수정/삭제)
components/
  KakaoMap.tsx        — 카카오 지도 (기본)
  NearbyMap.tsx       — 내 위치 근처 지도 (마커, 영역 검색)
  HospitalList.tsx    — 치과 목록 리스트 컴포넌트
  SearchButtons.tsx    — 내 위치 찾기 / 이 지역 검색 버튼
  PriceReportForm.tsx  — 제보 폼 (치료종류, 가격, 추가권유여부, 후기, 친절도, PIN)
hooks/
  useClinics.ts       — 치과 목록 조회 훅 (근처/지역/검색/필터)
lib/
  supabase.ts         — Supabase 클라이언트
  clinicUtils.ts      — 거리계산, 리포트 요약, 배지 생성 유틸
```

## Supabase DB 구조

**clinics** — 심평원 치과 전국 데이터
```
clinic_id UUID PK, hira_code, name, address, city, district,
phone, lat, lng DECIMAL(10,7), is_active BOOLEAN, created_at TIMESTAMPTZ
```

**treatment_types** — 진료유형 10개
```
treatment_id SERIAL PK, name VARCHAR(50), category VARCHAR(30)
```
- RLS: SELECT 공개

**user_price_reports** — 유저 직접 제보 (핵심 테이블)
```
report_id UUID PK DEFAULT gen_random_uuid()
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
pin VARCHAR(4)         -- 수정/삭제용 4자리 숫자
created_at TIMESTAMPTZ DEFAULT now()
```
- RLS: SELECT/INSERT 공개 (로그인 불필요)
- same visit_id rows = one visit, one PIN

**price_reports** — 뽐뿌 크롤링 데이터
```
report_id UUID PK, clinic_id UUID FK → clinics (nullable),
treatment_name, price, raw_text, post_url, post_date
```

**reviews** — (구버전, 현재 사용 안함)
- review_treatment_tags와 함께 하위 호환용으로 존재

## Supabase RPC 함수
- `get_districts(p_city)` — 해당 city의 district 목록 반환
- `report_requires_pin(p_report_id)` — PIN 필요 여부 (첫 제보인지)
- `delete_report_with_pin(p_report_id, p_pin)` — PIN 확인 후 삭제 (같은 visit_id도 함께 삭제)
- `verify_report_pin(p_report_id, p_pin)` — PIN 검증

## 환경변수 (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=https://xshjpypkaohmqdmymcho.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...  ← JWT 포맷 (sb_publishable_ 아님)
NEXT_PUBLIC_KAKAO_JS_KEY=...
```

## UX 결정사항
- 추가권유없음 비율 배지: ≥80% → green, ≥50% → yellow, <50% → red
- 치과 목록 카드에 배지 표시, 상세 페이지에 visit별 그룹핑 표시
- 제보 폼: 치료종류 복수 선택 → visit_id로 묶어서 insert
- PIN 4자리: 수정/삭제 시 인증 (edit/delete 버튼 → PIN 입력 프롬프트)
- 내 위치: Geolocation API, 5km 반경, 24시간 캐시
- 이 지역 검색: 지도 영역 내 치과 표시 (bounds 기반)
- 제보 있는 곳만 필터: user_price_reports 존재하는 치과만 표시
- 전국/서울/경기/부산/인천 등 17개 시도 지원

## 구현 완료된 기능
1. ✅ 치과 목록 (내 위치 근처 + 지역 검색 탭)
2. ✅ 카카오맵 연동 (상세페이지 + 근처 검색)
3. ✅ 유저 제보 작성 (치료종류, 가격, 추가권유, 후기, 친절도, PIN)
4. ✅ PIN으로 제보 수정/삭제
5. ✅ 전국 치과 지역 확대 (17개 시도)
6. ✅ 제보 있는 곳만 필터
7. ✅ 커뮤니티(뽐뿌) 가격정보 표시

## 다음 개발 단계
1. 리뷰 작성 기능 (Supabase Auth) — 선택사항 (현재 PIN 기반으로 충분할 수 있음)
2. 관리자 페이지 (부정제보 신고/삭제)
3. 제보 통계 대시보드 (치과별 상세 분석)
4. PWA 지원 (manifest.ts 존재, 추가 최적화)
5. SEO 최적화 (치과 상세페이지 메타태그)
