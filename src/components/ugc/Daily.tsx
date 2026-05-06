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

const RANGES = ["Last 30 days", "Last 90 days", "This year", "All time", "Custom"] as const;
type Range = (typeof RANGES)[number];

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

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: readonly T[]; onChange: (v: T) => void }) {
  return (
    <div style={{ display: "inline-flex", background: "#F3F4F6", borderRadius: 8, padding: 4, flexWrap: "wrap" }}>
      {options.map((o) => {
        const active = value === o;
        return (
          <button
            key={o}
            onClick={() => onChange(o)}
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
            {o}
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

export default function Daily({ records, platform }: { records: any[]; platform: "flipkart" | "myntra" }) {
  const slicers = platform === "flipkart" ? FLIPKART_SLICERS : MYNTRA_SLICERS;
  const [range, setRange] = useState<Range>("Last 30 days");
  const [slicerKey, setSlicerKey] = useState<string>("total");
  const slicer = slicers.find((s) => s.key === slicerKey) || slicers[0];

  const allDates = useMemo(
    () => records.map((r) => r.date).filter(Boolean).sort() as string[],
    [records]
  );
  const minAvail = allDates[0] || "";
  const maxAvail = allDates[allDates.length - 1] || "";
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");

  // Initialize custom range when first switching to Custom
  const effectiveStart = customStart || minAvail;
  const effectiveEnd = customEnd || maxAvail;

  const filtered = useMemo(() => {
    const dated = records.filter((r) => r.date).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    if (!dated.length) return [];
    const maxDate = new Date(dated[dated.length - 1].date);
    let cutoff: Date | null = null;
    if (range === "Last 30 days") {
      cutoff = new Date(maxDate);
      cutoff.setDate(cutoff.getDate() - 29);
    } else if (range === "Last 90 days") {
      cutoff = new Date(maxDate);
      cutoff.setDate(cutoff.getDate() - 89);
    } else if (range === "This year") {
      cutoff = new Date(maxDate.getFullYear(), 0, 1);
    } else if (range === "Custom") {
      const lo = effectiveStart;
      const hi = effectiveEnd;
      return dated.filter((r) => {
        const d = String(r.date);
        return (!lo || d >= lo) && (!hi || d <= hi);
      });
    }
    if (!cutoff) return dated;
    const c = cutoff.toISOString().slice(0, 10);
    return dated.filter((r) => String(r.date) >= c);
  }, [records, range, effectiveStart, effectiveEnd]);

  const data = useMemo(
    () =>
      filtered.map((r) => ({
        date: String(r.date),
        inflow: slicer.inflow(r),
        outflow: slicer.outflow(r),
        tat: tatToHours(r.tat),
      })),
    [filtered, slicer]
  );

  const totals = useMemo(() => {
    const inflow = data.reduce((a, d) => a + d.inflow, 0);
    const outflow = data.reduce((a, d) => a + d.outflow, 0);
    const tats = data.map((d) => d.tat).filter((v): v is number => v != null && !isNaN(v));
    const avg = tats.length ? tats.reduce((a, b) => a + b, 0) / tats.length : 0;
    return { inflow, outflow, avg };
  }, [data]);

  const interval = data.length > 30 ? 4 : 0;
  const heading: React.CSSProperties = { fontSize: 16, fontWeight: 600, color: COLORS.text, margin: "0 0 12px" };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
        <Segmented
          value={range}
          options={RANGES}
          onChange={(v) => {
            setRange(v);
            if (v === "Custom") {
              if (!customStart) setCustomStart(minAvail);
              if (!customEnd) setCustomEnd(maxAvail);
            }
          }}
        />
        {range === "Custom" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <label style={{ fontSize: 12, color: COLORS.muted }}>From</label>
            <input
              type="date"
              value={effectiveStart}
              min={minAvail}
              max={effectiveEnd || maxAvail}
              onChange={(e) => setCustomStart(e.target.value)}
              style={{
                padding: "6px 10px",
                border: `1px solid ${COLORS.border}`,
                borderRadius: 8,
                fontSize: 13,
                fontFamily: "inherit",
              }}
            />
            <label style={{ fontSize: 12, color: COLORS.muted }}>To</label>
            <input
              type="date"
              value={effectiveEnd}
              min={effectiveStart || minAvail}
              max={maxAvail}
              onChange={(e) => setCustomEnd(e.target.value)}
              style={{
                padding: "6px 10px",
                border: `1px solid ${COLORS.border}`,
                borderRadius: 8,
                fontSize: 13,
                fontFamily: "inherit",
              }}
            />
            <button
              type="button"
              onClick={() => {
                setCustomStart(maxAvail);
                setCustomEnd(maxAvail);
              }}
              style={{
                padding: "6px 12px",
                background: "#fff",
                color: COLORS.primary,
                border: `1px solid ${COLORS.primary}`,
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Single day (latest)
            </button>
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {slicers.map((s) => (
          <Pill key={s.key} active={s.key === slicerKey} onClick={() => setSlicerKey(s.key)}>
            {s.label}
          </Pill>
        ))}
      </div>

      <div style={card}>
        <h3 style={heading}>Daily Inflow vs Outflow — {slicer.label}</h3>
        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 40 }}>
              <CartesianGrid stroke={COLORS.border} vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: COLORS.muted }}
                angle={-45}
                textAnchor="end"
                height={60}
                interval={interval}
              />
              <YAxis tick={{ fontSize: 11, fill: COLORS.muted }} tickFormatter={(v) => v.toLocaleString()} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: any, name: string) => [Number(v).toLocaleString(), name]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="inflow" name="Inflow" fill={COLORS.primary} />
              <Bar dataKey="outflow" name="Outflow" fill={COLORS.purple} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={card}>
        <h3 style={heading}>Daily TAT</h3>
        <div style={{ width: "100%", height: 140 }}>
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid stroke={COLORS.border} vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: COLORS.muted }} interval={interval} hide={data.length > 60} />
              <YAxis tick={{ fontSize: 11, fill: COLORS.muted }} tickFormatter={(v) => `${v}h`} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: any) => [v == null ? "—" : `${Number(v).toFixed(1)}h`, "TAT"]}
              />
              <ReferenceLine
                y={24}
                stroke="#9CA3AF"
                strokeDasharray="4 4"
                label={{ value: "24h SLA", position: "right", fill: COLORS.muted, fontSize: 11 }}
              />
              <Line type="monotone" dataKey="tat" stroke={COLORS.danger} strokeWidth={2} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <StatCard label="Period Inflow" value={totals.inflow.toLocaleString()} />
        <StatCard label="Period Outflow" value={totals.outflow.toLocaleString()} />
        <StatCard label="Avg TAT" value={`${totals.avg.toFixed(1)}h`} />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={card}>
      <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: COLORS.text }}>{value}</div>
    </div>
  );
}