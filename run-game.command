#!/bin/zsh
cd "$(dirname "$0")" || exit 1

echo "Installing dependencies if needed..."
npm install
if [ $? -ne 0 ]; then
  echo
  echo "npm install failed."
  read "?Press Enter to close..."
  exit 1
fi

# Free port 5173 in case a previous session is still running.
lsof -ti:5173 | xargs kill -9 2>/dev/null || true

echo
echo "Starting Mowbound dev server..."
npm run dev &
SERVER_PID=$!

trap 'echo; echo "Stopping dev server..."; kill $SERVER_PID 2>/dev/null; wait $SERVER_PID 2>/dev/null; exit 0' INT TERM

# Wait until the server is actually accepting connections before opening the browser.
until curl -s http://localhost:5173 > /dev/null 2>&1; do
  sleep 0.3
done

echo "Opening http://localhost:5173"
echo "(Press Ctrl+C to stop the server)"
open "http://localhost:5173"

wait $SERVER_PID
echo
echo "Dev server stopped."
read "?Press Enter to close..."
