#!/usr/bin/env python3
"""
Create or reset the default client ERP admin user so you can log in.
Run from backend dir: python seed_default_admin.py
Uses backend/.env for MONGO_URL and DB_NAME.
"""
import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

# Load backend .env
ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
try:
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env")
except ImportError:
    # Fallback: read .env manually
    env_file = ROOT / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "prawn_erp")
EMAIL = "admin@prawnexport.com"
PASSWORD = "admin123"

async def main():
    from motor.motor_asyncio import AsyncIOMotorClient
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    try:
        hashed = pwd_context.hash(PASSWORD)
        doc = {
            "email": EMAIL,
            "name": "Admin User",
            "role": "admin",
            "phone": None,
            "password": hashed,
            "is_active": True,
            "tenant_id": "cli_001",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        existing = await db.users.find_one({"email": EMAIL})
        if existing:
            await db.users.update_one(
                {"email": EMAIL},
                {"$set": {**doc, "id": existing.get("id") or str(uuid.uuid4())}}
            )
            print("✅ Default admin password reset.")
        else:
            doc["id"] = str(uuid.uuid4())
            await db.users.insert_one(doc)
            print("✅ Default admin created.")
        print("   Login with:")
        print(f"   Email:    {EMAIL}")
        print(f"   Password: {PASSWORD}")
    except Exception as e:
        print("❌ Error:", e)
        sys.exit(1)
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(main())
