# Create MongoDB user for Prawn ERP (Option B)

Use this when MongoDB has **authentication enabled** and you want to connect with a dedicated user.

---

## Option A: Run MongoDB locally with Docker (recommended)

MongoDB and the app user are set up via Docker. No manual user creation needed.

**Start MongoDB:**

```bash
cd /Users/ramakrishnaraju/personal/prawns_erp_1
docker compose up -d mongo
```

On first run, the container creates `prawn_erp_user` with password `prawn_erp_dev_password` automatically. The app listens on **port 27018** (so it doesn’t clash with a local MongoDB on 27017). `backend/.env` and `super-admin-api/.env` are set to `localhost:27018`.

**Stop MongoDB:**

```bash
docker compose down
```

**Admin access** (if you need to run other scripts): use `admin` / `mongo_admin_local` on port **27018**:

```bash
mongosh "mongodb://admin:mongo_admin_local@localhost:27018/admin"
```

---

## 1. Create the user (one-time) — when not using Docker

**If MongoDB is running without auth** (e.g. first time setup):

```bash
cd /Users/ramakrishnaraju/personal/prawns_erp_1
mongosh mongodb://localhost:27017 scripts/mongo_create_erp_user.js
```

This creates user `prawn_erp_user` with password `prawn_erp_dev_password` (change in the script or see below).

**Custom password:** Edit `scripts/mongo_create_erp_user.js` and change the `password` variable, then run the command above. Or create the user in one go (replace `MySecurePass`):

```bash
mongosh mongodb://localhost:27017 --eval 'const admin=db.getSiblingDB("admin"); admin.createUser({user:"prawn_erp_user",pwd:"MySecurePass",roles:[{role:"readWrite",db:"prawn_erp"},{role:"readWrite",db:"prawn_erp_super_admin"}]})'
```

**If MongoDB already has auth enabled** (you have an admin user):

```bash
mongosh "mongodb://prawn_erp_user:prawn_erp_dev_password@localhost:27017/admin" scripts/mongo_create_erp_user.js
```

To use a custom password for the new user, edit the `password` variable in `scripts/mongo_create_erp_user.js` before running it.

## 2. Set MONGO_URL in both apps

**Backend (main ERP):**

Create or edit `backend/.env`:

```env
MONGO_URL=mongodb://prawn_erp_user:prawn_erp_dev_password@localhost:27017
DB_NAME=prawn_erp
SECRET_KEY=dev-secret-key-change-me
```

**Super Admin API:**

Create or edit `super-admin-api/.env`:

```env
MONGO_URL=mongodb://prawn_erp_user:prawn_erp_dev_password@localhost:27017
MONGO_DB_NAME=prawn_erp
SECRET_KEY=super-admin-secret-key-change-in-production
```

Replace `YOUR_PASSWORD` with the password you used when creating the user (e.g. `prawn_erp_dev_password` or the one you set in the script / `--eval`).

## 3. Restart services

- Main app: `./run_local.sh`
- Super Admin API: `cd super-admin-api && source .venv/bin/activate && uvicorn main:app --reload --host 0.0.0.0 --port 8002`

## Troubleshooting

- **"Authentication failed"**: Wrong password or user not created. Re-run the script or reset password by dropping the user in `admin` and running the script again.
- **"Command createIndexes requires authentication"**: MONGO_URL is still without credentials; ensure both `backend/.env` and `super-admin-api/.env` use the URL with `prawn_erp_user:password`.
