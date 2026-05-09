ALTER TABLE user_price_reports
  ADD COLUMN IF NOT EXISTS consultation_type      VARCHAR(20),
  ADD COLUMN IF NOT EXISTS overtreatment_other_teeth    BOOLEAN,
  ADD COLUMN IF NOT EXISTS overtreatment_discount_pressure BOOLEAN,
  ADD COLUMN IF NOT EXISTS consultation_time      VARCHAR(10),
  ADD COLUMN IF NOT EXISTS tags                   TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS receipt_image_url      TEXT;
