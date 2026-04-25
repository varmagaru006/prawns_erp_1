# Super Admin Portal – Working setup

## Login URL

**http://localhost:3000/super-admin/login**

## Credentials

| Field    | Value                     |
|----------|---------------------------|
| **Email**    | `superadmin@prawnrp.com`  |
| **Password** | `admin123`               |

---

## Run the portal (step by step)

### 1. MongoDB

Ensure MongoDB is running (e.g. Docker):

```bash
docker compose up -d mongo
```

### 2. Super Admin API (port 8002)

In a terminal, start the API (leave it running):

```bash
cd super-admin-api
../backend/.venv/bin/python -m uvicorn main:app --reload --host 0.0.0.0 --port 8002
```

On startup it will:

- Ensure default super admin: `superadmin@prawnrp.com` / `admin123`
- Reset that user’s password so login works
- Create default subscription plans if missing
- Create a default client **“Prawn Export Company”** (tenant_id: cli_001) if none exist

### 3. Main frontend (port 3000)

In another terminal, start the main React app so `/super-admin/` is served:

```bash
cd frontend
yarn install
yarn start
```

### 4. Build the Super Admin UI (first time or after changes)

So that `http://localhost:3000/super-admin/` serves the Super Admin app:

```bash
./scripts/build_super_admin_portal.sh
```

Then restart or keep the main frontend running. Open:

**http://localhost:3000/super-admin/login**

Log in with `superadmin@prawnrp.com` / `admin123`. You should see the dashboard with **existing clients** (at least “Prawn Export Company” if it was seeded).

---

## Feature toggles applying to the client

When you toggle features in the Super Admin portal, the Super Admin API:

1. Updates **MongoDB** (`prawn_erp.feature_flags`).
2. Tries to **invalidate the client ERP’s Redis** cache (if Redis is reachable).
3. **Calls the client ERP** at `POST /internal/saas-hook/features` with the full feature set so the client updates its DB and invalidates its own Redis. This is what makes toggles show up in the client app right away.

**Requirements:**

- **Client ERP (main backend) must be running** on the URL the Super Admin API uses. By default that is `http://localhost:8000`. If your backend runs on another host/port, set in `super-admin-api/.env`:
  - `CLIENT_ERP_URL=http://your-backend-host:port`
- Requests from localhost are allowed by the client ERP without an API key, so no extra config is needed for local dev.

After toggling, **refresh the client ERP page** (or open a screen that loads feature flags) to see the change.

---

## Step-by-step: Make Super Admin toggles apply in Client ERP

Follow these steps so feature toggles in the Super Admin panel show up in the Client ERP (admin app).

### Step 1: Restart the Super Admin API

So it loads the latest code (including the HTTP push to the client ERP).

1. Go to the terminal where the **Super Admin API** is running (the one that shows `uvicorn main:app --reload ... port 8002`).
2. Press **Ctrl+C** to stop it.
3. Start it again from the project root:
   ```bash
   cd /Users/ramakrishnaraju/personal/prawns_erp_1/super-admin-api
   ../backend/.venv/bin/python -m uvicorn main:app --reload --host 0.0.0.0 --port 8002
   ```
4. Leave this terminal open. You should see something like: `Application startup complete`.

---

### Step 2: Ensure the main backend (Client ERP) is running and reachable

The Super Admin API pushes feature flags to the Client ERP at **http://localhost:8000** by default.

1. In **another terminal**, check if the main backend is running:
   ```bash
   curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/docs
   ```
   If you get **200**, the backend is up. If you get connection refused or no response, start it:
   ```bash
   cd /Users/ramakrishnaraju/personal/prawns_erp_1/backend
   .venv/bin/uvicorn server:app --reload --host 0.0.0.0 --port 8000
   ```
   (Or use `./run_all.sh` from the project root to start backend + Super Admin API + frontend together.)

2. **If your backend runs on a different host or port** (e.g. `http://192.168.1.10:8000` or `http://localhost:8001`):
   - Open `super-admin-api/.env` in an editor.
   - Add or change this line (use your actual backend URL **without** a path):
     ```env
     CLIENT_ERP_URL=http://localhost:8000
     ```
     Example: if the backend is on port 8001, set `CLIENT_ERP_URL=http://localhost:8001`.
   - Save the file and **restart the Super Admin API** (repeat Step 1).

---

### Step 3: See the changes in the Client ERP after toggling

1. Open **Super Admin**: http://localhost:3000/super-admin/login and log in.
2. Open a client (e.g. “Prawn Export Company”) and **toggle some features** (or use bulk enable/disable). Wait for the success message.
3. Open **Client ERP** in the same or another browser tab: http://localhost:3000 and log in as `admin@prawnexport.com` / `admin123`.
4. **Refresh the Client ERP page** (F5 or Ctrl+R). Menus and visibility should now match the flags you set in Super Admin (e.g. a disabled feature no longer shows, or a newly enabled one appears).

If you don’t refresh, the client may still show old flags until the next request that loads feature flags.

---

## Existing clients

- Clients are stored in the Super Admin API (DB: `prawn_erp_super_admin`, collection: `clients`).
- On first API startup with an empty DB, one default client is created: **Prawn Export Company** (tenant_id: `cli_001`), so the portal is not empty.
- Any client you add from the portal is saved in the same DB and will appear on the next load.

---

## Quick reference

| What              | URL or command |
|-------------------|----------------|
| Portal login      | http://localhost:3000/super-admin/login |
| API docs          | http://localhost:8002/docs |
| Start API         | `cd super-admin-api && ../backend/.venv/bin/python -m uvicorn main:app --reload --host 0.0.0.0 --port 8002` |
| Build portal UI   | `./scripts/build_super_admin_portal.sh` |
| Credentials       | superadmin@prawnrp.com / admin123 |
