#!/usr/bin/env bash

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== Prawn ERP local runner ==="
echo "Assumes MongoDB is running (e.g. docker compose up -d mongo → localhost:27018)"

# --- Backend env setup ---
if [ ! -f "$ROOT_DIR/backend/.env" ]; then
  echo "Creating backend/.env with default development values..."
  cat > "$ROOT_DIR/backend/.env" << 'EOF'
MONGO_URL=mongodb://prawn_erp_user:prawn_erp_dev_password@localhost:27018
DB_NAME=prawn_erp
SECRET_KEY=dev-secret-key-change-me
EOF
fi

# --- Frontend env setup ---
if [ ! -f "$ROOT_DIR/frontend/.env" ]; then
  echo "Creating frontend/.env with default development values..."
  cat > "$ROOT_DIR/frontend/.env" << 'EOF'
REACT_APP_BACKEND_URL=http://localhost:8000
WDS_SOCKET_PORT=3000
ENABLE_HEALTH_CHECK=false
EOF
fi

# --- Backend setup & start ---
cd "$ROOT_DIR/backend"

if [ ! -d ".venv" ]; then
  echo "Creating Python virtualenv in backend/.venv..."
  python3 -m venv .venv
fi

echo "Activating virtualenv and installing backend dependencies..."
source .venv/bin/activate
pip install -r requirements.txt

echo "Starting FastAPI backend on http://localhost:8000 ..."
uvicorn server:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# --- Frontend setup & start ---
cd "$ROOT_DIR/frontend"

if ! command -v yarn >/dev/null 2>&1; then
  echo "Error: yarn is not installed. Install Node.js 18+ and yarn, then rerun."
  kill "$BACKEND_PID" 2>/dev/null || true
  exit 1
fi

echo "Installing frontend dependencies (this may take a while)..."
yarn install

echo "Starting React frontend on http://localhost:3000 ..."
yarn start &
FRONTEND_PID=$!

trap 'echo "Stopping services..."; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true; exit 0' INT TERM

echo
echo "=== Prawn ERP running locally ==="
echo "Backend:  http://localhost:8000"
echo "Frontend: http://localhost:3000"
echo "Login with admin@prawnexport.com / admin123"
echo "Press Ctrl+C here to stop both frontend and backend."

wait

