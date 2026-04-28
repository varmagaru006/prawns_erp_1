import React, { useEffect, useMemo, useState, useCallback } from 'react';
import axios from 'axios';
import { API } from '../context/AuthContext';
import { useFeatureFlags } from '../context/FeatureFlagContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { formatLoadErrorMessage, isRequestCanceled } from '../utils/apiError';
import {
  Package, Weight, DollarSign, Factory, Box, AlertTriangle, TrendingUp,
  ArrowUpRight, ArrowDownRight, Minus, RefreshCw, ExternalLink,
  ShieldAlert, BarChart2, Globe, Bell, Zap, CheckCircle2
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const RAG_STYLES = {
  green:  { dot: 'bg-green-500',  border: 'border-green-200', text: 'text-green-700', bg: 'bg-green-50' },
  amber:  { dot: 'bg-amber-500',  border: 'border-amber-200', text: 'text-amber-700', bg: 'bg-amber-50' },
  red:    { dot: 'bg-red-500',    border: 'border-red-200',   text: 'text-red-700',   bg: 'bg-red-50' },
  info:   { dot: 'bg-blue-400',   border: 'border-blue-200',  text: 'text-blue-700',  bg: 'bg-blue-50' },
};

const SEVERITY_STYLES = {
  critical: { bar: 'border-l-red-500',    badge: 'bg-red-100 text-red-700',    icon: 'text-red-500' },
  warning:  { bar: 'border-l-amber-500',  badge: 'bg-amber-100 text-amber-700', icon: 'text-amber-500' },
  info:     { bar: 'border-l-blue-400',   badge: 'bg-blue-100 text-blue-700',   icon: 'text-blue-500' },
};

// ─── Sub-components ────────────────────────────────────────────────────────────

function SmartKPICard({ card }) {
  const rag = RAG_STYLES[card.rag] || RAG_STYLES.info;
  const hasMoM = card.mom_pct !== null && card.mom_pct !== undefined;
  const momUp = hasMoM && card.mom_pct >= 0;
  const hasSparkline = card.sparkline && card.sparkline.length > 1;
  const sparkData = hasSparkline ? card.sparkline.map((v, i) => ({ i, v })) : [];

  return (
    <Card className={`border ${rag.border} hover:shadow-lg transition-all duration-200`}>
      <CardHeader className="pb-1 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            {card.title}
          </CardTitle>
          <span className={`h-2 w-2 rounded-full ${rag.dot}`} title={card.rag} />
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <div className="flex items-end justify-between gap-2">
          <div>
            <span className="text-2xl font-bold text-slate-800">
              {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
            </span>
            {card.unit && <span className="text-sm text-slate-500 ml-1">{card.unit}</span>}
          </div>
          {hasMoM && (
            <span className={`flex items-center text-xs font-medium px-1.5 py-0.5 rounded ${
              momUp ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'
            }`}>
              {momUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(card.mom_pct)}%
            </span>
          )}
        </div>
        {hasSparkline && (
          <div className="mt-2 h-8">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <Line type="monotone" dataKey="v" stroke="#3b82f6" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="text-xs text-slate-400 mt-1">{card.description}</p>
      </CardContent>
    </Card>
  );
}

function AlertFeed({ data }) {
  if (!data) return <CardSkeleton />;
  const { alerts = [], counts = {} } = data;
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4 text-red-500" />
          Business Alerts
          <div className="ml-auto flex gap-1">
            {counts.critical > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">
                {counts.critical} critical
              </span>
            )}
            {counts.warning > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">
                {counts.warning} warning
              </span>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400">
            <CheckCircle2 className="h-10 w-10 mb-2 text-green-400" />
            <p className="text-sm font-medium text-green-600">All clear — no active alerts</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {alerts.map(alert => {
              const s = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.info;
              return (
                <div key={alert.id}
                  className={`border-l-4 ${s.bar} pl-3 py-2 bg-slate-50 rounded-r-md`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{alert.title}</p>
                      {alert.detail && (
                        <p className="text-xs text-slate-500 mt-0.5 leading-snug">{alert.detail}</p>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${s.badge}`}>
                      {alert.severity}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FraudSignals({ data }) {
  if (!data) return <CardSkeleton />;
  const { signals = [] } = data;
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="h-4 w-4 text-purple-500" />
          Fraud & Anomaly Signals
          {signals.length > 0 && (
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold">
              {signals.length} signal{signals.length > 1 ? 's' : ''}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {signals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400">
            <ShieldAlert className="h-10 w-10 mb-2 text-green-400" />
            <p className="text-sm font-medium text-green-600">No anomalies detected</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {signals.map((sig, i) => (
              <div key={i} className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{sig.title}</p>
                    <p className="text-xs text-slate-600 mt-0.5">{sig.detail}</p>
                    {sig.stats && (
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {sig.stats.zscore !== undefined && (
                          <span className="text-xs bg-purple-200 text-purple-800 px-1.5 py-0.5 rounded font-mono">
                            z={sig.stats.zscore}
                          </span>
                        )}
                        {sig.stats.deviation_pct !== undefined && (
                          <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-mono">
                            {sig.stats.deviation_pct > 0 ? '+' : ''}{sig.stats.deviation_pct}%
                          </span>
                        )}
                        {sig.stats.share_pct !== undefined && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-mono">
                            {sig.stats.share_pct}% share
                          </span>
                        )}
                      </div>
                    )}
                    {sig.affected_lots?.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {sig.affected_lots.slice(0, 3).map((lot, j) => (
                          <span key={j} className="text-xs bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                            {lot}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MarketNews({ data }) {
  if (!data) return <CardSkeleton />;
  const { news = [], price_vs_cost = [] } = data;
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe className="h-4 w-4 text-teal-500" />
          Market Intelligence
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-4">
        {price_vs_cost.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Price vs Cost</p>
            <div className="space-y-1.5">
              {price_vs_cost.slice(0, 3).map((p, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">{p.species} {p.product_form || 'raw'}</span>
                  <span className={`font-semibold ${p.margin_pct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {p.margin_pct > 0 ? '+' : ''}{p.margin_pct}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {news.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Industry News</p>
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {news.map((item, i) => (
                <a key={i} href={item.url} target="_blank" rel="noreferrer"
                  className="block bg-slate-50 rounded-md p-2 hover:bg-teal-50 transition-colors group">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-xs font-medium text-teal-600">{item.source}</span>
                    <ExternalLink className="h-3 w-3 text-slate-400 group-hover:text-teal-500" />
                  </div>
                  <p className="text-xs font-medium text-slate-800 leading-snug line-clamp-2">
                    {item.title}
                  </p>
                </a>
              ))}
            </div>
          </div>
        )}
        {news.length === 0 && price_vs_cost.length === 0 && (
          <div className="py-6 text-center text-slate-400 text-sm">
            Add market rates to see price vs cost analysis
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MoMChart({ data }) {
  if (!data?.length) return <ChartEmpty />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }} barCategoryGap="25%">
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="month" stroke="#94a3b8" tick={{ fontSize: 11 }} />
        <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v) => v.toLocaleString()} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="procurement_weight_kg" name="Procurement (KG)" fill="#3b82f6" radius={[4,4,0,0]} />
        <Bar dataKey="fg_output_kg" name="FG Output (KG)" fill="#10b981" radius={[4,4,0,0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function SpeciesTrendChart({ data }) {
  if (!data?.length) return <ChartEmpty />;
  const species = ['Vannamei', 'Black Tiger', 'Sea Tiger'];
  const speciesColors = { 'Vannamei': '#3b82f6', 'Black Tiger': '#f59e0b', 'Sea Tiger': '#8b5cf6' };
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="month" stroke="#94a3b8" tick={{ fontSize: 11 }} />
        <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v) => `${v.toLocaleString()} KG`} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {species.map(s => (
          <Area key={s} type="monotone" dataKey={s} name={s} stackId="s"
            stroke={speciesColors[s]} fill={speciesColors[s]} fillOpacity={0.55} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

function PartyBalancesChart({ data }) {
  if (!data?.length) return <ChartEmpty />;
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
        <XAxis type="number" stroke="#94a3b8" tick={{ fontSize: 11 }}
          tickFormatter={v => `₹${(v/100000).toFixed(1)}L`} />
        <YAxis type="category" dataKey="party_name" stroke="#94a3b8"
          tick={{ fontSize: 11 }} width={140} />
        <Tooltip formatter={(v) => `₹${v.toLocaleString()}`} />
        <Bar dataKey="balance_inr" name="Outstanding (₹)" fill="#ef4444" radius={[0,4,4,0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ProcessingEfficiencyChart({ data }) {
  if (!data?.length) return <ChartEmpty />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="month" stroke="#94a3b8" tick={{ fontSize: 11 }} />
        <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} domain={[0, 100]}
          tickFormatter={v => `${v}%`} />
        <Tooltip formatter={(v) => `${v}%`} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="preprocessing_yield_pct" name="Pre-processing Yield"
          stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="production_conversion_pct" name="Production Conversion"
          stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ChartEmpty() {
  return (
    <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
      Not enough data yet
    </div>
  );
}

function CardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
          <div className="h-8 w-20 bg-slate-200 rounded animate-pulse" />
          <div className="h-3 w-full bg-slate-100 rounded animate-pulse" />
        </div>
      </CardContent>
    </Card>
  );
}

function SectionHeader({ icon: Icon, title, color = 'text-slate-600' }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className={`h-5 w-1 rounded-full bg-current ${color}`} />
      {Icon && <Icon className={`h-5 w-5 ${color}`} />}
      <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
    </div>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────

const Dashboard = () => {
  const { isEnabled } = useFeatureFlags();

  const showAlerts = isEnabled('dashboardAlerts');
  const showFraud  = isEnabled('dashboardFraudSignals');
  const showBI     = isEnabled('dashboardBICharts');
  const showMarket = isEnabled('dashboardMarketIntelligence');

  const [overview, setOverview]     = useState(null);
  const [kpis, setKpis]             = useState(null);
  const [alerts, setAlerts]         = useState(null);
  const [fraudSignals, setFraud]    = useState(null);
  const [biCharts, setBiCharts]     = useState(null);
  const [marketIntel, setMarket]    = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    setRefreshing(true);
    const fetches = [
      axios.get(`${API}/dashboard/overview`).then(r => setOverview(r.data)).catch(() => {}),
      axios.get(`${API}/dashboard/kpis`).then(r => setKpis(r.data)).catch(() => {}),
    ];
    if (showAlerts)  fetches.push(axios.get(`${API}/dashboard/alerts`).then(r => setAlerts(r.data)).catch(() => {}));
    if (showFraud)   fetches.push(axios.get(`${API}/dashboard/fraud-signals`).then(r => setFraud(r.data)).catch(() => {}));
    if (showBI)      fetches.push(axios.get(`${API}/dashboard/bi-charts`).then(r => setBiCharts(r.data)).catch(() => {}));
    if (showMarket)  fetches.push(axios.get(`${API}/dashboard/market-intelligence`).then(r => setMarket(r.data)).catch(() => {}));
    await Promise.allSettled(fetches);
    setLastRefresh(new Date());
    setRefreshing(false);
  }, [showAlerts, showFraud, showBI, showMarket]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 120000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // Legacy chart data from overview
  const lots    = overview?.lots    || [];
  const batches = overview?.batches || [];
  const livePrices = overview?.live_prices || [];

  const speciesData = useMemo(() => {
    const bucket = new Map();
    for (const lot of lots) {
      const key = lot?.species || 'Unknown';
      bucket.set(key, (bucket.get(key) || 0) + (lot?.net_weight_kg || 0));
    }
    return Array.from(bucket.entries()).map(([name, value]) => ({ name, value }));
  }, [lots]);

  const paymentStatusData = useMemo(() => {
    const bucket = new Map();
    for (const lot of lots) {
      const key = lot?.payment_status || 'unknown';
      const ex = bucket.get(key) || { value: 0, amount: 0 };
      ex.value += 1; ex.amount += lot?.total_amount || 0;
      bucket.set(key, ex);
    }
    return Array.from(bucket.entries()).map(([name, agg]) => ({ name, ...agg }));
  }, [lots]);

  const yieldTrendData = useMemo(() => (
    batches.map((b, i) => ({ name: `B${i + 1}`, yield: b.yield_pct, target: 80 }))
  ), [batches]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg">
        <p className="font-medium text-slate-800 text-sm">{label}</p>
        {payload.map((entry, i) => (
          <p key={i} className="text-xs mt-0.5" style={{ color: entry.color }}>
            {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
            {entry.name?.includes('yield') ? '%' : ''}
          </p>
        ))}
      </div>
    );
  };

  const alertCount = alerts?.counts ? (alerts.counts.critical || 0) + (alerts.counts.warning || 0) : 0;

  return (
    <div className="space-y-8 animate-fadeIn" data-testid="dashboard-page">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Dashboard</h1>
          <p className="text-slate-500 mt-1 text-sm">
            {lastRefresh ? `Last updated ${lastRefresh.toLocaleTimeString()}` : 'Loading…'}
          </p>
        </div>
        <button onClick={fetchAll} disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors">
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── Section 1: Smart KPI Cards ── */}
      <div>
        <SectionHeader icon={Zap} title="Key Metrics" color="text-blue-600" />
        {!kpis ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 9 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {kpis.cards.map(card => <SmartKPICard key={card.key} card={card} />)}
          </div>
        )}
      </div>

      {/* ── Section 2: Alerts + Fraud + Market ── */}
      {(showAlerts || showFraud || showMarket) && (
        <div>
          <SectionHeader icon={Bell} title="Alerts & Intelligence" color="text-red-500" />
          <div className={`grid gap-4 ${
            [showAlerts, showFraud, showMarket].filter(Boolean).length === 3
              ? 'grid-cols-1 lg:grid-cols-3'
              : [showAlerts, showFraud, showMarket].filter(Boolean).length === 2
              ? 'grid-cols-1 lg:grid-cols-2'
              : 'grid-cols-1'
          }`}>
            {showAlerts  && <AlertFeed data={alerts} />}
            {showFraud   && <FraudSignals data={fraudSignals} />}
            {showMarket  && <MarketNews data={marketIntel} />}
          </div>
        </div>
      )}

      {/* ── Section 3: BI Charts ── */}
      {showBI && (
        <div>
          <SectionHeader icon={BarChart2} title="Business Intelligence" color="text-purple-600" />
          {!biCharts ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}><CardContent className="p-4">
                  <div className="h-64 bg-slate-100 rounded animate-pulse" />
                </CardContent></Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">
                    Month-over-Month Comparison
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <MoMChart data={biCharts.mom_comparison} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">
                    Species Mix Trend (12 months)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <SpeciesTrendChart data={biCharts.species_trend} />
                </CardContent>
              </Card>
              {biCharts.top_party_balances?.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-slate-600">
                      Top Outstanding Party Balances
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <PartyBalancesChart data={biCharts.top_party_balances} />
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">
                    Processing Efficiency Trend
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ProcessingEfficiencyChart data={biCharts.processing_efficiency} />
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ── Section 4: Legacy Charts (always visible) ── */}
      <div>
        <SectionHeader icon={TrendingUp} title="Operations Overview" color="text-green-600" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <div className="h-4 w-1 bg-blue-600 rounded" />
                Species Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              {speciesData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={speciesData} cx="50%" cy="50%" outerRadius={100}
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      dataKey="value" animationDuration={600}>
                      {speciesData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <ChartEmpty />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <div className="h-4 w-1 bg-green-600 rounded" />
                Payment Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {paymentStatusData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={paymentStatusData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 12 }} />
                    <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" fill="#10b981" radius={[6, 6, 0, 0]} animationDuration={600} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <ChartEmpty />}
            </CardContent>
          </Card>

          {yieldTrendData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-600">
                  <div className="h-4 w-1 bg-purple-600 rounded" />
                  Yield Performance Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={yieldTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 12 }} />
                    <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line type="monotone" dataKey="yield" stroke="#8b5cf6" strokeWidth={2.5}
                      dot={{ r: 4 }} activeDot={{ r: 7 }} animationDuration={600} />
                    <Line type="monotone" dataKey="target" stroke="#94a3b8"
                      strokeDasharray="5 5" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Live Prices */}
          {livePrices.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-600">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  Live Prawn Prices — Andhra Pradesh
                  <span className="ml-auto text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                    Live
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {livePrices.map((price, i) => (
                    <div key={i}
                      className="border border-slate-200 rounded-xl p-3 hover:border-green-400 transition-colors">
                      <p className="text-xs font-medium text-slate-600 mb-1">{price.category}</p>
                      <div className="text-2xl font-bold text-green-600">₹{price.price_per_kg?.toFixed(0)}</div>
                      <p className="text-xs text-slate-400 mt-1">per KG · {price.market}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ── Section 5: Recent Activity ── */}
      {overview?.stats?.recent_activities?.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <Package className="h-4 w-4 text-blue-600" />
              Recent Activities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {overview.stats.recent_activities.map((activity, i) => (
                <div key={i}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-blue-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <Package className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{activity.description}</p>
                      <p className="text-xs text-slate-400">{new Date(activity.timestamp).toLocaleString()}</p>
                    </div>
                  </div>
                  <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">{activity.type}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;
