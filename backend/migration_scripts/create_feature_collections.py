"""
Create MongoDB collections for feature flags and announcements
These are synced from PostgreSQL saas_control_db
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
db_name = os.environ['DB_NAME']

async def create_feature_flag_collections():
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("📋 Creating feature flag and announcement collections...")
    
    # Create feature_flags collection with schema validation
    try:
        await db.create_collection("feature_flags")
        await db.feature_flags.create_index([("tenant_id", 1), ("feature_code", 1)], unique=True)
        await db.feature_flags.create_index("tenant_id")
        print("✅ feature_flags collection created")
    except Exception as e:
        print(f"⚠️  feature_flags: {e}")
    
    # Create active_announcements collection
    try:
        await db.create_collection("active_announcements")
        await db.active_announcements.create_index("tenant_id")
        await db.active_announcements.create_index([("show_from", 1), ("show_until", 1)])
        print("✅ active_announcements collection created")
    except Exception as e:
        print(f"⚠️  active_announcements: {e}")
    
    # Create announcement_dismissals collection
    try:
        await db.create_collection("announcement_dismissals")
        await db.announcement_dismissals.create_index([("tenant_id", 1), ("announcement_id", 1), ("user_id", 1)], unique=True)
        print("✅ announcement_dismissals collection created")
    except Exception as e:
        print(f"⚠️  announcement_dismissals: {e}")
    
    # Populate feature flags for cli_001 (all features enabled for now)
    tenant_id = "cli_001"
    
    # Basic features to enable
    features_to_enable = [
        "procurement",
        "procurement.quality_inspection",
        "procurement.size_verification",
        "procurement.farm_master",
        "preprocessing",
        "preprocessing.byproducts",
        "production",
        "production.glazing_tracking",
        "cold_storage",
        "cold_storage.slot_map",
        "cold_storage.temperature_log",
        "cold_storage.fifo_alerts",
        "qc",
        "qc.lab_report",
        "sales",
        "sales.multi_line_orders",
        "sales.shipment_tracking",
        "reports",
        "wastage",
        "wastage.revenue_loss_engine",
        "wastage.yield_benchmarks_admin",
        "wastage.waterfall_view",
        "admin.user_management",
        "admin.notifications",
    ]
    
    for feature_code in features_to_enable:
        await db.feature_flags.update_one(
            {"tenant_id": tenant_id, "feature_code": feature_code},
            {"$set": {
                "tenant_id": tenant_id,
                "feature_code": feature_code,
                "is_enabled": True,
                "synced_at": "2026-02-22T00:00:00Z"
            }},
            upsert=True
        )
    
    print(f"✅ Enabled {len(features_to_enable)} features for {tenant_id}")
    print("🎉 Feature flag collections ready!")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(create_feature_flag_collections())
