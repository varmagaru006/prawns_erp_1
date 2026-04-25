import pytest
from datetime import datetime, timezone

from server import RiskService, PurchaseRiskAlertCreate, PurchaseRiskAlertUpdate, User, UserRole


class FakeCursor:
    def __init__(self, rows):
        self._rows = list(rows)

    def sort(self, *_args, **_kwargs):
        return self

    async def to_list(self, _n):
        return list(self._rows)


class FakeCollection:
    def __init__(self):
        self.rows = []

    async def insert_one(self, doc):
        self.rows.append(dict(doc))

    async def find_one(self, query, _proj=None):
        for row in self.rows:
            if all(row.get(k) == v for k, v in query.items()):
                return dict(row)
        return None

    async def update_one(self, query, update):
        class R:
            matched_count = 0
        for row in self.rows:
            if all(row.get(k) == v for k, v in query.items()):
                row.update(update.get("$set", {}))
                R.matched_count = 1
                break
        return R()

    async def count_documents(self, query):
        cnt = 0
        for row in self.rows:
            ok = True
            for k, v in query.items():
                if row.get(k) != v:
                    ok = False
                    break
            if ok:
                cnt += 1
        return cnt

    def find(self, _query, _proj=None):
        return FakeCursor(self.rows)


class FakeDb:
    def __init__(self):
        self.purchase_risk_alerts = FakeCollection()
        self.risk_config = FakeCollection()
        self.audit_logs = FakeCollection()


@pytest.mark.asyncio
async def test_risk_service_create_edit_resolve():
    db = FakeDb()
    svc = RiskService(db)
    user = User(email="a@b.com", name="Admin", role=UserRole.admin)

    created = await svc.create_comment(
        PurchaseRiskAlertCreate(farmer_name="Farmer One", note_text="bad quality", severity="high", category="quality"),
        user,
    )
    assert created.severity == "critical"
    assert len(db.purchase_risk_alerts.rows) == 1

    updated = await svc.edit_comment(
        created.id,
        PurchaseRiskAlertUpdate(note_text="repeat bad quality", severity="warning"),
        user,
    )
    assert updated.note_text == "repeat bad quality"
    assert updated.severity == "warning"
    assert len(updated.edit_history) == 1

    resolved = await svc.set_resolved(created.id, user, resolve=True, reason="handled")
    assert resolved.resolved_by == user.id
    assert resolved.resolved_at is not None
    assert resolved.is_active is False


@pytest.mark.asyncio
async def test_risk_service_alert_check_threshold():
    db = FakeDb()
    svc = RiskService(db)
    user = User(email="a@b.com", name="Admin", role=UserRole.admin)
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.risk_config.insert_one({"key": "defaults", "bad_purchase_threshold": 2, "lookback_months": 6})
    await db.purchase_risk_alerts.insert_one({
        "id": "1", "farmer_name": "F1", "note_text": "x", "severity": "critical", "category": "quality",
        "created_by": user.id, "created_by_name": user.name, "is_active": True, "created_at": now_iso, "updated_at": now_iso
    })
    await db.purchase_risk_alerts.insert_one({
        "id": "2", "farmer_name": "F1", "note_text": "y", "severity": "warning", "category": "payment",
        "created_by": user.id, "created_by_name": user.name, "is_active": True, "created_at": now_iso, "updated_at": now_iso
    })

    result = await svc.get_alert_check("F1", None, None, None)
    assert result["has_blocking_critical"] is True
    assert result["summary"]["threshold_triggered"] is True


@pytest.mark.asyncio
async def test_risk_service_area_insights():
    db = FakeDb()
    svc = RiskService(db)
    user = User(email="a@b.com", name="Admin", role=UserRole.admin)
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.purchase_risk_alerts.insert_one({
        "id": "1", "farmer_name": "F1", "party_name": "P1", "area_name": "Area A", "note_text": "x",
        "severity": "critical", "category": "fraud_suspected", "created_by": user.id, "created_by_name": user.name,
        "is_active": True, "created_at": now_iso, "updated_at": now_iso
    })
    insights = await svc.get_area_insights()
    assert insights["critical_comments_last_90_days"] >= 1
    assert len(insights["areas"]) >= 1
