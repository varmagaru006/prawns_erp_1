# Phase 3 Complete - Quick Start Guide

## Super Admin API is Running! 🎉

The Super Admin Portal backend is fully operational and tested.

---

## Quick Test Commands

### 1. Health Check
```bash
curl http://localhost:8002/health | python3 -m json.tool
```

### 2. Login as Super Admin
```bash
curl -X POST http://localhost:8002/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"superadmin@prawnrp.com","password":"admin123"}' \
  | python3 -m json.tool
```

### 3. List All Clients
```bash
TOKEN="<paste_token_here>"
curl http://localhost:8002/clients \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool
```

### 4. Get Feature Flags for a Client
```bash
CLIENT_ID="<paste_client_id_here>"
curl "http://localhost:8002/clients/$CLIENT_ID/features" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool | head -50
```

### 5. Toggle a Feature
```bash
curl -X POST "http://localhost:8002/clients/$CLIENT_ID/features/toggle" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "cli_001",
    "feature_code": "wastage",
    "is_enabled": true,
    "is_override": false
  }' | python3 -m json.tool
```

---

## Run Comprehensive Test Suite

```bash
cd /app/super-admin-api
python3 test_super_admin_api.py
```

---

## Service Management

### Check Status
```bash
sudo supervisorctl status superadmin
```

### Restart Service
```bash
sudo supervisorctl restart superadmin
```

### View Logs
```bash
# Output logs
tail -f /var/log/supervisor/superadmin.out.log

# Error logs
tail -f /var/log/supervisor/superadmin.err.log
```

---

## Database Access

### PostgreSQL (Super Admin Database)
```bash
sudo -u postgres psql -d saas_control_db

# Example queries:
SELECT * FROM clients;
SELECT * FROM feature_registry LIMIT 10;
SELECT * FROM client_feature_flags WHERE client_id = '<uuid>';
```

### MongoDB (Client Data)
```python
from pymongo import MongoClient
client = MongoClient('mongodb://localhost:27017')
db = client.test_database

# Check feature flags synced from Super Admin
list(db.feature_flags.find({"tenant_id": "cli_001"}))
```

### Redis (Cache)
```bash
redis-cli -n 0

# Check cached flags
GET flags:cli_001
KEYS feature:cli_001:*
```

---

## What's Working

✅ Super admin authentication  
✅ Client listing and detail views  
✅ Feature registry management  
✅ Feature flag toggling  
✅ PostgreSQL → MongoDB sync  
✅ Redis cache invalidation  
✅ Client ERP integration  

---

## What's Next (Phase 4)

Build the Super Admin Portal Frontend:
- React application (separate from Client ERP)
- Login page
- Client dashboard
- Feature management UI
- Subscription management

---

## Support

**Super Admin Credentials:**
- Email: `superadmin@prawnrp.com`
- Password: `admin123`

**API Base URL:** `http://localhost:8002`

**Documentation:** See `/app/PHASE_3_COMPLETION_REPORT.md` for full details
