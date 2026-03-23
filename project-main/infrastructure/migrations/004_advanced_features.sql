-- ============================================================
-- ΨΗΦΙΑΚΗ ΚΑΡΤΑ ΕΡΓΑΣΙΑΣ — Migration 004
-- Advanced Features: Auto Actions, Platform Control, Tracking
--
-- Προσθέτει:
--   1. employer_notification_settings — auto check-in/out, tracking
--   2. employers — platform control (allowed_platforms, blocked_reason)
--   3. time_stamps — is_auto flag
--   4. tracking_logs — GPS tracking log
-- ============================================================

-- --- 1. Auto Check-in/Check-out & Tracking ρυθμίσεις ---
ALTER TABLE employer_notification_settings
    ADD COLUMN IF NOT EXISTS auto_checkout_enabled BOOLEAN DEFAULT false;

ALTER TABLE employer_notification_settings
    ADD COLUMN IF NOT EXISTS auto_checkout_grace_min INT DEFAULT 10;
-- Πόσα λεπτά μετά το (προσαρμοσμένο) τέλος βάρδιας να γίνει αυτόματο checkout

ALTER TABLE employer_notification_settings
    ADD COLUMN IF NOT EXISTS auto_checkin_late_enabled BOOLEAN DEFAULT false;

ALTER TABLE employer_notification_settings
    ADD COLUMN IF NOT EXISTS auto_checkin_late_after_min INT DEFAULT 30;
-- Αν αργήσει X λεπτά χωρίς check-in → αυτόματο check-in

ALTER TABLE employer_notification_settings
    ADD COLUMN IF NOT EXISTS tracking_enabled BOOLEAN DEFAULT false;

ALTER TABLE employer_notification_settings
    ADD COLUMN IF NOT EXISTS tracking_interval_min INT DEFAULT 30;

-- --- 2. Platform Control ανά Εργοδότη ---
ALTER TABLE employers
    ADD COLUMN IF NOT EXISTS allowed_platforms TEXT[] DEFAULT '{telegram,viber,whatsapp}';

ALTER TABLE employers
    ADD COLUMN IF NOT EXISTS blocked_reason TEXT;

-- --- 3. Auto flag στις χρονοσημάνσεις ---
-- Επισημαίνει αν η χρονοσήμανση δημιουργήθηκε αυτόματα από το σύστημα
ALTER TABLE time_stamps
    ADD COLUMN IF NOT EXISTS is_auto BOOLEAN DEFAULT false;

-- --- 4. Tracking Logs (GPS κάθε X λεπτά) ---
-- ⚠️ Οι πλατφόρμες (Telegram/Viber/WhatsApp) δεν στέλνουν GPS push.
-- Η τοποθεσία υποβάλλεται εθελοντικά από τον εργαζόμενο μέσω button.
CREATE TABLE IF NOT EXISTS tracking_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    accuracy DECIMAL(8,2),
    is_within_geofence BOOLEAN,
    distance_meters DECIMAL(8,2),
    checked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracking_logs_employee
    ON tracking_logs(employee_id, checked_at DESC);
