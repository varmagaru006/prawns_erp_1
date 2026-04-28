---
name: Code Conventions and Project Rules
description: Non-obvious conventions established in this project that must be followed
type: feedback
originSessionId: e27094f3-98a1-478e-a642-7676a8b4e3ff
---
Keep all backend logic in `backend/server.py` — do not refactor into separate modules unless explicitly asked.

**Why:** The project was deliberately built monolithic for simplicity. Splitting would break import paths, deployment scripts, and the mental model.

**How to apply:** When adding backend features, append to server.py. Do not suggest "let's move this to a services/ file."

---

Frontend page files use `.js` extension, not `.jsx`. Super Admin frontend uses `.jsx` with Vite.

**Why:** Established pattern from Cursor AI development — mixing would cause confusion.

**How to apply:** Always use `.js` for files in `frontend/src/pages/` and `frontend/src/components/`. Use `.jsx` only in `super-admin-frontend/src/`.

---

Use `Yarn` for frontend dependencies, `pip` for backend. Never switch.

**Why:** Project was scaffolded with Create React App + Yarn.

**How to apply:** All `npm install` suggestions should be `yarn add`. All `npm run` should be `yarn`.

---

No TypeScript — the entire project is plain JavaScript and Python.

**Why:** Existing Cursor AI codebase. Adding TS would require migration of 25+ files.

**How to apply:** Never suggest `.ts`/`.tsx` files or TypeScript migration.

---

All new feature flags must be registered in `backend/feature_registry.py` first.

**Why:** Single source of truth for the 20-flag system used by Super Admin portal.

**How to apply:** When adding a new toggleable feature, add to feature_registry.py before referencing the flag in server.py or frontend.

---

All DB queries must go through `TenantAwareDatabase`, never raw Motor collection access.

**Why:** Multi-tenancy — bypassing the wrapper would send queries to the wrong tenant's data.

**How to apply:** In server.py, always use `db.get_collection("collection_name")` pattern, never `motor_client["db"]["collection"]` directly.
