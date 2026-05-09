CREATE TABLE IF NOT EXISTS user_price_reports (
    report_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id          UUID NOT NULL REFERENCES clinics(clinic_id),
    treatment_id       INT  NOT NULL REFERENCES treatment_types(treatment_id),
    price              INTEGER,
    extra_recommended  BOOLEAN NOT NULL,
    extra_note         VARCHAR(200),
    nickname           VARCHAR(30),
    created_at         TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_price_reports_clinic     ON user_price_reports(clinic_id);
CREATE INDEX IF NOT EXISTS idx_user_price_reports_treatment  ON user_price_reports(treatment_id);

ALTER TABLE user_price_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "upr_read"   ON user_price_reports FOR SELECT USING (true);
CREATE POLICY "upr_insert" ON user_price_reports FOR INSERT WITH CHECK (true);
