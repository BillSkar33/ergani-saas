#!/bin/bash
# ============================================================
# 🏁 FIRST SETUP — Πρώτη εγκατάσταση (μόνο μία φορά)
#
# Τρέχει ΟΛΑ τα βήματα setup σε σειρά:
# npm install → .env → Docker → migration → seed → tests
#
# Χρήση:
#   ./scripts/first-setup.sh
# ============================================================

set -e
cd "$(dirname "$0")/.."

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🏁 Πρώτη Εγκατάσταση${NC}"
echo -e "${GREEN}Ψηφιακή Κάρτα Εργασίας — SaaS Platform${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# 1. Node.js version check
echo -e "\n${CYAN}[1/7] Έλεγχος Node.js...${NC}"
NODE_V=$(node --version 2>/dev/null || echo "none")
if [[ "$NODE_V" == "none" ]]; then
  echo -e "${RED}❌ Node.js δεν βρέθηκε! Εγκαταστήστε v20+${NC}"
  exit 1
fi
echo -e "  ${GREEN}✅ Node.js ${NODE_V}${NC}"

# 2. npm install
echo -e "\n${CYAN}[2/7] npm install...${NC}"
npm install
echo -e "  ${GREEN}✅ Dependencies εγκαταστάθηκαν${NC}"

# 3. .env
echo -e "\n${CYAN}[3/7] Environment (.env)...${NC}"
if [ ! -f .env ]; then
  cp .env.example .env
  # Auto-generate encryption key
  KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  sed -i "s|your-64-hex-chars-encryption-key-here-change-this-immediately00|$KEY|" .env
  echo -e "  ${GREEN}✅ .env δημιουργήθηκε με auto-generated ENCRYPTION_KEY${NC}"
else
  echo -e "  ${YELLOW}⚠️ .env υπάρχει ήδη — δεν αντικαθίσταται${NC}"
fi

# 4. Docker
echo -e "\n${CYAN}[4/7] Docker containers...${NC}"
docker compose up -d 2>/dev/null || docker-compose up -d 2>/dev/null
echo -e "  ${GREEN}✅ PostgreSQL, Redis, Kafka ξεκίνησαν${NC}"

echo -e "  ${CYAN}⏳ Αναμονή PostgreSQL (5 sec)...${NC}"
sleep 5

# 5. Migration
echo -e "\n${CYAN}[5/7] Database migration...${NC}"
docker exec -i ergani-postgres psql -U ergani_user -d ergani_db < infrastructure/migrations/001_initial.sql 2>/dev/null
echo -e "  ${GREEN}✅ Πίνακες δημιουργήθηκαν${NC}"

# 6. Seed data
echo -e "\n${CYAN}[6/7] Demo δεδομένα...${NC}"
docker exec -i ergani-postgres psql -U ergani_user -d ergani_db < infrastructure/seeds/demo_data.sql 2>/dev/null
echo -e "  ${GREEN}✅ Demo data φορτώθηκαν${NC}"

# 7. Tests
echo -e "\n${CYAN}[7/7] Unit tests...${NC}"
npx jest --forceExit 2>&1 | tail -5

echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 Εγκατάσταση ολοκληρώθηκε!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  Εκκίνηση:     ${CYAN}./scripts/start.sh${NC}"
echo -e "  Dashboard:    ${CYAN}http://localhost:3000/admin/${NC}"
echo -e "  Κατάσταση:    ${CYAN}./scripts/status.sh${NC}"
echo -e "  Βοήθεια:      ${CYAN}./scripts/help.sh${NC}"
echo ""
