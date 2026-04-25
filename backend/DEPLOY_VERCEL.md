# Backend deploy on Vercel (Frontend-only reference)

Vercel is not suitable for this repository's full-stack persistent runtime (backend + mongo).
Use this path only when Vercel hosts frontend assets and backend/database are hosted elsewhere.
For single-stack deployment, use `../DEPLOY_DOCKER_SINGLE_STACK.md`.

## 1) Vercel project settings

- Import your repository in Vercel.
- Set **Root Directory** to `backend`.
- Keep framework as **Other**.
- `vercel.json` and `api/index.py` are already configured.

## 2) Environment variables

Set these in Vercel Project -> Settings -> Environment Variables:

- `MONGO_URL` = your MongoDB Atlas connection string
- `DB_NAME` = `prawn_erp`
- `SECRET_KEY` = a strong random secret

Also add any other backend vars used in your local `.env`.

## 3) Deploy and verify

After deployment:

- Open `https://<your-project>.vercel.app/health`
- Open `https://<your-project>.vercel.app/docs`
- Confirm login and key API flows from frontend

## 4) Data safety checklist

- Use MongoDB Atlas (persistent storage) for all production data.
- Keep a backup before each release:
  - `./scripts/mongo_bundle_backup.sh`
- Restore backup if needed:
  - `./scripts/mongo_restore.sh <dump_dir>`

## 5) Important limitation

Vercel filesystem is ephemeral. Local files under `backend/uploads` are not persistent.
For production uploads, move file storage to S3/Cloudinary/Supabase Storage.
