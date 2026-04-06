# Database loading optimisations

Ways we optimise loading records from MongoDB and how to apply them elsewhere.

## 1. Indexes

- **Ensure indexes** on every filter/sort used in list APIs: `ensure_erp_indexes()` in `server.py` runs at startup.
- Prefer **compound indexes** when you filter on several fields and sort: e.g. `(invoice_date, status, payment_status)` for purchase invoice list.
- Add indexes for: date ranges, status filters, foreign keys (`party_id`, `invoice_id`, etc.), and sort fields.

## 2. Pagination

- **Never** load “all” records with a large `to_list(10000)` for list UIs. Use `skip`/`limit` (or cursor-based) and return one page.
- Use **aggregation** or `count_documents` for total count; don’t load all docs just to count.

## 3. Avoid N+1 (batch lookups)

- If you load a list and then, **per item**, call `find_one` (e.g. to attach party name, user name, ledger), that’s N+1 and slows down as the list grows.
- **Fix:** collect the related IDs from the list, run **one** `find({"id": {"$in": ids}})` (or equivalent), build a map `id -> document`, then attach in a loop.

**Examples in this codebase:**

- Purchase invoices list: one batch `parties.find({"id": {"$in": party_ids}})` for `party_short_code`.
- Audit logs: one batch `users.find({"id": {"$in": user_ids}})` for user names.
- Wastage breach alerts: one batch `procurement_lots.find({"id": {"$in": lot_ids}})` for lot details.
- Parties list: one batch `party_ledger_accounts.find({"party_id": {"$in": party_ids}, "financial_year": fy})` for balances.
- Party-ledger parties: same batch ledger fetch for ledger details.
- **Party ledger detail / export / PDF / Excel:** one batch `purchase_invoice_lines.find({"invoice_id": {"$in": invoice_ids}})` for all bill entries, then group by `invoice_id` and attach `line_items` per entry (avoids one query per bill entry).

## 4. Projection

- Request only fields you need: `find(query, {"_id": 0, "id": 1, "name": 1})` instead of loading full documents when you only need a few keys.

## 5. Parallel independent queries

- When you need **metrics** and **one page of list** for the same filter, run them in **parallel** with `asyncio.gather()` so total time is ~max of the two, not sum.
- Dashboard: multiple independent stats/queries are run in parallel.

## 6. Caching

- Use short-TTL in-memory cache for expensive, rarely changing data (e.g. dashboard overview 30s per tenant). See `_cache_get` / `_cache_set` in `server.py`.
- **Tenant config:** `get_tenant_config_dict()` loads full config once per 60s per tenant; used by ledger detail, PDF, Excel, CSV export, GET /tenant-config. Invalidated on config update.
- **List caches (30s):** GET /agents, GET /parties (unfiltered), GET /procurement/lots, GET /finished-goods. Invalidated on create/update/delete so lists stay fresh.

## 7. Aggregation for stats

- For counts and sums (totals, metrics), use an **aggregation pipeline** with `$match` + `$group` instead of loading all documents and summing in Python.

## Quick checklist for a new list endpoint

1. Add indexes for filter + sort fields.
2. Use pagination (skip/limit or cursor); don’t `to_list(10000)`.
3. If you need related data (party, user, ledger), batch fetch with `$in` and a map, not `find_one` in a loop.
4. Use projection to return only required fields.
5. If the same query drives both “list” and “metrics”, run list and metrics in parallel.
