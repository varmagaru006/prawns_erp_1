---
name: Prawn ERP Project Overview
description: Core context about the Prawn ERP SaaS system — stack, architecture, purpose
type: project
originSessionId: e27094f3-98a1-478e-a642-7676a8b4e3ff
---
Multi-tenant SaaS ERP for prawn seafood export businesses. Started in Cursor AI, now maintained in Claude Code.

**Why:** Industry-specific ERP for prawn exporters covering the full chain: procurement → pre-processing → production → QC → cold storage → sales → accounts.

**Stack:**
- Backend: FastAPI (Python 3.11), MongoDB (Motor async), JWT, ReportLab
- Frontend: React 19 + Craco, Tailwind CSS 3, Shadcn/UI, React Router 7
- Super Admin API: Separate FastAPI service
- Super Admin Frontend: React 19 + Vite
- Infra: Docker Compose, Render/Railway/Fly.io deployable

**Key architectural choices:**
- All 120+ backend endpoints in a single `backend/server.py` (~9700 lines) — intentional monolith
- Multi-tenancy via `TenantAwareDatabase` wrapper + `X-Tenant-ID` header
- No Redux — React Context only (Auth, FeatureFlag, Branding)
- Feature flags (20) per-tenant managed from Super Admin portal
- 10 user roles with module-level RBAC

**How to apply:** Frame all backend suggestions around server.py. Frame frontend suggestions around the existing Context + pages/.js pattern. Never suggest splitting into microservices or adding TypeScript without explicit ask.
