# OurSchool Docker Setup

This document covers everything Docker-related: the recommended GHCR pull-based setup for end users and the build-from-source setup for contributors.

## Prerequisites

- Docker and Docker Compose 2.20 or later installed on your system
- At least 2 GB of available RAM
- Available frontend host port: 4173 by default (customizable with `FRONTEND_PORT`). Production does not claim host ports 5432 or 8000.


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

# 3. Start (includes a bundled PostgreSQL container by default)
docker compose -f docker-compose.ghcr.yml up -d

# 4. Open the app
open http://localhost:4173
```

> ⚠️ **Change the default credentials immediately.** Admin login: `admin` / `admin123`.

### Using an external database

Download the small external-database override, then set `DATABASE_URL` in `.env` (or use the individual `DATABASE_*` settings):

```bash
curl -O https://raw.githubusercontent.com/DGAzr/ourschool/main/docker-compose.external-db.yml
```

```env
DATABASE_URL=postgresql+psycopg://user:password@host:5432/dbname
```

Then:
```bash
docker compose -f docker-compose.ghcr.yml -f docker-compose.external-db.yml up -d
```

Include both files in subsequent `pull`, `up`, `down`, `restart`, `exec`, and
other management commands. Do not enable `local-db` through `--profile` or
`COMPOSE_PROFILES`, or explicitly target `db`; doing so re-enables the bundled
database. Setting `DATABASE_URL` alone changes the backend connection but does
not disable the bundled database. Its precedence over individual variables is
unchanged. Container `localhost` refers to that container, not your host.

For a source-built deployment, use `docker-compose.yml` as the first file.
For external-database development, use this order:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml -f docker-compose.external-db.yml up --build
```

Existing external databases are never copied or moved into the bundled volume.
Use your database provider's tooling for PostgreSQL-level backups and monitoring;
`exec db` examples below apply only to the bundled database.

### Choosing an image tag

`IMAGE_TAG` in `.env` controls which release is pulled (default: the release the compose file shipped with). To upgrade, **back up your database first** (see [Backup and Restore](#backup-and-restore)), then update `IMAGE_TAG` and pull fresh images:

```bash
# Update IMAGE_TAG in .env, then:
docker compose -f docker-compose.ghcr.yml pull
docker compose -f docker-compose.ghcr.yml up -d
```

Keep the same Compose project name and `postgres_data` volume when upgrading.
Never use `down -v` as an upgrade step. Fetch the new Compose files along with
an image upgrade: old copies retain the old profiles and published ports.
External-database users must add the external override; developers must opt
into the dev preset. The old `--profile local-db` flag is unnecessary for the
new bundled default, but remains harmless without the external override.

All published tags: https://github.com/DGAzr/ourschool/pkgs/container/ourschool-backend


## Build from Source (contributors)

Use the build-based `docker-compose.yml` if you're working on the code and need to test local changes.

### Dev mode (live-reload)

Select `docker-compose.dev.yml` explicitly. It:
- Mounts backend source; restart `backend` after Python edits.
- Targets the `builder` stage of `Dockerfile.frontend` and enables Vite HMR.
- Polls source files so HMR works across VM bind mounts. Set
  `CHOKIDAR_USEPOLLING=false` if your runtime forwards file-change events.
- Runs Vite on container port 80, preserving the frontend host mapping.
- Publishes API/database host ports on `127.0.0.1` only, configurable with
  `BACKEND_PORT` and `POSTGRES_PORT`.

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

The previous `docker-compose.override.yml` was an ignored, local file rather
than a shipped preset. Preserve any custom settings and review or move that
file aside when adopting the new dev preset. Bare Compose commands still load
user-owned overrides automatically; explicit `-f` commands do not.

### Production build

```bash
docker compose up --build -d
```

On a checkout with a user-owned automatic override, use
`docker compose -f docker-compose.yml up --build -d` to select only the base.

> **Note (Vite 8 + Colima):** Vite 8 added strict host checking. If the frontend is unreachable through a tunnel or reverse proxy, ensure `allowedHosts: true` is set in `vite.config.ts` (already the case in this repo).


## Environment Configuration

Key variables (see `env.EXAMPLE` for the full annotated list):

### Database

```env
POSTGRES_DB=ourschool
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-secure-password-here
POSTGRES_PORT=5432      # development host mapping only

# Or full URL (takes precedence):
# DATABASE_URL=postgresql+psycopg://user:password@host:5432/dbname
```

### Security

```env
SECRET_KEY=...          # Required — app refuses to start if unset
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30  # Fallback; configure the active value in Users & access
```

### Server & ports

```env
BACKEND_PORT=8000       # development host mapping only; container stays on 8000
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
- **Port**: container 5432; no production host mapping. Development publishes loopback `${POSTGRES_PORT:-5432}`.
- **Data**: Persisted in the `postgres_data` named volume
- **Startup**: included by default; excluded when selecting the external-database override without enabling `local-db`.

### Backend (FastAPI)
- **Image**: `ghcr.io/dgazr/ourschool-backend:${IMAGE_TAG}` (GHCR) or built from `Dockerfile.backend` (source)
- **Port**: container 8000; no production host mapping. Development publishes loopback `${BACKEND_PORT:-8000}`.
- **Startup**: runs `start.sh` which applies Alembic migrations, seeds the admin account if no users exist, then starts uvicorn
- **Health check**: `GET /health` — 15s interval, 5 retries, 30s start period

### Frontend (React / nginx)
- **Image**: `ghcr.io/dgazr/ourschool-frontend:${IMAGE_TAG}` (GHCR) or built from `Dockerfile.frontend` (source)
- **Port**: 4173 → 80 (nginx; customizable via `FRONTEND_PORT`)
- **Depends on**: backend `service_healthy` — won't start until the API is ready
- **Health check**: `wget -qO- http://localhost:80` — 30s interval, 3 retries, 10s start period


## PaaS / Coolify routing

Use the GHCR base file and configure the public domain to route to the
`frontend` service on container port **80**. The frontend proxies `/api/...`
to `backend:8000`; the backend connects to `db:5432` in bundled mode. Neither
internal service needs a published host port. If host port 4173 is occupied,
choose another `FRONTEND_PORT` in the PaaS environment.

For external PostgreSQL, include the external override in the platform's
Compose-file list, after the base file, and supply its connection settings.
A platform that accepts only one file can use the merged result of
`docker compose -f docker-compose.ghcr.yml -f docker-compose.external-db.yml config`;
that output contains resolved secrets and must be treated as private configuration.
This documents the routing contract; it does not claim a live Coolify deployment
has been verified.

## Common Docker Commands

```bash
# View logs
docker compose -f docker-compose.ghcr.yml logs -f
docker compose -f docker-compose.ghcr.yml logs -f backend
docker compose -f docker-compose.ghcr.yml logs -f frontend

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
docker compose -f docker-compose.ghcr.yml exec backend curl -f http://localhost:8000/health
docker compose -f docker-compose.ghcr.yml exec backend curl -f http://localhost:8000/health/db
curl http://localhost:4173
```

### Port conflicts

Production needs only a free frontend port. Change `FRONTEND_PORT` in `.env`.
Development also publishes localhost API/database ports, which can be changed
without changing the container ports:
```env
BACKEND_PORT=8001
FRONTEND_PORT=3001
POSTGRES_PORT=5433
```

### Reset everything (⚠️ destroys all data)

```bash
docker compose -f docker-compose.ghcr.yml down -v
docker compose -f docker-compose.ghcr.yml up -d
```


## Security Notes

- **Generate a real `SECRET_KEY`** — use `openssl rand -hex 32` and put it in `.env`. Docker Compose (both files) refuses to start if `SECRET_KEY` is unset.
- **Change the default admin password** immediately after first login (`admin` / `admin123`).
- **Set a strong database password.** The default `postgres`/`postgres` is for local dev only; it is not safe to expose publicly.
- **Restrict `ALLOWED_ORIGINS`** to your actual domains in production — a `*` wildcard is rejected at startup because credentials are enabled.
- **Terminate TLS at a reverse proxy.** The bundled nginx serves static files
  with gzip compression, but it provides no TLS or rate limiting. Put
  nginx/Caddy/Traefik (or a managed load balancer) in front. Production
  publishes only the frontend; backend/database ports stay on the Compose
  network. Development host bindings are loopback-only.
- **Disable interactive API docs** in production if desired: `ENABLE_API_DOCS=false`.
- **Don't expose the database port** publicly. Use container commands in production or the loopback development preset.


## Backup and Restore

OurSchool has a built-in backup/restore system (Admin → Backup) with dry-run
preview, cross-version compatibility, and stable external IDs. That is the
recommended way to back up application data. The default restore mode merges
records by external ID. The optional **wipe-and-restore** mode deletes
backup-scoped data before import for point-in-time recovery; it requires typed
confirmation and preserves the importing administrator's account and
credentials.

The bundled deployment accepts restore requests up to 256 MiB. If you override
`MAX_REQUEST_BODY_BYTES`, keep it aligned with `client_max_body_size` in
`nginx.conf` and with any request-size limit on an external reverse proxy.

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
docker compose -f docker-compose.ghcr.yml exec backend curl -f http://localhost:8000/health
docker compose -f docker-compose.ghcr.yml exec backend curl -f http://localhost:8000/health/db
```
