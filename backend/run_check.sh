#!/bin/bash
cd /Users/abylajhanbegimkulov/Desktop/ScoutAlgo/backend
node check_today_urls.js 2>&1 &
PID=$!
sleep 15
kill $PID 2>/dev/null
