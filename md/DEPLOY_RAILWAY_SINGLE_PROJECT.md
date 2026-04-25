# Railway Single-Project Deployment (Recommended)

This is the canonical production deployment for this repository.

## Architecture

- One Railway project
- Two services only:
  - `backend` from `backend/`
  - `frontend` from `frontend/`
- One external database: MongoDB Atlas

## Service 1: Backend (`backend/`)

- **Root Directory:** `backend`
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `uvicorn server:app --host 0.0.0.0 --port $PORT`

Set backend environment variables:

- `MONGO_URL=<atlas-uri>`
- `DB_NAME=prawn_erp`
- `SECRET_KEY=<strong-secret>`
- `CORS_ORIGINS=https://<frontend-domain>`

Optional:

- `CORS_ALLOW_ORIGIN_REGEX=^https://.*\\.up\\.railway\\.app$`

## Service 2: Frontend (`frontend/`)

- **Root Directory:** `frontend`
- **Build Command:** `yarn install --frozen-lockfile && yarn build`
- **Start Command:** `npx serve -s build -l $PORT`

Set frontend environment variables:

- `REACT_APP_BACKEND_URL=https://<backend-domain>`

## Deployment Order

1. Deploy backend service and verify:
   - `https://<backend-domain>/health`
   - `https://<backend-domain>/docs`
2. Deploy frontend service with `REACT_APP_BACKEND_URL` set to backend URL.
3. Open frontend and test login + core workflows.

## Validation Checklist

- Backend health returns success.
- Backend docs page loads.
- Browser requests from frontend to backend succeed (no CORS errors).
- Login and one create/list flow work.
- File upload flow works.

Quick CLI smoke test:

```bash
BACKEND_URL="https://<backend-domain>" FRONTEND_URL="https://<frontend-domain>" ./scripts/railway_smoke_checks.sh
```

## Notes

- Keep MongoDB on Atlas for durability and backups.
- Root `Dockerfile` exists as a compatibility fallback for platforms that force root Docker builds.
- This guide is the primary production path; platform-specific alternatives are secondary.
