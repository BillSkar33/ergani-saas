#!/bin/bash
# ============================================================
# 🚀 START — Εκκίνηση ΟΛΩΝ των υπηρεσιών
#
# Ξεκινάει: Docker → Webhook Gateway → Message Processor → Scheduler
#
# Χρήση:
#   ./scripts/start.sh          → εκκίνηση όλων
#   ./scripts/start.sh gateway  → μόνο gateway
# ============================================================

set -e
cd "$(dirname "$0")/.."

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${GREEN}🚀 Εκκίνηση — Ψηφιακή Κάρτα Εργασίας${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Βήμα 1: Docker
echo -e "\n${CYAN}[1/4] Docker containers...${NC}"
docker compose up -d 2>/dev/null || docker-compose up -d 2>/dev/null
echo -e "${GREEN}✅ PostgreSQL, Redis, Kafka ξεκίνησαν${NC}"

# Αναμονή PostgreSQL
echo -e "${CYAN}⏳ Αναμονή PostgreSQL...${NC}"
sleep 3

SERVICE="${1:-all}"

if [ "$SERVICE" = "all" ] || [ "$SERVICE" = "gateway" ]; then
  # Βήμα 2: Webhook Gateway
  echo -e "\n${CYAN}[2/4] Webhook Gateway (port 3000)...${NC}"
  node services/webhook-gateway/index.js &
  GATEWAY_PID=$!
  echo -e "${GREEN}✅ Gateway PID: $GATEWAY_PID${NC}"
fi

if [ "$SERVICE" = "all" ] || [ "$SERVICE" = "processor" ]; then
  # Βήμα 3: Message Processor
  echo -e "\n${CYAN}[3/4] Message Processor (Kafka consumer)...${NC}"
  node services/message-processor/index.js &
  PROCESSOR_PID=$!
  echo -e "${GREEN}✅ Processor PID: $PROCESSOR_PID${NC}"
fi

if [ "$SERVICE" = "all" ] || [ "$SERVICE" = "scheduler" ]; then
  # Βήμα 4: Scheduler
  echo -e "\n${CYAN}[4/4] Scheduler (CRON jobs)...${NC}"
  node services/scheduler/index.js &
  SCHEDULER_PID=$!
  echo -e "${GREEN}✅ Scheduler PID: $SCHEDULER_PID${NC}"
fi

echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 Όλες οι υπηρεσίες ξεκίνησαν!${NC}"
echo -e "${CYAN}Dashboard: http://localhost:3000/admin/${NC}"
echo -e "${CYAN}Health:    http://localhost:3000/health${NC}"
echo -e "\n${YELLOW}Πατήστε Ctrl+C για τερματισμό${NC}"

# Αναμονή (κρατάει το script ζωντανό)
wait
