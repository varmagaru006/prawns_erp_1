#!/usr/bin/env bash

set -euo pipefail

if [[ -z "${BACKEND_URL:-}" ]]; then
  echo "ERROR: BACKEND_URL is required (example: https://backend-production.up.railway.app)"
  exit 1
fi

if [[ -z "${FRONTEND_URL:-}" ]]; then
  echo "ERROR: FRONTEND_URL is required (example: https://frontend-production.up.railway.app)"
  exit 1
fi

backend="${BACKEND_URL%/}"
frontend="${FRONTEND_URL%/}"

echo "Checking backend health..."
curl -fsS "${backend}/health" >/dev/null
echo "OK: ${backend}/health"

echo "Checking backend docs..."
curl -fsS "${backend}/docs" >/dev/null
echo "OK: ${backend}/docs"

echo "Checking frontend reachability..."
curl -fsS "${frontend}" >/dev/null
echo "OK: ${frontend}"

echo "Smoke checks passed."
