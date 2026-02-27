#!/bin/bash
# ============================================================
# 💾 BACKUP — Αντίγραφο ασφαλείας PostgreSQL
#
# Δημιουργεί SQL dump στον φάκελο backups/
#
# Χρήση:
#   ./scripts/backup.sh           → backup τώρα
#   ./scripts/backup.sh --list    → εμφάνιση backups
#   ./scripts/backup.sh --restore backup_2026-02-27.sql → επαναφορά
# ============================================================

set -e
cd "$(dirname "$0")/.."

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR"

echo -e "${CYAN}💾 Backup — Ψηφιακή Κάρτα Εργασίας${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

MODE="${1:---backup}"

case "$MODE" in
  --list)
    echo -e "\n${CYAN}📋 Υπάρχοντα backups:${NC}"
    ls -lh "$BACKUP_DIR"/*.sql 2>/dev/null || echo "  Δεν υπάρχουν backups"
    ;;

  --restore)
    FILE="$2"
    if [ -z "$FILE" ]; then
      echo -e "${RED}❌ Δώστε αρχείο: ./scripts/backup.sh --restore backups/file.sql${NC}"
      exit 1
    fi
    if [ ! -f "$FILE" ]; then
      echo -e "${RED}❌ Αρχείο δεν βρέθηκε: $FILE${NC}"
      exit 1
    fi

    echo -e "${RED}⚠️  ΠΡΟΣΟΧΗ: Αυτό θα αντικαταστήσει τα τρέχοντα δεδομένα!${NC}"
    read -p "Σίγουρα; (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      echo -e "${YELLOW}Ακυρώθηκε${NC}"
      exit 0
    fi

    echo -e "\n${YELLOW}♻️ Επαναφορά από: $FILE${NC}"
    docker exec -i ergani-postgres psql -U ergani_user -d ergani_db < "$FILE"
    echo -e "${GREEN}✅ Επαναφορά ολοκληρώθηκε${NC}"
    ;;

  *)
    # Default: backup
    TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
    FILENAME="$BACKUP_DIR/backup_${TIMESTAMP}.sql"

    echo -e "\n${GREEN}📦 Δημιουργία backup...${NC}"
    docker exec ergani-postgres pg_dump -U ergani_user -d ergani_db > "$FILENAME"

    SIZE=$(du -h "$FILENAME" | cut -f1)
    echo -e "${GREEN}✅ Backup: ${FILENAME} (${SIZE})${NC}"
    
    # Κράτα μόνο τα τελευταία 10 backups
    ls -t "$BACKUP_DIR"/backup_*.sql 2>/dev/null | tail -n +11 | xargs rm -f 2>/dev/null
    echo -e "${CYAN}📋 Backups: $(ls "$BACKUP_DIR"/backup_*.sql 2>/dev/null | wc -l) αρχεία${NC}"
    ;;
esac
