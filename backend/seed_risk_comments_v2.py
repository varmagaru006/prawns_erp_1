import os
import uuid
from datetime import datetime, timezone, timedelta

from motor.motor_asyncio import AsyncIOMotorClient


def now_iso(days_ago: int = 0) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat()


async def seed():
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME", "prawn_erp")
    if not mongo_url:
        raise RuntimeError("MONGO_URL is required")
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    await db.risk_config.update_one(
        {"key": "defaults"},
        {"$set": {"key": "defaults", "bad_purchase_threshold": 2, "lookback_months": 6, "updated_at": now_iso()}},
        upsert=True,
    )

    samples = [
        {"farmer_name": "Rama Rao", "party_name": "Sai Aqua Traders", "agent_name": "Agent Kumar", "area_name": "Kakinada", "severity": "critical", "category": "quality", "note_text": "Repeated icing mismatch and spoilage complaints", "days_ago": 12},
        {"farmer_name": "Srinivas", "party_name": "Delta Marine", "agent_name": "Agent Babu", "area_name": "Bhimavaram", "severity": "warning", "category": "payment", "note_text": "Delayed settlement in last 2 invoices", "days_ago": 18},
        {"farmer_name": "Nagesh", "party_name": "Sai Aqua Traders", "agent_name": "Agent Kumar", "area_name": "Kakinada", "severity": "warning", "category": "quantity_mismatch", "note_text": "Weight mismatch vs slip above tolerance", "days_ago": 40},
        {"farmer_name": "Prasad", "party_name": "Godavari Exports", "agent_name": "Agent Rao", "area_name": "Narsapur", "severity": "info", "category": "other", "note_text": "Needs closer supervision on grading", "days_ago": 7},
        {"farmer_name": "Srinivas", "party_name": "Delta Marine", "agent_name": "Agent Babu", "area_name": "Bhimavaram", "severity": "critical", "category": "fraud_suspected", "note_text": "Suspected duplicate weighment reference", "days_ago": 3},
    ]

    docs = []
    for s in samples:
        ts = now_iso(s["days_ago"])
        docs.append({
            "id": str(uuid.uuid4()),
            "entity_type": "farmer",
            "entity_id": None,
            "farmer_name": s["farmer_name"],
            "party_name": s["party_name"],
            "agent_name": s["agent_name"],
            "area_name": s["area_name"],
            "note_text": s["note_text"],
            "severity": s["severity"],
            "category": s["category"],
            "linked_invoice_id": None,
            "linked_purchase_id": None,
            "edit_history": [],
            "resolved_at": None,
            "resolved_by": None,
            "resolved_by_name": None,
            "resolve_reason": None,
            "is_active": True,
            "created_by": "seed-script",
            "created_by_name": "Seed Script",
            "created_at": ts,
            "updated_at": ts,
        })

    if docs:
        await db.purchase_risk_alerts.insert_many(docs)
    print(f"Seeded {len(docs)} risk comments in {db_name}")


if __name__ == "__main__":
    import asyncio
    asyncio.run(seed())
