#!/bin/bash
# ============================================================
# ❓ HELP — Λίστα διαθέσιμων scripts
# ============================================================

CYAN='\033[0;36m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}📦 Scripts — Ψηφιακή Κάρτα Εργασίας${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${CYAN}🏁 Πρώτη Εγκατάσταση:${NC}"
echo "   ./scripts/first-setup.sh           Ολοκληρωμένη εγκατάσταση (1η φορά)"
echo ""
echo -e "${CYAN}🚀 Λειτουργία:${NC}"
echo "   ./scripts/start.sh                 Εκκίνηση ΟΛΩΝ"
echo "   ./scripts/start.sh gateway         Μόνο webhook gateway"
echo "   ./scripts/stop.sh                  Τερματισμός ΟΛΩΝ"
echo "   ./scripts/stop.sh --keep-docker    Μόνο Node.js (Docker μένει)"
echo "   ./scripts/restart.sh               Restart ΟΛΩΝ"
echo "   ./scripts/status.sh                Κατάσταση υπηρεσιών"
echo ""
echo -e "${CYAN}🗄️ Βάση Δεδομένων:${NC}"
echo "   ./scripts/db-setup.sh              Migration + Seed data"
echo "   ./scripts/db-setup.sh --reset      ΔΙΑΓΡΑΦΗ + Migration + Seed"
echo "   ./scripts/db-setup.sh --migrate    Μόνο migration (χωρίς seed)"
echo ""
echo -e "${CYAN}💾 Backup:${NC}"
echo "   ./scripts/backup.sh                Δημιουργία backup"
echo "   ./scripts/backup.sh --list         Λίστα backups"
echo "   ./scripts/backup.sh --restore X    Επαναφορά από αρχείο"
echo ""
echo -e "${CYAN}🧪 Testing:${NC}"
echo "   ./scripts/test.sh                  Εκτέλεση 45 tests"
echo "   ./scripts/test.sh --coverage       Tests + Coverage report"
echo "   ./scripts/test.sh --watch          Watch mode"
echo ""
echo -e "${CYAN}📦 Git:${NC}"
echo "   ./scripts/git-push.sh              Auto commit + push"
echo '   ./scripts/git-push.sh "message"    Με custom μήνυμα'
echo ""
echo -e "${CYAN}📋 Logs:${NC}"
echo "   ./scripts/logs.sh                  PostgreSQL logs"
echo "   ./scripts/logs.sh kafka            Kafka logs"
echo "   ./scripts/logs.sh all              Όλα τα Docker logs"
echo ""
echo -e "${YELLOW}📖 Documentation: docs/ folder${NC}"
echo "   ADMIN_SETUP_GUIDE.md  — Οδηγός εγκατάστασης"
echo "   SANDBOX_GUIDE.md      — Πειραματικό testing"
echo "   GITHUB_SETUP_GUIDE.md — Ρύθμιση GitHub"
echo "   DASHBOARD_GUIDE.md    — Οδηγός Admin Dashboard"
echo "   CHEATSHEET.md         — Γρήγορη αναφορά"
echo ""
