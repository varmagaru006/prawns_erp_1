"""
Seed default yield benchmarks for wastage tracking system
Run this once to populate default thresholds for all species
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from datetime import datetime, timezone
from uuid import uuid4

MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'prawn_erp')

# Default benchmarks for each species
BENCHMARKS = [
    # VANNAMEI
    {
        "species": "Vannamei",
        "process_type": "gate_ice",
        "min_yield_pct": 80.0,
        "optimal_yield_pct": 85.0,
        "max_yield_pct": 95.0,
        "tolerance_pct": None,
        "reference_rate_per_kg": None,
        "description": "Max 20% ice ratio acceptable; >15% triggers amber"
    },
    {
        "species": "Vannamei",
        "process_type": "heading",
        "min_yield_pct": 65.0,
        "optimal_yield_pct": 68.0,
        "max_yield_pct": 72.0,
        "tolerance_pct": None,
        "reference_rate_per_kg": 350.0,
        "description": "Head-on to headless: 68-72% typical"
    },
    {
        "species": "Vannamei",
        "process_type": "peeling",
        "min_yield_pct": 85.0,
        "optimal_yield_pct": 87.5,
        "max_yield_pct": 90.0,
        "tolerance_pct": None,
        "reference_rate_per_kg": 350.0,
        "description": "HLSO to PD/PDTO: 85-90% typical"
    },
    {
        "species": "Vannamei",
        "process_type": "deveining",
        "min_yield_pct": 97.0,
        "optimal_yield_pct": 98.0,
        "max_yield_pct": 99.5,
        "tolerance_pct": None,
        "reference_rate_per_kg": 350.0,
        "description": "Deveining loss < 3%"
    },
    {
        "species": "Vannamei",
        "process_type": "grading",
        "min_yield_pct": 90.0,
        "optimal_yield_pct": 93.0,
        "max_yield_pct": 99.0,
        "tolerance_pct": None,
        "reference_rate_per_kg": 350.0,
        "description": "Size rejects: < 10% grade-down acceptable"
    },
    {
        "species": "Vannamei",
        "process_type": "cooking",
        "min_yield_pct": 82.0,
        "optimal_yield_pct": 85.0,
        "max_yield_pct": 88.0,
        "tolerance_pct": None,
        "reference_rate_per_kg": 350.0,
        "description": "Moisture loss on cooking: 12-18%"
    },
    {
        "species": "Vannamei",
        "process_type": "iqf_freezing",
        "min_yield_pct": 97.5,
        "optimal_yield_pct": 98.5,
        "max_yield_pct": 100.0,
        "tolerance_pct": None,
        "reference_rate_per_kg": 350.0,
        "description": "IQF drip loss: < 2.5%"
    },
    {
        "species": "Vannamei",
        "process_type": "glazing",
        "min_yield_pct": None,
        "optimal_yield_pct": None,
        "max_yield_pct": None,
        "tolerance_pct": 2.0,
        "reference_rate_per_kg": None,
        "description": "±2% tolerance on declared glaze %"
    },
    {
        "species": "Vannamei",
        "process_type": "breading",
        "min_yield_pct": None,
        "optimal_yield_pct": None,
        "max_yield_pct": None,
        "tolerance_pct": 3.0,
        "reference_rate_per_kg": None,
        "description": "±3% tolerance on target coating %"
    },
    {
        "species": "Vannamei",
        "process_type": "cold_storage_monthly",
        "min_yield_pct": 99.0,
        "optimal_yield_pct": 99.5,
        "max_yield_pct": 100.0,
        "tolerance_pct": None,
        "reference_rate_per_kg": 350.0,
        "description": "Monthly drip < 1%"
    },
    
    # BLACK TIGER
    {
        "species": "Black Tiger",
        "process_type": "gate_ice",
        "min_yield_pct": 78.0,
        "optimal_yield_pct": 83.0,
        "max_yield_pct": 93.0,
        "tolerance_pct": None,
        "reference_rate_per_kg": None,
        "description": "Max 22% ice acceptable"
    },
    {
        "species": "Black Tiger",
        "process_type": "heading",
        "min_yield_pct": 63.0,
        "optimal_yield_pct": 66.0,
        "max_yield_pct": 70.0,
        "tolerance_pct": None,
        "reference_rate_per_kg": 700.0,
        "description": "BT heading: 63-70% typical"
    },
    {
        "species": "Black Tiger",
        "process_type": "peeling",
        "min_yield_pct": 84.0,
        "optimal_yield_pct": 86.5,
        "max_yield_pct": 89.0,
        "tolerance_pct": None,
        "reference_rate_per_kg": 700.0,
        "description": "BT peeling: 84-89%"
    },
    {
        "species": "Black Tiger",
        "process_type": "deveining",
        "min_yield_pct": 96.5,
        "optimal_yield_pct": 97.5,
        "max_yield_pct": 99.0,
        "tolerance_pct": None,
        "reference_rate_per_kg": 700.0,
        "description": "BT deveining loss < 3.5%"
    },
    {
        "species": "Black Tiger",
        "process_type": "grading",
        "min_yield_pct": 89.0,
        "optimal_yield_pct": 92.0,
        "max_yield_pct": 98.0,
        "tolerance_pct": None,
        "reference_rate_per_kg": 700.0,
        "description": "BT size rejects < 11%"
    },
    {
        "species": "Black Tiger",
        "process_type": "cooking",
        "min_yield_pct": 80.0,
        "optimal_yield_pct": 83.0,
        "max_yield_pct": 86.0,
        "tolerance_pct": None,
        "reference_rate_per_kg": 700.0,
        "description": "BT moisture loss on cooking: 14-20%"
    },
    {
        "species": "Black Tiger",
        "process_type": "iqf_freezing",
        "min_yield_pct": 97.0,
        "optimal_yield_pct": 98.0,
        "max_yield_pct": 100.0,
        "tolerance_pct": None,
        "reference_rate_per_kg": 700.0,
        "description": "IQF drip < 3%"
    },
    {
        "species": "Black Tiger",
        "process_type": "glazing",
        "min_yield_pct": None,
        "optimal_yield_pct": None,
        "max_yield_pct": None,
        "tolerance_pct": 2.0,
        "reference_rate_per_kg": None,
        "description": "±2% tolerance"
    },
    {
        "species": "Black Tiger",
        "process_type": "breading",
        "min_yield_pct": None,
        "optimal_yield_pct": None,
        "max_yield_pct": None,
        "tolerance_pct": 3.0,
        "reference_rate_per_kg": None,
        "description": "±3% tolerance"
    },
    {
        "species": "Black Tiger",
        "process_type": "cold_storage_monthly",
        "min_yield_pct": 98.5,
        "optimal_yield_pct": 99.5,
        "max_yield_pct": 100.0,
        "tolerance_pct": None,
        "reference_rate_per_kg": 700.0,
        "description": "Monthly drip < 1.5%"
    },
    
    # SEA TIGER
    {
        "species": "Sea Tiger",
        "process_type": "gate_ice",
        "min_yield_pct": 80.0,
        "optimal_yield_pct": 84.0,
        "max_yield_pct": 93.0,
        "tolerance_pct": None,
        "reference_rate_per_kg": None,
        "description": "Sea Tiger ice"
    },
    {
        "species": "Sea Tiger",
        "process_type": "heading",
        "min_yield_pct": 66.0,
        "optimal_yield_pct": 68.0,
        "max_yield_pct": 72.0,
        "tolerance_pct": None,
        "reference_rate_per_kg": 450.0,
        "description": "Sea Tiger heading yield"
    },
    {
        "species": "Sea Tiger",
        "process_type": "peeling",
        "min_yield_pct": 85.0,
        "optimal_yield_pct": 87.0,
        "max_yield_pct": 90.0,
        "tolerance_pct": None,
        "reference_rate_per_kg": 450.0,
        "description": "Sea Tiger peeling"
    },
    {
        "species": "Sea Tiger",
        "process_type": "deveining",
        "min_yield_pct": 97.0,
        "optimal_yield_pct": 98.0,
        "max_yield_pct": 99.5,
        "tolerance_pct": None,
        "reference_rate_per_kg": 450.0,
        "description": "Sea Tiger deveining"
    },
    {
        "species": "Sea Tiger",
        "process_type": "iqf_freezing",
        "min_yield_pct": 97.5,
        "optimal_yield_pct": 98.5,
        "max_yield_pct": 100.0,
        "tolerance_pct": None,
        "reference_rate_per_kg": 450.0,
        "description": "IQF drip"
    },
    {
        "species": "Sea Tiger",
        "process_type": "cold_storage_monthly",
        "min_yield_pct": 99.0,
        "optimal_yield_pct": 99.5,
        "max_yield_pct": 100.0,
        "tolerance_pct": None,
        "reference_rate_per_kg": 450.0,
        "description": "Monthly drip"
    }
]

async def seed_benchmarks():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    try:
        # Check if benchmarks already exist
        existing_count = await db.yield_benchmarks.count_documents({})
        
        if existing_count > 0:
            print(f"⚠️  Found {existing_count} existing benchmarks. Skipping seed.")
            print("   To reseed, delete existing benchmarks first.")
            return
        
        # Insert all benchmarks
        benchmarks_to_insert = []
        for benchmark_data in BENCHMARKS:
            benchmark = {
                "id": str(uuid4()),
                **benchmark_data,
                "is_active": True,
                "set_by": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": None
            }
            benchmarks_to_insert.append(benchmark)
        
        result = await db.yield_benchmarks.insert_many(benchmarks_to_insert)
        
        print(f"✅ Successfully seeded {len(result.inserted_ids)} yield benchmarks!")
        print(f"   - Vannamei: 10 process types")
        print(f"   - Black Tiger: 10 process types")
        print(f"   - Sea Tiger: 6 process types")
        
    except Exception as e:
        print(f"❌ Error seeding benchmarks: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    print("🌱 Seeding yield benchmarks...")
    asyncio.run(seed_benchmarks())
