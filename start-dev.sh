#!/bin/bash

# ScoutAlgo Development Startup Script
# Автоматический запуск фронтенда и бэкенда

echo "🚀 Starting ScoutAlgo Development Environment..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Simple retry helper
wait_for_url() {
  local url="$1"
  local name="$2"
  local retries="${3:-20}"
  local delay="${4:-1}"
  for i in $(seq 1 "$retries"); do
    if curl -fsS "$url" > /dev/null; then
      return 0
    fi
    sleep "$delay"
  done
  echo "❌ ${name} failed to start. Check logs:"
  return 1
}

# Kill any existing processes
echo "🧹 Cleaning up existing processes..."
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true
sleep 1

# Start Backend
echo ""
echo -e "${YELLOW}📦 Starting Backend (Node.js)...${NC}"
cd backend
nohup node src/server.js > /tmp/scoutalgo-backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"
cd ..

# Wait for backend to start (retry)
if wait_for_url "http://localhost:8000/api/aggregators/" "Backend"; then
  echo -e "${GREEN}✅ Backend is running on http://localhost:8000${NC}"
else
  tail -n 80 /tmp/scoutalgo-backend.log
  exit 1
fi

# Start Frontend
echo ""
echo -e "${YELLOW}🎨 Starting Frontend (React + Vite)...${NC}"
cd Algobot
nohup npm run dev > /tmp/scoutalgo-frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"
cd ..

# Wait for frontend to start (retry)
if wait_for_url "http://localhost:5173/" "Frontend" 30 1; then
  echo -e "${GREEN}✅ Frontend is running on http://localhost:5173${NC}"
else
  tail -n 80 /tmp/scoutalgo-frontend.log
  exit 1
fi

echo ""
echo "=========================================="
echo -e "${GREEN}✨ ScoutAlgo is ready!${NC}"
echo "=========================================="
echo ""
echo "📊 Frontend: http://localhost:5173"
echo "🔧 Backend API: http://localhost:8000/api"
echo ""
echo "📝 Logs:"
echo "   Backend:  tail -f /tmp/scoutalgo-backend.log"
echo "   Frontend: tail -f /tmp/scoutalgo-frontend.log"
echo ""
echo "🛑 To stop: ./stop-dev.sh"
echo "   or: lsof -ti:8000,5173 | xargs kill"
echo ""
