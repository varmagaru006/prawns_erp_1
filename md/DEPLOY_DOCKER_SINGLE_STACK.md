# Single Docker Stack Deployment

This is the canonical guide to run the full application as one stack:

- `frontend` (React + nginx)
- `backend` (FastAPI)
- `mongo` (MongoDB with persistent volume)

## 1) Prerequisites

- Docker Engine
- Docker Compose plugin

## 2) Configure environment

- Backend env defaults are documented in `backend/.env.example`.
- For production, set strong values for:
  - `SECRET_KEY`
  - Mongo credentials/connection
- Do not commit real credentials.

## 3) Run the stack

From repo root:

```bash
docker compose up -d --build
```

## 4) Access

- Frontend: `http://<host>:3000`
- API health via same origin proxy: `http://<host>:3000/api/health`
- API docs via backend container: `http://<host>:3000/docs` (proxied when requested directly through frontend domain if your edge/router forwards it) or temporarily expose backend for direct admin access.

## 5) Operations

- View status:
  - `docker compose ps`
- View logs:
  - `docker compose logs -f backend`
  - `docker compose logs -f frontend`
  - `docker compose logs -f mongo`
- Restart:
  - `docker compose restart`
- Update deployment:
  - `git pull`
  - `docker compose up -d --build`

## 6) Data persistence

- Mongo data is stored in named volume: `mongo_data`
- Uploads are stored in named volume: `backend_uploads`

Before upgrades, create a Mongo backup (`mongodump`) and keep it off-host.

## 7) Important note about Vercel

Vercel does not support running this full persistent multi-service Docker stack from a single `Dockerfile`.
If you must use Vercel, keep it frontend-only and host backend/database elsewhere.
