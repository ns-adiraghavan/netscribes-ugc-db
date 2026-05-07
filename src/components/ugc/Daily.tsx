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

const RANGES = ["Last 30 days", "Last 90 days", "This year", "Last year", "All time"] as const;
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
  const [slicerKeys, setSlicerKeys] = useState<string[]>(["total"]);
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
      return [...prev, key];
    });
  };

  const filtered = useMemo(() => {
    const dated = records.filter((r) => r.date).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    if (!dated.length) return [];
    const maxDate = new Date(dated[dated.length - 1].date);
    let cutoff: Date | null = null;
    let ceiling: Date | null = null;
    if (range === "Last 30 days") {
      cutoff = new Date(maxDate);
      cutoff.setDate(cutoff.getDate() - 29);
    } else if (range === "Last 90 days") {
      cutoff = new Date(maxDate);
      cutoff.setDate(cutoff.getDate() - 89);
    } else if (range === "This year") {
      cutoff = new Date(maxDate.getFullYear(), 0, 1);
    } else if (range === "Last year") {
      const ly = maxDate.getFullYear() - 1;
      cutoff = new Date(ly, 0, 1);
      ceiling = new Date(ly, 11, 31);
    }
    if (!cutoff) return dated;
    const c = cutoff.toISOString().slice(0, 10);
    const cap = ceiling ? ceiling.toISOString().slice(0, 10) : null;
    return dated.filter((r) => {
      const d = String(r.date);
      return d >= c && (!cap || d <= cap);
    });
  }, [records, range]);

  const data = useMemo(
    () =>
      filtered.map((r) => ({
        date: String(r.date),
        inflow: combinedInflow(r),
        outflow: combinedOutflow(r),
        tat: tatToHours(r.tat),
      })),
    [filtered, slicerKeys]
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
        <Segmented value={range} options={RANGES} onChange={setRange} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {slicers.map((s) => (
          <Pill key={s.key} active={slicerKeys.includes(s.key)} onClick={() => toggleSlicer(s.key)}>
            {s.label}
          </Pill>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <StatCard label="Period Inflow" value={totals.inflow.toLocaleString()} />
        <StatCard label="Period Outflow" value={totals.outflow.toLocaleString()} />
        <StatCard label="Avg TAT" value={`${totals.avg.toFixed(1)}h`} />
      </div>

      <div style={card}>
        <h3 style={heading}>Daily Inflow vs Outflow — {combinedLabel}</h3>
        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 64 }}>
              <CartesianGrid stroke={COLORS.border} vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9, fill: COLORS.muted }}
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

      <DetailTable filtered={filtered} platform={platform} heading={heading} />
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

type Col = { key: string; label: string; get: (r: any) => any; bold?: boolean };

const FK_COLS: Col[] = [
  { key: "date", label: "Date", get: (r) => String(r.date) },
  { key: "in_text", label: "Inflow Text", get: (r) => num(r.in_text_total) },
  { key: "in_image", label: "Inflow Image", get: (r) => num(r.in_image_total) },
  { key: "in_q", label: "Inflow Q", get: (r) => num(r.in_question) },
  { key: "in_a", label: "Inflow A", get: (r) => num(r.in_answer) },
  { key: "in_video", label: "Inflow Video", get: (r) => num(r.in_video) },
  { key: "total_in", label: "Total Received", get: (r) => num(r.total_received), bold: true },
  { key: "out_text", label: "Outflow Text", get: (r) => num(r.out_text_total) },
  { key: "out_image", label: "Outflow Image", get: (r) => num(r.out_image_total) },
  { key: "out_q", label: "Outflow Q", get: (r) => num(r.out_question) },
  { key: "out_a", label: "Outflow A", get: (r) => num(r.out_answer) },
  { key: "out_video", label: "Outflow Video", get: (r) => num(r.out_video) },
  { key: "total_out", label: "Total Delivered", get: (r) => num(r.total_delivered), bold: true },
];

const MY_COLS: Col[] = [
  { key: "date", label: "Date", get: (r) => String(r.date) },
  { key: "in_text", label: "Inflow Text", get: (r) => num(r.in_text_total) },
  { key: "in_image", label: "Inflow Image", get: (r) => num(r.in_image_total) },
  { key: "in_video", label: "Inflow Video", get: (r) => num(r.in_video) },
  { key: "total_in", label: "Total Received", get: (r) => num(r.total_received), bold: true },
  { key: "out_text", label: "Outflow Text", get: (r) => num(r.out_text_total) },
  { key: "out_image", label: "Outflow Image", get: (r) => num(r.out_image_total) },
  { key: "out_video", label: "Outflow Video", get: (r) => num(r.out_video) },
  { key: "total_out", label: "Total Delivered", get: (r) => num(r.total_delivered), bold: true },
];

function DetailTable({
  filtered,
  platform,
  heading,
}: {
  filtered: any[];
  platform: "flipkart" | "myntra";
  heading: React.CSSProperties;
}) {
  const cols = platform === "flipkart" ? FK_COLS : MY_COLS;
  const rows = [...filtered].sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const th: React.CSSProperties = {
    fontSize: 11,
    textTransform: "uppercase",
    color: COLORS.muted,
    textAlign: "left",
    fontWeight: 600,
    padding: "8px 12px",
    borderBottom: `1px solid ${COLORS.border}`,
    whiteSpace: "nowrap",
  };
  const td: React.CSSProperties = {
    fontSize: 12,
    color: COLORS.text,
    padding: "8px 12px",
    borderBottom: `1px solid ${COLORS.border}`,
    whiteSpace: "nowrap",
  };

  return (
    <div style={card}>
      <h3 style={heading}>Day-level Detail</h3>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "inherit" }}>
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.key} style={th}>
                  {c.label}
                </th>
              ))}
              <th style={th}>TAT</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const bg = i % 2 === 0 ? "#fff" : "#F9FAFB";
              const tatHrs = tatToHours(r.tat);
              const tatColor =
                tatHrs == null ? COLORS.muted : tatHrs < 24 ? "#057A55" : COLORS.danger;
              return (
                <tr key={i} style={{ background: bg }}>
                  {cols.map((c) => {
                    const v = c.get(r);
                    const display = c.key === "date" ? v : Number(v).toLocaleString();
                    return (
                      <td key={c.key} style={{ ...td, fontWeight: c.bold ? 600 : 400 }}>
                        {display}
                      </td>
                    );
                  })}
                  <td style={{ ...td, color: tatColor, fontWeight: 500 }}>
                    {r.tat ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}