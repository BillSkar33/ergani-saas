-- ============================================================
-- ΨΗΦΙΑΚΗ ΚΑΡΤΑ ΕΡΓΑΣΙΑΣ — Migration 003
-- Ωράρια, Αναθέσεις & Άδειες/Απουσίες
--
-- Προσθέτει:
--   1. work_schedules — Πρότυπα ωραρίων εργοδότη
--   2. employee_schedules — Ανάθεση ωραρίου σε εργαζόμενο
--   3. leaves — Άδειες και απουσίες
-- ============================================================

-- --- 1. Πρότυπα Ωραρίων ---
-- Ο εργοδότης ορίζει πρότυπα: "Πρωινό 08:00-16:00 (Δευ-Παρ)"
CREATE TABLE IF NOT EXISTS work_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employer_id UUID REFERENCES employers(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,                       -- πχ "Πρωινό", "Βραδινό", "Σαββατοκύριακο"
    start_time TIME NOT NULL,                         -- Ώρα έναρξης (πχ 08:00)
    end_time TIME NOT NULL,                           -- Ώρα λήξης (πχ 16:00)
    days_of_week INT[] NOT NULL DEFAULT '{1,2,3,4,5}', -- ISO ημέρες (1=Δευ, 7=Κυρ)
    is_night_shift BOOLEAN DEFAULT false,             -- Νυχτερινό (πχ 22:00-06:00)
    break_minutes INT DEFAULT 0,                      -- Διάλειμμα (λεπτά)
    grace_minutes_before INT DEFAULT 15,              -- Grace πριν (check-in νωρίτερα)
    grace_minutes_after INT DEFAULT 10,               -- Grace μετά (check-in αργότερα)
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(employer_id, name)                         -- Μοναδικό όνομα ανά εργοδότη
);

-- --- 2. Ανάθεση Ωραρίου σε Εργαζόμενο ---
-- "Ο Κώστας δουλεύει Πρωινό από 1/3 μέχρι 31/3"
CREATE TABLE IF NOT EXISTS employee_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    schedule_id UUID REFERENCES work_schedules(id) ON DELETE CASCADE,
    effective_from DATE NOT NULL,                     -- Ισχύει από
    effective_until DATE,                             -- Ισχύει μέχρι (NULL = μόνιμο)
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- --- 3. Άδειες & Απουσίες ---
CREATE TABLE IF NOT EXISTS leaves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    leave_type VARCHAR(30) NOT NULL,                  -- 'annual', 'sick', 'unpaid', 'maternity', 'other'
    start_date DATE NOT NULL,                         -- Από
    end_date DATE NOT NULL,                           -- Μέχρι
    status VARCHAR(20) DEFAULT 'pending',             -- 'pending', 'approved', 'rejected'
    notes TEXT,                                       -- Σημειώσεις
    approved_by UUID REFERENCES employers(id),        -- Ποιος ενέκρινε
    approved_at TIMESTAMPTZ,                          -- Πότε εγκρίθηκε
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- --- Indexes ---
CREATE INDEX IF NOT EXISTS idx_employee_schedules_lookup
    ON employee_schedules(employee_id, is_active)
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_employee_schedules_dates
    ON employee_schedules(effective_from, effective_until);

CREATE INDEX IF NOT EXISTS idx_leaves_employee_dates
    ON leaves(employee_id, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_leaves_status
    ON leaves(status)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_work_schedules_employer
    ON work_schedules(employer_id, is_active);

-- Εισαγωγή δείγματος ωραρίων (για demo/testing)
-- Αυτά ΔΕΝ εισάγονται αυτόματα — μπορείτε να τα χρησιμοποιήσετε ως πρότυπα
-- INSERT INTO work_schedules (employer_id, name, start_time, end_time, days_of_week)
-- VALUES ('employer-uuid', 'Πρωινό', '08:00', '16:00', '{1,2,3,4,5}');
