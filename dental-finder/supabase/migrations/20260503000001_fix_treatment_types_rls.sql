ALTER TABLE treatment_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "treatment_types_read" ON treatment_types FOR SELECT USING (true);
