# Backend deploy on Render / Railway / Fly.io

Use this guide to deploy `backend` with the same runtime settings across providers.

## Common service settings

- **Root directory:** `backend`
- **Start command:** `uvicorn server:app --host 0.0.0.0 --port $PORT`
- **Environment variables:**
  - `MONGO_URL=<atlas-uri>`
  - `DB_NAME=prawn_erp`
  - `SECRET_KEY=<strong-secret>`

## Render

- Create a new **Web Service** from your repo.
- Set **Root Directory** to `backend`.
- Set **Build Command** to `pip install -r requirements.txt`.
- Set **Start Command** to:
  - `uvicorn server:app --host 0.0.0.0 --port $PORT`
- Add env vars from the common section.
- You can also use the root `render.yaml` for Blueprint deploy (it points Render to `backend`).

## Railway

- Create a new project and connect your repository.
- Set the service **Root Directory** to `backend`.
- Railway can read `backend/Procfile`, or you can set Start Command manually:
  - `uvicorn server:app --host 0.0.0.0 --port $PORT`
- Add env vars from the common section.

## Fly.io

- In `backend`, run:
  - `fly launch --no-deploy` (first time only, if app name/region changes)
  - `fly secrets set MONGO_URL="<atlas-uri>" SECRET_KEY="<strong-secret>" DB_NAME="prawn_erp"`
  - `fly deploy`
- `backend/fly.toml` is included and uses the backend `Dockerfile`.
- The Docker command uses `${PORT:-8000}`, so it works both locally and on Fly.

## Verify after deploy

- `https://<backend-domain>/health`
- `https://<backend-domain>/docs`
