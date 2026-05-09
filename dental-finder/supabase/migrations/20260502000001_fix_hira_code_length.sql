-- hira_code 컬럼 길이 20 → 100으로 변경 (암호화요양기호 80자)
ALTER TABLE clinics ALTER COLUMN hira_code TYPE VARCHAR(100);
