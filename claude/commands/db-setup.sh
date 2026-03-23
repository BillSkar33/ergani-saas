#!/bin/bash
# ============================================================
# 🗄️ DB SETUP — Δημιουργία/Επαναφορά βάσης δεδομένων
#
# Χρήση:
#   ./scripts/db-setup.sh           → migration + seed
#   ./scripts/db-setup.sh --reset   → ΔΙΑΓΡΑΦΗ + migration + seed
#   ./scripts/db-setup.sh --migrate → μόνο migration (χωρίς seed)
# ============================================================

set -e
cd "$(dirname "$0")/.."

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}🗄️ Database Setup — Ψηφιακή Κάρτα Εργασίας${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

MODE="${1:---setup}"

# Reset (ΠΡΟΣΟΧΗ!)
if [ "$MODE" = "--reset" ]; then
  echo -e "\n${RED}⚠️  ΠΡΟΣΟΧΗ: Αυτό θα ΔΙΑΓΡΑΨΕΙ όλα τα δεδομένα!${NC}"
  read -p "Σίγουρα; (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Ακυρώθηκε${NC}"
    exit 0
  fi

  echo -e "\n${RED}[1/4] Διαγραφή Docker volumes...${NC}"
  docker compose down -v 2>/dev/null || docker-compose down -v 2>/dev/null
  
  echo -e "${GREEN}[2/4] Εκκίνηση Docker...${NC}"
  docker compose up -d 2>/dev/null || docker-compose up -d 2>/dev/null
  
  echo -e "${CYAN}⏳ Αναμονή PostgreSQL (5 sec)...${NC}"
  sleep 5
fi

# Migration
echo -e "\n${GREEN}[3/4] Εκτέλεση migration...${NC}"
docker exec -i ergani-postgres psql -U ergani_user -d ergani_db < infrastructure/migrations/001_initial.sql 2>/dev/null
echo -e "${GREEN}✅ Πίνακες δημιουργήθηκαν${NC}"

# Seed (εκτός αν --migrate)
if [ "$MODE" != "--migrate" ]; then
  echo -e "\n${GREEN}[4/4] Φόρτωση demo δεδομένων...${NC}"
  docker exec -i ergani-postgres psql -U ergani_user -d ergani_db < infrastructure/seeds/demo_data.sql 2>/dev/null
  echo -e "${GREEN}✅ Demo data φορτώθηκαν${NC}"
fi

echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Database ready!${NC}"

# Εμφάνιση σύνοψης
echo -e "\n${CYAN}📊 Σύνοψη:${NC}"
docker exec ergani-postgres psql -U ergani_user -d ergani_db -c "
  SELECT 'Εργοδότες' AS πίνακας, COUNT(*) AS εγγραφές FROM employers
  UNION ALL
  SELECT 'Παραρτήματα', COUNT(*) FROM branches
  UNION ALL
  SELECT 'Εργαζόμενοι', COUNT(*) FROM employees
  UNION ALL
  SELECT 'Χρονοσημάνσεις', COUNT(*) FROM time_stamps;
" 2>/dev/null || echo "(δεν μπόρεσε να εμφανίσει σύνοψη)"
