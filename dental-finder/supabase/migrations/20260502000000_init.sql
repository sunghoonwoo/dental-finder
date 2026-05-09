-- =============================================
-- 치과 과잉진료 앱 - 테이블 생성 스크립트
-- Supabase SQL Editor 에서 실행
-- =============================================

-- 1. 치과
CREATE TABLE IF NOT EXISTS clinics (
    clinic_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hira_code   VARCHAR(20) UNIQUE,
    name        VARCHAR(100) NOT NULL,
    address     VARCHAR(200) NOT NULL,
    city        VARCHAR(20) NOT NULL,
    district    VARCHAR(30) NOT NULL,
    phone       VARCHAR(20),
    lat         DECIMAL(10, 7),
    lng         DECIMAL(10, 7),
    is_active   BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- 2. 사용자
CREATE TABLE IF NOT EXISTS users (
    user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email       VARCHAR(100) UNIQUE NOT NULL,
    nickname    VARCHAR(30) NOT NULL,
    is_verified BOOLEAN DEFAULT false,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- 3. 진료유형
CREATE TABLE IF NOT EXISTS treatment_types (
    treatment_id    SERIAL PRIMARY KEY,
    name            VARCHAR(50) NOT NULL,
    category        VARCHAR(30)
);

-- 4. 리뷰
CREATE TABLE IF NOT EXISTS reviews (
    review_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id               UUID NOT NULL REFERENCES clinics(clinic_id),
    user_id                 UUID NOT NULL REFERENCES users(user_id),
    visit_date              DATE NOT NULL,
    unnecessary_treatment   BOOLEAN,
    price_excessive         BOOLEAN,
    non_covered_pushed      BOOLEAN,
    pressure_felt           BOOLEAN,
    score_explanation       SMALLINT CHECK (score_explanation BETWEEN 1 AND 5),
    score_trust             SMALLINT CHECK (score_trust BETWEEN 1 AND 5),
    score_price             SMALLINT CHECK (score_price BETWEEN 1 AND 5),
    content                 TEXT,
    is_verified_visit       BOOLEAN DEFAULT false,
    is_hidden               BOOLEAN DEFAULT false,
    created_at              TIMESTAMPTZ DEFAULT now(),
    UNIQUE (clinic_id, user_id, visit_date)
);

-- 5. 리뷰-진료유형 연결
CREATE TABLE IF NOT EXISTS review_treatment_tags (
    review_id       UUID REFERENCES reviews(review_id) ON DELETE CASCADE,
    treatment_id    INT REFERENCES treatment_types(treatment_id),
    PRIMARY KEY (review_id, treatment_id)
);

-- =============================================
-- 인덱스
-- =============================================
CREATE INDEX IF NOT EXISTS idx_clinics_location ON clinics(lat, lng);
CREATE INDEX IF NOT EXISTS idx_clinics_district  ON clinics(city, district);
CREATE INDEX IF NOT EXISTS idx_reviews_clinic    ON reviews(clinic_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user      ON reviews(user_id);

-- =============================================
-- 과잉진료 위험도 뷰
-- =============================================
CREATE OR REPLACE VIEW clinic_risk_scores AS
SELECT
    c.clinic_id,
    c.name,
    c.city,
    c.district,
    c.lat,
    c.lng,
    COUNT(r.review_id) AS review_count,
    ROUND(AVG(
        (COALESCE(r.unnecessary_treatment::int, 0) +
         COALESCE(r.price_excessive::int, 0) +
         COALESCE(r.non_covered_pushed::int, 0) +
         COALESCE(r.pressure_felt::int, 0))
        / 4.0 * 100
    ), 1) AS risk_score,
    ROUND(AVG(r.score_trust), 2) AS avg_trust_score
FROM clinics c
LEFT JOIN reviews r
    ON c.clinic_id = r.clinic_id AND r.is_hidden = false
GROUP BY c.clinic_id, c.name, c.city, c.district, c.lat, c.lng;

-- =============================================
-- Row Level Security
-- =============================================
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clinics_read" ON clinics FOR SELECT USING (true);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_read"   ON reviews FOR SELECT USING (is_hidden = false);
CREATE POLICY "reviews_insert" ON reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reviews_update" ON reviews FOR UPDATE USING (auth.uid() = user_id);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own" ON users USING (auth.uid() = user_id);

-- =============================================
-- 시드 데이터 (진료유형)
-- =============================================
INSERT INTO treatment_types (name, category) VALUES
('스케일링',   '예방'),
('충치치료',   '치료'),
('신경치료',   '치료'),
('잇몸치료',   '치료'),
('크라운',     '보철'),
('임플란트',   '보철'),
('틀니',       '보철'),
('교정',       '교정'),
('미백',       '심미'),
('라미네이트', '심미')
ON CONFLICT DO NOTHING;

-- 완료 확인
SELECT 'setup complete' AS status;
