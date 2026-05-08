import { useEffect, useMemo, useState } from "react";
import Trends from "./Trends";
import DailyTab from "./Daily";
import EntryForm from "./EntryForm";
import logo from "@/assets/netscribes-logo.png";
import { supabase } from "@/integrations/supabase/client";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  XAxis,
  YAxis,
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
} from "recharts";

declare global {
  interface Window {
    pako?: { inflate: (data: Uint8Array, opts: { to: "string" }) => string };
  }
}

function loadPako(): Promise<NonNullable<Window["pako"]>> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.pako) return Promise.resolve(window.pako);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-pako="1"]');
    const onReady = () => {
      if (window.pako) resolve(window.pako);
      else reject(new Error("pako failed to load"));
    };
    if (existing) {
      existing.addEventListener("load", onReady);
      existing.addEventListener("error", () => reject(new Error("pako script error")));
      return;
    }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js";
    s.async = true;
    s.dataset.pako = "1";
    s.onload = onReady;
    s.onerror = () => reject(new Error("pako script error"));
    document.head.appendChild(s);
  });
}

type Platform = "flipkart" | "myntra";

const CREDS: Record<string, { password: string; platform: Platform }> = {
  "flipkart@netscribes.com": { password: "fk@ugc2025", platform: "flipkart" as Platform },
  "myntra@netscribes.com": { password: "myn@ugc2025", platform: "myntra" as Platform },
};

const COLORS = {
  primary: "#1A56DB",
  danger: "#E02424",
  success: "#057A55",
  amber: "#D97706",
  bg: "#F8F9FA",
  border: "#E5E7EB",
  text: "#111827",
  muted: "#6B7280",
};

const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 8,
  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  padding: 20,
};

function tatToHours(tat: string | null | undefined): number | null {
  if (!tat) return null;
  const [h, m, s] = tat.split(":").map(Number);
  return h + m / 60 + s / 3600;
}

function fmtNum(n: number): string {
  return Math.round(n).toLocaleString();
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function computeKpis(rows: any[]) {
  const inflow = rows.reduce((a, r) => a + (Number(r.total_received) || 0), 0);
  const outflow = rows.reduce((a, r) => a + (Number(r.total_delivered) || 0), 0);
  const tats = rows.map((r) => tatToHours(r.tat)).filter((v): v is number => v != null && !isNaN(v));
  const avg = tats.length ? tats.reduce((a, b) => a + b, 0) / tats.length : 0;
  const sorted = [...tats].sort((a, b) => a - b);
  const p95 = percentile(sorted, 95);
  const over24 = tats.filter((v) => v > 24).length;
  return { inflow, outflow, avg, p95, over24, tatCount: tats.length };
}

function KpiCard({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={card}>
      <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: valueColor || "#111827" }}>{value}</div>
    </div>
  );
}

function KpiRow({ rows }: { rows: any[] }) {
  const k = computeKpis(rows);
  const p95Color = k.p95 > 24 ? COLORS.danger : "#111827";
  const over24Color = k.over24 > 20 ? COLORS.danger : k.over24 <= 10 ? COLORS.success : COLORS.amber;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
      <KpiCard label="Total Inflow" value={fmtNum(k.inflow)} />
      <KpiCard label="Total Outflow" value={fmtNum(k.outflow)} />
      <KpiCard label="Avg TAT" value={`${k.avg.toFixed(1)}h`} />
      <KpiCard label="Peak TAT" value={`${k.p95.toFixed(1)}h`} valueColor={p95Color} />
      <KpiCard label="Days TAT > 24h" value={String(k.over24)} valueColor={over24Color} />
    </div>
  );
}

function Login({ onLogin, error, loading }: { onLogin: (e: string, p: string) => void; error: string; loading: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ ...card, width: "100%", maxWidth: 400 }}>
        <img src={logo} alt="Netscribes" style={{ height: 40, width: "auto", display: "block", marginBottom: 12 }} />
        <p style={{ color: COLORS.muted, fontSize: 14, marginBottom: 24 }}>UGC Moderation Dashboard</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onLogin(email.trim().toLowerCase(), password);
          }}
        >
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: "100%", padding: "10px 12px", border: `1px solid ${COLORS.border}`, borderRadius: 8, marginBottom: 14, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }}
          />
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: "100%", padding: "10px 12px", border: `1px solid ${COLORS.border}`, borderRadius: 8, marginBottom: 14, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }}
          />
          {error && <div style={{ color: COLORS.danger, fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <button
            type="submit"
            disabled={loading}
            style={{ width: "100%", padding: "10px 12px", background: COLORS.primary, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: loading ? "wait" : "pointer", fontFamily: "inherit" }}
          >
            {loading ? "Loading data..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Nav({ platform, onLogout, tab, setTab }: { platform: Platform; onLogout: () => void; tab: string; setTab: (t: string) => void }) {
  const badgeColor = platform === "flipkart" ? COLORS.primary : COLORS.danger;
  const badgeText = platform === "flipkart" ? "Flipkart UGC" : "Myntra UGC";
  const tabs = ["Overview", "Trends", "Daily", "Entry Form"];
  return (
    <div style={{ background: "#fff", borderBottom: `1px solid ${COLORS.border}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 24px" }}>
        <img src={logo} alt="Netscribes" style={{ height: 32, width: "auto", display: "block" }} />
        <div style={{ background: badgeColor, color: "#fff", padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>{badgeText}</div>
        <button
          onClick={onLogout}
          style={{ padding: "8px 14px", background: "#fff", color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
        >
          Logout
        </button>
      </div>
      <div style={{ display: "flex", gap: 4, padding: "0 24px" }}>
        {tabs.map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "10px 16px",
                background: "transparent",
                color: active ? badgeColor : COLORS.muted,
                border: "none",
                borderBottom: active ? `3px solid ${badgeColor}` : "3px solid transparent",
                fontSize: 14,
                fontWeight: active ? 600 : 500,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {t}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function getDateField(r: any): string | null {
  for (const k of ["date", "Date", "created_at", "createdAt", "timestamp", "day"]) {
    if (r && r[k]) return String(r[k]).slice(0, 10);
  }
  return null;
}

function getStatus(r: any): string {
  for (const k of ["status", "Status", "moderation_status", "decision", "verdict"]) {
    if (r && r[k]) return String(r[k]);
  }
  return "unknown";
}

function Overview({ records, platform }: { records: any[]; platform: Platform }) {
  const { latestRows, minDate, maxDate, count } = useMemo(() => {
    const dates = records.map((r) => r.date).filter(Boolean).sort();
    const years = records.map((r) => Number(r.year)).filter((y) => !isNaN(y));
    const maxYear = years.length ? Math.max(...years) : null;
    const latestRows = maxYear != null ? records.filter((r) => Number(r.year) === maxYear) : [];
    return {
      latestRows,
      minDate: dates[0] || "—",
      maxDate: dates[dates.length - 1] || "—",
      count: records.length,
    };
  }, [records]);

  const heading: React.CSSProperties = { fontSize: 18, color: "#111827", fontWeight: 600, margin: "0 0 12px" };
  const cardHeading: React.CSSProperties = { fontSize: 16, color: "#111827", fontWeight: 600, margin: "0 0 12px" };

  if (!records || records.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 80, gap: 16 }}>
        <div className="ugc-spinner" />
        <div style={{ color: "#6B7280", fontSize: 14 }}>Loading data...</div>
      </div>
    );
  }

  const allKpis = computeKpis(records);

  // TAT health buckets
  const tatValues = records
    .map((r) => tatToHours(r.tat))
    .filter((v): v is number => v != null && !isNaN(v));
  const under8 = tatValues.filter((v) => v < 8).length;
  const mid = tatValues.filter((v) => v >= 8 && v <= 24).length;
  const over24 = tatValues.filter((v) => v > 24).length;
  const total = tatValues.length || 1;

  // Content mix
  const sumField = (field: string) =>
    records.reduce((a, r) => a + (Number(r[field]) || 0), 0);
  const mixRaw = platform === "flipkart"
    ? [
        { name: "Text", value: sumField("in_text_total") },
        { name: "Image", value: sumField("in_image_total") },
        { name: "Question", value: sumField("in_question") },
        { name: "Answer", value: sumField("in_answer") },
        { name: "Video", value: sumField("in_video") },
      ]
    : [
        { name: "Text", value: sumField("in_text_total") },
        { name: "Image", value: sumField("in_image_total") },
        { name: "Video", value: sumField("in_video") },
      ];
  const pieColors = ["#1A56DB", "#7E3AF2", "#057A55", "#D97706", "#E02424"];
  const mixWithColor = mixRaw
    .map((m, i) => ({ ...m, color: pieColors[i] }))
    .filter((m) => m.value > 0);
  const grandTotal = mixWithColor.reduce((a, m) => a + m.value, 0) || 1;

  // Last 7 days
  const last7 = [...records]
    .filter((r) => r.date)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 7)
    .reverse()
    .map((r) => ({
      date: String(r.date).slice(5),
      inflow: Number(r.total_received) || 0,
      outflow: Number(r.total_delivered) || 0,
      tat: tatToHours(r.tat) ?? 0,
    }));
  const compactNum = (v: number) =>
    v >= 1000 ? (v / 1000).toFixed(0) + "K" : String(v);
  const tooltipStyle = {
    background: "#fff",
    border: "1px solid #E5E7EB",
    borderRadius: 8,
    fontSize: 12,
  };

  const cardBox: React.CSSProperties = card;

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div>
        <h2 style={heading}>2025–Present Summary</h2>
        <KpiRow rows={records} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <div style={cardBox}>
          <h3 style={cardHeading}>Inflow Content Mix — 2025–Present</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
            <PieChart width={320} height={260}>
              <Pie data={mixWithColor} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} cx="50%" cy="50%">
                {mixWithColor.map((m, i) => (
                  <Cell key={i} fill={m.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12, color: "#374151" }}>
              {mixWithColor.map((m) => (
                <div key={m.name} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 10, height: 10, background: m.color, display: "inline-block" }} />
                  {m.name} — {m.value.toLocaleString()} ({((m.value / grandTotal) * 100).toFixed(1)}%)
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={cardBox}>
          <h3 style={cardHeading}>TAT Health Distribution</h3>
          <div style={{ display: "flex", gap: 16, alignItems: "stretch", height: 260 }}>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", fontSize: 11, color: "#6B7280", textAlign: "right" }}>
              <span>Over 24h</span>
              <span>Under 8h</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", width: 40, borderRadius: 8, overflow: "hidden" }}>
              <div style={{ background: "#E02424", height: `${(over24 / total) * 100}%` }} />
              <div style={{ background: "#D97706", height: `${(mid / total) * 100}%` }} />
              <div style={{ background: "#057A55", height: `${(under8 / total) * 100}%` }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 12, color: "#374151", justifyContent: "center" }}>
              {[
                { c: "#E02424", label: "Over 24h", n: over24 },
                { c: "#D97706", label: "8–24h", n: mid },
                { c: "#057A55", label: "Under 8h", n: under8 },
              ].map((it) => (
                <div key={it.label} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: it.c, display: "inline-block" }} />
                  <span>{it.label}<br /><span style={{ color: "#6B7280", fontSize: 11 }}>{((it.n / total) * 100).toFixed(0)}% ({it.n} days)</span></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ background: "#F3F4F6", borderRadius: 8, padding: 16 }}>
        <h2 style={heading}>Latest Year Summary</h2>
        <KpiRow rows={latestRows} />
      </div>

      <div style={cardBox}>
        <h3 style={cardHeading}>Last 7 Days</h3>
        <div style={{ display: "flex", gap: 16, fontSize: 12, marginBottom: 8, color: "#374151" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "#1A56DB" }}>●</span> Inflow
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "#7E3AF2" }}>●</span> Outflow
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "#D97706" }}>●</span> TAT (h)
          </span>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={last7}>
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left" tickFormatter={compactNum} tick={{ fontSize: 11 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}h`} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar yAxisId="left" dataKey="inflow" fill="#1A56DB" radius={[4, 4, 0, 0]} />
            <Bar yAxisId="left" dataKey="outflow" fill="#7E3AF2" radius={[4, 4, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="tat" stroke="#D97706" strokeWidth={2} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div style={{ fontSize: 12, fontStyle: "italic", color: "#6B7280" }}>
        Data from {minDate} to {maxDate}. {count} days on record.
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("Overview");

  const handleLogin = async (email: string, password: string) => {
    const c = CREDS[email];
    if (!c || c.password !== password) {
      setError("Invalid credentials. Please try again.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const url = c.platform === "flipkart" ? "/flipkart_ugc.gz.bin" : "/myntra_ugc.gz.bin";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load data");
      const buf = await res.arrayBuffer();
      const pako = await loadPako();
      const text = pako.inflate(new Uint8Array(buf), { to: "string" });
      const data = JSON.parse(text);
      const table = c.platform === "flipkart" ? "flipkart_ugc_entries" : "myntra_ugc_entries";
      const { data: manualRows, error: sbError } = await supabase
        .from(table)
        .select("*")
        .order("date", { ascending: true });

      if (sbError) console.warn("Supabase fetch error:", sbError.message);

      const allRows = [
        ...(Array.isArray(data) ? data : data.records || data.data || []),
        ...(manualRows || []),
      ];

      // Deduplicate by date — Supabase row wins over .gz row for same date
      const byDate = new Map<string, any>();
      for (const r of allRows) {
        const d = r.date ? String(r.date).slice(0, 10) : null;
        if (d) byDate.set(d, { ...r, date: d });
      }
      const merged = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));

      setRecords(merged);
      setPlatform(c.platform);
      setTab("Overview");
    } catch (e: any) {
      setError(e?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setRecords([]);
    setPlatform(null);
  };

  if (!platform) return <Login onLogin={handleLogin} error={error} loading={loading} />;

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg }}>
      <Nav platform={platform} onLogout={handleLogout} tab={tab} setTab={setTab} />
      <div style={{ padding: 24, maxWidth: 1280, margin: "0 auto" }}>
        {tab === "Overview" && <Overview records={records} platform={platform} />}
        {tab === "Trends" && <Trends records={records} platform={platform} />}
        {tab === "Daily" && <DailyTab records={records} setRecords={setRecords} platform={platform} />}
        {tab === "Entry Form" && <EntryForm records={records} setRecords={setRecords} platform={platform} />}
      </div>
    </div>
  );
}