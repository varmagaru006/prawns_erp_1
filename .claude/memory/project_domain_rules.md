---
name: Domain Business Rules
description: Prawn ERP domain-specific calculations and business logic that must be preserved exactly
type: project
originSessionId: e27094f3-98a1-478e-a642-7676a8b4e3ff
---
These auto-calculations are core business logic. Never change the formulas without explicit instruction.

**Procurement:**
- `net_weight = gross_weight - ice_weight - box_weight`
- `total_amount = net_weight * rate`
- `balance = total_amount - advance_paid`

**Pre-Processing:**
- `waste_weight = input_weight - output_weight`
- `yield_pct = (output_weight / input_weight) * 100`
- Yield alert threshold default: **75%** (configurable via Yield Benchmarks)

**Production:**
- `conversion_rate = (finished_weight / input_weight) * 100`

**Party Ledger:**
- FY-wise opening balances are auto-carried forward to next financial year

**Why:** These are the exact formulas the client business uses. Wrong calculations = wrong financials.

**How to apply:** When modifying any procurement/preprocessing/production models or endpoints, verify these calculations are intact. When asked to add fields, check if they affect any of these formulas.

---

**Species:** Vannamei, Black Tiger, Sea Tiger (exact strings — used in DB and UI)

**Freshness Grades:** A, B, C, Rejected

**Product Forms:** HOSO, HLSO, PTO, PD, PDTO, Butterfly, Ring Cut, Cooked

**Process Types:** heading, peeling, deveining, iqf, blanching, grading

**Why:** Domain-specific terminology for prawn processing industry. Must match exactly.
