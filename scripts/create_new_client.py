#!/usr/bin/env python3
"""
Script to create a new client end-to-end in the Prawn ERP system.

This script will:
1. Create a client in Super Admin database
2. Create an admin user for the client in the Client ERP database
3. Set up initial feature flags for the client

Usage:
    python3 create_new_client.py
    
Then follow the prompts to enter client details.
"""

import os
import sys
import uuid
import bcrypt
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
mongo_client = MongoClient(MONGO_URL)

# Databases
super_admin_db = mongo_client['prawn_erp_super_admin']
client_erp_db = mongo_client['test_database']

def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def generate_api_key() -> str:
    """Generate a random API key"""
    return f"pk_{uuid.uuid4().hex}"

def create_client():
    print("\n" + "="*60)
    print("  NEW CLIENT SETUP WIZARD")
    print("="*60 + "\n")
    
    # Gather client information
    print("Step 1: Enter Client Details")
    print("-" * 40)
    
    tenant_id = input("Tenant ID (e.g., 'my_company', no spaces): ").strip().lower().replace(" ", "_")
    if not tenant_id:
        print("Error: Tenant ID is required")
        return
    
    # Check if tenant already exists
    existing = super_admin_db.clients.find_one({"tenant_id": tenant_id})
    if existing:
        print(f"Error: Client with tenant_id '{tenant_id}' already exists!")
        return
    
    business_name = input("Business Name: ").strip()
    owner_name = input("Owner Name: ").strip()
    owner_email = input("Owner Email: ").strip()
    
    print("\nStep 2: Admin User Credentials")
    print("-" * 40)
    admin_email = input(f"Admin Login Email [{owner_email}]: ").strip() or owner_email
    admin_password = input("Admin Password: ").strip()
    if not admin_password:
        print("Error: Password is required")
        return
    
    # Create client in Super Admin DB
    print("\n\nCreating client...")
    client_id = str(uuid.uuid4())
    api_key = generate_api_key()
    now = datetime.now(timezone.utc)
    
    client_doc = {
        "id": client_id,
        "tenant_id": tenant_id,
        "business_name": business_name,
        "owner_email": owner_email,
        "owner_name": owner_name,
        "api_key_hash": hash_password(api_key),
        "plan_id": "free",
        "subscription_status": "active",
        "subscription_start": now.isoformat(),
        "subscription_end": (now + timedelta(days=365)).isoformat(),
        "is_active": True,
        "link_status": "linked",
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    super_admin_db.clients.insert_one(client_doc)
    client_doc.pop('_id', None)
    print(f"✅ Client created in Super Admin DB")
    print(f"   Client ID: {client_id}")
    print(f"   Tenant ID: {tenant_id}")
    print(f"   API Key: {api_key}")
    
    # Create admin user in Client ERP DB
    print("\nCreating admin user...")
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": admin_email,
        "name": owner_name,
        "password": hash_password(admin_password),
        "role": "admin",
        "phone": "",
        "is_active": True,
        "tenant_id": tenant_id,  # Important: Links user to client
        "created_at": now.isoformat()
    }
    
    # Check if user already exists
    existing_user = client_erp_db.users.find_one({"email": admin_email})
    if existing_user:
        print(f"⚠️  User with email '{admin_email}' already exists. Updating tenant_id...")
        client_erp_db.users.update_one(
            {"email": admin_email},
            {"$set": {"tenant_id": tenant_id}}
        )
    else:
        client_erp_db.users.insert_one(user_doc)
    print(f"✅ Admin user created/updated")
    print(f"   Email: {admin_email}")
    print(f"   Role: admin")
    
    # Set up default feature flags
    print("\nSetting up feature flags...")
    default_features = [
        "procurement",
        "accounts",
        "admin"
    ]
    
    for feature_code in default_features:
        client_erp_db.feature_flags.update_one(
            {"tenant_id": tenant_id, "feature_code": feature_code},
            {"$set": {
                "is_enabled": True,
                "updated_at": now.isoformat()
            }},
            upsert=True
        )
    print(f"✅ Default features enabled: {', '.join(default_features)}")
    
    # Summary
    print("\n" + "="*60)
    print("  CLIENT SETUP COMPLETE!")
    print("="*60)
    print(f"""
Client Details:
  - Business Name: {business_name}
  - Tenant ID: {tenant_id}
  - Client ID: {client_id}
  - API Key: {api_key}

Admin Login Credentials:
  - Email: {admin_email}
  - Password: {admin_password}

Default Features Enabled:
  - procurement
  - accounts  
  - admin

To enable more features:
  1. Go to Super Admin Portal
  2. Click "Manage" on your client
  3. Toggle the features you want to enable

Login URL: https://erp-migration-5.preview.emergentagent.com/login
""")

if __name__ == "__main__":
    create_client()
