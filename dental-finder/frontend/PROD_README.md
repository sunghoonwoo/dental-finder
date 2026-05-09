# 우리동네 양심치과 - Production Deployment Guide

## 프로젝트 개요
- **앱 이름**: 우리동네 양심치과
- **목적**: 과잉진료 없는 양심치과를 찾아주는 웹앱 (유저 직접 제보 기반)
- **핵심 지표**: `extra_recommended=false` 비율 → 양심치과 판별
- **URL**: https://dental-finder-six.vercel.app
- **호스팅**: Vercel (GitHub 연동 자동 배포)

## 기술 스택
- Next.js 15 (App Router, TypeScript, Tailwind CSS)
- Supabase (PostgreSQL + RLS)
- Kakao Maps JavaScript API
- 배포: Vercel

## 환경변수 설정 (Vercel Dashboard)

다음 환경변수를 Vercel 프로젝트 설정에 추가하세요:

```
NEXT_PUBLIC_SUPABASE_URL=https://xshjpypkaohmqdmymcho.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... (JWT 포맷)
NEXT_PUBLIC_KAKAO_JS_KEY=your_kakao_js_key
```

**주의**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`는 `sb_publishable_`로 시작하지 않고 `eyJ`로 시작하는 JWT 포맷이어야 합니다.

## 프로젝트 구조

```
dental-finder/frontend/
├── app/
│   ├── layout.tsx          # 헤더, max-w-4xl 레이아웃
│   ├── page.tsx            # 루트 리다이렉트 → /clinics
│   ├── manifest.ts         # PWA 매니페스트
│   ├── globals.css        # 전역 스타일
│   └── clinics/
│       ├── page.tsx        # 치과 목록 (내 위치 근처 + 지역 검색)
│       └── [id]/page.tsx   # 치과 상세 (지도, 제보, 수정/삭제)
├── components/
│   ├── NearbyMap.tsx      # 내 위치 근처 지도 (마커, 영역 검색)
│   ├── KakaoMap.tsx       # 기본 카카오 지도
│   ├── HospitalList.tsx    # 치과 목록 리스트
│   ├── SearchButtons.tsx   # 위치 찾기 / 이 지역 검색 버튼
│   └── PriceReportForm.tsx # 제보 폼 (치료종류, 가격, 추가권유, 후기, 친절도, PIN)
├── hooks/
│   └── useClinics.ts     # 치과 목록 조회 훅 (근처/지역/검색/필터)
├── lib/
│   ├── supabase.ts        # Supabase 클라이언트
│   └── clinicUtils.ts     # 거리계산, 리포트 요약, 배지 생성
└── public/               # 정적 파일 (favicon, etc.)
```

## 주요 기능

### 1. 치과 검색
- **내 위치 근처**: Geolocation API로 현재 위치 기반 5km 내 치과 검색
- **지역으로 찾기**: 시/도, 구/군 선택 + 이름 검색
- **이 지역 검색**: 지도 영역 내 치과 표시 (Search in this Area)

### 2. 필터링 (AND 조건)
- **경험 공유된 곳**: `user_price_reports`에 제보가 있는 치과만 표시
- **지역 + 검색어 + 필터**: 모든 조건을 동시 만족하는 결과만 표시
- **URL 파라미터 동기화**: `?city=서울&district=강서구&q=포&reportOnly=true`

### 3. 제보 시스템
- **작성**: 치료종류(복수 선택), 가격, 추가권유 여부, 후기, 친절도, 닉네임, PIN(4자리)
- **수정/삭제**: PIN 입력으로 본인 제보만 수정/삭제 가능
- **그룹핑**: 같은 방문(visit_id)의 치료들은 하나의 제보로 표시

### 4. 데이터 일관성
- **리스트뷰**: 방문(visit) 수 기준 카운트 → "제보 N건"
- **상세뷰**: visit_id 기준 그룹핑하여 표시
- **배지**: 추가권유 없음 비율 ≥80% 초록, ≥50% 노랑, <50% 빨강

## Supabase DB 구조

### clinics
```
clinic_id UUID PK, hira_code, name, address, city, district,
phone, lat DECIMAL(10,7), lng DECIMAL(10,7), is_active BOOLEAN, created_at TIMESTAMPTZ
```

### user_price_reports (핵심 테이블)
```
report_id UUID PK, clinic_id UUID FK, treatment_id INT FK, visit_id UUID,
price INTEGER, visit_date DATE, extra_recommended BOOLEAN NOT NULL,
extra_note VARCHAR(200), review_text VARCHAR(500),
friendliness_score INTEGER (1~5), nickname VARCHAR(30),
pin VARCHAR(4), created_at TIMESTAMPTZ
```

### treatment_types
```
treatment_id SERIAL PK, name VARCHAR(50), category VARCHAR(30)
```

### price_reports (커뮤니티 크롤링 데이터)
```
report_id UUID PK, clinic_id UUID FK (nullable), treatment_name,
price INTEGER, raw_text, post_url, post_date
```

## Supabase RPC 함수

```sql
-- 해당 city의 district 목록 반환
get_districts(p_city TEXT) RETURNS TABLE(district TEXT)

-- PIN 필요 여부 (첫 제보인지)
report_requires_pin(p_report_id UUID) RETURNS BOOLEAN

-- PIN 확인 후 삭제 (같은 visit_id도 함께 삭제)
delete_report_with_pin(p_report_id UUID, p_pin TEXT) RETURNS BOOLEAN

-- PIN 검증
verify_report_pin(p_report_id UUID, p_pin TEXT) RETURNS BOOLEAN
```

## 배포 전 체크리스트

### 1. 빌드 테스트
```bash
cd dental-finder/frontend
npm run build
```

### 2. 환경변수 확인
- [ ] `NEXT_PUBLIC_SUPABASE_URL` 설정됨
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` 설정됨 (JWT 포맷)
- [ ] `NEXT_PUBLIC_KAKAO_JS_KEY` 설정됨

### 3. HTTPS 및 Geolocation
- Vercel 배포는 자동으로 HTTPS 제공
- Geolocation API는 HTTPS에서만 동작함 (배포 환경에서 정상 작동)

### 4. 카카오맵 API 설정
- 카카오 디벨로퍼 콘솔에서 배포 도메인(vercel.app)을 허용 도메인으로 추가

## 문제 해결

### 빌드 에러
```bash
# Node modules 재설치
rm -rf node_modules package-lock.json
npm install
```

### 환경변수 문제
- Vercel Dashboard → Settings → Environment Variables 확인
- Production 환경에 변수 추가했는지 확인

### 지도 안 나옴
- 카카오 JS 키 확인
- 브라우저 콘솔에서 API 에러 메시지 확인

## 최적화 완료 사항
- [x] 디버그 `console.log` 제거
- [x] Korean 라벨 적용 (제보 있는 곳만 → 경험 공유된 곳)
- [x] URL 파라미터로 필터 상태 유지
- [x] visit_id 기준 리포트 카운트 (데이터 일관성)
- [x] 지역 + 검색어 + 필터 AND 조건 적용

## 라이선스
MIT License
