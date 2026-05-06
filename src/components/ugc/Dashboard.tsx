import { useEffect, useMemo, useState } from "react";

declare global {
  interface Window {
    pako?: { inflate: (data: Uint8Array, opts: { to: "string" }) => string };
  }
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
      <KpiCard label="P95 TAT" value={`${k.p95.toFixed(1)}h`} valueColor={p95Color} />
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
        <h1 style={{ fontSize: 22, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>Netscribes</h1>
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
        <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text }}>Netscribes</div>
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
                color: active ? COLORS.primary : COLORS.muted,
                border: "none",
                borderBottom: active ? `2px solid ${COLORS.primary}` : "2px solid transparent",
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

function Overview({ records }: { records: any[] }) {
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

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div>
        <h2 style={heading}>All-time Summary</h2>
        <KpiRow rows={records} />
      </div>
      <div>
        <h2 style={heading}>Latest Year Summary</h2>
        <KpiRow rows={latestRows} />
      </div>
      <div style={{ fontSize: 12, fontStyle: "italic", color: "#6B7280" }}>
        Data from {minDate} to {maxDate}. {count} days on record.
      </div>
    </div>
  );
}

function Trends({ records }: { records: any[] }) {
  const series = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of records) {
      const d = getDateField(r);
      if (!d) continue;
      map[d] = (map[d] || 0) + 1;
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [records]);

  const max = Math.max(1, ...series.map(([, v]) => v));

  return (
    <div style={card}>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Volume Trend</h3>
      {series.length === 0 ? (
        <p style={{ color: COLORS.muted, fontSize: 14 }}>No date data available.</p>
      ) : (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 240, overflowX: "auto", paddingBottom: 24, position: "relative" }}>
          {series.map(([d, v]) => (
            <div key={d} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 24 }}>
              <div title={`${d}: ${v}`} style={{ width: 20, height: `${(v / max) * 200}px`, background: COLORS.primary, borderRadius: 4 }} />
              <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 4, transform: "rotate(-45deg)", transformOrigin: "left", whiteSpace: "nowrap" }}>{d}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Daily({ records }: { records: any[] }) {
  const rows = useMemo(() => {
    const map: Record<string, { total: number; approved: number; rejected: number; pending: number }> = {};
    for (const r of records) {
      const d = getDateField(r);
      if (!d) continue;
      if (!map[d]) map[d] = { total: 0, approved: 0, rejected: 0, pending: 0 };
      const s = getStatus(r).toLowerCase();
      map[d].total++;
      if (s.includes("approve") || s.includes("accept")) map[d].approved++;
      else if (s.includes("reject")) map[d].rejected++;
      else if (s.includes("pend") || s.includes("review")) map[d].pending++;
    }
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  }, [records]);

  return (
    <div style={card}>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Daily Breakdown</h3>
      {rows.length === 0 ? (
        <p style={{ color: COLORS.muted, fontSize: 14 }}>No date data available.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${COLORS.border}`, textAlign: "left" }}>
                <th style={{ padding: "10px 8px", fontWeight: 600 }}>Date</th>
                <th style={{ padding: "10px 8px", fontWeight: 600 }}>Total</th>
                <th style={{ padding: "10px 8px", fontWeight: 600, color: COLORS.success }}>Approved</th>
                <th style={{ padding: "10px 8px", fontWeight: 600, color: COLORS.danger }}>Rejected</th>
                <th style={{ padding: "10px 8px", fontWeight: 600, color: COLORS.amber }}>Pending</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([d, v]) => (
                <tr key={d} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  <td style={{ padding: "10px 8px" }}>{d}</td>
                  <td style={{ padding: "10px 8px" }}>{v.total}</td>
                  <td style={{ padding: "10px 8px" }}>{v.approved}</td>
                  <td style={{ padding: "10px 8px" }}>{v.rejected}</td>
                  <td style={{ padding: "10px 8px" }}>{v.pending}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EntryForm({ records }: { records: any[] }) {
  const sample = records[0] || {};
  const fields = Object.keys(sample).slice(0, 8);
  const [form, setForm] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  return (
    <div style={card}>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>New Entry</h3>
      {fields.length === 0 ? (
        <p style={{ color: COLORS.muted, fontSize: 14 }}>No data schema detected.</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(true);
            setTimeout(() => setSubmitted(false), 2500);
          }}
          style={{ display: "grid", gap: 12, maxWidth: 600 }}
        >
          {fields.map((f) => (
            <div key={f}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4, textTransform: "capitalize" }}>{f.replace(/_/g, " ")}</label>
              <input
                value={form[f] || ""}
                onChange={(e) => setForm({ ...form, [f]: e.target.value })}
                style={{ width: "100%", padding: "10px 12px", border: `1px solid ${COLORS.border}`, borderRadius: 8, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }}
              />
            </div>
          ))}
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button
              type="submit"
              style={{ padding: "10px 20px", background: COLORS.primary, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
            >
              Submit
            </button>
            {submitted && <span style={{ color: COLORS.success, fontSize: 13 }}>Entry captured (in-memory only).</span>}
          </div>
        </form>
      )}
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
      const url = c.platform === "flipkart" ? "/flipkart_ugc.json.gz" : "/myntra_ugc.json.gz";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load data");
      const buf = await res.arrayBuffer();
      if (!window.pako) throw new Error("pako not loaded");
      const text = window.pako.inflate(new Uint8Array(buf), { to: "string" });
      const data = JSON.parse(text);
      setRecords(Array.isArray(data) ? data : data.records || data.data || []);
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
        {tab === "Overview" && <Overview records={records} />}
        {tab === "Trends" && <Trends records={records} />}
        {tab === "Daily" && <Daily records={records} />}
        {tab === "Entry Form" && <EntryForm records={records} />}
      </div>
    </div>
  );
}