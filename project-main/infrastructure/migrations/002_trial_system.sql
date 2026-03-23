-- ============================================================
-- ΨΗΦΙΑΚΗ ΚΑΡΤΑ ΕΡΓΑΣΙΑΣ — Migration 002
-- Trial Subscription System
--
-- Προσθέτει:
--   1. Trial πεδία στους employers
--   2. super_admins table (ο SaaS owner)
--   3. subscription_plans table (πλάνα + όρια)
-- ============================================================

-- --- 1. Subscription Plans (πλάνα με όρια) ---
CREATE TABLE IF NOT EXISTS subscription_plans (
    id VARCHAR(50) PRIMARY KEY,                       -- πχ 'trial', 'basic', 'pro', 'enterprise'
    name VARCHAR(100) NOT NULL,                       -- Εμφανιζόμενο όνομα
    max_employees INT NOT NULL DEFAULT 5,             -- Μέγιστος αριθμός εργαζομένων
    max_branches INT NOT NULL DEFAULT 1,              -- Μέγιστα παραρτήματα
    trial_days INT NOT NULL DEFAULT 14,               -- Ημέρες δοκιμαστικής περιόδου
    price_monthly DECIMAL(10,2) DEFAULT 0,            -- Μηνιαία χρέωση (€)
    features JSONB DEFAULT '[]'::JSONB,               -- Λίστα features
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Εισαγωγή βασικών πλάνων
INSERT INTO subscription_plans (id, name, max_employees, max_branches, trial_days, price_monthly, features) VALUES
    ('trial',      'Δοκιμαστικό',   5,   1,   14,   0,    '["check_in","check_out","basic_reports"]'),
    ('basic',      'Βασικό',        10,  2,   0,    9.90, '["check_in","check_out","basic_reports","csv_export"]'),
    ('pro',        'Επαγγελματικό', 50,  5,   0,    29.90,'["check_in","check_out","basic_reports","csv_export","fraud_detection","notifications"]'),
    ('enterprise', 'Εταιρικό',      500, 50,  0,    79.90,'["check_in","check_out","basic_reports","csv_export","fraud_detection","notifications","api_access","priority_support"]')
ON CONFLICT (id) DO NOTHING;

-- --- 2. Trial πεδία στο employers ---
ALTER TABLE employers ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMPTZ;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS trial_status VARCHAR(20) DEFAULT 'active';
-- trial_status: 'active', 'trial', 'expired', 'suspended'
ALTER TABLE employers ADD COLUMN IF NOT EXISTS max_employees INT DEFAULT 5;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS max_branches INT DEFAULT 1;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
-- Αν δεν υπάρχει ήδη, ρυθμίζουμε defaults
UPDATE employers SET 
    trial_status = 'trial',
    trial_expires_at = NOW() + INTERVAL '14 days',
    max_employees = 5,
    max_branches = 1
WHERE trial_status IS NULL OR trial_expires_at IS NULL;

-- --- 3. Super Admins (SaaS Owner — εσείς) ---
CREATE TABLE IF NOT EXISTS super_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index για γρήγορα lookups
CREATE INDEX IF NOT EXISTS idx_employers_trial_status ON employers(trial_status);
CREATE INDEX IF NOT EXISTS idx_employers_trial_expires ON employers(trial_expires_at);
