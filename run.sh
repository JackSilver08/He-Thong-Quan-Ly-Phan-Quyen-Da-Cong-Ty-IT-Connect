#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "Starting IT Connect..."

if [[ ! -f .env ]]; then
  if [[ ! -f .env.example ]]; then
    echo "Missing .env.example. Cannot create .env." >&2
    exit 1
  fi
  cp .env.example .env
  echo "Created .env from .env.example"
fi

# Normal development startup rebuilds changed application images automatically.
# Docker reuses cached layers, so unchanged services stay fast.
# Set NO_BUILD=1 when you explicitly want to start existing images only.
if [[ "${NO_BUILD:-0}" == "1" ]]; then
  echo "Starting cached containers without rebuilding..."
  docker compose up -d
else
  echo "Building changed images and starting containers..."
  docker compose up -d --build
fi

echo "Waiting for application (max 90 seconds)..."
for _ in {1..90}; do
  if curl -fsS http://localhost:8080/health >/dev/null 2>&1 && curl -fsS http://localhost:3000 >/dev/null 2>&1; then
    if command -v xdg-open >/dev/null 2>&1; then
      xdg-open http://localhost:3000 >/dev/null 2>&1 &
    elif command -v open >/dev/null 2>&1; then
      open http://localhost:3000 >/dev/null 2>&1 &
    fi
    echo "IT Connect is running: http://localhost:3000"
    exit 0
  fi
  sleep 1
done

echo "Application did not become ready. Run: docker compose ps" >&2
echo "Run: docker compose logs --tail=100" >&2
exit 1
