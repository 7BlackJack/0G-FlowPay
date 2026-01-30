#!/bin/bash
source venv/bin/activate

# Kill any existing python processes (be careful, but this is a sandbox)
pkill -f "python provider-agent/app.py"

echo "Starting Provider Agent..."
python provider-agent/app.py > provider.log 2>&1 &
SERVER_PID=$!

echo "Waiting for server to start..."
sleep 3

echo "Starting Consumer Agent..."
python consumer-agent/client.py

echo "Stopping Provider Agent..."
kill $SERVER_PID
