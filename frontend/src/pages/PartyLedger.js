import { useState, useMemo, useRef, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { useSortableTable } from '../hooks/useSortableTable';

const API = process.env.REACT_APP_BACKEND_URL;

const COMPANY = {
  name: "KRISH AQUA TRADERS",
  addr1: "195/1A1&1A2, Batnavelli Village, By-Pass Road, Amalapuram,",
  addr2: "Dr.BR Ambedkar Konaseema District, Andhra Pradesh-533201.",
  phone: "8096696789",
  email: "krishaquatraders@gmail.com",
};

// Compute running balance
function computeBalances(entries, opening) {
  let running = opening;
  return entries.map(e => {
    const prevBalance = running;
    
    if (e.entry_type === "bill" || e.entry_type === "manual_debit") {
      running += e.tds_after_bill || e.total_bill || 0;
      const balAfterBill = running;
      return { ...e, balance_after_bill: balAfterBill, running_balance: running, prev_balance: prevBalance };
    } else if (e.entry_type === "payment" || e.entry_type === "manual_credit") {
      running -= e.payment_amount || 0;
      return { ...e, balance_after_pay: running, running_balance: running, prev_balance: prevBalance };
    } else if (e.entry_type === "opening") {
      return { ...e, running_balance: running, prev_balance: prevBalance };
    }
    
    return { ...e, running_balance: running, prev_balance: prevBalance };
  });
}

function fmt(n, dp = 2) {
  if (n == null || isNaN(n)) return "";
  return Number(n).toLocaleString("en-IN", { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

function fmtDate(d) {
  if (!d) return "";
  const dateStr = typeof d === 'string' ? d.split('T')[0] : d;
  const [y, m, day] = dateStr.split("-");
  return `${day}-${m}-${y.slice(2)}`;
}

// ─── LEDGER PRINT STYLES ──────────────────────────────────────────────────────
const PRINT_STYLE = `
@media print {
  body * { visibility: hidden !important; }
  #ledger-print, #ledger-print * { visibility: visible !important; }
  #ledger-print { position: fixed; top: 0; left: 0; width: 100%; }
  @page { size: A3 landscape; margin: 8mm; }
}`;

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

function Chip({ label, color }) {
  const map = {
    green:  { bg: "#dcfce7", text: "#15803d", border: "#86efac" },
    amber:  { bg: "#fef3c7", text: "#92400e", border: "#fcd34d" },
    red:    { bg: "#fee2e2", text: "#991b1b", border: "#fca5a5" },
    blue:   { bg: "#dbeafe", text: "#1e40af", border: "#93c5fd" },
    grey:   { bg: "#f3f4f6", text: "#374151", border: "#d1d5db" },
  };
  const s = map[color] || map.grey;
  return (
    <span style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}`, borderRadius: 12, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>
      {label}
    </span>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: wide ? 900 : 480, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#1e293b" }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required, hint }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>
        {label}{required && <span style={{ color: "#ef4444" }}> *</span>}
      </div>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 7, padding: "8px 12px", fontSize: 13, color: "#1e293b", outline: "none", boxSizing: "border-box" }} />
      {hint && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>{hint}</div>}
    </div>
  );
}

// ─── LEDGER PRINT TEMPLATE ────────────────────────────────────────────────────
function LedgerPrintView({ party, fy, entries, opening }) {
  const computed = computeBalances(entries, opening);
  
  // Calculate totals
  const bills = computed.filter(e => e.entry_type === "bill");
  const payments = computed.filter(e => e.entry_type === "payment" || e.entry_type === "manual_credit");
  const totBilled = bills.reduce((s, e) => s + (e.total_bill || 0), 0);
  const totTds = bills.reduce((s, e) => s + (e.tds_amount || 0), 0);
  const totPay = payments.reduce((s, e) => s + (e.payment_amount || 0), 0);
  const closing = computed.length ? computed[computed.length - 1].running_balance : opening;

  const tdStyle = { border: "1px solid #94a3b8", padding: "3px 5px", fontSize: 10, verticalAlign: "top" };
  const thStyle = { ...tdStyle, background: "#e0f2fe", fontWeight: 700, textAlign: "center", fontSize: 10 };

  return (
    <div id="ledger-print" style={{ fontFamily: "Arial, sans-serif", background: "#f0f9ff", padding: 16, minWidth: 1100 }}>
      <style>{PRINT_STYLE}</style>
      {/* Header */}
      <div style={{ textAlign: "center", borderBottom: "2px solid #0369a1", paddingBottom: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: "#0c4a6e" }}>{COMPANY.name}</div>
        <div style={{ fontSize: 10, color: "#334155" }}>{COMPANY.addr1}</div>
        <div style={{ fontSize: 10, color: "#334155" }}>{COMPANY.addr2}</div>
        <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4 }}>
          PARTY NAME: {party.party_name}{party.party_alias ? ` (${party.party_alias})` : ""}
        </div>
        <div style={{ fontSize: 10, color: "#475569" }}>Financial Year: {fy} &nbsp;|&nbsp; Opening Balance: ₹{fmt(opening)}</div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["DATE","BILL NO","COUNT","QTY","RATE","AMOUNT","TOTAL BILL","TDS@0.1%","TDS AFTER BILL","PAYMENT","PAY DATE","BALANCE","PAID TO"].map(h => (
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr>
          <tr>
            <td colSpan={13} style={{ ...tdStyle, fontWeight: 700, background: "#e0f2fe" }}>
              OPENING BALANCE: ₹{fmt(opening)}
            </td>
          </tr>
        </thead>
        <tbody>
          {computed.map((e) => {
            if (e.entry_type === "opening") return null;
            
            if (e.entry_type === "bill") {
              const lines = e.lines || [];
              return lines.map((line, li) => {
                const isLast = li === lines.length - 1;
                return (
                  <tr key={`${e.id}-${li}`} style={{ background: li % 2 === 0 ? "#fff" : "#f8fafc" }}>
                    <td style={tdStyle}>{li === 0 ? fmtDate(e.entry_date) : ""}</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>{li === 0 ? e.bill_no : ""}</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>{line.count_value}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{fmt(line.quantity_kg, 3)}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{fmt(line.rate, 1)}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{fmt(line.amount)}</td>
                    {isLast ? (
                      <>
                        <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>{fmt(e.total_bill)}</td>
                        <td style={{ ...tdStyle, textAlign: "right", color: "#b91c1c" }}>{fmt(e.tds_amount, 4)}</td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>{fmt(e.tds_after_bill)}</td>
                        <td style={tdStyle}></td>
                        <td style={tdStyle}></td>
                        <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>{fmt(e.balance_after || e.running_balance)}</td>
                        <td style={tdStyle}></td>
                      </>
                    ) : (
                      <td colSpan={7} style={tdStyle}></td>
                    )}
                  </tr>
                );
              });
            }
            
            if (e.entry_type === "payment" || e.entry_type === "manual_credit") {
              return (
                <tr key={e.id} style={{ background: "#fef9c3" }}>
                  <td style={tdStyle}>{fmtDate(e.entry_date)}</td>
                  <td colSpan={8} style={{...tdStyle, textAlign: "center", fontStyle: "italic"}}>
                    {e.entry_type === "manual_credit" ? `Credit: ${e.description}` : "Payment Received"}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color: "#15803d" }}>{fmt(e.payment_amount)}</td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>{fmtDate(e.payment_date || e.entry_date)}</td>
                  <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>{fmt(e.balance_after || e.running_balance)}</td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>{e.paid_to || ""}</td>
                </tr>
              );
            }
            
            if (e.entry_type === "manual_debit") {
              return (
                <tr key={e.id} style={{ background: "#fef2f2" }}>
                  <td style={tdStyle}>{fmtDate(e.entry_date)}</td>
                  <td style={{ ...tdStyle, textAlign: "center", fontWeight: 700 }}>ADJ+</td>
                  <td colSpan={4} style={tdStyle}>{e.description}</td>
                  <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>{fmt(e.total_bill || e.tds_after_bill)}</td>
                  <td colSpan={4} style={tdStyle}></td>
                  <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>{fmt(e.balance_after || e.running_balance)}</td>
                  <td style={tdStyle}></td>
                </tr>
              );
            }
            
            return null;
          })}
        </tbody>
        <tfoot>
          <tr style={{ background: "#bae6fd", fontWeight: 700 }}>
            <td colSpan={5} style={{ ...tdStyle, textAlign: "center", fontWeight: 800 }}>TOTAL VALUE'S</td>
            <td style={{ ...tdStyle, textAlign: "right" }}>{fmt(totBilled)}</td>
            <td style={{ ...tdStyle, textAlign: "right" }}>{fmt(totBilled)}</td>
            <td style={{ ...tdStyle, textAlign: "right", color: "#b91c1c" }}>{fmt(totTds, 2)}</td>
            <td style={tdStyle}></td>
            <td style={{ ...tdStyle, textAlign: "right" }}>{fmt(totPay)}</td>
            <td colSpan={2} style={{ ...tdStyle, textAlign: "right", fontSize: 12 }}>{fmt(closing)}</td>
            <td style={tdStyle}></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── MAIN MODULE ─────────────────────────────────────────────────────────────
export default function PartyLedgerModule() {
  const [view, setView]           = useState("list");
  const [selectedParty, setParty] = useState(null);
  const [selectedFY, setFY]       = useState("25-26");
  const [showPreview, setPreview] = useState(false);
  const [showPayModal, setPayModal] = useState(false);
  const [showAddParty, setAddParty] = useState(false);
  const [showAddManual, setAddManual] = useState(null);
  const [showSetOB, setSetOB]     = useState(false);
  
  const [parties, setParties]     = useState([]);
  const [ledgerData, setLedgerData] = useState({});
  const [loading, setLoading]     = useState(false);
  const [searchQ, setSearch]      = useState("");
  
  const [payForm, setPayForm] = useState({ date: "", amount: "", paid_to: "", mode: "bank_transfer", reference: "", bill_no: "" });
  const [partyForm, setPartyForm] = useState({ party_name: "", party_alias: "", short_code: "", mobile: "", address: "" });
  const [manualForm, setManualForm] = useState({ date: "", amount: "", description: "" });
  const [obForm, setObForm] = useState({ amount: "" });

  const ALL_FY = ["24-25", "25-26", "26-27"];

  // Filter parties by search
  const filteredParties = parties.filter(p => 
    p.party_name.toLowerCase().includes(searchQ.toLowerCase()) ||
    (p.party_alias || "").toLowerCase().includes(searchQ.toLowerCase())
  );

  // Sortable table for parties list (after filteredParties is defined)
  const { sortedData: sortedParties, requestSort: requestPartySort, getSortIcon: getPartySortIcon } = useSortableTable(
    filteredParties,
    { key: 'party_name', direction: 'asc' }
  );

  // Fetch parties list
  useEffect(() => {
    fetchParties();
  }, [selectedFY]);

  async function fetchParties() {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/api/party-ledger/parties?fy=${selectedFY}`);
      setParties(response.data);
    } catch (error) {
      toast.error("Failed to fetch parties");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  // Fetch ledger detail for a party
  async function fetchLedgerDetail(partyId, fy) {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/api/party-ledger/parties/${partyId}/ledger?fy=${fy}`);
      setLedgerData(prev => ({
        ...prev,
        [partyId]: {
          ...prev[partyId],
          [fy]: response.data
        }
      }));
    } catch (error) {
      toast.error("Failed to fetch ledger");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  // Get current ledger
  const currentLedgerData = selectedParty && ledgerData[selectedParty.id]?.[selectedFY];
  const currentLedger = currentLedgerData?.ledger_account;
  const entries = currentLedgerData?.entries || [];
  const computedEntries = useMemo(() => {
    if (!currentLedger) return [];
    return computeBalances(entries, currentLedger.opening_balance);
  }, [entries, currentLedger]);
  
  const closingBal = currentLedger ? currentLedger.closing_balance : 0;

  // Add payment
  async function addPayment() {
    if (!payForm.date || !payForm.amount) {
      toast.error("Date and amount are required");
      return;
    }
    
    try {
      await axios.post(`${API}/api/party-ledger/parties/${selectedParty.id}/payments`, {
        financial_year: selectedFY,
        payment_date: payForm.date,
        payment_amount: parseFloat(payForm.amount),
        paid_to: payForm.paid_to || selectedParty.short_code,
        payment_mode: payForm.mode,
        payment_reference: payForm.reference,
        invoice_id: payForm.bill_no || null
      });
      
      toast.success("Payment added successfully");
      setPayModal(false);
      setPayForm({ date: "", amount: "", paid_to: "", mode: "bank_transfer", reference: "", bill_no: "" });
      fetchLedgerDetail(selectedParty.id, selectedFY);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to add payment");
    }
  }

  // Add manual entry
  async function addManualEntry() {
    if (!manualForm.date || !manualForm.amount) {
      toast.error("Date and amount are required");
      return;
    }
    
    try {
      await axios.post(`${API}/api/party-ledger/parties/${selectedParty.id}/manual-entry`, {
        financial_year: selectedFY,
        entry_date: manualForm.date,
        entry_type: showAddManual === "debit" ? "manual_debit" : "manual_credit",
        amount: parseFloat(manualForm.amount),
        description: manualForm.description
      });
      
      toast.success(`Manual ${showAddManual} added successfully`);
      setAddManual(null);
      setManualForm({ date: "", amount: "", description: "" });
      fetchLedgerDetail(selectedParty.id, selectedFY);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to add entry");
    }
  }

  // Set opening balance
  async function setOpeningBalance() {
    if (!obForm.amount) {
      toast.error("Opening balance amount is required");
      return;
    }
    
    try {
      await axios.post(`${API}/api/party-ledger/parties/${selectedParty.id}/opening-balance`, {
        financial_year: selectedFY,
        opening_balance: parseFloat(obForm.amount)
      });
      
      toast.success("Opening balance set successfully");
      setSetOB(false);
      setObForm({ amount: "" });
      fetchLedgerDetail(selectedParty.id, selectedFY);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to set opening balance");
    }
  }

  // Export CSV
  function exportCSV() {
    window.open(`${API}/api/party-ledger/parties/${selectedParty.id}/export?fy=${selectedFY}&format=csv`, '_blank');
  }

  // Export Excel
  function exportExcel() {
    window.open(`${API}/api/party-ledger/parties/${selectedParty.id}/export?fy=${selectedFY}&format=excel`, '_blank');
  }

  // ── LIST VIEW ──────────────────────────────────────────────────────────────
  if (view === "list") return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: "#f8fafc", minHeight: "100vh", padding: 24 }}>
      <style>{`
        .row-hover:hover { background: #f1f5f9 !important; }
        button:hover { opacity: 0.88; }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>Party Ledger</div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>Maintain ledger accounts for all parties · Indian Financial Year</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={selectedFY} onChange={e => setFY(e.target.value)}
            style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: 13, background: "#fff", color: "#1e293b" }}>
            {ALL_FY.map(y => <option key={y} value={y}>FY {y}</option>)}
          </select>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {(() => {
          let totOpen=0, totBilled=0, totPaid=0, totClose=0;
          parties.forEach(p => {
            const l = p.ledger || {};
            totOpen += l.opening_balance || 0;
            totBilled += l.total_billed || 0;
            totPaid += l.total_payments || 0;
            totClose += l.closing_balance || 0;
          });
          return [
            { label: "Total Opening Balance", val: totOpen, color: "#0369a1" },
            { label: "Total Billed (FY)", val: totBilled, color: "#7c3aed" },
            { label: "Total Payments (FY)", val: totPaid, color: "#15803d" },
            { label: "Total Outstanding", val: totClose, color: "#dc2626" },
          ].map((c, i) => (
            <div key={i} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 6 }}>{c.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: c.color }}>₹{fmt(c.val)}</div>
            </div>
          ));
        })()}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 14 }}>
        <input value={searchQ} onChange={e => setSearch(e.target.value)} placeholder="Search parties..."
          style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 14px", fontSize: 13, width: 260, outline: "none", background: "#fff" }} />
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40 }}>Loading...</div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f0f9ff", borderBottom: "2px solid #bae6fd" }}>
                {[
                  {label: "Party Name", key: "party_name"},
                  {label: "Alias", key: "party_alias"},
                  {label: "Short Code", key: "short_code"},
                  {label: "Mobile", key: "mobile"},
                  {label: "Opening Bal", key: "ledger.opening_balance"},
                  {label: "Total Billed", key: "ledger.total_billed"},
                  {label: "Payments", key: "ledger.total_payments"},
                  {label: "Closing Balance", key: "ledger.closing_balance"},
                  {label: "Actions", key: null}
                ].map(h => (
                  <th key={h.label} 
                    onClick={() => h.key && requestPartySort(h.key)}
                    style={{ 
                      padding: "12px 14px", 
                      textAlign: "left", 
                      fontWeight: 700, 
                      fontSize: 11, 
                      color: "#0369a1", 
                      letterSpacing: 0.4,
                      cursor: h.key ? 'pointer' : 'default',
                      userSelect: 'none'
                    }}>
                    {h.label.toUpperCase()} {h.key && <span style={{fontSize: 9, color: '#94a3b8'}}>{getPartySortIcon(h.key)}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedParties.map(p => {
                const l = p.ledger || {};
                return (
                  <tr key={p.id} className="row-hover" style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}
                    onClick={() => { setParty(p); fetchLedgerDetail(p.id, selectedFY); setView("detail"); }}>
                    <td style={{ padding: "13px 14px" }}>
                      <div style={{ fontWeight: 700, color: "#0f172a" }}>{p.party_name}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>{p.address}</div>
                    </td>
                    <td style={{ padding: "13px 14px", color: "#64748b" }}>{p.party_alias || "—"}</td>
                    <td style={{ padding: "13px 14px" }}><Chip label={p.short_code || "N/A"} color="blue" /></td>
                    <td style={{ padding: "13px 14px", color: "#64748b" }}>{p.mobile}</td>
                    <td style={{ padding: "13px 14px", color: "#475569", fontWeight: 600 }}>₹{fmt(l.opening_balance || 0)}</td>
                    <td style={{ padding: "13px 14px", color: "#7c3aed", fontWeight: 600 }}>₹{fmt(l.total_billed || 0)}</td>
                    <td style={{ padding: "13px 14px", color: "#15803d", fontWeight: 600 }}>₹{fmt(l.total_payments || 0)}</td>
                    <td style={{ padding: "13px 14px" }}>
                      <span style={{ fontWeight: 800, fontSize: 14, color: (l.closing_balance || 0) > 0 ? "#dc2626" : "#15803d" }}>₹{fmt(l.closing_balance || 0)}</span>
                    </td>
                    <td style={{ padding: "13px 14px" }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => { setParty(p); fetchLedgerDetail(p.id, selectedFY); setView("detail"); }}
                        style={{ background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                        View Ledger
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // ── DETAIL VIEW ────────────────────────────────────────────────────────────
  const totBilled = currentLedger ? currentLedger.total_billed : 0;
  const totTds = currentLedger ? currentLedger.total_tds : 0;
  const totPaid = currentLedger ? currentLedger.total_payments : 0;

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: "#f8fafc", minHeight: "100vh" }}>
      <style>{PRINT_STYLE}</style>

      {/* Top bar */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={() => setView("list")} style={{ background: "#f1f5f9", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, cursor: "pointer", color: "#475569", fontWeight: 600 }}>← All Parties</button>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>{selectedParty.party_name}</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>{selectedParty.party_alias && `${selectedParty.party_alias} · `}FY {selectedFY}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <select value={selectedFY} onChange={e => { setFY(e.target.value); fetchLedgerDetail(selectedParty.id, e.target.value); }}
            style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 10px", fontSize: 13, background: "#f8fafc" }}>
            {ALL_FY.map(y => <option key={y}>{y}</option>)}
          </select>
          <button onClick={() => setPayModal(true)}
            style={{ background: "#15803d", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            + Add Payment
          </button>
          <button onClick={() => setAddManual("debit")}
            style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            + Manual Debit
          </button>
          <button onClick={() => setAddManual("credit")}
            style={{ background: "#0369a1", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            + Manual Credit
          </button>
          <button onClick={() => setSetOB(true)}
            style={{ background: "#475569", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Set Opening Balance
          </button>
          <button onClick={() => setPreview(true)}
            style={{ background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            👁 Preview
          </button>
          <button onClick={exportExcel}
            style={{ background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            ↓ Excel
          </button>
          <button onClick={() => { setPreview(true); setTimeout(() => window.print(), 300); }}
            style={{ background: "#0f172a", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            ↓ PDF
          </button>
        </div>
      </div>

      <div style={{ padding: 24 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40 }}>Loading...</div>
        ) : !currentLedger ? (
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: 48, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📒</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#475569" }}>No ledger for FY {selectedFY}</div>
            <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 6, marginBottom: 20 }}>Set an opening balance to start the ledger for this party.</div>
            <button onClick={() => setSetOB(true)} style={{ background: "#0369a1", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Set Opening Balance
            </button>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}>
              {[
                { label: "Opening Balance", val: currentLedger.opening_balance, color: "#0369a1" },
                { label: "Total Billed", val: totBilled, color: "#7c3aed" },
                { label: "Total TDS Deducted", val: totTds, color: "#d97706" },
                { label: "Total Payments", val: totPaid, color: "#15803d" },
                { label: "Closing Balance", val: closingBal, color: closingBal > 0 ? "#dc2626" : "#15803d" },
              ].map((c, i) => (
                <div key={i} style={{ background: "#fff", border: `1px solid #e2e8f0`, borderRadius: 12, padding: "14px 16px", borderTop: `3px solid ${c.color}` }}>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>{c.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: c.color, marginTop: 4 }}>₹{fmt(c.val)}</div>
                </div>
              ))}
            </div>

            {/* Ledger table */}
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ background: "#e0f2fe", padding: "10px 16px", fontWeight: 700, fontSize: 13, color: "#0369a1", borderBottom: "2px solid #bae6fd" }}>
                Ledger — {selectedParty.party_name} · FY {selectedFY} · Opening Balance: ₹{fmt(currentLedger.opening_balance)}
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#f0f9ff" }}>
                      {["DATE","BILL NO","COUNT","QTY","RATE","AMOUNT","TOTAL BILL","TDS @0.1%","TDS AFTER BILL","PAYMENT","PAY DATE","BALANCE","PAID TO"].map(h => (
                        <th key={h} style={{ padding: "9px 8px", textAlign: h.includes("QTY") || h.includes("RATE") || h.includes("AMOUNT") || h.includes("TOTAL") || h.includes("TDS") || h.includes("PAYMENT") || h.includes("BALANCE") ? "right" : "center", fontWeight: 700, fontSize: 10, color: "#0369a1", borderBottom: "2px solid #bae6fd", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {computedEntries.map((e, ei) => {
                      if (e.entry_type === "opening") return null;
                      
                      if (e.entry_type === "bill") {
                        const lines = e.lines || [];
                        return lines.map((line, li) => {
                          const isLast = li === lines.length - 1;
                          return (
                            <tr key={`${e.id}-${li}`} style={{ background: ei % 2 === 0 ? "#fff" : "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
                              <td style={{ padding: "7px 8px", textAlign: "center", color: "#475569", whiteSpace: "nowrap" }}>{li === 0 ? fmtDate(e.entry_date) : ""}</td>
                              <td style={{ padding: "7px 8px", textAlign: "center", fontWeight: li === 0 ? 700 : 400, color: "#0f172a" }}>{li === 0 ? e.bill_no : ""}</td>
                              <td style={{ padding: "7px 8px", textAlign: "center", color: "#475569" }}>{line.count_value}</td>
                              <td style={{ padding: "7px 8px", textAlign: "right", color: "#475569" }}>{fmt(line.quantity_kg, 3)}</td>
                              <td style={{ padding: "7px 8px", textAlign: "right", color: "#475569" }}>{line.rate}</td>
                              <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 600, color: "#0f172a" }}>{fmt(line.amount)}</td>
                              {isLast ? (<>
                                <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700, color: "#0f172a", background: "#f0f9ff" }}>{fmt(e.total_bill)}</td>
                                <td style={{ padding: "7px 8px", textAlign: "right", color: "#b91c1c" }}>{fmt(e.tds_amount, 4)}</td>
                                <td style={{ padding: "7px 8px", textAlign: "right", color: "#475569" }}>{fmt(e.tds_after_bill)}</td>
                                <td style={{ padding: "7px 8px", textAlign: "right" }}></td>
                                <td style={{ padding: "7px 8px", textAlign: "center" }}></td>
                                <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 800, color: "#0369a1", background: "#f0f9ff" }}>{fmt(e.balance_after || e.running_balance)}</td>
                                <td style={{ padding: "7px 8px", textAlign: "center" }}></td>
                              </>) : (
                                <td colSpan={7} style={{ padding: "7px 8px" }}></td>
                              )}
                            </tr>
                          );
                        });
                      }
                      
                      if (e.entry_type === "payment" || e.entry_type === "manual_credit") {
                        return (
                          <tr key={e.id} style={{ background: "#fef9c3", borderBottom: "2px solid #fde68a" }}>
                            <td style={{ padding: "7px 8px", textAlign: "center", color: "#92400e", fontWeight: 600 }}>{fmtDate(e.entry_date)}</td>
                            <td colSpan={8} style={{ padding: "7px 8px", textAlign: "center", color: "#92400e", fontStyle: "italic" }}>
                              {e.entry_type === "manual_credit" ? `Credit: ${e.description}` : "Payment Received"}
                            </td>
                            <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 800, color: "#15803d", fontSize: 13 }}>{fmt(e.payment_amount)}</td>
                            <td style={{ padding: "7px 8px", textAlign: "center", color: "#92400e" }}>{fmtDate(e.payment_date || e.entry_date)}</td>
                            <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 800, color: "#dc2626", fontSize: 13 }}>{fmt(e.balance_after || e.running_balance)}</td>
                            <td style={{ padding: "7px 8px", textAlign: "center", fontWeight: 700, color: "#0369a1" }}>{e.paid_to}</td>
                          </tr>
                        );
                      }
                      
                      if (e.entry_type === "manual_debit") {
                        return (
                          <tr key={e.id} style={{ background: "#fef2f2", borderBottom: "2px solid #fca5a5" }}>
                            <td style={{ padding: "7px 8px", textAlign: "center", color: "#991b1b", fontWeight: 600 }}>{fmtDate(e.entry_date)}</td>
                            <td style={{ padding: "7px 8px", textAlign: "center", fontWeight: 700, color: "#dc2626" }}>ADJ+</td>
                            <td colSpan={4} style={{ padding: "7px 8px", color: "#991b1b", fontStyle: "italic" }}>{e.description || "Manual Debit"}</td>
                            <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700, color: "#dc2626" }}>{fmt(e.total_bill || e.tds_after_bill)}</td>
                            <td colSpan={4} style={{ padding: "7px 8px" }}></td>
                            <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 800, color: "#dc2626", fontSize: 13 }}>{fmt(e.balance_after || e.running_balance)}</td>
                            <td style={{ padding: "7px 8px" }}></td>
                          </tr>
                        );
                      }
                      
                      return null;
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "#bae6fd", fontWeight: 800 }}>
                      <td colSpan={5} style={{ padding: "10px 8px", textAlign: "center", fontSize: 12, color: "#0369a1" }}>TOTAL VALUE'S</td>
                      <td style={{ padding: "10px 8px", textAlign: "right", color: "#0f172a" }}>{fmt(totBilled)}</td>
                      <td style={{ padding: "10px 8px", textAlign: "right", color: "#0f172a" }}>{fmt(totBilled)}</td>
                      <td style={{ padding: "10px 8px", textAlign: "right", color: "#b91c1c" }}>{fmt(totTds, 2)}</td>
                      <td style={{ padding: "10px 8px" }}></td>
                      <td style={{ padding: "10px 8px", textAlign: "right", color: "#15803d" }}>{fmt(totPaid)}</td>
                      <td colSpan={2} style={{ padding: "10px 8px", textAlign: "right", color: "#dc2626", fontSize: 14 }}>{fmt(closingBal)}</td>
                      <td style={{ padding: "10px 8px" }}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── PREVIEW MODAL ──────────────────────────────────────────────── */}
      {showPreview && currentLedger && (
        <Modal title={`Ledger Preview — ${selectedParty.party_name} · FY ${selectedFY}`} onClose={() => setPreview(false)} wide>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, justifyContent: "flex-end" }}>
            <button onClick={exportCSV} style={{ background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0", borderRadius: 7, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>↓ Download Excel</button>
            <button onClick={() => window.print()} style={{ background: "#0f172a", color: "#fff", border: "none", borderRadius: 7, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>↓ Print / Save PDF</button>
          </div>
          <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
            <LedgerPrintView party={selectedParty} fy={selectedFY} entries={entries} opening={currentLedger.opening_balance} />
          </div>
        </Modal>
      )}

      {/* ── ADD PAYMENT MODAL ──────────────────────────────────────────── */}
      {showPayModal && (
        <Modal title={`Add Payment — ${selectedParty.party_name}`} onClose={() => setPayModal(false)}>
          <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
            <span style={{ color: "#166534", fontWeight: 700 }}>Current Balance: </span>
            <span style={{ color: "#dc2626", fontWeight: 800, fontSize: 15 }}>₹{fmt(closingBal)}</span>
          </div>
          <Field label="Payment Date" value={payForm.date} onChange={v => setPayForm(p => ({...p, date: v}))} type="date" required />
          <Field label="Payment Amount (₹)" value={payForm.amount} onChange={v => setPayForm(p => ({...p, amount: v}))} type="number" required />
          <Field label="Paid To (Short Code)" value={payForm.paid_to || selectedParty.short_code} onChange={v => setPayForm(p => ({...p, paid_to: v}))} hint={`Default: ${selectedParty.short_code}`} />
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>Payment Mode</div>
            <select value={payForm.mode} onChange={e => setPayForm(p => ({...p, mode: e.target.value}))}
              style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 7, padding: "8px 12px", fontSize: 13 }}>
              {["bank_transfer","cash","cheque","upi"].map(m => <option key={m} value={m}>{m.replace("_"," ").toUpperCase()}</option>)}
            </select>
          </div>
          <Field label="Reference No (UTR / Cheque)" value={payForm.reference} onChange={v => setPayForm(p => ({...p, reference: v}))} />
          {payForm.amount && (
            <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13 }}>
              <span style={{ color: "#991b1b", fontWeight: 700 }}>Balance after payment: </span>
              <span style={{ color: "#dc2626", fontWeight: 800 }}>₹{fmt(closingBal - parseFloat(payForm.amount || 0))}</span>
            </div>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button onClick={() => setPayModal(false)} style={{ flex: 1, padding: "10px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 13 }}>Cancel</button>
            <button onClick={addPayment} style={{ flex: 2, padding: "10px", background: "#15803d", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
              Save Payment
            </button>
          </div>
        </Modal>
      )}

      {/* ── MANUAL ENTRY MODAL ─────────────────────────────────────────── */}
      {showAddManual && (
        <Modal title={`Manual ${showAddManual === "debit" ? "Debit (adds to balance)" : "Credit (reduces balance)"}`} onClose={() => setAddManual(null)}>
          <div style={{ background: showAddManual === "debit" ? "#fef2f2" : "#f0fdf4", border: `1px solid ${showAddManual === "debit" ? "#fca5a5" : "#86efac"}`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: showAddManual === "debit" ? "#991b1b" : "#166534" }}>
            {showAddManual === "debit" ? "⬆ Debit increases the outstanding balance (e.g. additional charges)" : "⬇ Credit reduces the outstanding balance (e.g. discount, write-off)"}
          </div>
          <Field label="Date" value={manualForm.date} onChange={v => setManualForm(p => ({...p, date: v}))} type="date" required />
          <Field label="Amount (₹)" value={manualForm.amount} onChange={v => setManualForm(p => ({...p, amount: v}))} type="number" required />
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>Description <span style={{ color: "#ef4444" }}>*</span></div>
            <textarea value={manualForm.description} onChange={e => setManualForm(p => ({...p, description: e.target.value}))} rows={3}
              style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 7, padding: "8px 12px", fontSize: 13, resize: "vertical", boxSizing: "border-box" }} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setAddManual(null)} style={{ flex: 1, padding: "10px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 13 }}>Cancel</button>
            <button onClick={addManualEntry} style={{ flex: 2, padding: "10px", background: showAddManual === "debit" ? "#dc2626" : "#0369a1", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
              Save {showAddManual === "debit" ? "Debit" : "Credit"} Entry
            </button>
          </div>
        </Modal>
      )}

      {/* ── SET OPENING BALANCE MODAL ──────────────────────────────────── */}
      {showSetOB && (
        <Modal title={`Set Opening Balance — ${selectedParty.party_name} · FY ${selectedFY}`} onClose={() => setSetOB(false)}>
          <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#0369a1" }}>
            This is the amount this party owed at the start of FY {selectedFY} (carry-forward from previous year, or initial entry for new party).
          </div>
          <Field label="Opening Balance (₹)" value={obForm.amount} onChange={v => setObForm(p => ({...p, amount: v}))} type="number" required 
            hint={currentLedger ? `Current: ₹${fmt(currentLedger.opening_balance)}` : "This will create a new ledger"} />
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button onClick={() => setSetOB(false)} style={{ flex: 1, padding: "10px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 13 }}>Cancel</button>
            <button onClick={setOpeningBalance} style={{ flex: 2, padding: "10px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
              Set Opening Balance
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
