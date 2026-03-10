# 🦐 Prawn ERP - Wastage v4.0 Feature Verification Guide

## Test Credentials
- **Admin**: admin@prawnexport.com / admin123
- **Full credentials**: See /app/TEST_CREDENTIALS.md

## App URL
https://erp-admin-upgrade.preview.emergentagent.com

---

## ✅ Feature 1: Market Rates Admin UI

**Location**: Navigate to "Market Rates" in the sidebar

### Test Steps:
1. **CREATE**: Click "+ Add Market Rate"
   - Species: Vannamei
   - Product Form: HLSO
   - Rate per KG (INR): 450.00
   - Effective From: Today's date
   - Click "Add Market Rate"
   - **Expected**: Rate appears in the table

2. **READ**: Verify the table shows:
   - Species column
   - Product Form column
   - Rate (INR/KG) in green
   - Effective From date
   - Edit and Delete buttons

3. **UPDATE**: Click Edit icon on any rate
   - Change Rate per KG to 475.00
   - Click "Update Market Rate"
   - **Expected**: Table updates with new rate

4. **DELETE**: Click Delete icon on a test rate
   - Confirm deletion
   - **Expected**: Rate disappears from table

---

## ✅ Feature 2: Procurement Wastage Dialog

**Location**: Procurement page

### Test Steps:
1. Go to "Procurement" in sidebar
2. Find any lot with data (look for lots with Ice % and Gate Yield values)
3. Click the **Package icon** (View Wastage button) in the Actions column
4. **Expected**: Dialog opens showing:
   - Lot details (Species, Agent, Gross/Net Weight)
   - Stage-wise Wastage table with columns:
     * Stage (e.g., "Gate Ice")
     * Input (KG)
     * Output (KG)
     * Wastage (KG) in red
     * Yield % with color badge
     * Status (green/amber/red badge)
     * Revenue Loss (₹)
5. Close dialog with X or click outside

---

## ✅ Feature 3: Lot Waterfall View

**Location**: Direct URL or via future navigation

### Test Steps:
1. From Procurement page, note a lot ID (e.g., from the lot number like PRW-2026-02-21-173233)
2. Manually navigate to: `/admin/lot/{lot_id}/wastage`
   - Replace {lot_id} with the actual lot's ID
3. **Expected**: Waterfall page displays:
   - 4 summary cards at top:
     * Initial Weight (KG)
     * Final Weight (KG)
     * Total Wastage (KG) in red
     * Revenue Loss (₹)
   - Visual waterfall showing:
     * START box (blue) with initial weight
     * Each processing stage (color-coded by status)
     * Arrows between stages
     * Per-stage details: Input/Output/Wastage/Yield/Revenue Loss
     * END box (green) with final weight
4. Check for alert icons on red/amber stages

**Note**: If lot has no processing stages yet, waterfall will show "No processing stages found"

---

## ✅ Feature 4: Pre-processing Threshold Status

**Location**: Pre-Processing page

### Test Steps:
1. Go to "Pre-Processing" in sidebar
2. Look at the batches table
3. **Expected**: New "Threshold Status" column appears:
   - Shows "-" if no wastage data yet
   - Shows color-coded badge (green/amber/red) with yield %
   - Badge format: "85.0%" with colored background and border
4. Verify column is between "Yield %" and "Status" columns

---

## ✅ Feature 5: Production Threshold Status

**Location**: Production page

### Test Steps:
1. Go to "Production" in sidebar
2. Look at the production orders table
3. **Expected**: New "Threshold Status" column appears:
   - Shows "-" if no wastage data yet
   - Shows color-coded badge with yield %
   - Badge format: "90.0%" with colored background and border
4. Verify column is between "Conversion %" and "QC Status" columns

---

## ✅ Feature 6: Sidebar Navigation

**Location**: Left sidebar

### Test Steps:
1. Log in as Admin
2. Check sidebar for new "Market Rates" link
3. **Expected**: Link appears under "Yield Benchmarks"
4. Click link - should navigate to Market Rates page
5. Verify icon displays correctly (Receipt/Dollar icon)

---

## ✅ Feature 7: Wastage Dashboard (Previously Completed)

**Location**: Wastage Dashboard in sidebar

### Quick Verification:
1. Click "Wastage Dashboard"
2. **Expected**:
   - 4 stat cards at top
   - Stage-wise wastage bar chart
   - Breach alerts table (if any alerts exist)
3. All should be working from previous implementation

---

## 🐛 What to Report if Something Doesn't Work

For each feature that doesn't work as expected, please note:
1. **Feature name** (e.g., "Market Rates CRUD")
2. **What you did** (exact steps)
3. **What happened** (error message, incorrect behavior, blank screen)
4. **Expected behavior** (what should have happened)
5. **Browser console errors** (F12 → Console tab → screenshot any red errors)

---

## ✅ Success Criteria

All features should work without errors. The system should:
- Load all pages without crashes
- Display data correctly
- Save/update/delete operations should persist
- Color-coded badges should appear with proper colors
- No console errors (minor warnings are OK)

