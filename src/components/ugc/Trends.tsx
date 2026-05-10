import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";

const COLORS = {
  primary: "#1A56DB",
  purple: "#7E3AF2",
  danger: "#E02424",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
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

const num = (v: any) => (v == null || isNaN(Number(v)) ? 0 : Number(v));

type Slicer = {
  key: string;
  label: string;
  inflow: (r: any) => number;
  outflow: (r: any) => number;
};

const FLIPKART_SLICERS: Slicer[] = [
  { key: "total", label: "Total", inflow: (r) => num(r.total_received), outflow: (r) => num(r.total_delivered) },
  { key: "text", label: "Text", inflow: (r) => num(r.in_text_total), outflow: (r) => num(r.out_text_total) },
  {
    key: "text_p0",
    label: "Text P0",
    inflow: (r) => num(r.in_eng_text_p0) + num(r.in_hin_text_p0),
    outflow: (r) => num(r.out_eng_text_p0) + num(r.out_hin_text_p0),
  },
  { key: "image", label: "Image", inflow: (r) => num(r.in_image_total), outflow: (r) => num(r.out_image_total) },
  {
    key: "english",
    label: "English",
    inflow: (r) => num(r.in_eng_text) + num(r.in_eng_text_p0) + num(r.in_eng_image),
    outflow: (r) => num(r.out_eng_text) + num(r.out_eng_text_p0) + num(r.out_eng_image),
  },
  {
    key: "hindi",
    label: "Hindi",
    inflow: (r) => num(r.in_hin_text) + num(r.in_hin_text_p0) + num(r.in_hin_image),
    outflow: (r) => num(r.out_hin_text) + num(r.out_hin_text_p0) + num(r.out_hin_image),
  },
  { key: "question", label: "Question", inflow: (r) => num(r.in_question), outflow: (r) => num(r.out_question) },
  { key: "answer", label: "Answer", inflow: (r) => num(r.in_answer), outflow: (r) => num(r.out_answer) },
  { key: "video", label: "Video", inflow: (r) => num(r.in_video), outflow: (r) => num(r.out_video) },
];

const MYNTRA_SLICERS: Slicer[] = [
  { key: "total", label: "Total", inflow: (r) => num(r.total_received), outflow: (r) => num(r.total_delivered) },
  { key: "text", label: "Text", inflow: (r) => num(r.in_text_total), outflow: (r) => num(r.out_text_total) },
  { key: "image", label: "Image", inflow: (r) => num(r.in_image_total), outflow: (r) => num(r.out_image_total) },
  { key: "video", label: "Video", inflow: (r) => num(r.in_video), outflow: (r) => num(r.out_video) },
];

function compactNum(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[m - 1]}-${String(y).slice(-2)}`;
}

function weekNum(w: string): number {
  const m = String(w || "").match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 14px",
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 500,
        cursor: "pointer",
        fontFamily: "inherit",
        background: active ? COLORS.primary : "#F3F4F6",
        color: active ? "#fff" : "#374151",
        border: `2px solid ${active ? COLORS.primary : "transparent"}`,
      }}
    >
      {children}
    </button>
  );
}

function Segmented({ value, onChange }: { value: "monthly" | "weekly"; onChange: (v: "monthly" | "weekly") => void }) {
  const opts: ("monthly" | "weekly")[] = ["monthly", "weekly"];
  return (
    <div style={{ display: "inline-flex", background: "#F3F4F6", borderRadius: 8, padding: 4 }}>
      {opts.map((o) => {
        const active = value === o;
        return (
          <button
            key={o}
            onClick={() => onChange(o)}
            style={{
              padding: "6px 16px",
              border: "none",
              borderRadius: 6,
              background: active ? "#fff" : "transparent",
              color: active ? COLORS.text : COLORS.muted,
              fontWeight: active ? 600 : 500,
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "inherit",
              boxShadow: active ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
            }}
          >
            {o === "monthly" ? "Monthly" : "Weekly"}
          </button>
        );
      })}
    </div>
  );
}

const tooltipStyle: React.CSSProperties = {
  background: "#fff",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 12,
  fontFamily: "DM Sans, sans-serif",
  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
};

export default function Trends({ records, platform }: { records: any[]; platform: "flipkart" | "myntra" }) {
  const slicers = platform === "flipkart" ? FLIPKART_SLICERS : MYNTRA_SLICERS;
  const [view, setView] = useState<"monthly" | "weekly">("monthly");
  const [slicerKeys, setSlicerKeys] = useState<string[]>(["total"]);
  const [year, setYear] = useState<"all" | "2025" | "2026">("all");
  const activeSlicers = slicers.filter((s) => slicerKeys.includes(s.key));
  const combinedInflow = (r: any) => activeSlicers.reduce((sum, s) => sum + s.inflow(r), 0);
  const combinedOutflow = (r: any) => activeSlicers.reduce((sum, s) => sum + s.outflow(r), 0);
  const combinedLabel = activeSlicers.map((s) => s.label).join(" + ");
  const toggleSlicer = (key: string) => {
    setSlicerKeys((prev) => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev;
        return prev.filter((k) => k !== key);
      }
      if (key === "total") return ["total"];
      if (prev.includes("total")) return [key];
      return [...prev, key];
    });
  };

  const yearFiltered = useMemo(() => {
    if (year === "all") return records;
    return records.filter((r) => {
      const d = String(r.date || "");
      if (d.startsWith(year)) return true;
      const w = String(r.week || "");
      return w.includes(year);
    });
  }, [records, year]);

  const monthly = useMemo(() => {
    const map: Record<string, { inflow: number; outflow: number; days: number; tatSum: number; tatCount: number; over24: number }> = {};
    for (const r of yearFiltered) {
      if (!r.date) continue;
      const ym = String(r.date).slice(0, 7);
      if (!map[ym]) map[ym] = { inflow: 0, outflow: 0, days: 0, tatSum: 0, tatCount: 0, over24: 0 };
      map[ym].inflow += combinedInflow(r);
      map[ym].outflow += combinedOutflow(r);
      map[ym].days++;
      const t = tatToHours(r.tat);
      if (t != null && !isNaN(t)) {
        map[ym].tatSum += t;
        map[ym].tatCount++;
        if (t > 24) map[ym].over24++;
      }
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ym, v]) => ({
        month: monthLabel(ym),
        ym,
        inflow: v.inflow,
        outflow: v.outflow,
        avgInflow: v.days ? v.inflow / v.days : 0,
        avgOutflow: v.days ? v.outflow / v.days : 0,
        net: v.inflow - v.outflow,
        tat: v.tatCount ? v.tatSum / v.tatCount : null,
        days: v.days,
        over24Pct: v.tatCount ? (v.over24 / v.tatCount) * 100 : 0,
      }));
  }, [yearFiltered, slicerKeys]);

  const weekly = useMemo(() => {
    const map: Record<string, { inflow: number; outflow: number; n: number; tatSum: number; tatCount: number; over24: number }> = {};
    for (const r of yearFiltered) {
      const w = r.week;
      if (!w) continue;
      if (!map[w]) map[w] = { inflow: 0, outflow: 0, n: 0, tatSum: 0, tatCount: 0, over24: 0 };
      map[w].inflow += combinedInflow(r);
      map[w].outflow += combinedOutflow(r);
      map[w].n++;
      const t = tatToHours(r.tat);
      if (t != null && !isNaN(t)) {
        map[w].tatSum += t;
        map[w].tatCount++;
        if (t > 24) map[w].over24++;
      }
    }
    return Object.entries(map)
      .map(([week, v]) => ({
        week,
        n: weekNum(week),
        inflow: v.inflow,
        outflow: v.outflow,
        avgInflow: v.n ? v.inflow / v.n : 0,
        avgOutflow: v.n ? v.outflow / v.n : 0,
        net: v.inflow - v.outflow,
        tat: v.tatCount ? v.tatSum / v.tatCount : null,
        days: v.n,
        over24Pct: v.tatCount ? (v.over24 / v.tatCount) * 100 : 0,
      }))
      .sort((a, b) => a.n - b.n);
  }, [yearFiltered, slicerKeys]);

  const monthlyAvg = useMemo(() => {
    if (!monthly.length) return { inflow: 0, outflow: 0 };
    const i = monthly.reduce((a, b) => a + b.inflow, 0) / monthly.length;
    const o = monthly.reduce((a, b) => a + b.outflow, 0) / monthly.length;
    return { inflow: i, outflow: o };
  }, [monthly]);

  const weeklyAvg = useMemo(() => {
    if (!weekly.length) return { inflow: 0, outflow: 0 };
    const i = weekly.reduce((a, b) => a + b.inflow, 0) / weekly.length;
    const o = weekly.reduce((a, b) => a + b.outflow, 0) / weekly.length;
    return { inflow: i, outflow: o };
  }, [weekly]);

  const peak = weekly.reduce((acc, cur) => (cur.inflow > (acc?.inflow ?? -Infinity) ? cur : acc), weekly[0]);
  const low = weekly.reduce((acc, cur) => (cur.inflow < (acc?.inflow ?? Infinity) ? cur : acc), weekly[0]);
  const overflowCount = weekly.filter((w) => w.outflow > w.inflow).length;

  const heading: React.CSSProperties = { fontSize: 16, fontWeight: 600, color: COLORS.text, margin: "0 0 12px" };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <Segmented value={view} onChange={setView} />
        <div style={{ display: "inline-flex", background: "#F3F4F6", borderRadius: 8, padding: 4 }}>
          {(["all", "2025", "2026"] as const).map((y) => {
            const active = year === y;
            return (
              <button
                key={y}
                onClick={() => setYear(y)}
                style={{
                  padding: "6px 14px",
                  border: "none",
                  borderRadius: 6,
                  background: active ? "#fff" : "transparent",
                  color: active ? COLORS.text : COLORS.muted,
                  fontWeight: active ? 600 : 500,
                  fontSize: 13,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  boxShadow: active ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                }}
              >
                {y === "all" ? "All" : y}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {slicers.map((s) => (
          <Pill key={s.key} active={slicerKeys.includes(s.key)} onClick={() => toggleSlicer(s.key)}>
            {s.label}
          </Pill>
        ))}
      </div>

      {view === "monthly" ? (
        <>
          <SummaryTable
            label="Month"
            rows={monthly.map((m) => ({
              key: m.ym,
              label: m.month,
              avgInflow: m.avgInflow,
              avgOutflow: m.avgOutflow,
              tat: m.tat,
              over24Pct: m.over24Pct,
            }))}
          />
          <div style={card}>
            <h3 style={heading}>Monthly Inflow vs Outflow — Average (per day) — {combinedLabel}</h3>
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer>
                <LineChart data={monthly} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                  <CartesianGrid stroke={COLORS.border} vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: COLORS.muted }} />
                  <YAxis tickFormatter={compactNum} tick={{ fontSize: 11, fill: COLORS.muted }} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: any, name: string) => [Math.round(Number(v)).toLocaleString(), name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="avgInflow" name="Avg Inflow" stroke={COLORS.primary} strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="avgOutflow" name="Avg Outflow" stroke={COLORS.purple} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={card}>
            <h3 style={heading}>Monthly Avg TAT (hours) — all content types</h3>
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <LineChart data={monthly} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                  <CartesianGrid stroke={COLORS.border} vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: COLORS.muted }} />
                  <YAxis tick={{ fontSize: 11, fill: COLORS.muted }} tickFormatter={(v) => `${v}h`} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: any) => [v == null ? "—" : `${Number(v).toFixed(1)}h`, "Avg TAT"]}
                  />
                  <ReferenceLine
                    y={24}
                    stroke="#9CA3AF"
                    strokeDasharray="4 4"
                    label={{ value: "24h SLA", position: "right", fill: COLORS.muted, fontSize: 11 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="tat"
                    stroke="#7E3AF2"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#7E3AF2" }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={card}>
            <h3 style={heading}>Monthly Net Volume (Inflow − Outflow) — {combinedLabel}</h3>
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <LineChart data={monthly} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                  <CartesianGrid stroke={COLORS.border} vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: COLORS.muted }} />
                  <YAxis tickFormatter={compactNum} tick={{ fontSize: 11, fill: COLORS.muted }} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: any) => [Number(v).toLocaleString(), "Net"]}
                  />
                  <ReferenceLine y={0} stroke={COLORS.muted} strokeDasharray="2 4" />
                  <Line type="monotone" dataKey="net" name="Net" stroke={COLORS.text} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={card}>
            <h3 style={heading}>Monthly Inflow vs Outflow — Total — {combinedLabel}</h3>
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer>
                <LineChart data={monthly} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                  <CartesianGrid stroke={COLORS.border} vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: COLORS.muted }} />
                  <YAxis tickFormatter={compactNum} tick={{ fontSize: 11, fill: COLORS.muted }} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: any, name: string) => [Number(v).toLocaleString(), `${combinedLabel} ${name}`]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine
                    y={monthlyAvg.inflow}
                    stroke={COLORS.primary}
                    strokeDasharray="4 4"
                    label={{ value: `Avg In ${compactNum(Math.round(monthlyAvg.inflow))}`, position: "insideTopLeft", fill: COLORS.primary, fontSize: 10 }}
                  />
                  <ReferenceLine
                    y={monthlyAvg.outflow}
                    stroke={COLORS.purple}
                    strokeDasharray="4 4"
                    label={{ value: `Avg Out ${compactNum(Math.round(monthlyAvg.outflow))}`, position: "insideBottomLeft", fill: COLORS.purple, fontSize: 10 }}
                  />
                  <Line type="monotone" dataKey="inflow" name="Inflow" stroke={COLORS.primary} strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="outflow" name="Outflow" stroke={COLORS.purple} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      ) : (
        <>
          <SummaryTable
            label="Week"
            rows={weekly.map((w) => ({
              key: w.week,
              label: w.week,
              avgInflow: w.avgInflow,
              avgOutflow: w.avgOutflow,
              tat: w.tat,
              over24Pct: w.over24Pct,
            }))}
          />
          <div style={card}>
            <h3 style={heading}>Weekly Inflow vs Outflow — Average (per day) — {combinedLabel}</h3>
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer>
                <LineChart data={weekly} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                  <CartesianGrid stroke={COLORS.border} vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: COLORS.muted }} interval={3} />
                  <YAxis tickFormatter={compactNum} tick={{ fontSize: 11, fill: COLORS.muted }} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: any, name: string) => [Math.round(Number(v)).toLocaleString(), name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="avgInflow" name="Avg Inflow" stroke={COLORS.primary} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="avgOutflow" name="Avg Outflow" stroke={COLORS.purple} strokeWidth={2} strokeDasharray="6 4" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={card}>
            <h3 style={heading}>Weekly Avg TAT (hours) — all content types</h3>
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <LineChart data={weekly} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                  <CartesianGrid stroke={COLORS.border} vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: COLORS.muted }} interval={3} />
                  <YAxis tick={{ fontSize: 11, fill: COLORS.muted }} tickFormatter={(v) => `${v}h`} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: any) => [v == null ? "—" : `${Number(v).toFixed(1)}h`, "Avg TAT"]}
                  />
                  <ReferenceLine
                    y={24}
                    stroke="#9CA3AF"
                    strokeDasharray="4 4"
                    label={{ value: "24h SLA", position: "right", fill: COLORS.muted, fontSize: 11 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="tat"
                    stroke="#7E3AF2"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={card}>
            <h3 style={heading}>Weekly Net Volume (Inflow − Outflow) — {combinedLabel}</h3>
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <LineChart data={weekly} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                  <CartesianGrid stroke={COLORS.border} vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: COLORS.muted }} interval={3} />
                  <YAxis tickFormatter={compactNum} tick={{ fontSize: 11, fill: COLORS.muted }} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: any) => [Number(v).toLocaleString(), "Net"]}
                  />
                  <ReferenceLine y={0} stroke={COLORS.muted} strokeDasharray="2 4" />
                  <Line type="monotone" dataKey="net" name="Net" stroke={COLORS.text} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={card}>
            <h3 style={heading}>Weekly Inflow vs Outflow — Total — {combinedLabel}</h3>
            <div style={{ fontSize: 12, color: COLORS.muted, margin: "0 0 8px" }}>Week highlights</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
              {peak && (
                <StatPill label="Peak week" value={`${peak.week} • ${peak.inflow.toLocaleString()}`} color={COLORS.primary} />
              )}
              {low && (
                <StatPill label="Lowest week" value={`${low.week} • ${low.inflow.toLocaleString()}`} color={COLORS.muted} />
              )}
              <StatPill label="Weeks outflow > inflow" value={String(overflowCount)} color={COLORS.danger} />
            </div>
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer>
                <LineChart data={weekly} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                  <CartesianGrid stroke={COLORS.border} vertical={false} />
                  <XAxis
                    dataKey="week"
                    tick={{ fontSize: 11, fill: COLORS.muted }}
                    interval={3}
                  />
                  <YAxis tickFormatter={compactNum} tick={{ fontSize: 11, fill: COLORS.muted }} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: any, name: string) => [Number(v).toLocaleString(), name]}
                    labelFormatter={(l) => l}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine
                    y={weeklyAvg.inflow}
                    stroke={COLORS.primary}
                    strokeDasharray="4 4"
                    label={{ value: `Avg In ${compactNum(Math.round(weeklyAvg.inflow))}`, position: "insideTopLeft", fill: COLORS.primary, fontSize: 10 }}
                  />
                  <ReferenceLine
                    y={weeklyAvg.outflow}
                    stroke={COLORS.purple}
                    strokeDasharray="4 4"
                    label={{ value: `Avg Out ${compactNum(Math.round(weeklyAvg.outflow))}`, position: "insideBottomLeft", fill: COLORS.purple, fontSize: 10 }}
                  />
                  <Line type="monotone" dataKey="inflow" name="Inflow" stroke={COLORS.primary} strokeWidth={2} dot={false} />
                  <Line
                    type="monotone"
                    dataKey="outflow"
                    name="Outflow"
                    stroke={COLORS.purple}
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: "#F9FAFB", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 14px" }}>
      <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color }}>{value}</div>
    </div>
  );
}

type SummaryRow = {
  key: string;
  label: string;
  avgInflow: number;
  avgOutflow: number;
  tat: number | null;
  over24Pct: number;
};

function tatColor(t: number | null): string {
  if (t == null) return "#F3F4F6";
  if (t > 24) return "#FCA5A5";
  if (t >= 12) return "#FCD9B6";
  return "#BBF7D0";
}

function over24Color(p: number): string {
  if (p > 20) return "#FCA5A5";
  if (p > 5) return "#FCD9B6";
  return "#BBF7D0";
}

function SummaryTable({ label, rows }: { label: string; rows: SummaryRow[] }) {
  if (!rows.length) return null;
  const headerStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 700,
    textAlign: "left",
    padding: "10px 12px",
    color: COLORS.muted,
    letterSpacing: 0.3,
  };
  const cellStyle: React.CSSProperties = {
    padding: "10px 12px",
    fontSize: 13,
    color: COLORS.text,
    borderTop: `1px solid ${COLORS.border}`,
  };
  const chip = (bg: string): React.CSSProperties => ({
    display: "inline-block",
    padding: "3px 10px",
    borderRadius: 999,
    background: bg,
    fontWeight: 600,
    fontSize: 12,
    color: "#111827",
  });
  return (
    <div style={card}>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: COLORS.text, margin: "0 0 12px", borderLeft: `3px solid ${COLORS.primary}`, paddingLeft: 10 }}>
        Summary — {label} × Metrics
      </h3>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
          <thead>
            <tr>
              <th style={{ ...headerStyle, color: COLORS.muted }}>{label}</th>
              <th style={{ ...headerStyle, color: COLORS.primary }}>Avg Daily Inflow</th>
              <th style={{ ...headerStyle, color: COLORS.purple }}>Avg Daily Outflow</th>
              <th style={{ ...headerStyle, color: "#7E3AF2" }}>Avg TAT</th>
              <th style={{ ...headerStyle, color: COLORS.danger }}>% Days TAT &gt; 24h</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td style={{ ...cellStyle, fontWeight: 600 }}>{r.label}</td>
                <td style={cellStyle}>{Math.round(r.avgInflow).toLocaleString()}</td>
                <td style={cellStyle}>{Math.round(r.avgOutflow).toLocaleString()}</td>
                <td style={cellStyle}>
                  <span style={chip(tatColor(r.tat))}>{r.tat == null ? "—" : `${r.tat.toFixed(1)}h`}</span>
                </td>
                <td style={cellStyle}>
                  <span style={chip(over24Color(r.over24Pct))}>{r.over24Pct.toFixed(1)}%</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}