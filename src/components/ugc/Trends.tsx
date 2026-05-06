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
  {
    key: "text_p2",
    label: "Text P2",
    inflow: (r) => num(r.in_eng_text_p2) + num(r.in_hin_text_p2),
    outflow: (r) => num(r.out_eng_text_p2) + num(r.out_hin_text_p2),
  },
  { key: "image", label: "Image", inflow: (r) => num(r.in_image_total), outflow: (r) => num(r.out_image_total) },
  {
    key: "english",
    label: "English",
    inflow: (r) => num(r.in_eng_text) + num(r.in_eng_text_p0) + num(r.in_eng_text_p2) + num(r.in_eng_image),
    outflow: (r) => num(r.out_eng_text) + num(r.out_eng_text_p0) + num(r.out_eng_text_p2) + num(r.out_eng_image),
  },
  {
    key: "hindi",
    label: "Hindi",
    inflow: (r) => num(r.in_hin_text) + num(r.in_hin_text_p0) + num(r.in_hin_text_p2) + num(r.in_hin_image),
    outflow: (r) => num(r.out_hin_text) + num(r.out_hin_text_p0) + num(r.out_hin_text_p2) + num(r.out_hin_image),
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
  const [slicerKey, setSlicerKey] = useState<string>("total");
  const slicer = slicers.find((s) => s.key === slicerKey) || slicers[0];

  const monthly = useMemo(() => {
    const map: Record<string, { inflow: number; outflow: number; tatSum: number; tatCount: number }> = {};
    for (const r of records) {
      if (!r.date) continue;
      const ym = String(r.date).slice(0, 7);
      if (!map[ym]) map[ym] = { inflow: 0, outflow: 0, tatSum: 0, tatCount: 0 };
      map[ym].inflow += slicer.inflow(r);
      map[ym].outflow += slicer.outflow(r);
      const t = tatToHours(r.tat);
      if (t != null && !isNaN(t)) {
        map[ym].tatSum += t;
        map[ym].tatCount++;
      }
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ym, v]) => ({
        month: monthLabel(ym),
        ym,
        inflow: v.inflow,
        outflow: v.outflow,
        tat: v.tatCount ? v.tatSum / v.tatCount : null,
      }));
  }, [records, slicer]);

  const weekly = useMemo(() => {
    const map: Record<string, { inflow: number; outflow: number; n: number }> = {};
    for (const r of records) {
      const w = r.week;
      if (!w) continue;
      if (!map[w]) map[w] = { inflow: 0, outflow: 0, n: 0 };
      map[w].inflow += slicer.inflow(r);
      map[w].outflow += slicer.outflow(r);
      map[w].n++;
    }
    return Object.entries(map)
      .map(([week, v]) => ({ week, n: weekNum(week), inflow: v.inflow, outflow: v.outflow }))
      .sort((a, b) => a.n - b.n);
  }, [records, slicer]);

  const peak = weekly.reduce((acc, cur) => (cur.inflow > (acc?.inflow ?? -Infinity) ? cur : acc), weekly[0]);
  const low = weekly.reduce((acc, cur) => (cur.inflow < (acc?.inflow ?? Infinity) ? cur : acc), weekly[0]);
  const overflowCount = weekly.filter((w) => w.outflow > w.inflow).length;

  const heading: React.CSSProperties = { fontSize: 16, fontWeight: 600, color: COLORS.text, margin: "0 0 12px" };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <Segmented value={view} onChange={setView} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {slicers.map((s) => (
          <Pill key={s.key} active={s.key === slicerKey} onClick={() => setSlicerKey(s.key)}>
            {s.label}
          </Pill>
        ))}
      </div>

      {view === "monthly" ? (
        <>
          <div style={card}>
            <h3 style={heading}>Monthly Inflow vs Outflow — {slicer.label}</h3>
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer>
                <BarChart data={monthly} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                  <CartesianGrid stroke={COLORS.border} vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: COLORS.muted }} />
                  <YAxis tickFormatter={compactNum} tick={{ fontSize: 11, fill: COLORS.muted }} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: any, name: string) => [Number(v).toLocaleString(), `${slicer.label} ${name}`]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="inflow" name="Inflow" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="outflow" name="Outflow" fill={COLORS.purple} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={card}>
            <h3 style={heading}>Monthly Avg TAT (hours)</h3>
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
                    stroke={COLORS.danger}
                    strokeWidth={2}
                    dot={{ r: 3, fill: COLORS.danger }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      ) : (
        <>
          <div style={card}>
            <h3 style={heading}>Weekly Inflow vs Outflow — {slicer.label}</h3>
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

            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 16 }}>
              {peak && (
                <StatPill label="Peak week" value={`${peak.week} • ${peak.inflow.toLocaleString()}`} color={COLORS.primary} />
              )}
              {low && (
                <StatPill label="Lowest week" value={`${low.week} • ${low.inflow.toLocaleString()}`} color={COLORS.muted} />
              )}
              <StatPill label="Weeks outflow > inflow" value={String(overflowCount)} color={COLORS.danger} />
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