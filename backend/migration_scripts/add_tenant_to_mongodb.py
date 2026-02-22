"""
MongoDB Multi-Tenancy Migration
Adds tenant_id field to all existing collections and migrates data to cli_001
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

# Load environment
ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
db_name = os.environ['DB_NAME']

async def migrate_to_multi_tenant():
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Define all collections to migrate
    collections = [
        'users',
        'agents',
        'procurement_lots',
        'preprocessing_batches',
        'production_orders',
        'finished_goods',
        'qc_inspections',
        'cold_storage_chambers',
        'cold_storage_slots',
        'cold_storage_inventory',
        'temperature_logs',
        'buyers',
        'sales',
        'shipments',
        'notifications',
        'approvals',
        'edit_requests',
        'photo_tracker',
        'yield_benchmarks',
        'market_rates',
        'lot_stage_wastage',
    ]
    
    tenant_id = "cli_001"
    
    print(f"🚀 Starting MongoDB multi-tenancy migration...")
    print(f"📦 Tenant ID: {tenant_id}")
    print(f"🗄️  Database: {db_name}")
    print()
    
    for collection_name in collections:
        collection = db[collection_name]
        
        # Check if collection exists
        count = await collection.count_documents({})
        
        if count == 0:
            print(f"⏭️  {collection_name}: Empty, skipping")
            continue
        
        # Add tenant_id to all documents
        result = await collection.update_many(
            {},
            {"$set": {"tenant_id": tenant_id}}
        )
        
        # Create index on tenant_id
        await collection.create_index("tenant_id")
        
        print(f"✅ {collection_name}: Updated {result.modified_count} documents, index created")
    
    print()
    print("🎉 Migration complete!")
    print(f"📊 All data now belongs to tenant: {tenant_id}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(migrate_to_multi_tenant())
