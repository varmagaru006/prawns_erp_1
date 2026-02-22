# 🔐 Prawn ERP System - Test User Credentials

## All User Roles - Login Credentials

### 1. **Admin (Full System Access)**
- **Email:** admin@prawnexport.com
- **Password:** admin123
- **Name:** Admin User
- **Access:** All modules + user management + notifications

### 2. **Owner (Business Owner)**
- **Email:** owner@prawnexport.com
- **Password:** owner123
- **Name:** Owner Sharma
- **Access:** All modules + reports + analytics

### 3. **Procurement Manager**
- **Email:** procurement@prawnexport.com
- **Password:** proc123
- **Name:** Rajesh Procurement
- **Access:** Procurement, Agents, Dashboard

### 4. **Production Supervisor**
- **Email:** production@prawnexport.com
- **Password:** prod123
- **Name:** Suresh Production
- **Access:** Pre-Processing, Production, Dashboard

### 5. **Cold Storage Incharge**
- **Email:** coldstorage@prawnexport.com
- **Password:** cold123
- **Name:** Vijay Storage
- **Access:** Cold Storage, Finished Goods, Dashboard

### 6. **QC Officer**
- **Email:** qc@prawnexport.com
- **Password:** qc123
- **Name:** Priya QC
- **Access:** QC Module, Finished Goods, Dashboard

### 7. **Sales Manager**
- **Email:** sales@prawnexport.com
- **Password:** sales123
- **Name:** Arun Sales
- **Access:** Sales, Dispatch, Finished Goods, Dashboard

### 8. **Accounts Manager**
- **Email:** accounts@prawnexport.com
- **Password:** acc123
- **Name:** Lakshmi Accounts
- **Access:** Accounts, Wage & Billing, Payments, Dashboard

### 9. **Worker (Read-Only)**
- **Email:** worker@prawnexport.com
- **Password:** work123
- **Name:** Mohan Worker
- **Access:** Assigned module view only, Dashboard

---

## Quick Start Guide

1. **Go to:** https://prawn-erp-saas.preview.emergentagent.com
2. **Choose a role** from the list above
3. **Login** with the corresponding email and password
4. **Explore** the modules based on your role access

---

## Role-Based Access Matrix

| Module | Admin | Owner | Procurement | Production | Cold Storage | QC | Sales | Accounts | Worker |
|--------|-------|-------|-------------|------------|--------------|----| ------|----------|--------|
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Procurement | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Agents | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Pre-Processing | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Production | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Finished Goods | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Cold Storage | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| QC Module | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Sales & Dispatch | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Wage & Billing | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Notifications | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Security Notes

⚠️ **These are test credentials for development/demo purposes only**

- Change all passwords before production deployment
- Use strong passwords (min 12 characters, mix of letters, numbers, symbols)
- Enable 2FA for admin and owner accounts
- Regularly rotate passwords
- Monitor audit logs for suspicious activity

---

## Support

For access issues or password reset, contact your system administrator.

**System URL:** https://prawn-erp-saas.preview.emergentagent.com
**Status:** ✅ Active and Running
