#!/bin/bash
# ============================================================
# 📦 GIT PUSH — Αυτόματο commit & push αλλαγών
#
# Χρήση:
#   ./scripts/git-push.sh                    → commit "update" + push
#   ./scripts/git-push.sh "fix: geofence"    → custom commit message
# ============================================================

set -e
cd "$(dirname "$0")/.."

# Χρώματα
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}📦 Git Push — Ψηφιακή Κάρτα Εργασίας${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Commit message
MSG="${1:-update: $(date '+%Y-%m-%d %H:%M')}"

# Εμφάνιση αλλαγών
echo -e "\n${GREEN}📋 Αλλαγές:${NC}"
git status --short

# Αν δεν υπάρχουν αλλαγές
if git diff --quiet && git diff --cached --quiet; then
  echo -e "${YELLOW}⚠️  Δεν υπάρχουν αλλαγές για commit${NC}"
  exit 0
fi

# Add + Commit
echo -e "\n${GREEN}📝 Commit: ${MSG}${NC}"
git add .
git commit -m "$MSG"

# Push
BRANCH=$(git branch --show-current 2>/dev/null || echo "main")
echo -e "\n${GREEN}🚀 Push στο branch: ${BRANCH}${NC}"
git push origin "$BRANCH"

echo -e "\n${GREEN}✅ Ολοκληρώθηκε!${NC}"
