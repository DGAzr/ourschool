#!/bin/bash
set -e

echo "🚀 Deploying OurSchool with Docker..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  No .env file found."
    echo "📝 Copy env.EXAMPLE to .env and set SECRET_KEY before running again."
    exit 1
fi

# Load .env so we can validate critical secrets before starting anything.
set -a
# shellcheck disable=SC1091
. ./.env
set +a

# Reject missing/placeholder/weak SECRET_KEY (the app signs JWTs with it).
if [ -z "${SECRET_KEY}" ] \
   || printf '%s' "${SECRET_KEY}" | grep -qiE 'change-this|change-me|your-secret-key|changeme' \
   || [ "${#SECRET_KEY}" -lt 16 ]; then
    echo "❌ SECRET_KEY is missing, a placeholder, or too short (<16 chars)."
    echo "   Generate a strong key and set it in .env:  openssl rand -hex 32"
    exit 1
fi

# Reject the well-known default DB password unless explicitly allowed.
DB_PW="${DATABASE_PASSWORD:-${POSTGRES_PASSWORD:-}}"
if { [ "${DB_PW}" = "postgres" ] || [ "${DB_PW}" = "your-secure-password-here" ] || [ -z "${DB_PW}" ]; } \
   && [ "${ALLOW_WEAK_DB_PASSWORD:-false}" != "true" ]; then
    echo "❌ DATABASE_PASSWORD/POSTGRES_PASSWORD is empty or a known default."
    echo "   Set a strong password in .env (or set ALLOW_WEAK_DB_PASSWORD=true to override)."
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

echo "🏗️  Building and starting services..."
# Use only the base compose file so the dev-only source bind-mount in
# docker-compose.override.yml is NOT applied to this deployment.
docker-compose -f docker-compose.yml up --build -d

echo "⏳ Waiting for all services to be healthy..."

# Derive container names dynamically from docker-compose
# This works regardless of project name or COMPOSE_PROJECT_NAME
COMPOSE_SERVICES=("db" "backend" "frontend")
MAX_WAIT=120
INTERVAL=5
elapsed=0

while [ $elapsed -lt $MAX_WAIT ]; do
    all_healthy=true
    for compose_service in "${COMPOSE_SERVICES[@]}"; do
        container_id=$(docker-compose ps -q "$compose_service" 2>/dev/null || true)
        if [ -z "$container_id" ]; then
            all_healthy=false
            break
        fi
        status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_id" 2>/dev/null || echo "missing")
        if [ "$status" != "healthy" ]; then
            all_healthy=false
            break
        fi
    done

    if $all_healthy; then
        echo "✅ All services are healthy!"
        break
    fi

    echo "   Waiting... (${elapsed}s / ${MAX_WAIT}s)"
    sleep $INTERVAL
    elapsed=$((elapsed + INTERVAL))
done

if ! $all_healthy; then
    echo "❌ Services did not become healthy within ${MAX_WAIT}s. Showing logs:"
    docker-compose logs --tail=50
    exit 1
fi

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "📋 Service URLs:"
echo "   Frontend:    http://localhost:${FRONTEND_PORT:-4173}"
echo "   Backend API: http://localhost:${BACKEND_PORT:-8000}"
echo "   API Docs:    http://localhost:${BACKEND_PORT:-8000}/docs"
echo ""
echo "📊 To view logs: docker-compose logs -f"
echo "🛑 To stop:      docker-compose down"
echo "🔄 To restart:   docker-compose restart"
echo ""
