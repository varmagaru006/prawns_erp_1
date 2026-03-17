#!/usr/bin/env bash
#
# Run the full Prawn ERP stack locally (MongoDB, Backend, Super Admin API, Frontend).
# Use this after pulling changes or editing code to start everything with one command.
# Press Ctrl+C to stop all services.
#

set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

BACKEND_PID=""
SUPER_ADMIN_PID=""

cleanup() {
  echo ""
  echo "Stopping services..."
  [ -n "$BACKEND_PID" ]     && kill "$BACKEND_PID" 2>/dev/null || true
  [ -n "$SUPER_ADMIN_PID" ] && kill "$SUPER_ADMIN_PID" 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

echo "=== Prawn ERP – starting full stack ==="

# --- Env files (create if missing) ---
if [ ! -f "$ROOT/backend/.env" ]; then
  echo "Creating backend/.env..."
  cat > "$ROOT/backend/.env" << 'EOF'
MONGO_URL=mongodb://prawn_erp_user:prawn_erp_dev_password@localhost:27017
DB_NAME=prawn_erp
SECRET_KEY=dev-secret-key-change-me
EOF
fi
if [ ! -f "$ROOT/frontend/.env" ]; then
  echo "Creating frontend/.env..."
  cat > "$ROOT/frontend/.env" << 'EOF'
REACT_APP_BACKEND_URL=http://localhost:8000
WDS_SOCKET_PORT=3000
ENABLE_HEALTH_CHECK=false
EOF
fi
if [ ! -f "$ROOT/super-admin-api/.env" ]; then
  echo "Creating super-admin-api/.env..."
  cat > "$ROOT/super-admin-api/.env" << 'EOF'
MONGO_URL=mongodb://prawn_erp_user:prawn_erp_dev_password@localhost:27017
MONGO_DB_NAME=prawn_erp
SECRET_KEY=super-admin-secret-key-change-in-production
EOF
fi

# --- 1. MongoDB ---
MONGO_PORT=27017
if command -v docker >/dev/null 2>&1; then
  echo "[1/4] Starting MongoDB (Docker)..."
  if docker compose up -d mongo 2>/dev/null; then
    MONGO_PORT=27018
    echo "      Waiting for MongoDB to be ready..."
    sleep 5
    # Point app .env to Docker Mongo (host port 27018)
    for envfile in "$ROOT/backend/.env" "$ROOT/super-admin-api/.env"; do
      [ -f "$envfile" ] && sed -i '' 's/localhost:27017/localhost:27018/g' "$envfile"
    done
  fi
fi
if [ "$MONGO_PORT" = "27017" ]; then
  echo "[1/4] Using local MongoDB (port 27017)."
  if ! (mongosh --quiet --eval "db.runCommand({ping:1})" "mongodb://localhost:27017" 2>/dev/null); then
    echo ""
    echo "  MongoDB is not running on port 27017."
    echo "  Start it with one of:"
    echo "    • Docker:  docker compose up -d mongo   (then re-run this script)"
    echo "    • Homebrew: brew services start mongodb-community"
    echo "    • Or run:  mongod"
    echo ""
    exit 1
  fi
fi

# --- 2. Backend ---
echo "[2/4] Starting Backend (port 8000)..."
if [ ! -d "$ROOT/backend/.venv" ]; then
  python3 -m venv "$ROOT/backend/.venv"
fi
"$ROOT/backend/.venv/bin/pip" install -q -r "$ROOT/backend/requirements.txt"
(cd "$ROOT/backend" && "$ROOT/backend/.venv/bin/uvicorn" server:app --reload --host 0.0.0.0 --port 8000) &
BACKEND_PID=$!
sleep 2

# --- 3. Super Admin API ---
echo "[3/4] Starting Super Admin API (port 8002)..."
(cd "$ROOT/super-admin-api" && "$ROOT/backend/.venv/bin/python" -m uvicorn main:app --reload --host 0.0.0.0 --port 8002) &
SUPER_ADMIN_PID=$!
sleep 2

# --- 4. Frontend ---
echo "[4/4] Starting Frontend (port 3000)..."
if ! command -v yarn >/dev/null 2>&1; then
  echo "Error: yarn not found. Install Node.js and yarn, then run this script again."
  cleanup
fi
cd "$ROOT/frontend"
yarn install --silent 2>/dev/null || yarn install
echo ""
echo "=== Stack running ==="
echo "  Client ERP:    http://localhost:3000"
echo "  Super Admin:   http://localhost:3000/super-admin/login"
echo "  Backend API:   http://localhost:8000"
echo "  Super Admin API: http://localhost:8002"
echo ""
echo "  Client ERP login:    admin@prawnexport.com / admin123"
echo "  Super Admin login:   superadmin@prawnrp.com / admin123"
echo ""
echo "Press Ctrl+C to stop all services."
echo ""
yarn start
