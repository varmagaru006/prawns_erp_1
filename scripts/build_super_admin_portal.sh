#!/usr/bin/env bash
# Build Super Admin frontend and deploy to main frontend's public folder
# so it is served at http://localhost:3000/super-admin/ when main app runs.
set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/super-admin-frontend"
# Point API to local backend (change for production)
export VITE_API_URL="${VITE_API_URL:-http://localhost:8002}"
npm ci --prefer-offline --no-audit 2>/dev/null || npm install
npm run build
mkdir -p "$ROOT/frontend/public/super-admin"
cp -r dist/* "$ROOT/frontend/public/super-admin/"
echo "✅ Super Admin portal built and copied to frontend/public/super-admin/"
echo "   API URL: $VITE_API_URL"
echo "   Serve main frontend (yarn start) and open: http://localhost:3000/super-admin/login"
