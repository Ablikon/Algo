#!/bin/bash

# ScoutAlgo Development Stop Script

echo "🛑 Stopping ScoutAlgo Development Environment..."

# Kill backend (port 8000)
echo "Stopping backend..."
lsof -ti:8000 | xargs kill -9 2>/dev/null || true

# Kill frontend (port 5173)
echo "Stopping frontend..."
lsof -ti:5173 | xargs kill -9 2>/dev/null || true

# Kill any remaining node processes related to the project
pkill -f "node src/server.js" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

sleep 1

echo "✅ All services stopped"
