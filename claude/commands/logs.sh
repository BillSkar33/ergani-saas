#!/bin/bash
# ============================================================
# 📋 LOGS — Εμφάνιση logs υπηρεσιών
#
# Χρήση:
#   ./scripts/logs.sh              → PostgreSQL logs
#   ./scripts/logs.sh kafka        → Kafka logs
#   ./scripts/logs.sh redis        → Redis logs
#   ./scripts/logs.sh all          → Όλα τα Docker logs
# ============================================================

cd "$(dirname "$0")/.."

SERVICE="${1:-postgres}"

case "$SERVICE" in
  postgres|pg|db)
    echo "📋 PostgreSQL Logs (τελευταίες 50 γραμμές):"
    docker logs ergani-postgres --tail 50
    ;;
  kafka)
    echo "📋 Kafka Logs:"
    docker logs ergani-kafka --tail 50
    ;;
  redis)
    echo "📋 Redis Logs:"
    docker logs ergani-redis --tail 50
    ;;
  all)
    echo "📋 All Docker Logs:"
    docker compose logs --tail 30
    ;;
  *)
    echo "Χρήση: ./scripts/logs.sh [postgres|kafka|redis|all]"
    ;;
esac
