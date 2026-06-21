# OurSchool Docker Setup

This document explains how to run OurSchool using Docker and Docker Compose.

## Prerequisites

- Docker and Docker Compose installed on your system
- At least 2GB of available RAM
- Available ports: 5432 (PostgreSQL), 8000 (Backend), 4173 (Frontend)

## Quick Start

1. **Copy the environment file:**
   ```bash
   cp env.EXAMPLE .env
   ```

2. **Build and start all services:**
   ```bash
   docker-compose up --build
   ```

3. **Access the application:**
   - Frontend: http://localhost:4173
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

## Environment Configuration

The Docker setup uses environment variables for configuration. You can customize these in your `.env` file:

### Database Configuration
```env
POSTGRES_DB=ourschool                    # Database name
POSTGRES_USER=postgres                   # Database user
POSTGRES_PASSWORD=docker_password        # Database password (change for production!)
```

### Application Configuration
```env
SECRET_KEY=your-secret-key              # JWT signing key (REQUIRED - change for production!)
ALGORITHM=HS256                         # JWT algorithm
ACCESS_TOKEN_EXPIRE_MINUTES=30          # Token expiration time

BACKEND_HOST=0.0.0.0                    # Backend bind address
BACKEND_PORT=8000                       # Backend port
FRONTEND_PORT=4173                      # Frontend port (default: 4173)

LOG_LEVEL=INFO                          # Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
LOG_FORMAT=json                         # Log format (json or text)

# CORS origins (comma-separated)
ALLOWED_ORIGINS=http://localhost:4173,http://frontend:4173
```

## Services

### Database (PostgreSQL)
- **Image**: postgres:15-alpine
- **Port**: 5432 (customizable with `POSTGRES_PORT`)
- **Data**: Persisted in `postgres_data` volume
- **Health Check**: Automatic readiness check

### Backend (FastAPI)
- **Build**: `Dockerfile.backend`
- **Port**: 8000 (customizable with `BACKEND_PORT`)
- **Restart**: `unless-stopped` (auto-restart on failure)
- **Features**:
  - Automatic database migrations on startup
  - Initial admin user creation if no users exist
  - Health checks on `/health` endpoint (15s interval, 5 retries, 30s start period)
  - Hot-reload for development (when volumes are mounted)

### Frontend (React/Vite)
- **Build**: `Dockerfile.frontend`
- **Port**: 4173 (customizable with `FRONTEND_PORT`)
- **Restart**: `unless-stopped` (auto-restart on failure)
- **Depends on**: Backend with `condition: service_healthy` (waits for backend to be healthy, not just running)
- **Features**:
  - Production build served by Vite preview server
  - Proxy configuration for API calls
  - Health checks (node HTTP check)

## Docker Commands

### Start services (detached)
```bash
docker-compose up -d
```

### View logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f db
```

### Stop services
```bash
docker-compose down
```

### Rebuild and restart
```bash
docker-compose down
docker-compose up --build
```

### Reset database (removes all data!)
```bash
docker-compose down -v
docker-compose up --build
```

## Development vs Production

### Development Setup
A `docker-compose.override.yml` is provided in the repository root for local development. It:
- Mounts source directories so backend edits are live without a rebuild.
- Targets the `builder` stage of `Dockerfile.frontend` (Node/Vite instead of nginx).
- Runs `vite dev` on port 80 inside the container so the standard `4173→80` host-mapping works for both dev and production.

```bash
# Dev mode (override is applied automatically):
docker-compose up --build

# Production-style run (ignores the override):
docker-compose -f docker-compose.yml up --build -d
```

> **Note (Vite 8 + Colima):** Vite 8 added strict host checking. If the frontend
> is unreachable through a tunnel or reverse proxy, ensure `allowedHosts: true`
> is set in `vite.config.ts` (already the case in this repo).

### Production Setup
For production:

1. **Use strong passwords and secrets:**
   ```env
   SECRET_KEY=your-very-secure-production-secret-key
   POSTGRES_PASSWORD=your-secure-database-password
   ```

2. **Configure proper CORS origins:**
   ```env
   ALLOWED_ORIGINS=https://yourapp.com,https://www.yourapp.com
   ```

3. **Use appropriate logging:**
   ```env
   LOG_LEVEL=INFO
   LOG_FORMAT=json
   ```

4. **Consider using external database:**
   Instead of the included PostgreSQL container, you might want to use a managed database service.

## Troubleshooting

### Database Connection Issues
```bash
# Check if database is ready
docker-compose exec db pg_isready -U postgres

# Check database logs
docker-compose logs db
```

### Backend Issues
```bash
# Check backend logs
docker-compose logs backend

# Access backend container
docker-compose exec backend bash

# Run migrations manually
docker-compose exec backend alembic upgrade head
```

### Frontend Issues
```bash
# Check frontend logs
docker-compose logs frontend

# Rebuild frontend
docker-compose build frontend
```

### Port Conflicts
If you get port conflicts, you can change the ports in your `.env` file:
```env
BACKEND_PORT=8001
FRONTEND_PORT=3001
POSTGRES_PORT=5433
```

### Health Check Failures
Health checks may fail if services are still starting up. Wait a few minutes and check logs:
```bash
# Check service status
docker-compose ps

# Check health status
docker-compose exec backend curl -f http://localhost:8000/health
```

## Security Notes

- **Change default passwords** in production. `docker-deploy.sh` now refuses to
  start with an empty/known-default `POSTGRES_PASSWORD` (override with
  `ALLOW_WEAK_DB_PASSWORD=true` only if you really mean it).
- **Use a strong SECRET_KEY.** `docker-compose.yml` has no default — deployment
  fails fast if it is unset — and `docker-deploy.sh` rejects placeholder/short
  keys. Generate one with `openssl rand -hex 32`.
- **Restrict CORS origins** to your actual domains (`ALLOWED_ORIGINS`). A `*`
  wildcard is rejected at startup because credentials are enabled.
- **Terminate TLS at a reverse proxy.** The bundled frontend uses Vite's
  `preview` server, which is not a hardened production web server and provides
  no TLS, gzip, or rate limiting. Put nginx/Caddy/Traefik (or a managed load
  balancer) in front to terminate HTTPS and add rate limiting. By default the
  backend (8000) and database (5432) bind to `127.0.0.1`; set
  `BACKEND_BIND`/`POSTGRES_BIND` to `0.0.0.0` only when fronted by such a proxy.
- **Disable interactive API docs** in production if desired: `ENABLE_API_DOCS=false`.
- **Keep Docker images updated** and rebuild after dependency bumps.
- **Don't expose the database port** publicly (it stays on loopback by default).

## Backup and Restore

### Backup Database
```bash
docker-compose exec db pg_dump -U postgres ourschool > backup.sql
```

### Restore Database
```bash
# Stop backend to avoid conflicts
docker-compose stop backend

# Restore
docker-compose exec -T db psql -U postgres ourschool < backup.sql

# Restart backend
docker-compose start backend
```

## Monitoring

### Check Service Health
```bash
# Backend health
curl http://localhost:8000/health

# Database health  
curl http://localhost:8000/health/db

# Frontend health
curl http://localhost:4173
```

### Resource Usage
```bash
# Check resource usage
docker stats

# Check disk usage
docker system df
```