#!/bin/bash
source venv/bin/activate

# Kill any existing python processes (be careful, but twhis is a sandbox)
pkill -f "python provider-agent/app.py"

echo "Starting Provider Agent (Backend)..."
python provider-agent/app.py > provider.log 2>&1 &
SERVER_PID=$!

echo "Starting Frontend (React)..."
echo "Navigate to http://localhost:5173 to use the UI."
cd frontend
npm run dev

# Cleanup on exit
echo "Stopping Provider Agent..."
kill $SERVER_PID
