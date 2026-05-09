-- 커뮤니티에서 수집한 가격 제보 테이블
CREATE TABLE IF NOT EXISTS price_reports (
    report_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id       UUID REFERENCES clinics(clinic_id),  -- 매칭된 치과 (없을 수도 있음)
    clinic_name_raw VARCHAR(100) NOT NULL,                -- 원문 치과명
    treatment_name  VARCHAR(100) NOT NULL,                -- 임플란트, 교정 등
    price           INTEGER NOT NULL,                     -- 가격 (원 단위)
    location_raw    VARCHAR(100),                         -- 원문 지역 (강남, 수원 등)
    source          VARCHAR(30) DEFAULT 'ppomppu',        -- 출처
    post_url        VARCHAR(500),                         -- 원문 URL
    post_date       DATE,                                 -- 게시글 날짜
    raw_text        TEXT,                                 -- 원문 발췌
    is_verified     BOOLEAN DEFAULT false,                -- 관리자 검증 여부
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_price_reports_clinic    ON price_reports(clinic_id);
CREATE INDEX IF NOT EXISTS idx_price_reports_treatment ON price_reports(treatment_name);

ALTER TABLE price_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "price_reports_read" ON price_reports FOR SELECT USING (true);
