#!/usr/bin/env bash
#
# Run the full Prawn ERP stack locally (MongoDB, Backend, Super Admin API, Super Admin Frontend, Frontend).
# Use this after pulling changes or editing code to start everything with one command.
# Press Ctrl+C to stop all services.
#

set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

BACKEND_PID=""
SUPER_ADMIN_PID=""
SUPER_ADMIN_FRONTEND_PID=""

cleanup() {
  echo ""
  echo "Stopping services..."
  [ -n "$BACKEND_PID" ]               && kill "$BACKEND_PID" 2>/dev/null || true
  [ -n "$SUPER_ADMIN_PID" ]           && kill "$SUPER_ADMIN_PID" 2>/dev/null || true
  [ -n "$SUPER_ADMIN_FRONTEND_PID" ]  && kill "$SUPER_ADMIN_FRONTEND_PID" 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

echo "=== Prawn ERP – starting full stack ==="

# --- Pick a Python version with good wheel support ---
# grpcio/protobuf and several deps often lag on newest Python betas.
# Prefer stable 3.11/3.12 if available.
PY_BIN=""
for cand in python3.11 python3.12 python3.13 python3; do
  if command -v "$cand" >/dev/null 2>&1; then
    PY_BIN="$cand"
    break
  fi
done
if [ -z "$PY_BIN" ]; then
  echo "Error: Python 3 not found. Install Python 3.11+ and re-run."
  exit 1
fi
PY_VERSION="$($PY_BIN -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}")')"
echo "Using Python: $PY_BIN ($PY_VERSION)"
PY_MINOR="$($PY_BIN -c 'import sys; print(sys.version_info.minor)')"
if [ "$PY_MINOR" -ge 14 ]; then
  echo ""
  echo "Warning: Detected Python >= 3.14 ($PY_VERSION). Some third-party packages may"
  echo "         still be catching up with wheel support, so installs could be slower"
  echo "         or require local builds, but the script will continue."
  echo ""
fi

# --- Env files (create if missing) ---
if [ ! -f "$ROOT/backend/.env" ]; then
  echo "Creating backend/.env..."
  cat > "$ROOT/backend/.env" << 'EOF'
MONGO_URL=mongodb://prawn_erp_user:prawn_erp_dev_password@localhost:27017
DB_NAME=prawn_erp
SECRET_KEY=dev-secret-key-change-me
ENABLE_MULTI_DB_ROUTING=true
SUPER_ADMIN_DB_NAME=prawn_erp_super_admin
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
ENABLE_MULTI_DB_ROUTING=true
EOF
fi
if [ ! -f "$ROOT/super-admin-frontend/.env" ]; then
  echo "Creating super-admin-frontend/.env..."
  cat > "$ROOT/super-admin-frontend/.env" << 'EOF'
VITE_API_URL=http://localhost:8002
EOF
fi

# --- 1. MongoDB ---
MONGO_PORT=27017
if command -v docker >/dev/null 2>&1; then
  echo "[1/5] Starting MongoDB (Docker)..."
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
  echo "[1/5] Using local MongoDB (port 27017)."
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
echo "[2/5] Starting Backend (port 8000)..."
if [ ! -d "$ROOT/backend/.venv" ]; then
  "$PY_BIN" -m venv "$ROOT/backend/.venv"
fi
"$ROOT/backend/.venv/bin/pip" install -q -r "$ROOT/backend/requirements.txt"
(cd "$ROOT/backend" && "$ROOT/backend/.venv/bin/uvicorn" server:app --reload --host 0.0.0.0 --port 8000) &
BACKEND_PID=$!
sleep 2

# --- 3. Super Admin API ---
echo "[3/5] Starting Super Admin API (port 8002)..."
(cd "$ROOT/super-admin-api" && "$ROOT/backend/.venv/bin/python" -m uvicorn main:app --reload --host 0.0.0.0 --port 8002) &
SUPER_ADMIN_PID=$!
sleep 2

# --- 4. Super Admin Frontend ---
echo "[4/5] Starting Super Admin Frontend (port 3001)..."
if [ ! -d "$ROOT/super-admin-frontend/node_modules" ]; then
  echo "      Installing super-admin-frontend dependencies..."
  (cd "$ROOT/super-admin-frontend" && npm install --silent 2>/dev/null || npm install)
fi
(cd "$ROOT/super-admin-frontend" && npm run dev) &
SUPER_ADMIN_FRONTEND_PID=$!
sleep 2

# --- 5. Frontend ---
echo "[5/5] Starting Frontend (port 3000)..."
if ! command -v yarn >/dev/null 2>&1; then
  echo "Error: yarn not found. Install Node.js and yarn, then run this script again."
  cleanup
fi
cd "$ROOT/frontend"
yarn install --silent 2>/dev/null || yarn install
echo ""
echo "=== Stack running ==="
echo "  Client ERP:           http://localhost:3000"
echo "  Super Admin Portal:   http://localhost:3001/super-admin/login"
echo "  Backend API:          http://localhost:8000"
echo "  Super Admin API:      http://localhost:8002"
echo ""
echo "  Client ERP login:     admin@prawnexport.com / admin123"
echo "  Super Admin login:    superadmin@prawnrp.com / admin123"
echo ""
echo "Press Ctrl+C to stop all services."
echo ""
yarn start
