# Running Prawn ERP with Docker (local)

Step-by-step guide to run the full application (MongoDB + Backend + Frontend) using Docker on your machine.

## Prerequisites

- **Docker** and **Docker Compose** installed ([Install Docker](https://docs.docker.com/get-docker/))
- No other service using ports **27018**, **8000**, or **3000** (or change them in `docker-compose.yml`)

## Step 1: Open the project directory

```bash
cd /Users/ramakrishnaraju/personal/prawns_erp_1
```

## Step 2: Build and start all services

```bash
docker compose up -d --build
```

This will:

1. **Build** the backend and frontend images (first time may take a few minutes).
2. **Start MongoDB** on port 27018 (internal 27017). On first run it creates the app user `prawn_erp_user` automatically.
3. **Start the backend** (FastAPI) on port 8000 after MongoDB is healthy.
4. **Start the frontend** (React, served by nginx) on port 3000.

## Step 3: Wait for first-time MongoDB init (first run only)

On the very first run, MongoDB creates the database user. If the backend logs show **authentication failed**, wait about 10 seconds and restart the backend:

```bash
docker compose restart backend
```

## Step 4: Open the application

- **Frontend (UI):** [http://localhost:3000](http://localhost:3000)
- **Backend API:** [http://localhost:8000](http://localhost:8000)
- **API docs:** [http://localhost:8000/docs](http://localhost:8000/docs)

**Login:** See [CREDENTIALS.md](CREDENTIALS.md) — Client ERP: `admin@prawnexport.com` / `admin123`.

## Useful commands

| Action | Command |
|--------|--------|
| View logs (all services) | `docker compose logs -f` |
| View backend logs only | `docker compose logs -f backend` |
| View frontend logs only | `docker compose logs -f frontend` |
| Stop all services | `docker compose down` |
| Stop and remove volumes (reset DB) | `docker compose down -v` |
| Rebuild after code changes | `docker compose up -d --build` |

## Changing the backend URL (frontend)

The frontend is built with `REACT_APP_BACKEND_URL=http://localhost:8000` so the browser can call the API. To use a different URL (e.g. another host or port), rebuild the frontend with a build arg:

```bash
docker compose build --build-arg REACT_APP_BACKEND_URL=http://your-host:8000 frontend
docker compose up -d frontend
```

## Running only MongoDB in Docker

To run just MongoDB in Docker and run backend/frontend on the host (e.g. with `./run_local.sh`):

```bash
docker compose up -d mongo
```

Then in `backend/.env` and `super-admin-api/.env` use:

- `MONGO_URL=mongodb://prawn_erp_user:prawn_erp_dev_password@localhost:27018`

## File overview

| File / folder | Purpose |
|---------------|--------|
| `docker-compose.yml` | Defines mongo, backend, frontend services and env |
| `backend/Dockerfile` | Builds FastAPI app, runs uvicorn on port 8000 |
| `frontend/Dockerfile` | Builds React app (craco), serves with nginx on port 3000 |
| `frontend/docker/nginx.conf` | Nginx config for SPA (fallback to index.html) |
| `docker/mongo-init.js` | Creates `prawn_erp_user` on first MongoDB start |

## Troubleshooting

- **Port already in use:** Change the host port in `docker-compose.yml` (e.g. `"3001:3000"` for frontend) and, for frontend, rebuild with `REACT_APP_BACKEND_URL` pointing to your backend URL.
- **Backend can’t connect to MongoDB:** Ensure only one MongoDB is using the port; on first run wait ~10s and run `docker compose restart backend`.
- **Frontend shows blank or wrong API URL:** Rebuild with the correct `REACT_APP_BACKEND_URL` (see “Changing the backend URL” above).
