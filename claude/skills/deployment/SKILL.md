# Deployment Skill — Docker & Infrastructure

## Overview
Guidelines for containerization, deployment, and infrastructure management of the Ergani SaaS platform.

## Stack
- **Containers**: Docker + Docker Compose
- **Reverse Proxy**: Nginx
- **Database**: PostgreSQL (containerized)
- **Cache**: Redis (containerized)
- **Messaging**: Apache Kafka (containerized)

## Docker Compose Structure
```yaml
# project-main/docker-compose.yml
services:
  ergani-postgres     # PostgreSQL database
  ergani-redis        # Redis cache
  ergani-kafka        # Kafka broker
  ergani-zookeeper    # Kafka dependency
  ergani-gateway      # webhook-gateway service
  ergani-processor    # message-processor service
  ergani-admin-api    # admin-api service
  ergani-super-api    # super-admin-api service
  ergani-scheduler    # scheduler service
  ergani-nginx        # Nginx reverse proxy
```

## Service Start Order
1. `ergani-postgres` + `ergani-redis` + `ergani-zookeeper`
2. `ergani-kafka` (depends on zookeeper)
3. Backend services (depend on postgres + redis + kafka)
4. `ergani-nginx` (depends on all backend services)

## Commands (via claude/commands/)
```bash
./claude/commands/start.sh       # Start all services
./claude/commands/stop.sh        # Stop all services
./claude/commands/restart.sh     # Restart services
./claude/commands/status.sh      # Show service health
./claude/commands/logs.sh        # Tail logs
./claude/commands/backup.sh      # Backup database
./claude/commands/db-setup.sh    # Initialize database
./claude/commands/first-setup.sh # First-time setup
```

## Environment Variables
Required vars (see `.env.example`):
```
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
KAFKA_BROKERS=localhost:9092
JWT_SECRET=...
ENCRYPTION_KEY=...  # 32-byte hex
ERGANI_API_URL=...
ERGANI_USERNAME=...
ERGANI_PASSWORD=...
```

## Nginx Configuration
```
project-main/infrastructure/nginx/
└── nginx.conf    # Upstream proxying, SSL termination, static file serving
```
- Routes `/api/` → admin-api service
- Routes `/super/` → super-admin-api service
- Routes `/webhook/` → webhook-gateway service
- Serves `/dashboard/` static files

## Health Checks
Each service exposes `GET /health`:
```json
{ "status": "ok", "service": "admin-api", "uptime": 3600 }
```

## Migrations on Deploy
Run migrations in order before starting services:
```bash
npm run migrate
npm run migrate:trial
npm run migrate:schedules
npm run migrate:advanced
```

## Logs
- All services use Pino structured JSON logging
- Log level controlled by `LOG_LEVEL` env var
- In development: `pino-pretty` for human-readable output

## Do's & Don'ts
- ✅ Use `restart: unless-stopped` for production containers
- ✅ Mount `.env` as Docker secret in production
- ✅ Set resource limits (`mem_limit`, `cpus`) on containers
- ✅ Run migrations before deploying new service versions
- ❌ Never expose PostgreSQL or Redis ports publicly
- ❌ Never use `latest` Docker image tags in production
- ❌ Never store secrets in Dockerfile or docker-compose.yml
