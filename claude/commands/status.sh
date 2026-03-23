#!/bin/bash
# ============================================================
# 📋 STATUS — Κατάσταση ΟΛΩΝ των υπηρεσιών
#
# Ελέγχει αν τρέχουν: Docker, Gateway, Processor, Scheduler
#
# Χρήση:
#   ./scripts/status.sh
# ============================================================

cd "$(dirname "$0")/.."

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}📋 Status — Ψηφιακή Κάρτα Εργασίας${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Docker Containers
echo -e "\n${CYAN}🐳 Docker:${NC}"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "  Docker δεν τρέχει"

# Node.js Services
echo -e "\n${CYAN}📦 Node.js Services:${NC}"

check_service() {
  local name="$1"
  local pattern="$2"
  if pgrep -f "$pattern" > /dev/null 2>&1; then
    PID=$(pgrep -f "$pattern" | head -1)
    echo -e "  ${GREEN}✅ ${name} (PID: ${PID})${NC}"
  else
    echo -e "  ${RED}❌ ${name} — δεν τρέχει${NC}"
  fi
}

check_service "Webhook Gateway" "node services/webhook-gateway"
check_service "Message Processor" "node services/message-processor"
check_service "Scheduler" "node services/scheduler"

# Health Check
echo -e "\n${CYAN}🏥 Health Check:${NC}"
HEALTH=$(curl -s http://localhost:3000/health 2>/dev/null)
if [ -n "$HEALTH" ]; then
  echo -e "  ${GREEN}✅ HTTP OK — $HEALTH${NC}"
else
  echo -e "  ${RED}❌ HTTP δεν απαντάει (port 3000)${NC}"
fi

# Disk Usage
echo -e "\n${CYAN}💾 Disk:${NC}"
echo "  Docker volumes: $(docker system df --format '{{.Size}}' 2>/dev/null | head -1 || echo 'N/A')"
echo "  Backups: $(du -sh backups/ 2>/dev/null | cut -f1 || echo '0')"

echo ""
