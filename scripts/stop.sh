#!/bin/bash
# ============================================================
# 🛑 STOP — Τερματισμός ΟΛΩΝ των υπηρεσιών
#
# Σταματάει: Node.js services + Docker containers
#
# Χρήση:
#   ./scripts/stop.sh          → σταματάει τα πάντα
#   ./scripts/stop.sh --keep-docker  → μόνο Node.js
# ============================================================

set -e
cd "$(dirname "$0")/.."

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${RED}🛑 Stop — Ψηφιακή Κάρτα Εργασίας${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Βήμα 1: Node.js
echo -e "\n${YELLOW}[1/2] Τερματισμός Node.js...${NC}"
pkill -f "node services/webhook-gateway" 2>/dev/null && echo "  ✓ Gateway" || echo "  - Gateway δεν έτρεχε"
pkill -f "node services/message-processor" 2>/dev/null && echo "  ✓ Processor" || echo "  - Processor δεν έτρεχε"
pkill -f "node services/scheduler" 2>/dev/null && echo "  ✓ Scheduler" || echo "  - Scheduler δεν έτρεχε"

# Βήμα 2: Docker (αν δεν ζητήθηκε --keep-docker)
if [ "$1" != "--keep-docker" ]; then
  echo -e "\n${YELLOW}[2/2] Τερματισμός Docker containers...${NC}"
  docker compose down 2>/dev/null || docker-compose down 2>/dev/null
  echo -e "${GREEN}✅ Docker containers σταμάτησαν${NC}"
else
  echo -e "\n${YELLOW}[2/2] Docker παραμένει ενεργό (--keep-docker)${NC}"
fi

echo -e "\n${GREEN}✅ Τερματισμός ολοκληρώθηκε${NC}"
