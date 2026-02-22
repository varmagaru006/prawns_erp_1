# Super Admin Portal Frontend

## Overview
A modern React application for managing multi-tenant SaaS clients, subscriptions, and feature flags.

**Running on:** `http://localhost:3001`  
**API Backend:** `http://localhost:8002`

---

## Tech Stack

- **React 18** - UI framework
- **Vite** - Build tool & dev server
- **React Router** - Client-side routing
- **Tailwind CSS** - Styling
- **Axios** - HTTP client
- **Lucide React** - Icon library

---

## Pages

### 1. Login (`/login`)
- Super admin authentication
- Email/password form
- JWT token management
- Auto-redirect to dashboard

**Credentials:**
- Email: `superadmin@prawnrp.com`
- Password: `admin123`

### 2. Dashboard (`/dashboard`)
- List all clients
- Search/filter clients
- View client stats
- Quick access to feature management

### 3. Client Detail (`/clients/:id`)
- Client information card
- Feature flag management
- Real-time toggle switches
- Grouped by module

---

## API Integration

All API calls go through `/src/api/auth.js`:

```javascript
// Login
authAPI.login(email, password)

// Get clients  
clientAPI.getAll()

// Toggle feature
clientAPI.toggleFeature(clientId, data)
```

---

## Development

```bash
cd /app/super-admin-frontend
yarn dev
```

---

## Access

- **Local:** http://localhost:3001
- **Credentials:** superadmin@prawnrp.com / admin123

**Status:** ✅ COMPLETE AND RUNNING
