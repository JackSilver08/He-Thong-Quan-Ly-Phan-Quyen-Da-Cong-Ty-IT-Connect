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

# Fast path: reuse existing images. Set REBUILD=1 when Dockerfiles/dependencies changed.
if [[ "${REBUILD:-0}" == "1" ]]; then
  echo "Rebuilding application images..."
  docker compose build
fi

docker compose up -d || {
  echo "Application images are not available. Building once..."
  docker compose build
  docker compose up -d
}

echo "Waiting for application (max 60 seconds)..."
for _ in {1..60}; do
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
