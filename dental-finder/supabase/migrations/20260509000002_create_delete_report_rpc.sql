CREATE OR REPLACE FUNCTION delete_report_with_pin(
  p_report_id UUID,
  p_pin TEXT
)
RETURNS TABLE(ok BOOLEAN, visit_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_visit_id UUID;
  v_clinic_id UUID;
  v_pin TEXT;
BEGIN
  SELECT r.visit_id, r.clinic_id, r.pin
    INTO v_visit_id, v_clinic_id, v_pin
    FROM user_price_reports r
   WHERE r.report_id = p_report_id;

  IF v_visit_id IS NULL THEN
    RETURN QUERY SELECT false::BOOLEAN, NULL::UUID;
    RETURN;
  END IF;

  IF v_pin IS NOT NULL AND v_pin <> p_pin THEN
    RETURN QUERY SELECT false::BOOLEAN, NULL::UUID;
    RETURN;
  END IF;

  DELETE FROM user_price_reports
   WHERE visit_id = v_visit_id
     AND clinic_id = v_clinic_id;

  RETURN QUERY SELECT true::BOOLEAN, v_visit_id;
END;
$$;
