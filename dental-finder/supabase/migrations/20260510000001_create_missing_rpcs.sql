CREATE OR REPLACE FUNCTION report_requires_pin(p_report_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pin TEXT;
BEGIN
  SELECT pin INTO v_pin FROM user_price_reports WHERE report_id = p_report_id;
  RETURN v_pin IS NOT NULL AND v_pin <> '';
END;
$$;

CREATE OR REPLACE FUNCTION verify_report_pin(p_report_id UUID, p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pin TEXT;
BEGIN
  SELECT pin INTO v_pin FROM user_price_reports WHERE report_id = p_report_id;
  RETURN v_pin IS NOT NULL AND v_pin = p_pin;
END;
$$;
