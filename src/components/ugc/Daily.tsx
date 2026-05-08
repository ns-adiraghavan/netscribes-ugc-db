import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
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

const RANGES = ["Last 30 days", "Last 90 days", "This year", "Last year", "All time", "Custom"] as const;
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

export default function Daily({
  records,
  setRecords,
  platform,
}: {
  records: any[];
  setRecords: (fn: (prev: any[]) => any[]) => void;
  platform: "flipkart" | "myntra";
}) {
  const slicers = platform === "flipkart" ? FLIPKART_SLICERS : MYNTRA_SLICERS;
  const [range, setRange] = useState<Range>("Last 30 days");
  const [slicerKeys, setSlicerKeys] = useState<string[]>(["total"]);
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
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
    } else if (range === "Custom") {
      if (!customFrom && !customTo) return dated;
      const from = customFrom || "0000-01-01";
      const to = customTo || "9999-12-31";
      return dated.filter((r) => {
        const d = String(r.date);
        return d >= from && d <= to;
      });
    }
    if (!cutoff) return dated;
    const c = cutoff.toISOString().slice(0, 10);
    const cap = ceiling ? ceiling.toISOString().slice(0, 10) : null;
    return dated.filter((r) => {
      const d = String(r.date);
      return d >= c && (!cap || d <= cap);
    });
  }, [records, range, customFrom, customTo]);

  const data = useMemo(
    () =>
      filtered.map((r) => ({
        date: String(r.date),
        inflow: combinedInflow(r),
        outflow: combinedOutflow(r),
        net: combinedInflow(r) - combinedOutflow(r),
        tat: tatToHours(r.tat),
      })),
    [filtered, slicerKeys]
  );

  const totals = useMemo(() => {
    const inflow = data.reduce((a, d) => a + d.inflow, 0);
    const outflow = data.reduce((a, d) => a + d.outflow, 0);
    const tats = data.map((d) => d.tat).filter((v): v is number => v != null && !isNaN(v));
    const avg = tats.length ? tats.reduce((a, b) => a + b, 0) / tats.length : 0;
    const net = inflow - outflow;
    return { inflow, outflow, avg, net };
  }, [data]);

  const interval = data.length > 30 ? 4 : 0;
  const heading: React.CSSProperties = { fontSize: 16, fontWeight: 600, color: COLORS.text, margin: "0 0 12px" };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
        <Segmented value={range} options={RANGES} onChange={setRange} />
        {range === "Custom" && (
          <div style={{ display: "inline-flex", gap: 8, alignItems: "center", fontSize: 12, color: COLORS.muted }}>
            From
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              style={{ fontSize: 12, padding: "4px 8px", border: `1px solid ${COLORS.border}`, borderRadius: 6, fontFamily: "inherit" }}
            />
            To
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              style={{ fontSize: 12, padding: "4px 8px", border: `1px solid ${COLORS.border}`, borderRadius: 6, fontFamily: "inherit" }}
            />
          </div>
        )}
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
            <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 64 }}>
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
              <ReferenceLine
                y={totals.inflow / (data.length || 1)}
                stroke={COLORS.primary}
                strokeDasharray="4 4"
                label={{ value: `Avg In ${Math.round(totals.inflow / (data.length || 1)).toLocaleString()}`, position: "insideTopLeft", fill: COLORS.primary, fontSize: 10 }}
              />
              <ReferenceLine
                y={totals.outflow / (data.length || 1)}
                stroke={COLORS.purple}
                strokeDasharray="4 4"
                label={{ value: `Avg Out ${Math.round(totals.outflow / (data.length || 1)).toLocaleString()}`, position: "insideBottomLeft", fill: COLORS.purple, fontSize: 10 }}
              />
              <Line type="monotone" dataKey="inflow" name="Inflow" stroke={COLORS.primary} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="outflow" name="Outflow" stroke={COLORS.purple} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={card}>
        <h3 style={heading}>Daily Net Volume (Inflow − Outflow) — {combinedLabel}</h3>
        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 64 }}>
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
                formatter={(v: any) => [Number(v).toLocaleString(), "Net"]}
              />
              <ReferenceLine y={0} stroke="#9CA3AF" strokeDasharray="2 2" />
              <ReferenceLine
                y={totals.net / (data.length || 1)}
                stroke={COLORS.text}
                strokeDasharray="4 4"
                label={{ value: `Avg Net ${Math.round(totals.net / (data.length || 1)).toLocaleString()}`, position: "insideTopLeft", fill: COLORS.text, fontSize: 10 }}
              />
              <Line type="monotone" dataKey="net" name="Net" stroke={COLORS.text} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={card}>
        <h3 style={heading}>Daily TAT</h3>
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 64 }}>
              <CartesianGrid stroke={COLORS.border} vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9, fill: COLORS.muted }}
                angle={-45}
                textAnchor="end"
                height={60}
                interval={interval}
              />
              <YAxis tick={{ fontSize: 11, fill: COLORS.muted }} tickFormatter={(v) => `${v}h`} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: any) => [v == null ? "—" : `${Number(v).toFixed(1)}h`, "TAT"]}
              />
              <ReferenceLine
                y={24}
                stroke="#1E3A8A"
                strokeDasharray="4 4"
                label={{ value: "24h SLA", position: "right", fill: "#1E3A8A", fontSize: 11 }}
              />
              <Line type="monotone" dataKey="tat" stroke="#1E3A8A" strokeWidth={2} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <DetailTable filtered={filtered} platform={platform} heading={heading} setRecords={setRecords} />
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
  setRecords,
}: {
  filtered: any[];
  platform: "flipkart" | "myntra";
  heading: React.CSSProperties;
  setRecords: (fn: (prev: any[]) => any[]) => void;
}) {
  const cols = platform === "flipkart" ? FK_COLS : MY_COLS;
  const rows = [...filtered].sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const [configOpen, setConfigOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<any | null>(null);
  const [visibility, setVisibility] = useState<Record<string, boolean>>(() => {
    const v: Record<string, boolean> = { tat: true };
    for (const c of cols) v[c.key] = true;
    return v;
  });
  const visibleCols = cols.filter((c) => c.key === "date" || visibility[c.key]);
  const tatVisible = visibility.tat;
  const toggleable = cols.filter((c) => c.key !== "date");

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ ...heading, margin: 0 }}>Day-level Detail</h3>
        <button
          onClick={() => setConfigOpen((v) => !v)}
          style={{
            fontSize: 12,
            fontFamily: "inherit",
            padding: "4px 10px",
            borderRadius: 6,
            border: `1px solid ${COLORS.border}`,
            background: "#fff",
            color: COLORS.text,
            cursor: "pointer",
          }}
        >
          Configure columns
        </button>
      </div>
      {configOpen && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            padding: 12,
            marginBottom: 12,
            background: "#F9FAFB",
            border: `1px solid ${COLORS.border}`,
            borderRadius: 6,
          }}
        >
          {toggleable.map((c) => (
            <label key={c.key} style={{ fontSize: 12, color: COLORS.text, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={!!visibility[c.key]}
                onChange={(e) => setVisibility((v) => ({ ...v, [c.key]: e.target.checked }))}
              />
              {c.label}
            </label>
          ))}
          <label style={{ fontSize: 12, color: COLORS.text, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={!!visibility.tat}
              onChange={(e) => setVisibility((v) => ({ ...v, tat: e.target.checked }))}
            />
            TAT
          </label>
        </div>
      )}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "inherit" }}>
          <thead>
            <tr>
              {visibleCols.map((c) => (
                <th key={c.key} style={th}>
                  {c.label}
                </th>
              ))}
              {tatVisible && <th style={th}>TAT</th>}
              <th style={th}>Actions</th>
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
                  {visibleCols.map((c) => {
                    const v = c.get(r);
                    const display = c.key === "date" ? v : Number(v).toLocaleString();
                    return (
                      <td key={c.key} style={{ ...td, fontWeight: c.bold ? 600 : 400 }}>
                        {display}
                      </td>
                    );
                  })}
                  {tatVisible && (
                    <td style={{ ...td, color: tatColor, fontWeight: 500 }}>
                      {r.tat ?? "—"}
                    </td>
                  )}
                  <td style={td}>
                    <button
                      onClick={() => setEditingRow(r)}
                      style={{
                        fontSize: 11,
                        padding: "3px 8px",
                        borderRadius: 4,
                        border: `1px solid ${COLORS.border}`,
                        background: "#fff",
                        color: COLORS.primary,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {editingRow && (
        <EditRowModal
          row={editingRow}
          platform={platform}
          onClose={() => setEditingRow(null)}
          setRecords={setRecords}
        />
      )}
    </div>
  );
}

const EDITABLE_FK = [
  "in_eng_text", "in_hin_text", "in_eng_text_p0", "in_hin_text_p0",
  "in_eng_image", "in_hin_image", "in_question", "in_answer", "in_video",
  "out_eng_text", "out_hin_text", "out_eng_text_p0", "out_hin_text_p0",
  "out_eng_image", "out_hin_image", "out_question", "out_answer", "out_video",
  "tat", "pending_count", "callout",
];
const EDITABLE_MY = [
  "in_text_total", "in_image_total", "in_video",
  "out_text_total", "out_image_total", "out_video",
  "tat", "pending_count", "callout",
];

function EditRowModal({
  row,
  platform,
  onClose,
  setRecords,
}: {
  row: any;
  platform: "flipkart" | "myntra";
  onClose: () => void;
  setRecords: (fn: (prev: any[]) => any[]) => void;
}) {
  const fields = platform === "flipkart" ? EDITABLE_FK : EDITABLE_MY;
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const f of fields) v[f] = row[f] == null ? "" : String(row[f]);
    return v;
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const handleSave = async () => {
    setSaving(true);
    setErr("");
    const numOrNull = (v: string) => (v === "" ? null : isNaN(Number(v)) ? null : Number(v));
    const update: any = {};
    for (const f of fields) {
      if (f === "tat" || f === "callout") {
        update[f] = values[f] === "" ? null : values[f];
      } else {
        update[f] = numOrNull(values[f]);
      }
    }
    if (platform === "flipkart") {
      update.in_text_total =
        (update.in_eng_text ?? 0) + (update.in_hin_text ?? 0) +
        (update.in_eng_text_p0 ?? 0) + (update.in_hin_text_p0 ?? 0);
      update.in_image_total = (update.in_eng_image ?? 0) + (update.in_hin_image ?? 0);
      update.out_text_total =
        (update.out_eng_text ?? 0) + (update.out_hin_text ?? 0) +
        (update.out_eng_text_p0 ?? 0) + (update.out_hin_text_p0 ?? 0);
      update.out_image_total = (update.out_eng_image ?? 0) + (update.out_hin_image ?? 0);
      update.total_received =
        update.in_text_total + update.in_image_total +
        (update.in_question ?? 0) + (update.in_answer ?? 0) + (update.in_video ?? 0);
      update.total_delivered =
        update.out_text_total + update.out_image_total +
        (update.out_question ?? 0) + (update.out_answer ?? 0) + (update.out_video ?? 0);
    } else {
      update.total_received =
        (update.in_text_total ?? 0) + (update.in_image_total ?? 0) + (update.in_video ?? 0);
      update.total_delivered =
        (update.out_text_total ?? 0) + (update.out_image_total ?? 0) + (update.out_video ?? 0);
    }

    const table = platform === "flipkart" ? "flipkart_ugc_entries" : "myntra_ugc_entries";
    const { error } = await supabase.from(table).update(update).eq("date", row.date);
    if (error) {
      setErr(error.message);
      setSaving(false);
      return;
    }
    setRecords((prev) => prev.map((r) => (r.date === row.date ? { ...r, ...update } : r)));
    setSaving(false);
    onClose();
  };

  const fmtLabel = (k: string) =>
    k.replace(/^in_/, "In: ").replace(/^out_/, "Out: ").replace(/_/g, " ");

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 8, padding: 24, maxWidth: 720, width: "100%",
          maxHeight: "90vh", overflow: "auto",
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 600, color: COLORS.text, margin: "0 0 4px" }}>
          Edit Entry
        </h3>
        <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 16 }}>{row.date}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
          {fields.map((f) => (
            <div key={f}>
              <label style={{ display: "block", fontSize: 11, color: COLORS.muted, marginBottom: 3, textTransform: "capitalize" }}>
                {fmtLabel(f)}
              </label>
              <input
                value={values[f]}
                onChange={(e) => setValues((v) => ({ ...v, [f]: e.target.value }))}
                style={{
                  width: "100%", padding: "6px 8px", border: `1px solid ${COLORS.border}`,
                  borderRadius: 6, fontSize: 12, fontFamily: "inherit", boxSizing: "border-box",
                }}
              />
            </div>
          ))}
        </div>
        {err && <div style={{ color: COLORS.danger, fontSize: 12, marginTop: 12 }}>{err}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px", background: "#fff", color: COLORS.text,
              border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: 13,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "8px 16px", background: COLORS.primary, color: "#fff",
              border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600,
              cursor: saving ? "default" : "pointer", fontFamily: "inherit",
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}