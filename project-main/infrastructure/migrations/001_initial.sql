-- ============================================================
-- ΨΗΦΙΑΚΗ ΚΑΡΤΑ ΕΡΓΑΣΙΑΣ — SaaS Platform
-- Αρχικό Database Schema Migration
-- 
-- Περιλαμβάνει: employers, branches, employees, messenger_links,
-- time_stamps, audit_log, processed_messages, jwt_cache,
-- employer_notification_settings, fraud_alerts + indexes
-- ============================================================

-- ============================================================
-- ΠΙΝΑΚΑΣ: employers (Εργοδότες)
-- Αποθηκεύει τα στοιχεία κάθε εργοδότη/εταιρείας
-- που χρησιμοποιεί την πλατφόρμα
-- ============================================================
CREATE TABLE IF NOT EXISTS employers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),       -- Μοναδικό αναγνωριστικό εργοδότη
    email VARCHAR(255) NOT NULL UNIQUE,                  -- Email εγγραφής (μοναδικό)
    password_hash VARCHAR(255) NOT NULL,                 -- Κρυπτογραφημένος κωδικός (bcrypt)
    company_name VARCHAR(255) NOT NULL,                  -- Επωνυμία εταιρείας
    afm_ergodoti CHAR(9) NOT NULL UNIQUE,               -- ΑΦΜ εργοδότη (f_afm_ergodoti) — 9 ψηφία
    created_at TIMESTAMPTZ DEFAULT NOW(),                -- Ημερομηνία δημιουργίας
    subscription_plan VARCHAR(50) DEFAULT 'basic',       -- Πλάνο συνδρομής (basic/pro/enterprise)
    is_active BOOLEAN DEFAULT true                       -- Ενεργός λογαριασμός (true/false)
);

-- ============================================================
-- ΠΙΝΑΚΑΣ: branches (Παραρτήματα / Καταστήματα)
-- Κάθε εργοδότης μπορεί να έχει πολλαπλά παραρτήματα
-- με ξεχωριστές GPS συντεταγμένες και geofence ρυθμίσεις
-- ============================================================
CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),       -- Μοναδικό αναγνωριστικό παραρτήματος
    employer_id UUID REFERENCES employers(id)            -- Ξένο κλειδί → εργοδότης
        ON DELETE CASCADE,
    branch_number VARCHAR(10) NOT NULL,                  -- Αριθμός παραρτήματος (f_aa) στο ΕΡΓΑΝΗ
    name VARCHAR(255),                                   -- Ονομασία παραρτήματος (π.χ. "Κεντρικό")
    latitude DECIMAL(10, 8) NOT NULL,                    -- Γεωγραφικό πλάτος (GPS)
    longitude DECIMAL(11, 8) NOT NULL,                   -- Γεωγραφικό μήκος (GPS)
    geofence_radius_meters INT DEFAULT 40,               -- Ακτίνα geofence σε μέτρα (ρυθμιζόμενο 10-200m)
    max_accuracy_meters INT DEFAULT 100,                 -- Μέγιστη αποδεκτή ακρίβεια GPS (μέτρα)
    ergani_username_encrypted BYTEA,                     -- Κρυπτογραφημένο username ΕΡΓΑΝΗ (AES-256-GCM)
    ergani_password_encrypted BYTEA,                     -- Κρυπτογραφημένος κωδικός ΕΡΓΑΝΗ (AES-256-GCM)
    checkout_geofence_enabled BOOLEAN DEFAULT true,      -- Ενεργοποίηση geofence στο check-out
    early_checkin_grace_min INT DEFAULT 15,              -- Λεπτά νωρίτερης αποδεκτής προσέλευσης
    late_checkout_grace_min INT DEFAULT 10,              -- Λεπτά αποδεκτής καθυστέρησης αποχώρησης
    max_shift_duration_hours INT DEFAULT 12,             -- Μέγιστη διάρκεια βάρδιας (ώρες) — auto-alert
    is_active BOOLEAN DEFAULT true,                      -- Ενεργό παράρτημα (true/false)
    UNIQUE(employer_id, branch_number)                   -- Μοναδικός συνδυασμός εργοδότη + αριθμού παραρτήματος
);

-- ============================================================
-- ΠΙΝΑΚΑΣ: employees (Εργαζόμενοι)
-- Στοιχεία κάθε εργαζομένου — τα ονόματα ΠΡΕΠΕΙ
-- να ταυτίζονται ακριβώς με το μητρώο ΕΡΓΑΝΗ (ΚΕΦΑΛΑΙΑ)
-- ============================================================
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),       -- Μοναδικό αναγνωριστικό εργαζομένου
    employer_id UUID REFERENCES employers(id)            -- Ξένο κλειδί → εργοδότης
        ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id)               -- Ξένο κλειδί → παράρτημα (default)
        ON DELETE SET NULL,
    afm CHAR(9) NOT NULL,                               -- ΑΦΜ εργαζομένου (f_afm) — 9 ψηφία, αριθμητικό
    eponymo VARCHAR(255) NOT NULL,                       -- Επώνυμο σε ΚΕΦΑΛΑΙΑ (f_eponymo)
    onoma VARCHAR(255) NOT NULL,                         -- Όνομα σε ΚΕΦΑΛΑΙΑ (f_onoma)
    phone VARCHAR(20),                                   -- Τηλέφωνο (προαιρετικό)
    is_external_worker BOOLEAN DEFAULT false,            -- Εξωτερικός εργαζόμενος (παράκαμψη geofence)
    linking_code CHAR(6),                                -- 6ψήφιος κωδικός σύνδεσης (μιας χρήσης)
    linking_code_expires_at TIMESTAMPTZ,                 -- Λήξη κωδικού σύνδεσης
    trust_score INT DEFAULT 100,                         -- Βαθμολογία εμπιστοσύνης (0-100, αόρατη)
    is_active BOOLEAN DEFAULT true,                      -- Ενεργός εργαζόμενος
    UNIQUE(employer_id, afm)                             -- Μοναδικός συνδυασμός εργοδότη + ΑΦΜ
);

-- ============================================================
-- ΠΙΝΑΚΑΣ: messenger_links (Σύνδεση Messenger → Εργαζόμενος)
-- Αντιστοιχίζει τα messenger IDs (Viber/Telegram/WhatsApp)
-- με τους εγγεγραμμένους εργαζομένους
-- ============================================================
CREATE TABLE IF NOT EXISTS messenger_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),       -- Μοναδικό αναγνωριστικό σύνδεσης
    employee_id UUID REFERENCES employees(id)            -- Ξένο κλειδί → εργαζόμενος
        ON DELETE CASCADE,
    platform VARCHAR(20) NOT NULL,                       -- Πλατφόρμα: 'viber', 'telegram', 'whatsapp'
    platform_user_id VARCHAR(255) NOT NULL,              -- Αναγνωριστικό χρήστη στην πλατφόρμα
    linked_at TIMESTAMPTZ DEFAULT NOW(),                 -- Ημερομηνία σύνδεσης
    UNIQUE(platform, platform_user_id)                   -- Ένας χρήστης πλατφόρμας → ένας εργαζόμενος
);

-- ============================================================
-- ΠΙΝΑΚΑΣ: time_stamps (Χρονοσημάνσεις Check-in / Check-out)
-- Βασικός πίνακας — αποθηκεύει κάθε χτύπημα κάρτας
-- με GPS δεδομένα, κατάσταση geofence, και status ΕΡΓΑΝΗ
-- ============================================================
CREATE TABLE IF NOT EXISTS time_stamps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),       -- Μοναδικό αναγνωριστικό χρονοσήμανσης
    employee_id UUID REFERENCES employees(id)            -- Ξένο κλειδί → εργαζόμενος
        ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id)               -- Ξένο κλειδί → παράρτημα (auto-detected)
        ON DELETE SET NULL,
    action_type VARCHAR(10) NOT NULL,                    -- Τύπος: 'check_in' ή 'check_out'
    event_timestamp TIMESTAMPTZ NOT NULL,                -- Ακριβής χρόνος ενέργειας (f_date)
    reference_date DATE NOT NULL,                        -- Ημερομηνία αναφοράς (f_reference_date)
    latitude DECIMAL(10, 8),                             -- GPS πλάτος (διαγράφεται μετά 48h — GDPR)
    longitude DECIMAL(11, 8),                            -- GPS μήκος (διαγράφεται μετά 48h — GDPR)
    horizontal_accuracy DECIMAL(8, 2),                   -- Ακρίβεια GPS σε μέτρα
    distance_meters DECIMAL(8, 2),                       -- Απόσταση από το κατάστημα (Haversine)
    geofence_status VARCHAR(20),                         -- 'approved', 'rejected', 'bypassed' (external)
    platform VARCHAR(20),                                -- Πλατφόρμα αποστολής (viber/telegram/whatsapp)
    ergani_status VARCHAR(20) DEFAULT 'pending',         -- Κατάσταση ΕΡΓΑΝΗ: pending/submitted/confirmed/failed
    ergani_response JSONB,                               -- Πλήρης απάντηση ΕΡΓΑΝΗ API (για audit)
    ergani_submitted_at TIMESTAMPTZ,                     -- Χρόνος υποβολής στο ΕΡΓΑΝΗ
    retry_count INT DEFAULT 0,                           -- Αριθμός προσπαθειών (σε αποτυχία)
    created_at TIMESTAMPTZ DEFAULT NOW()                 -- Χρόνος δημιουργίας εγγραφής
);

-- ============================================================
-- ΠΙΝΑΚΑΣ: audit_log (Αρχείο Καταγραφής — Αμετάβλητο)
-- Αποθηκεύει κάθε API call προς ΕΡΓΑΝΗ + εσωτερικές ενέργειες
-- ΝΟΜΙΚΗ ΥΠΟΧΡΕΩΣΗ: Κράτηση 5 χρόνια
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,                            -- Αύξων αριθμός εγγραφής
    event_type VARCHAR(50) NOT NULL,                     -- Τύπος: 'ergani_submission', 'auth', 'error' κλπ.
    entity_type VARCHAR(50) NOT NULL,                    -- Οντότητα: 'time_stamp', 'employee', 'branch' κλπ.
    entity_id UUID,                                      -- ID οντότητας (αν υπάρχει)
    payload JSONB NOT NULL,                              -- Δεδομένα αιτήματος (request body)
    response JSONB,                                      -- Απάντηση ΕΡΓΑΝΗ (response body)
    http_status INT,                                     -- HTTP status code απάντησης
    ip_address INET,                                     -- IP αποστολέα (αν σχετικό)
    created_at TIMESTAMPTZ DEFAULT NOW()                 -- Χρόνος καταγραφής
);

-- ============================================================
-- ΠΙΝΑΚΑΣ: processed_messages (Idempotency / Αντι-Διπλότυπα)
-- Αποτρέπει την επεξεργασία του ίδιου webhook message δύο φορές
-- Κρίσιμο για WhatsApp που κάνει retries μέχρι και 7 ημέρες
-- ============================================================
CREATE TABLE IF NOT EXISTS processed_messages (
    message_id VARCHAR(255) PRIMARY KEY,                 -- Unique ID μηνύματος (platform-specific)
    platform VARCHAR(20) NOT NULL,                       -- Πλατφόρμα προέλευσης
    processed_at TIMESTAMPTZ DEFAULT NOW()               -- Χρόνος επεξεργασίας
);

-- ============================================================
-- ΠΙΝΑΚΑΣ: jwt_cache (Cache JWT Token ΕΡΓΑΝΗ)
-- Εναλλακτικά στο Redis — αποθηκεύει JWT tokens ανά παράρτημα
-- ============================================================
CREATE TABLE IF NOT EXISTS jwt_cache (
    branch_id UUID REFERENCES branches(id)               -- Ξένο κλειδί → παράρτημα
        ON DELETE CASCADE
        PRIMARY KEY,
    access_token TEXT NOT NULL,                           -- JWT access token
    expires_at TIMESTAMPTZ NOT NULL,                     -- Χρόνος λήξης token
    created_at TIMESTAMPTZ DEFAULT NOW()                 -- Χρόνος αποθήκευσης
);

-- ============================================================
-- ΠΙΝΑΚΑΣ: employer_notification_settings (Ρυθμίσεις Ειδοποιήσεων)
-- Ο εργοδότης επιλέγει ποιες ειδοποιήσεις θέλει και σε ποιο κανάλι
-- ============================================================
CREATE TABLE IF NOT EXISTS employer_notification_settings (
    employer_id UUID REFERENCES employers(id)            -- Ξένο κλειδί → εργοδότης
        ON DELETE CASCADE
        PRIMARY KEY,
    notify_each_checkin BOOLEAN DEFAULT false,            -- Ειδοποίηση σε κάθε check-in (θόρυβος)
    notify_late_arrival BOOLEAN DEFAULT true,             -- Ειδοποίηση καθυστερημένης άφιξης
    late_arrival_threshold_min INT DEFAULT 15,            -- Κατώφλι καθυστέρησης (λεπτά)
    notify_missed_checkout BOOLEAN DEFAULT true,          -- Ειδοποίηση ξεχασμένου check-out
    missed_checkout_threshold_min INT DEFAULT 30,         -- Κατώφλι ξεχασμένου check-out (λεπτά)
    notify_gps_rejection BOOLEAN DEFAULT true,            -- Ειδοποίηση GPS rejection
    notify_overtime_risk BOOLEAN DEFAULT true,            -- Ειδοποίηση κινδύνου υπερωρίας
    overtime_threshold_min INT DEFAULT 30,                -- Κατώφλι υπερωρίας (λεπτά μετά τη λήξη)
    notify_fraud_alerts BOOLEAN DEFAULT true,             -- Ειδοποίηση ύποπτης δραστηριότητας
    notify_ergani_errors BOOLEAN DEFAULT true,            -- Ειδοποίηση σφαλμάτων ΕΡΓΑΝΗ
    weekly_summary_enabled BOOLEAN DEFAULT true,          -- Εβδομαδιαία σύνοψη
    weekly_summary_day VARCHAR(10) DEFAULT 'monday',      -- Ημέρα αποστολής σύνοψης
    notification_channels JSONB                           -- Κανάλια: {"push": true, "email": true, "sms": false}
        DEFAULT '{"push": true, "email": true, "sms": false}',
    quiet_hours_start TIME DEFAULT '22:00',               -- Ώρα σίγασης (από)
    quiet_hours_end TIME DEFAULT '07:00',                 -- Ώρα σίγασης (έως)
    employer_phone VARCHAR(20),                           -- Τηλέφωνο εργοδότη (για SMS)
    employer_viber_id VARCHAR(255),                       -- Viber ID εργοδότη (προαιρετικό)
    updated_at TIMESTAMPTZ DEFAULT NOW()                 -- Τελευταία ενημέρωση
);

-- ============================================================
-- ΠΙΝΑΚΑΣ: fraud_alerts (Ειδοποιήσεις Απάτης / GPS Spoofing)
-- Καταγράφει ύποπτες δραστηριότητες εργαζομένων
-- ============================================================
CREATE TABLE IF NOT EXISTS fraud_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),       -- Μοναδικό αναγνωριστικό
    employee_id UUID REFERENCES employees(id)            -- Ξένο κλειδί → εργαζόμενος
        ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL,                     -- Τύπος: 'gps_spoofing', 'impossible_travel', 'zero_accuracy' κλπ.
    severity VARCHAR(20) NOT NULL,                       -- Σοβαρότητα: 'low', 'medium', 'high', 'critical'
    details JSONB NOT NULL,                              -- Λεπτομέρειες (GPS, timestamps, distances κλπ.)
    is_reviewed BOOLEAN DEFAULT false,                   -- Ελεγμένο από εργοδότη
    reviewed_by UUID REFERENCES employers(id),           -- Ποιος το εξέτασε
    reviewed_at TIMESTAMPTZ,                             -- Πότε εξετάστηκε
    created_at TIMESTAMPTZ DEFAULT NOW()                 -- Χρόνος δημιουργίας alert
);

-- ============================================================
-- ΕΥΡΕΤΗΡΙΑ (Indexes) — Βελτιστοποίηση ερωτημάτων
-- ============================================================

-- Γρήγορη αναζήτηση χρονοσημάνσεων ανά εργαζόμενο + ημερομηνία
CREATE INDEX IF NOT EXISTS idx_timestamps_employee_date 
    ON time_stamps(employee_id, reference_date);

-- Εύρεση εκκρεμών υποβολών στο ΕΡΓΑΝΗ (partial index)
CREATE INDEX IF NOT EXISTS idx_timestamps_status 
    ON time_stamps(ergani_status) 
    WHERE ergani_status = 'pending';

-- Αναζήτηση εργαζομένου μέσω messenger ID (κρίσιμο για webhooks)
CREATE INDEX IF NOT EXISTS idx_messenger_lookup 
    ON messenger_links(platform, platform_user_id);

-- Αναζήτηση με linking code (κατά την εγγραφή εργαζομένου)
CREATE INDEX IF NOT EXISTS idx_employees_linking 
    ON employees(linking_code) 
    WHERE linking_code IS NOT NULL;

-- Αναζήτηση audit log ανά οντότητα
CREATE INDEX IF NOT EXISTS idx_audit_entity 
    ON audit_log(entity_type, entity_id);

-- Αναζήτηση fraud alerts ανά εργαζόμενο + αν είναι ελεγμένα
CREATE INDEX IF NOT EXISTS idx_fraud_employee 
    ON fraud_alerts(employee_id, is_reviewed);

-- Αναζήτηση εγγραφών χρονοσημάνσεων για GDPR cleanup
CREATE INDEX IF NOT EXISTS idx_timestamps_gdpr_cleanup 
    ON time_stamps(created_at) 
    WHERE latitude IS NOT NULL;
