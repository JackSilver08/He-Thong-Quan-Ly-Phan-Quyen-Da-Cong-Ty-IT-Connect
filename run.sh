#!/usr/bin/env bash
set -euo pipefail

echo "Starting IT Connect..."
docker compose up -d --build

echo "Waiting for frontend..."
for i in {1..30}; do
  if curl -fsS http://localhost:3000 >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

if ! curl -fsS http://localhost:3000 >/dev/null 2>&1; then
  echo "Frontend did not become ready. Check: docker compose logs"
  exit 1
fi

if command -v xdg-open >/dev/null 2>&1; then
  xdg-open http://localhost:3000 >/dev/null 2>&1 &
elif command -v open >/dev/null 2>&1; then
  open http://localhost:3000 >/dev/null 2>&1 &
else
  echo "Open http://localhost:3000 in your browser."
fi

echo "IT Connect is running: http://localhost:3000"
