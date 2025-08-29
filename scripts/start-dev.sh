#!/bin/bash

# DietIntel Development Startup Script
set -e

echo "🚀 Starting DietIntel Development Environment"

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found. Copying from .env.example..."
    cp .env.example .env
    echo "📝 Please edit .env file with your configuration and run this script again."
    exit 1
fi

# Load environment variables
source .env

echo "🐳 Starting Docker containers..."

# Build and start services
docker-compose up --build -d

echo "⏳ Waiting for services to be ready..."

# Wait for PostgreSQL
echo "🔍 Waiting for PostgreSQL..."
until docker-compose exec -T db pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB} > /dev/null 2>&1; do
    sleep 2
done
echo "✅ PostgreSQL is ready!"

# Wait for Redis
echo "🔍 Waiting for Redis..."
until docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; do
    sleep 2
done
echo "✅ Redis is ready!"

# Wait for API
echo "🔍 Waiting for API..."
until curl -f http://localhost:8000/health > /dev/null 2>&1; do
    sleep 2
done
echo "✅ API is ready!"

echo "🎉 DietIntel Development Environment is running!"
echo ""
echo "📍 Available services:"
echo "   • API: http://localhost:8000"
echo "   • API Docs: http://localhost:8000/docs"
echo "   • PostgreSQL: localhost:5432"
echo "   • Redis: localhost:6379"
echo ""
echo "🛠️  Development tools (run with --profile tools):"
echo "   docker-compose --profile tools up -d"
echo "   • pgAdmin: http://localhost:8080"
echo ""
echo "📝 Useful commands:"
echo "   • View logs: docker-compose logs -f"
echo "   • Stop services: docker-compose down"
echo "   • Rebuild: docker-compose up --build"
echo ""