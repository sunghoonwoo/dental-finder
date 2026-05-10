-- Fix RLS: Enable UPDATE/DELETE for anon role (user_price_reports is public data)

-- 1. Allow anon to UPDATE any row (needed for edit flow)
CREATE POLICY "anon_update" ON user_price_reports
  FOR UPDATE USING (true) WITH CHECK (true);

-- 2. Allow anon to DELETE any row (needed for edit flow when removing treatments)
CREATE POLICY "anon_delete" ON user_price_reports
  FOR DELETE USING (true);

-- 3. Verify INSERT policy exists (needed for create report + adding treatments in edit)
-- If the "anon_insert" policy doesn't exist, create it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_price_reports'
    AND policyname = 'anon_insert'
  ) THEN
    CREATE POLICY "anon_insert" ON user_price_reports
      FOR INSERT WITH CHECK (true);
  END IF;
END
$$;

-- 4. SECURITY DEFINER RPC as a bypass option (preferred for write operations)
CREATE OR REPLACE FUNCTION update_report_with_pin(
  p_report_id UUID,
  p_treatment_ids INTEGER[],
  p_price INTEGER,
  p_visit_date DATE,
  p_extra_recommended BOOLEAN,
  p_extra_note TEXT,
  p_review_text TEXT,
  p_friendliness_score INTEGER,
  p_nickname TEXT
)
RETURNS TABLE(success BOOLEAN, visit_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_visit_id UUID;
  v_clinic_id UUID;
  v_pin TEXT;
  v_tid INTEGER;
BEGIN
  -- Get current report info
  SELECT r.visit_id, r.clinic_id, r.pin
    INTO v_visit_id, v_clinic_id, v_pin
    FROM user_price_reports r
   WHERE r.report_id = p_report_id;

  IF v_visit_id IS NULL THEN
    RETURN QUERY SELECT false::BOOLEAN, NULL::UUID;
    RETURN;
  END IF;

  -- Update the report being edited (set to first treatment)
  UPDATE user_price_reports
     SET treatment_id = p_treatment_ids[1],
         price = p_price,
         visit_date = p_visit_date,
         extra_recommended = p_extra_recommended,
         extra_note = p_extra_note,
         review_text = p_review_text,
         friendliness_score = p_friendliness_score,
         nickname = p_nickname
   WHERE report_id = p_report_id;

  -- Delete deselected treatments (not in the array, and not the edited report)
  DELETE FROM user_price_reports
   WHERE visit_id = v_visit_id
     AND clinic_id = v_clinic_id
     AND report_id <> p_report_id
     AND treatment_id <> ALL(p_treatment_ids);

  -- Insert new treatments not already in the visit group
  INSERT INTO user_price_reports (clinic_id, treatment_id, visit_id, pin, price, visit_date, extra_recommended, extra_note, review_text, friendliness_score, nickname)
  SELECT v_clinic_id, unnest, v_visit_id, v_pin, p_price, p_visit_date, p_extra_recommended, p_extra_note, p_review_text, p_friendliness_score, p_nickname
  FROM unnest(p_treatment_ids) AS unnest
  WHERE unnest <> ALL(
    SELECT treatment_id FROM user_price_reports
    WHERE visit_id = v_visit_id AND clinic_id = v_clinic_id
  );

  RETURN QUERY SELECT true::BOOLEAN, v_visit_id;
END;
$$;
