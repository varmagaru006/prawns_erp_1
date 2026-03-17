#!/usr/bin/env python3
"""
Create or reset the default Super Admin user (superadmin@prawnrp.com / admin123).
Run from super-admin-api dir: python seed_default_super_admin.py
Uses .env for MONGO_URL.
"""
import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
try:
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env")
except ImportError:
    env_file = ROOT / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27018")
EMAIL = "superadmin@prawnrp.com"
PASSWORD = "admin123"

async def main():
    from motor.motor_asyncio import AsyncIOMotorClient
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

    client = AsyncIOMotorClient(MONGO_URL)
    db = client["prawn_erp_super_admin"]
    try:
        hashed = pwd_context.hash(PASSWORD)
        existing = await db.super_admins.find_one({"email": EMAIL})
        doc = {
            "email": EMAIL,
            "password_hash": hashed,
            "name": "Super Administrator",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_login_at": None,
        }
        if existing:
            await db.super_admins.update_one(
                {"email": EMAIL},
                {"$set": doc}
            )
            print("✅ Super Admin password reset.")
        else:
            doc["id"] = str(uuid.uuid4())
            await db.super_admins.insert_one(doc)
            print("✅ Super Admin created.")
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
