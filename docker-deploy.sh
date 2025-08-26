#!/bin/bash
set -e

echo "🚀 Deploying OurSchool with Docker..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  No .env file found...."
    echo "📝 Please copy env.EXAMPLE to .env file with your configuration before running again."
    echo "   Especially change the SECRET_KEY!"
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

echo "🏗️  Building and starting services..."

# Build and start all services
docker-compose up --build -d

echo "⏳ Waiting for services to be healthy..."

# Wait for services to be healthy
max_attempts=60
attempt=0

while [ $attempt -lt $max_attempts ]; do
    if docker-compose ps | grep -q "healthy"; then
        echo "✅ Services are healthy!"
        break
    fi
    
    echo "   Attempt $((attempt + 1))/$max_attempts - waiting for services..."
    sleep 5
    ((attempt++))
done

if [ $attempt -eq $max_attempts ]; then
    echo "❌ Services failed to become healthy. Check logs:"
    docker-compose logs
    exit 1
fi

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "📋 Service URLs:"
echo "   Frontend: http://localhost:${FRONTEND_PORT:-4173}"
echo "   Backend API: http://localhost:${BACKEND_PORT:-8000}"
echo "   API Docs: http://localhost:${BACKEND_PORT:-8000}/docs"
echo "   Database: localhost:${POSTGRES_PORT:-5432}"
echo ""
echo "📊 To view logs: docker-compose logs -f"
echo "🛑 To stop: docker-compose down"
echo "🔄 To restart: docker-compose restart"
echo ""
