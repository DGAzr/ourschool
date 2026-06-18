#!/bin/bash
set -e

echo "🚀 Deploying OurSchool with Docker..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  No .env file found."
    echo "📝 Copy env.EXAMPLE to .env and set SECRET_KEY before running again."
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

echo "🏗️  Building and starting services..."
docker-compose up --build -d

echo "⏳ Waiting for all services to be healthy..."

SERVICES=("ourschool-db-1" "ourschool-backend-1" "ourschool-frontend-1")
MAX_WAIT=120
INTERVAL=5
elapsed=0

while [ $elapsed -lt $MAX_WAIT ]; do
    all_healthy=true
    for service in "${SERVICES[@]}"; do
        status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$service" 2>/dev/null || echo "missing")
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
