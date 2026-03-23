-- ============================================================
-- ΨΗΦΙΑΚΗ ΚΑΡΤΑ ΕΡΓΑΣΙΑΣ — SaaS Platform
-- Demo/Testing Seed Data — Δοκιμαστικά Δεδομένα
--
-- Χρήση: psql -h localhost -U ergani_user -d ergani_db -f demo_data.sql
--
-- Αυτό το script δημιουργεί:
-- - 1 δοκιμαστικό εργοδότη (ΔΟΚΙΜΑΣΤΙΚΗ ΕΤΑΙΡΕΙΑ ΤΕΣΤ)
-- - 2 παραρτήματα (Σύνταγμα + Μοναστηράκι)
-- - 3 δοκιμαστικούς εργαζομένους
-- - Linking codes για σύνδεση με messenger
-- - Ρυθμίσεις ειδοποιήσεων
--
-- ΣΗΜΕΙΩΣΗ: Χρησιμοποιήστε ΜΟΝΟ για testing/demo!
-- ============================================================

-- Καθαρισμός προηγούμενων demo δεδομένων (αν υπάρχουν)
DELETE FROM fraud_alerts WHERE employee_id IN (SELECT id FROM employees WHERE employer_id IN (SELECT id FROM employers WHERE afm_ergodoti = '000000000'));
DELETE FROM time_stamps WHERE employee_id IN (SELECT id FROM employees WHERE employer_id IN (SELECT id FROM employers WHERE afm_ergodoti = '000000000'));
DELETE FROM messenger_links WHERE employee_id IN (SELECT id FROM employees WHERE employer_id IN (SELECT id FROM employers WHERE afm_ergodoti = '000000000'));
DELETE FROM employees WHERE employer_id IN (SELECT id FROM employers WHERE afm_ergodoti = '000000000');
DELETE FROM employer_notification_settings WHERE employer_id IN (SELECT id FROM employers WHERE afm_ergodoti = '000000000');
DELETE FROM branches WHERE employer_id IN (SELECT id FROM employers WHERE afm_ergodoti = '000000000');
DELETE FROM employers WHERE afm_ergodoti = '000000000';

-- ============================================================
-- 1. ΕΡΓΟΔΟΤΗΣ
-- ============================================================
INSERT INTO employers (
  afm_ergodoti,
  company_name,
  email,
  password_hash,
  subscription_plan,
  is_active
) VALUES (
  '000000000',                                    -- Δοκιμαστικό ΑΦΜ
  'ΔΟΚΙΜΑΣΤΙΚΗ ΕΤΑΙΡΕΙΑ ΤΕΣΤ',                   -- Επωνυμία
  'test@example.com',                              -- Email
  '$2b$10$.nArFYwJL1SeaRE6nnW2BOoKmDb/IPD1k5w1lgJSRojoJj6W5EiRK', -- Password hash for '12345678'
  'professional',                                  -- Πλάνο
  true                                             -- Ενεργός
);

-- ============================================================
-- 2. ΠΑΡΑΡΤΗΜΑΤΑ (2 τοποθεσίες στην Αθήνα)
-- ============================================================

-- Παράρτημα 1: Πλατεία Συντάγματος
INSERT INTO branches (
  employer_id,
  branch_number,
  name,
  latitude,
  longitude,
  geofence_radius_meters,
  max_accuracy_meters,
  is_active
) VALUES (
  (SELECT id FROM employers WHERE afm_ergodoti = '000000000'),
  '0',                                             -- Κεντρικό (branch 0)
  'Κεντρικό — Σύνταγμα',
  37.9755,                                          -- Latitude Συντάγματος
  23.7348,                                          -- Longitude Συντάγματος
  40,                                              -- 40 μέτρα geofence
  100,                                             -- Max 100m accuracy
  true
);

-- Παράρτημα 2: Μοναστηράκι
INSERT INTO branches (
  employer_id,
  branch_number,
  name,
  latitude,
  longitude,
  geofence_radius_meters,
  max_accuracy_meters,
  is_active
) VALUES (
  (SELECT id FROM employers WHERE afm_ergodoti = '000000000'),
  '1',                                             -- Branch 1
  'Υποκατάστημα — Μοναστηράκι',
  37.9765,                                          -- Latitude Μοναστηράκι
  23.7257,                                          -- Longitude Μοναστηράκι
  50,                                              -- 50 μέτρα (μεγαλύτερο)
  100,
  true
);

-- ============================================================
-- 3. ΕΡΓΑΖΟΜΕΝΟΙ (3 δοκιμαστικοί)
-- ============================================================

-- Εργαζόμενος 1: Κανονικός
INSERT INTO employees (
  employer_id,
  branch_id,
  afm,
  eponymo,
  onoma,
  is_external_worker,
  is_active,
  linking_code,
  linking_code_expires_at,
  trust_score
) VALUES (
  (SELECT id FROM employers WHERE afm_ergodoti = '000000000'),
  (SELECT id FROM branches WHERE name = 'Κεντρικό — Σύνταγμα' LIMIT 1),
  '111111111',                                      -- Δοκιμαστικό ΑΦΜ
  'ΔΟΚΙΜΑΣΤΙΚΟΣ',                                   -- Επώνυμο
  'ΧΡΗΣΤΗΣ',                                         -- Όνομα
  false,                                             -- Κανονικός
  true,
  '123456',                                          -- Linking code
  NOW() + INTERVAL '30 days',                        -- Λήγει σε 30 μέρες
  100                                                -- Πλήρες trust
);

-- Εργαζόμενος 2: Εξωτερικός (bypass geofence)
INSERT INTO employees (
  employer_id,
  branch_id,
  afm,
  eponymo,
  onoma,
  is_external_worker,
  is_active,
  linking_code,
  linking_code_expires_at,
  trust_score
) VALUES (
  (SELECT id FROM employers WHERE afm_ergodoti = '000000000'),
  (SELECT id FROM branches WHERE name = 'Κεντρικό — Σύνταγμα' LIMIT 1),
  '222222222',
  'ΕΞΩΤΕΡΙΚΟΣ',
  'ΕΡΓΑΖΟΜΕΝΟΣ',
  true,                                              -- ΕΞΩΤΕΡΙΚΟΣ → bypass geofence
  true,
  '654321',                                          -- Linking code
  NOW() + INTERVAL '30 days',
  100
);

-- Εργαζόμενος 3: Παράρτημα Μοναστηράκι
INSERT INTO employees (
  employer_id,
  branch_id,
  afm,
  eponymo,
  onoma,
  is_external_worker,
  is_active,
  linking_code,
  linking_code_expires_at,
  trust_score
) VALUES (
  (SELECT id FROM employers WHERE afm_ergodoti = '000000000'),
  (SELECT id FROM branches WHERE name = 'Υποκατάστημα — Μοναστηράκι' LIMIT 1),
  '333333333',
  'ΜΟΝΑΣΤΗΡΑΚΙΩΤΗΣ',
  'ΕΡΓΑΤΗΣ',
  false,
  true,
  '789012',
  NOW() + INTERVAL '30 days',
  100
);

-- ============================================================
-- 4. ΡΥΘΜΙΣΕΙΣ ΕΙΔΟΠΟΙΗΣΕΩΝ
-- ============================================================
INSERT INTO employer_notification_settings (
  employer_id,
  notify_each_checkin,
  notify_missed_checkout,
  notify_gps_rejection,
  notify_fraud_alerts,
  notify_ergani_errors
) VALUES (
  (SELECT id FROM employers WHERE afm_ergodoti = '000000000'),
  false,                                             -- Δεν ειδοποιεί σε κάθε check-in
  true,                                              -- Ειδοποιεί αν ξεχάσει
  true,                                              -- Ειδοποίηση σε geofence violations
  true,                                              -- Ειδοποίηση fraud alerts
  true                                               -- Ειδοποίηση ΕΡΓΑΝΗ failures
);

-- ============================================================
-- ΕΠΙΒΕΒΑΙΩΣΗ
-- ============================================================
SELECT '=== DEMO DATA LOADED ===' AS status;

SELECT 'Εργοδότης: ' || company_name || ' (ΑΦΜ: ' || afm_ergodoti || ')'
FROM employers WHERE afm_ergodoti = '000000000';

SELECT 'Παράρτημα: ' || name || ' (GPS: ' || latitude || ', ' || longitude || ')'
FROM branches WHERE employer_id = (SELECT id FROM employers WHERE afm_ergodoti = '000000000');

SELECT 'Εργαζόμενος: ' || onoma || ' ' || eponymo
  || ' | ΑΦΜ: ' || afm
  || ' | Κωδικός: ' || COALESCE(linking_code, '-')
  || ' | Εξωτερικός: ' || CASE WHEN is_external_worker THEN 'ΝΑΙ' ELSE 'ΟΧΙ' END
FROM employees WHERE employer_id = (SELECT id FROM employers WHERE afm_ergodoti = '000000000');

SELECT '=== LINKING CODES ===' AS info;
SELECT 'Κωδικός ' || linking_code || ' → ' || onoma || ' ' || eponymo
FROM employees
WHERE employer_id = (SELECT id FROM employers WHERE afm_ergodoti = '000000000')
  AND linking_code IS NOT NULL;
