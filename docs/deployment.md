# OurSchool Docker Setup

This document covers everything Docker-related: the recommended GHCR pull-based setup for end users and the build-from-source setup for contributors.

## Prerequisites

- Docker and Docker Compose installed on your system
- At least 2 GB of available RAM
- Available ports: 5432 (PostgreSQL, local-db profile only), 8000 (Backend), 4173 (Frontend)


## Quick Start (GHCR — recommended for end users)

No build step required. Pulls official images from the GitHub Container Registry.

```bash
# 1. Grab the compose file and sample env
curl -O https://raw.githubusercontent.com/DGAzr/ourschool/main/docker-compose.ghcr.yml
curl -O https://raw.githubusercontent.com/DGAzr/ourschool/main/env.EXAMPLE

# 2. Configure your environment
cp env.EXAMPLE .env
# Edit .env — at minimum, set a real SECRET_KEY:
#   openssl rand -hex 32

# 3. Start (includes a bundled PostgreSQL container via --profile local-db)
docker compose -f docker-compose.ghcr.yml --profile local-db up -d

# 4. Open the app
open http://localhost:4173
```

> ⚠️ **Change the default credentials immediately.** Admin login: `admin` / `admin123`.

### Using an external database

Skip `--profile local-db` and set `DATABASE_URL` in `.env`:

```env
DATABASE_URL=postgresql+psycopg://user:password@host:5432/dbname
```

Then:
```bash
docker compose -f docker-compose.ghcr.yml up -d
```

### Choosing an image tag

`IMAGE_TAG` in `.env` controls which release is pulled (default: the release the compose file shipped with). To upgrade, **back up your database first** (see [Backup and Restore](#backup-and-restore)), then update `IMAGE_TAG` and pull fresh images:

```bash
# Update IMAGE_TAG in .env, then:
docker compose -f docker-compose.ghcr.yml pull
docker compose -f docker-compose.ghcr.yml up -d
```

All published tags: https://github.com/DGAzr/ourschool/pkgs/container/ourschool-backend


## Build from Source (contributors)

Use the build-based `docker-compose.yml` if you're working on the code and need to test local changes.

### Dev mode (live-reload)

`docker-compose.override.yml` is automatically merged in dev mode. It:
- Mounts source directories for live backend reload without rebuilds.
- Targets the `builder` stage of `Dockerfile.frontend` (Node/Vite instead of nginx).
- Runs `vite dev` on port 80 inside the container so the standard `4173 → 80` host mapping works for both dev and production.

```bash
docker compose up --build
```

### Production-style build (ignores the dev override)

```bash
docker compose -f docker-compose.yml up --build -d
```

> **Note (Vite 8 + Colima):** Vite 8 added strict host checking. If the frontend is unreachable through a tunnel or reverse proxy, ensure `allowedHosts: true` is set in `vite.config.ts` (already the case in this repo).


## Environment Configuration

Key variables (see `env.EXAMPLE` for the full annotated list):

### Database

```env
POSTGRES_DB=ourschool
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-secure-password-here
POSTGRES_PORT=5432

# Or full URL (takes precedence):
# DATABASE_URL=postgresql+psycopg://user:password@host:5432/dbname
```

### Security

```env
SECRET_KEY=...          # Required — app refuses to start if unset
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

### Server & ports

```env
BACKEND_PORT=8000
FRONTEND_PORT=4173      # host port; container always listens on 80
```

### Logging

```env
LOG_LEVEL=INFO          # DEBUG, INFO, WARNING, ERROR, CRITICAL
LOG_FORMAT=json         # json (default) or text
```

### CORS

```env
ALLOWED_ORIGINS=http://localhost:4173
```


## Services

### Database (PostgreSQL)
- **Image**: `postgres:15-alpine`
- **Port**: 5432 (customizable via `POSTGRES_PORT`)
- **Data**: Persisted in the `postgres_data` named volume
- **Profile**: `local-db` — only started when you pass `--profile local-db`

### Backend (FastAPI)
- **Image**: `ghcr.io/dgazr/ourschool-backend:${IMAGE_TAG}` (GHCR) or built from `Dockerfile.backend` (source)
- **Port**: 8000 (customizable via `BACKEND_PORT`; binds loopback by default)
- **Startup**: runs `start.sh` which applies Alembic migrations, seeds the admin account if no users exist, then starts uvicorn
- **Health check**: `GET /health` — 15s interval, 5 retries, 30s start period

### Frontend (React / nginx)
- **Image**: `ghcr.io/dgazr/ourschool-frontend:${IMAGE_TAG}` (GHCR) or built from `Dockerfile.frontend` (source)
- **Port**: 4173 → 80 (nginx; customizable via `FRONTEND_PORT`)
- **Depends on**: backend `service_healthy` — won't start until the API is ready
- **Health check**: `wget -qO- http://localhost:80` — 30s interval, 3 retries


## Common Docker Commands

```bash
# View logs
docker compose logs -f
docker compose logs -f backend
docker compose logs -f frontend

# Stop services
docker compose -f docker-compose.ghcr.yml down

# Restart a service
docker compose -f docker-compose.ghcr.yml restart backend

# Check service status and health
docker compose -f docker-compose.ghcr.yml ps
```


## Troubleshooting

### Services won't start

Check the logs:
```bash
docker compose -f docker-compose.ghcr.yml logs --tail=50
```

### Backend fails to start / migrations error

```bash
# Inspect backend logs
docker compose -f docker-compose.ghcr.yml logs backend

# Run migrations manually
docker compose -f docker-compose.ghcr.yml exec backend alembic upgrade head
```

### Database connection issues

```bash
# Check if the DB is ready
docker compose -f docker-compose.ghcr.yml exec db pg_isready -U postgres

# Check DB logs
docker compose -f docker-compose.ghcr.yml logs db
```

### Health check failures

Services have start periods to account for initialization (backend: 30s). If health checks are still failing after a minute, check the logs. You can also hit the health endpoints directly:

```bash
curl http://localhost:8000/health
curl http://localhost:8000/health/db
curl http://localhost:4173
```

### Port conflicts

Change the conflicting ports in `.env`:
```env
BACKEND_PORT=8001
FRONTEND_PORT=3001
POSTGRES_PORT=5433
```

### Reset everything (⚠️ destroys all data)

```bash
docker compose -f docker-compose.ghcr.yml down -v
docker compose -f docker-compose.ghcr.yml --profile local-db up -d
```


## Security Notes

- **Generate a real `SECRET_KEY`** — use `openssl rand -hex 32` and put it in `.env`. Docker Compose (both files) refuses to start if `SECRET_KEY` is unset.
- **Change the default admin password** immediately after first login (`admin` / `admin123`).
- **Set a strong database password.** The default `postgres`/`postgres` is for local dev only; it is not safe to expose publicly.
- **Restrict `ALLOWED_ORIGINS`** to your actual domains in production — a `*` wildcard is rejected at startup because credentials are enabled.
- **Terminate TLS at a reverse proxy.** The bundled nginx serves static files
  with gzip compression, but it provides no TLS or rate limiting. Put
  nginx/Caddy/Traefik (or a managed load balancer) in front. The backend
  (8000) and database (5432) bind to loopback by default; set
  `BACKEND_BIND`/`POSTGRES_BIND` to `0.0.0.0` only when they are behind such a
  proxy.
- **Disable interactive API docs** in production if desired: `ENABLE_API_DOCS=false`.
- **Don't expose the database port** publicly (stays on loopback by default).


## Backup and Restore

OurSchool has a built-in backup/restore system (Admin → Backup) with dry-run
preview, cross-version compatibility, and stable external IDs. That is the
recommended way to back up application data. The default restore mode merges
records by external ID. The optional **wipe-and-restore** mode deletes
backup-scoped data before import for point-in-time recovery; it requires typed
confirmation and preserves the importing administrator's account and
credentials.

For a raw PostgreSQL dump:

```bash
# Backup
docker compose -f docker-compose.ghcr.yml exec db \
  pg_dump -U postgres ourschool > backup.sql

# Restore
docker compose -f docker-compose.ghcr.yml stop backend
docker compose -f docker-compose.ghcr.yml exec -T db \
  psql -U postgres ourschool < backup.sql
docker compose -f docker-compose.ghcr.yml start backend
```

### Back up on a schedule

Nothing backs your data up automatically — set up a schedule. These records
are your family's academic history; a weekly cron job is cheap insurance.
Example (host crontab, Sunday 2am, keeping 8 weeks):

```bash
crontab -e
# m h dom mon dow command
0 2 * * 0 cd /path/to/ourschool && docker compose -f docker-compose.ghcr.yml exec -T db pg_dump -U postgres ourschool | gzip > backups/ourschool_$(date +\%Y\%m\%d).sql.gz && ls -t backups/ourschool_*.sql.gz | tail -n +9 | xargs -r rm

# Restore test: periodically verify a dump actually restores (into a throwaway
# database) — an unverified backup is a hope, not a backup.
```

Also take a manual backup **before every upgrade** (see the
[migration guide](migrations.md)).


## Monitoring

```bash
# Resource usage
docker stats

# Disk usage
docker system df

# Health endpoints
curl http://localhost:8000/health
curl http://localhost:8000/health/db
```
