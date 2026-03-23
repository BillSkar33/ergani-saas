#!/bin/bash
# ============================================================
# 🧪 TEST — Εκτέλεση tests + code quality checks
#
# Χρήση:
#   ./scripts/test.sh           → τρέχει 45 unit tests
#   ./scripts/test.sh --coverage → + coverage report
#   ./scripts/test.sh --watch   → watch mode
# ============================================================

set -e
cd "$(dirname "$0")/.."

GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}🧪 Tests — Ψηφιακή Κάρτα Εργασίας${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

MODE="${1:---run}"

case "$MODE" in
  --coverage)
    echo -e "\n${GREEN}📊 Tests + Coverage...${NC}"
    npx jest --verbose --coverage --forceExit
    ;;
  --watch)
    echo -e "\n${GREEN}👁️ Watch mode...${NC}"
    npx jest --watch --verbose
    ;;
  *)
    echo -e "\n${GREEN}▶️ Running tests...${NC}"
    npx jest --verbose --forceExit
    ;;
esac
