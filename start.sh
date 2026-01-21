#!/bin/bash

echo "🚀 Starting ScoutAlgo System..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker is not running. Please start Docker Desktop and try again."
  exit 1
fi

# Stop any running containers
echo "🛑 Stopping existing containers..."
docker-compose down

# Build and start containers
echo "🏗️  Building and starting services..."
docker-compose up --build -d

# Check status
if [ $? -eq 0 ]; then
  echo "✅ System started successfully!"
  echo "   - Frontend: http://localhost:3000"
  echo "   - Backend:  http://localhost:8000"
  echo "   - Docs:     http://localhost:8000/docs"
  
  echo "📊 Services status:"
  docker-compose ps
else
  echo "❌ Failed to start system."
  exit 1
fi
