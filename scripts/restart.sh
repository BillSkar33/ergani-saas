#!/bin/bash
# ============================================================
# 🔄 RESTART — Τερματισμός & επανεκκίνηση υπηρεσιών
#
# Σταματάει τα running Node.js processes και τα ξεκινάει ξανά
#
# Χρήση:
#   ./scripts/restart.sh
# ============================================================

set -e
cd "$(dirname "$0")/.."

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}🔄 Restart — Ψηφιακή Κάρτα Εργασίας${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Βήμα 1: Σταμάτημα Node.js services
echo -e "\n${RED}[1/3] Τερματισμός Node.js processes...${NC}"

# Βρες και σκότωσε τα processes
pkill -f "node services/webhook-gateway" 2>/dev/null && echo "  ✓ Gateway τερματίστηκε" || echo "  - Gateway δεν έτρεχε"
pkill -f "node services/message-processor" 2>/dev/null && echo "  ✓ Processor τερματίστηκε" || echo "  - Processor δεν έτρεχε"
pkill -f "node services/scheduler" 2>/dev/null && echo "  ✓ Scheduler τερματίστηκε" || echo "  - Scheduler δεν έτρεχε"

sleep 2

# Βήμα 2: Restart Docker (αν χρειάζεται)
echo -e "\n${YELLOW}[2/3] Docker containers...${NC}"
docker compose restart 2>/dev/null || docker-compose restart 2>/dev/null
echo -e "${GREEN}✅ Docker restarted${NC}"

sleep 3

# Βήμα 3: Εκκίνηση ξανά
echo -e "\n${GREEN}[3/3] Εκκίνηση υπηρεσιών...${NC}"

node services/webhook-gateway/index.js &
echo "  ✓ Gateway ξεκίνησε (PID: $!)"

node services/message-processor/index.js &
echo "  ✓ Processor ξεκίνησε (PID: $!)"

node services/scheduler/index.js &
echo "  ✓ Scheduler ξεκίνησε (PID: $!)"

echo -e "\n${GREEN}✅ Restart ολοκληρώθηκε!${NC}"
echo -e "${YELLOW}Πατήστε Ctrl+C για τερματισμό${NC}"
wait
