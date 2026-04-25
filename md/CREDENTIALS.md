# Working credentials – Super Admin & Client ERP

Use these to log in after a fresh setup (Docker or local).

---

## Client ERP (main app)

**URL:** http://localhost:3000 (or your frontend URL)

| Field    | Value                    |
|----------|--------------------------|
| **Email**    | `admin@prawnexport.com`  |
| **Password** | `admin123`               |

- **Role:** Admin (full access).
- **Seeded when:** Main backend starts and no user exists in the database (first run).

---

## Super Admin (SaaS control panel)

**Login URL:** http://localhost:3000/super-admin/login  
(The Super Admin UI is served by the main frontend at `/super-admin/` and talks to the API on port 8002.)  
**Full setup:** See [SUPER_ADMIN_PORTAL.md](SUPER_ADMIN_PORTAL.md).

**API (must be running):** http://localhost:8002

| Field    | Value                     |
|----------|---------------------------|
| **Email**    | `superadmin@prawnrp.com`  |
| **Password** | `admin123`                |

- **Role:** Super Administrator.
- **Seeded when:** Super Admin API starts and no super admin exists (first run).

---

## Can't log in? (Super Admin)

1. **Start the Super Admin API** (required for http://localhost:3000/super-admin/login to work):
   ```bash
   cd super-admin-api
   # Use backend venv (has fastapi, uvicorn, motor, etc.):
   ../backend/.venv/bin/python -m uvicorn main:app --reload --host 0.0.0.0 --port 8002
   ```
   Leave this terminal running. Then open http://localhost:3000/super-admin/login and log in with the credentials below.

2. **Create or reset the default Super Admin** (if you get "Invalid credentials"):
   ```bash
   # From project root, using backend venv:
   backend/.venv/bin/python super-admin-api/seed_default_super_admin.py
   ```
   Then try again: `superadmin@prawnrp.com` / `admin123`.

3. **MongoDB** must be running. `super-admin-api/.env` should have `MONGO_URL=...` (e.g. `mongodb://prawn_erp_user:prawn_erp_dev_password@localhost:27018` for Docker MongoDB).

---

## Summary

| App           | Email                    | Password  |
|---------------|--------------------------|-----------|
| **Client ERP**   | admin@prawnexport.com     | admin123  |
| **Super Admin**  | superadmin@prawnrp.com    | admin123  |

Change these passwords before using in production.

---

## Can't log in? (Client ERP)

1. **Backend must be running** and reachable at the URL your frontend uses (e.g. `http://localhost:8000`). Check `frontend/.env`: `REACT_APP_BACKEND_URL=http://localhost:8000`.

2. **Create or reset the default admin** (if you get "Invalid credentials" or no user exists):
   ```bash
   cd backend
   source .venv/bin/activate   # or: python3 -m venv .venv && source .venv/bin/activate
   pip install motor passlib python-dotenv
   python seed_default_admin.py
   ```
   Then try logging in again with `admin@prawnexport.com` / `admin123`.

3. **MongoDB must be running** and `backend/.env` must have the correct `MONGO_URL` (e.g. `mongodb://prawn_erp_user:prawn_erp_dev_password@localhost:27018` if using Docker MongoDB on port 27018).
