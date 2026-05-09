/**
 * RejectionDashboard.tsx
 * Flipkart UGC — Rejection Intelligence Module
 *
 * Loads fk_ugc_{queue}_{year}_{month}.json.gz from /public/
 * Queues: text | image | question | video | answer
 * Months: Feb 2026 (2), Mar 2026 (3), Apr 2026 (4)
 *
 * Place this file at: src/components/ugc/RejectionDashboard.tsx
 */

import { useEffect, useMemo, useRef, useState } from "react";
import logo from "@/assets/netscribes-logo.png";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
  ComposedChart,
} from "recharts";

// ─── Types ───────────────────────────────────────────────────────────────────

type QueueType = "text" | "image" | "question" | "video" | "answer";
type MonthKey = "2026_2" | "2026_3" | "2026_4";

interface UGCRow {
  reference_id?: string;
  action?: string;       // "Approved" | "Rejected"
  reason?: string;
  review_language?: string;
  uploaded_at?: string;
  created_date?: string;
  agent_name?: string;
  rating?: number | null;
  category?: string;
  product_title?: string;
  queue_type?: string;
  date?: string;
  year?: number;
  month?: number;
  month_label?: string;
  // image-specific
  image_url?: string;
  // question/answer
  question_text?: string;
  answer_text?: string;
  // video
  duration_seconds?: number;
}

interface LoadedMonth {
  key: MonthKey;
  queue: QueueType;
  rows: UGCRow[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS: { key: MonthKey; label: string; year: number; month: number }[] = [
  { key: "2026_2", label: "Feb 2026", year: 2026, month: 2 },
  { key: "2026_3", label: "Mar 2026", year: 2026, month: 3 },
  { key: "2026_4", label: "Apr 2026", year: 2026, month: 4 },
];

const QUEUES: QueueType[] = ["text", "image", "question", "video", "answer"];

const QUEUE_LABELS: Record<QueueType, string> = {
  text: "Text",
  image: "Image",
  question: "Question",
  video: "Video",
  answer: "Answer",
};

const QUEUE_COLORS: Record<QueueType, string> = {
  text: "#1A56DB",
  image: "#7E3AF2",
  question: "#057A55",
  video: "#D97706",
  answer: "#E02424",
};

const PALETTE = ["#1A56DB", "#7E3AF2", "#057A55", "#D97706", "#E02424", "#0891B2", "#BE185D", "#15803D"];

const COLORS = {
  primary: "#1A56DB",
  danger: "#E02424",
  success: "#057A55",
  amber: "#D97706",
  purple: "#7E3AF2",
  bg: "#F8F9FA",
  border: "#E5E7EB",
  text: "#111827",
  muted: "#6B7280",
  white: "#ffffff",
};

const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 10,
  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  padding: 20,
};

const tooltipStyle = {
  background: "#fff",
  border: "1px solid #E5E7EB",
  borderRadius: 8,
  fontSize: 12,
  fontFamily: "DM Sans, sans-serif",
};

// ─── Pako loader ─────────────────────────────────────────────────────────────

declare global {
  interface Window {
    pako?: { inflate: (data: Uint8Array, opts: { to: "string" }) => string };
  }
}

function loadPako(): Promise<NonNullable<Window["pako"]>> {
  if (window.pako) return Promise.resolve(window.pako);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js";
    s.async = true;
    s.onload = () => (window.pako ? resolve(window.pako) : reject(new Error("pako failed")));
    s.onerror = () => reject(new Error("pako script error"));
    document.head.appendChild(s);
  });
}

const DATA_PREFIX = ""; // files are in /public/ → served from root in Vite

// Replace NaN tokens (invalid JSON from Python) with null before parsing
function safeParseJSON(text: string): any[] {
  // Avoid allocating a second multi-hundred-MB string when not needed.
  // Python writes `NaN` as a bare token which JSON.parse rejects — only
  // run the replace if we actually find one.
  if (text.indexOf("NaN") !== -1) {
    text = text.replace(/:\s*NaN\b/g, ": null");
  }
  return JSON.parse(text);
}

// ── Session-level in-memory cache (survives tab switches, not page reload) ──
// We intentionally avoid sessionStorage because values can be 40MB+ per queue.
// A module-level Map holds the parsed rows for the lifetime of the session.
const ROW_CACHE = new Map<string, UGCRow[]>();

// ── Retry helper for transient network errors / 5xx / 429 ────────────────────
async function fetchWithRetry(url: string, attempts = 3): Promise<Response> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
      // Retry on transient HTTP errors
      if (![408, 429, 500, 502, 503, 504].includes(res.status)) return res;
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, 400 * Math.pow(2, i)));
    }
  }
  throw lastErr ?? new Error(`Failed to fetch ${url}`);
}

async function fetchQueueMonth(
  queue: QueueType,
  year: number,
  month: number,
  onFileDone?: () => void
): Promise<UGCRow[]> {
  const stem = `fk_ugc_${queue}_${year}_${String(month).padStart(2, "0")}`;
  const cacheKey = stem;

  // ── Return from cache immediately if already parsed ──────────────────────
  if (ROW_CACHE.has(cacheKey)) {
    return ROW_CACHE.get(cacheKey)!;
  }

  const pako = await loadPako();

  // ── Project rows to only fields charts use — cuts memory 5-10x ─────────
  const projectRow = (r: any): UGCRow => ({
    action:          r.action,
    reason:          r.reason          ?? null,
    review_language: r.review_language ?? null,
    agent_name:      r.agent_name      ?? null,
    rating:          r.rating          ?? null,
    category:        r.category        ?? null,
    queue_type:      r.queue_type      ?? null,
    month:           r.month           ?? null,
    year:            r.year            ?? null,
    month_label:     r.month_label     ?? null,
    duration_seconds:r.duration_seconds ?? null,
    date:            r.date            ?? null,
  });

  // ── Helper: decompress + parse + project a single Uint8Array ─────────────
  const decompress = (buf: Uint8Array): UGCRow[] => {
    let text: string;
    try {
      text = pako.inflate(buf, { to: "string" });
    } catch {
      // File is plain JSON (not gzip) — decode directly
      text = new TextDecoder().decode(buf);
    }
    const raw = safeParseJSON(text);
    // Free the giant intermediate string ASAP before mapping allocates more.
    text = "";
    const out: UGCRow[] = new Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = projectRow(raw[i]);
    // Drop references to the heavy raw objects so GC can reclaim them.
    raw.length = 0;
    return out;
  };

  // ── Step 1: probe for .meta.json (chunked large file) ────────────────────
  let metaRes: Response;
  try {
    metaRes = await fetch(`${DATA_PREFIX}/${stem}.meta.json`);
  } catch {
    throw new Error(`Network error fetching ${stem}.meta.json`);
  }

  if (metaRes.ok) {
    const meta: { parts: number; filenames: string[] } = await metaRes.json();

    // Sequential fetch + decompress per part. Yields to the event loop
    // between parts so the UI can repaint and the browser doesn't freeze.
    const rows: UGCRow[] = [];
    for (const fname of meta.filenames) {
      const r = await fetchWithRetry(`${DATA_PREFIX}/${fname}`);
      if (!r.ok) throw new Error(`Part not found: ${fname} (${r.status})`);
      const buf = new Uint8Array(await r.arrayBuffer());
      const partRows = decompress(buf);
      for (let i = 0; i < partRows.length; i++) rows.push(partRows[i]);
      partRows.length = 0;
      onFileDone?.();
      // Yield to the browser event loop so UI can repaint between parts.
      await new Promise((res) => setTimeout(res, 0));
    }

    ROW_CACHE.set(cacheKey, rows);
    return rows;
  }

  // ── Step 2: whole file (small queues: video / question / answer) ──────────
  let res: Response;
  try {
    res = await fetchWithRetry(`${DATA_PREFIX}/${stem}.json.gz`);
  } catch {
    throw new Error(`Network error fetching ${stem}.json.gz`);
  }

  if (!res.ok) throw new Error(`${stem}: HTTP ${res.status} (checked both .meta.json and .json.gz)`);

  const buf = new Uint8Array(await res.arrayBuffer());
  const rows = decompress(buf);
  ROW_CACHE.set(cacheKey, rows);
  onFileDone?.();
  return rows;
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function fmtNum(n: number) {
  return Math.round(n).toLocaleString();
}

function pct(num: number, den: number) {
  if (!den) return "0%";
  return ((num / den) * 100).toFixed(1) + "%";
}

function topN<T>(arr: T[], key: (x: T) => number, n = 10): T[] {
  return [...arr].sort((a, b) => key(b) - key(a)).slice(0, n);
}

function countBy<T>(rows: T[], fn: (r: T) => string | null | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const k = fn(r) || "Unknown";
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function isoWeekLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  // Shift to Thursday of current ISO week
  const dayNum = (date.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const year = date.getUTCFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const dayOfYear = Math.floor((date.getTime() - jan1.getTime()) / 86400000) + 1;
  const leadingDays = (new Date(year, 0, 1).getDay() + 6) % 7;
  const week = Math.ceil((dayOfYear + leadingDays) / 7);
  return `W${week}-${String(year).slice(-2)}`;
}

function weekNumFromLabel(label: string): number {
  return parseInt(label.slice(1).split("-")[0], 10);
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDayLabel(dateStr: string): string {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${String(d).padStart(2, "0")} ${MONTH_ABBR[m - 1]}`;
}

function buildDailyData(rows: UGCRow[]) {
  const byDay: Record<string, { total: number; rejected: number }> = {};
  for (const r of rows) {
    if (!r.date) continue;
    if (!byDay[r.date]) byDay[r.date] = { total: 0, rejected: 0 };
    byDay[r.date].total++;
    if (r.action === "Rejected") byDay[r.date].rejected++;
  }
  return Object.entries(byDay)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, s]) => ({
      date,
      label: fmtDayLabel(date),
      volume: s.total,
      rejectionCount: s.rejected,
      rejectionRate: s.total ? (s.rejected / s.total) * 100 : 0,
    }));
}

function buildWeeklyData(rows: UGCRow[]) {
  const byWeek: Record<string, { total: number; rejected: number }> = {};
  for (const r of rows) {
    if (!r.date) continue;
    const w = isoWeekLabel(r.date);
    if (!byWeek[w]) byWeek[w] = { total: 0, rejected: 0 };
    byWeek[w].total++;
    if (r.action === "Rejected") byWeek[w].rejected++;
  }
  return Object.entries(byWeek)
    .sort((a, b) => weekNumFromLabel(a[0]) - weekNumFromLabel(b[0]))
    .map(([label, s]) => ({
      label,
      volume: s.total,
      rejectionCount: s.rejected,
      rejectionRate: s.total ? (s.rejected / s.total) * 100 : 0,
    }));
}

// ─── Daily dual-axis chart (bar volume + line rate) ──────────────────────────

function DailyTrendChart({ rows, barColor = COLORS.primary }: { rows: UGCRow[]; barColor?: string }) {
  const data = buildDailyData(rows);
  if (!data.length) {
    return <div style={{ color: COLORS.muted, fontSize: 13, padding: 20 }}>No daily data available.</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 50, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} interval="preserveStartEnd" />
        <YAxis yAxisId="vol" tickFormatter={fmtNum} tick={{ fontSize: 11 }} width={55} />
        <YAxis yAxisId="rate" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} width={45} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(val: any, name: string) =>
            name === "Rejection Rate" ? `${Number(val).toFixed(1)}%` : fmtNum(Number(val))
          }
        />
        <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
        <Bar yAxisId="vol" dataKey="volume" name="Total Volume" fill={barColor} radius={[3, 3, 0, 0]} />
        <Line yAxisId="rate" type="monotone" dataKey="rejectionRate" name="Rejection Rate" stroke={COLORS.danger} strokeWidth={2.5} dot={{ r: 2 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ─── Weekly rejection-rate per queue (one line per queue) ────────────────────

function WeeklyByQueueChart({ rows }: { rows: UGCRow[] }) {
  const byWeek: Record<string, Record<string, { total: number; rejected: number }>> = {};
  for (const r of rows) {
    if (!r.date) continue;
    const q = r.queue_type as QueueType;
    if (!QUEUES.includes(q)) continue;
    const w = isoWeekLabel(r.date);
    if (!byWeek[w]) {
      byWeek[w] = {};
      for (const qq of QUEUES) byWeek[w][qq] = { total: 0, rejected: 0 };
    }
    byWeek[w][q].total++;
    if (r.action === "Rejected") byWeek[w][q].rejected++;
  }
  const data = Object.entries(byWeek)
    .sort((a, b) => weekNumFromLabel(a[0]) - weekNumFromLabel(b[0]))
    .map(([label, q]) => {
      const row: Record<string, any> = { label };
      for (const queue of QUEUES) {
        const s = q[queue];
        row[queue] = s.total ? +((s.rejected / s.total) * 100).toFixed(2) : null;
      }
      return row;
    });
  if (!data.length) {
    return <div style={{ color: COLORS.muted, fontSize: 13, padding: 20 }}>No weekly data available.</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 50, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
        <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} width={45} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v: any) => (v == null ? "—" : `${Number(v).toFixed(1)}%`)}
        />
        <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
        {QUEUES.map((q) => (
          <Line
            key={q}
            type="monotone"
            dataKey={q}
            name={QUEUE_LABELS[q]}
            stroke={QUEUE_COLORS[q]}
            strokeWidth={2}
            dot={{ r: 2 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  color,
  delta,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  delta?: { text: string; direction: "up-bad" | "down-good" | "neutral" };
}) {
  const deltaStyle = delta
    ? delta.direction === "up-bad"
      ? { bg: "#FEE2E2", fg: "#E02424", arrow: "▲ " }
      : delta.direction === "down-good"
      ? { bg: "#D1FAE5", fg: "#057A55", arrow: "▼ " }
      : { bg: "#F3F4F6", fg: "#6B7280", arrow: "→ " }
    : null;
  return (
    <div style={card}>
      <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 6, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: color || COLORS.text, lineHeight: 1 }}>
        {typeof value === "number" ? fmtNum(value) : value}
      </div>
      {sub && <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>{sub}</div>}
      {delta && deltaStyle && (
        <div>
          <span
            style={{
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 6,
              display: "inline-block",
              marginTop: 6,
              background: deltaStyle.bg,
              color: deltaStyle.fg,
              fontWeight: 600,
            }}
          >
            {deltaStyle.arrow}
            {delta.text}
          </span>
        </div>
      )}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        fontSize: 16,
        fontWeight: 700,
        color: COLORS.text,
        margin: "0 0 14px",
        borderLeft: `3px solid ${COLORS.primary}`,
        paddingLeft: 10,
      }}
    >
      {children}
    </h3>
  );
}

// ─── Top Rejection Reasons bar chart ─────────────────────────────────────────

function RejectionReasonChart({
  rows,
  color = COLORS.primary,
}: {
  rows: UGCRow[];
  color?: string;
}) {
  const rejected = rows.filter((r) => r.action === "Rejected");
  const counts = countBy(rejected, (r) => r.reason);
  const data = topN(
    Object.entries(counts).map(([reason, count]) => ({ reason, count })),
    (x) => x.count,
    10
  );
  const max = data[0]?.count || 1;
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {data.map((d, i) => (
        <div
          key={i}
          onMouseEnter={() => setHoveredIndex(i)}
          onMouseLeave={() => setHoveredIndex(null)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            cursor: "default",
            background: hoveredIndex === i ? "#F9FAFB" : "transparent",
            borderRadius: 4,
            padding: "2px 4px",
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: COLORS.muted,
              width: 220,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
            title={d.reason}
          >
            {d.reason}
          </div>
          <div style={{ flex: 1, background: "#F3F4F6", borderRadius: 4, height: 18, position: "relative" }}>
            <div
              style={{
                width: `${(d.count / max) * 100}%`,
                background: color,
                borderRadius: 4,
                height: "100%",
                opacity: 0.85,
              }}
            />
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.text, width: 60, textAlign: "right" }}>
            {fmtNum(d.count)}
          </div>
          <div style={{ fontSize: 11, color: COLORS.muted, width: 44, textAlign: "right" }}>
            {pct(d.count, rejected.length)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Monthly trend line ───────────────────────────────────────────────────────

function MonthlyTrendChart({
  dataByMonth,
}: {
  dataByMonth: { label: string; rejectionRate: number; volume: number; rejectionCount: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={dataByMonth}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis
          yAxisId="rate"
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 11 }}
          width={40}
        />
        <YAxis yAxisId="vol" orientation="right" tickFormatter={(v) => fmtNum(v)} tick={{ fontSize: 11 }} width={50} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(val: any, name: string) =>
            name === "Rejection Rate" ? `${Number(val).toFixed(1)}%` : fmtNum(Number(val))
          }
        />
        <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
        <Line
          yAxisId="rate"
          type="monotone"
          dataKey="rejectionRate"
          name="Rejection Rate"
          stroke={COLORS.danger}
          strokeWidth={2.5}
          dot={{ r: 4 }}
        />
        <Line
          yAxisId="vol"
          type="monotone"
          dataKey="volume"
          name="Total Volume"
          stroke={COLORS.primary}
          strokeWidth={2}
          dot={{ r: 3 }}
          strokeDasharray="5 3"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── Category breakdown ────────────────────────────────────────────────────────

function CategoryBreakdown({ rows }: { rows: UGCRow[] }) {
  const rejected = rows.filter((r) => r.action === "Rejected");
  const counts = countBy(rejected, (r) => r.category);
  const data = topN(
    Object.entries(counts).map(([cat, count]) => ({ cat, count })),
    (x) => x.count,
    8
  );

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ left: 0 }}>
        <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={fmtNum} />
        <YAxis
          type="category"
          dataKey="cat"
          width={110}
          tick={{ fontSize: 10 }}
          tickFormatter={(v) => (v.length > 14 ? v.slice(0, 13) + "…" : v)}
        />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => fmtNum(Number(v))} />
        <Bar dataKey="count" name="Rejections" fill={COLORS.purple} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Language Distribution ────────────────────────────────────────────────────

function LanguageDonut({ rows }: { rows: UGCRow[] }) {
  const counts = countBy(rows, (r) => r.review_language);
  const data = Object.entries(counts)
    .map(([lang, count]) => ({ lang, count }))
    .sort((a, b) => b.count - a.count);
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      <PieChart width={140} height={140}>
        <Pie data={data} dataKey="count" nameKey="lang" innerRadius={40} outerRadius={65} cx="50%" cy="50%">
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => fmtNum(Number(v))} />
      </PieChart>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 11 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{ width: 8, height: 8, borderRadius: 2, background: PALETTE[i % PALETTE.length], display: "inline-block" }}
            />
            <span style={{ color: COLORS.text, fontWeight: 500 }}>{d.lang}</span>
            <span style={{ color: COLORS.muted }}>{pct(d.count, total)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Rating vs Rejection (Text + Video only) ─────────────────────────────────

function RatingRejectionChart({ rows }: { rows: UGCRow[] }) {
  const withRating = rows.filter((r) => r.rating != null && !isNaN(Number(r.rating)));
  if (!withRating.length) return <div style={{ color: COLORS.muted, fontSize: 13 }}>No rating data for this queue.</div>;

  const byRating: Record<string, { total: number; rejected: number }> = {};
  for (const r of withRating) {
    const star = String(Math.round(Number(r.rating)));
    if (!byRating[star]) byRating[star] = { total: 0, rejected: 0 };
    byRating[star].total++;
    if (r.action === "Rejected") byRating[star].rejected++;
  }

  const data = [1, 2, 3, 4, 5].map((s) => {
    const b = byRating[String(s)] || { total: 0, rejected: 0 };
    return {
      star: `★${s}`,
      total: b.total,
      rejected: b.rejected,
      rate: b.total ? (b.rejected / b.total) * 100 : 0,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data}>
        <XAxis dataKey="star" tick={{ fontSize: 12 }} />
        <YAxis yAxisId="vol" tick={{ fontSize: 11 }} tickFormatter={fmtNum} />
        <YAxis yAxisId="rate" orientation="right" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v: any, name: string) => (name === "Rejection Rate" ? `${Number(v).toFixed(1)}%` : fmtNum(Number(v)))}
        />
        <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
        <Bar yAxisId="vol" dataKey="total" name="Total" fill="#E5E7EB" radius={[3, 3, 0, 0]} />
        <Bar yAxisId="vol" dataKey="rejected" name="Rejected" fill={COLORS.danger} radius={[3, 3, 0, 0]} />
        <Line
          yAxisId="rate"
          type="monotone"
          dataKey="rate"
          name="Rejection Rate"
          stroke={COLORS.amber}
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Video Duration Buckets ───────────────────────────────────────────────────

function VideoDurationChart({ rows }: { rows: UGCRow[] }) {
  const withDuration = rows.filter((r) => r.duration_seconds != null);
  if (!withDuration.length) return <div style={{ color: COLORS.muted, fontSize: 13 }}>No duration data.</div>;

  const buckets: Record<string, { total: number; rejected: number }> = {
    "0–30s": { total: 0, rejected: 0 },
    "31–60s": { total: 0, rejected: 0 },
    "61–120s": { total: 0, rejected: 0 },
    "2–5min": { total: 0, rejected: 0 },
    "5min+": { total: 0, rejected: 0 },
  };

  for (const r of withDuration) {
    const d = Number(r.duration_seconds);
    const bucket =
      d <= 30 ? "0–30s" : d <= 60 ? "31–60s" : d <= 120 ? "61–120s" : d <= 300 ? "2–5min" : "5min+";
    buckets[bucket].total++;
    if (r.action === "Rejected") buckets[bucket].rejected++;
  }

  const data = Object.entries(buckets).map(([bucket, b]) => ({
    bucket,
    total: b.total,
    rejected: b.rejected,
    rate: b.total ? (b.rejected / b.total) * 100 : 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data}>
        <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="vol" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="rate" orientation="right" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
        <Bar yAxisId="vol" dataKey="total" name="Total" fill={QUEUE_COLORS.video} radius={[3, 3, 0, 0]} />
        <Bar yAxisId="vol" dataKey="rejected" name="Rejected" fill={COLORS.danger} radius={[3, 3, 0, 0]} />
        <Line
          yAxisId="rate"
          type="monotone"
          dataKey="rate"
          name="Rejection Rate"
          stroke="#111827"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Queue Overview cards ─────────────────────────────────────────────────────

function QueueSummaryCards({ allRows }: { allRows: UGCRow[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
      {QUEUES.map((q) => {
        const rows = allRows.filter((r) => r.queue_type === q);
        const rejected = rows.filter((r) => r.action === "Rejected").length;
        const rate = rows.length ? (rejected / rows.length) * 100 : 0;
        return (
          <div
            key={q}
            style={{
              ...card,
              borderTop: `3px solid ${QUEUE_COLORS[q]}`,
              padding: 16,
            }}
          >
            <div style={{ fontSize: 11, color: COLORS.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
              {QUEUE_LABELS[q]}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.text }}>{fmtNum(rows.length)}</div>
            <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>Total reviewed</div>
            <div
              style={{
                marginTop: 10,
                fontSize: 14,
                fontWeight: 700,
                color: rate > 40 ? COLORS.danger : rate > 20 ? COLORS.amber : COLORS.success,
              }}
            >
              {rate.toFixed(1)}% rejected
            </div>
            <div style={{ fontSize: 11, color: COLORS.muted }}>{fmtNum(rejected)} items</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Rejection heatmap by queue × month ──────────────────────────────────────

function RejectionHeatmap({ allRows }: { allRows: UGCRow[] }) {
  const data = MONTHS.map(({ label, month }) => {
    const monthRows = allRows.filter((r) => r.month === month);
    const row: Record<string, any> = { month: label };
    QUEUES.forEach((q) => {
      const qRows = monthRows.filter((r) => r.queue_type === q);
      const rej = qRows.filter((r) => r.action === "Rejected").length;
      row[q] = qRows.length ? +((rej / qRows.length) * 100).toFixed(1) : null;
    });
    return row;
  });

  const allRates = data.flatMap((d) => QUEUES.map((q) => d[q] as number | null).filter((v) => v != null)) as number[];
  const max = Math.max(...allRates, 1);

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            <th style={{ padding: "8px 12px", textAlign: "left", color: COLORS.muted, fontWeight: 600, fontSize: 11 }}>Month</th>
            {QUEUES.map((q) => (
              <th key={q} style={{ padding: "8px 12px", textAlign: "center", color: QUEUE_COLORS[q], fontWeight: 700, fontSize: 11 }}>
                {QUEUE_LABELS[q]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
              <td style={{ padding: "10px 12px", fontWeight: 600, color: COLORS.text }}>{row.month}</td>
              {QUEUES.map((q) => {
                const val = row[q] as number | null;
                const intensity = val != null ? val / max : 0;
                const bg = val != null ? `rgba(224,36,36,${(intensity * 0.6 + 0.05).toFixed(2)})` : "#F9FAFB";
                const textColor = intensity > 0.5 ? "#fff" : COLORS.text;
                return (
                  <td key={q} style={{ padding: "10px 12px", textAlign: "center" }}>
                    <span
                      style={{
                        display: "inline-block",
                        background: bg,
                        color: textColor,
                        padding: "4px 10px",
                        borderRadius: 6,
                        fontWeight: 600,
                        minWidth: 52,
                      }}
                    >
                      {val != null ? `${val}%` : "—"}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Tabs ────────────────────────────────────────────────────────────────

type Tab = "Overview" | "Text" | "Image" | "Question" | "Video" | "Answer";

const TABS: Tab[] = ["Overview", "Text", "Image", "Question", "Video", "Answer"];

type SubTab = "Daily" | "Weekly" | "Monthly";
const SUB_TABS: SubTab[] = ["Daily", "Weekly", "Monthly"];

// ─── Per-Queue Deep Dive ──────────────────────────────────────────────────────

function QueueDeepDive({
  queue,
  allRows,
  selectedMonths,
  loadingState,
}: {
  queue: QueueType;
  allRows: UGCRow[];
  selectedMonths: MonthKey[];
  loadingState: Record<string, boolean>;
}) {
  const [subTab, setSubTab] = useState<SubTab>("Monthly");
  const activeMths = MONTHS.filter((m) => selectedMonths.includes(m.key));

  const filtered = allRows.filter(
    (r) => r.queue_type === queue && activeMths.some((m) => m.month === r.month)
  );

  // If this queue's data for the selected months hasn't arrived yet, show a
  // dedicated loading state instead of zeroed-out KPIs/charts.
  const queueStillLoading = activeMths.some((m) => loadingState[`${queue}_${m.key}`]);
  if (filtered.length === 0 && queueStillLoading) {
    return (
      <div style={{ ...card, textAlign: "center", padding: 60, color: COLORS.muted, fontSize: 14 }}>
        <div className="rej-spinner" style={{ margin: "0 auto 16px" }} />
        Loading {QUEUE_LABELS[queue]} data…
      </div>
    );
  }

  const rejected = filtered.filter((r) => r.action === "Rejected");
  const approved = filtered.filter((r) => r.action === "Approved");
  const rejRate = filtered.length ? (rejected.length / filtered.length) * 100 : 0;
  const approvalRate = filtered.length ? (approved.length / filtered.length) * 100 : 0;

  // Month-over-month deltas (first vs last selected month)
  let deltaTotal: { text: string; direction: "neutral" } | undefined;
  let deltaApproved: { text: string; direction: "neutral" } | undefined;
  let deltaRejected: { text: string; direction: "neutral" } | undefined;
  let deltaRate: { text: string; direction: "up-bad" | "down-good" | "neutral" } | undefined;
  if (selectedMonths.length >= 2) {
    const sorted = [...selectedMonths].sort();
    const mFirst = MONTHS.find((m) => m.key === sorted[0]);
    const mLast = MONTHS.find((m) => m.key === sorted[sorted.length - 1]);
    if (mFirst && mLast) {
      const rowsFirst = filtered.filter((r) => r.month === mFirst.month);
      const rowsLast = filtered.filter((r) => r.month === mLast.month);
      const aFirst = rowsFirst.filter((r) => r.action === "Approved").length;
      const aLast = rowsLast.filter((r) => r.action === "Approved").length;
      const rFirst = rowsFirst.filter((r) => r.action === "Rejected").length;
      const rLast = rowsLast.filter((r) => r.action === "Rejected").length;
      const dT = rowsLast.length - rowsFirst.length;
      const dA = aLast - aFirst;
      const dR = rLast - rFirst;
      deltaTotal = { text: dT >= 0 ? `+${fmtNum(dT)}` : fmtNum(dT), direction: "neutral" };
      deltaApproved = { text: dA >= 0 ? `+${fmtNum(dA)}` : fmtNum(dA), direction: "neutral" };
      deltaRejected = { text: dR >= 0 ? `+${fmtNum(dR)}` : fmtNum(dR), direction: "neutral" };
      const firstRate = rowsFirst.length ? (rFirst / rowsFirst.length) * 100 : 0;
      const lastRate = rowsLast.length ? (rLast / rowsLast.length) * 100 : 0;
      const dRate = lastRate - firstRate;
      deltaRate = {
        text: dRate >= 0 ? `+${dRate.toFixed(1)}pp` : `${dRate.toFixed(1)}pp`,
        direction: dRate > 0 ? "up-bad" : dRate < 0 ? "down-good" : "neutral",
      };
    }
  }

  const monthlyData = MONTHS.filter((m) => selectedMonths.includes(m.key)).map(({ label, month }) => {
    const mRows = filtered.filter((r) => r.month === month);
    const mRej = mRows.filter((r) => r.action === "Rejected").length;
    return {
      label,
      volume: mRows.length,
      rejectionCount: mRej,
      rejectionRate: mRows.length ? (mRej / mRows.length) * 100 : 0,
    };
  });

  const qColor = QUEUE_COLORS[queue];
  const weeklyData = buildWeeklyData(filtered);

  return (
    <div style={{ display: "grid", gap: 24 }}>
      {/* KPI Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
        <KpiCard label="Total Reviewed" value={filtered.length} delta={deltaTotal} />
        <KpiCard label="Approved" value={approved.length} color={COLORS.success} sub={pct(approved.length, filtered.length)} delta={deltaApproved} />
        <KpiCard label="Rejected" value={rejected.length} color={COLORS.danger} sub={pct(rejected.length, filtered.length)} delta={deltaRejected} />
        <KpiCard
          label="Rejection Rate"
          value={`${rejRate.toFixed(1)}%`}
          color={rejRate > 40 ? COLORS.danger : rejRate > 20 ? COLORS.amber : COLORS.success}
          delta={deltaRate}
        />
      </div>

      {/* Sub-tab pill bar */}
      <div style={{ display: "flex", gap: 8 }}>
        {SUB_TABS.map((st) => {
          const active = subTab === st;
          return (
            <button
              key={st}
              onClick={() => setSubTab(st)}
              style={{
                padding: "6px 14px",
                borderRadius: 999,
                border: "none",
                background: active ? COLORS.primary : "#F3F4F6",
                color: active ? "#fff" : COLORS.muted,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {st}
            </button>
          );
        })}
      </div>

      {subTab === "Monthly" && (
        <>
          {/* Reason Chart + Language */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
            <div style={card}>
              <SectionHeading>Top Rejection Reasons</SectionHeading>
              <RejectionReasonChart rows={filtered} color={qColor} />
            </div>
            <div style={card}>
              <SectionHeading>Language Distribution</SectionHeading>
              <LanguageDonut rows={filtered} />
            </div>
          </div>

          {/* Monthly Trend */}
          <div style={card}>
            <SectionHeading>Monthly Trend</SectionHeading>
            <MonthlyTrendChart dataByMonth={monthlyData} />
          </div>

          {/* Category breakdown */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={card}>
              <SectionHeading>Rejection by Category (Top 8)</SectionHeading>
              <CategoryBreakdown rows={filtered} />
            </div>

            {(queue === "text" || queue === "video") && (
              <div style={card}>
                <SectionHeading>
                  {queue === "text" ? "Rejection Rate by Star Rating" : "Rejection by Video Duration"}
                </SectionHeading>
                {queue === "text" ? <RatingRejectionChart rows={filtered} /> : <VideoDurationChart rows={filtered} />}
              </div>
            )}

            {queue === "image" && (
              <div style={card}>
                <SectionHeading>Approval vs. Rejection Split</SectionHeading>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 12 }}>
                  {[
                    { label: "Approved", val: approved.length, color: COLORS.success },
                    { label: "Rejected", val: rejected.length, color: COLORS.danger },
                  ].map((item) => (
                    <div key={item.label}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                        <span style={{ color: item.color, fontWeight: 600 }}>{item.label}</span>
                        <span>{fmtNum(item.val)} ({pct(item.val, filtered.length)})</span>
                      </div>
                      <div style={{ background: "#F3F4F6", borderRadius: 4, height: 14 }}>
                        <div
                          style={{
                            width: `${(item.val / (filtered.length || 1)) * 100}%`,
                            background: item.color,
                            borderRadius: 4,
                            height: "100%",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 6, fontWeight: 600 }}>TOP REASON FOR IMAGE REJECTION</div>
                    {(() => {
                      const counts = countBy(rejected, (r) => r.reason);
                      const top = topN(Object.entries(counts).map(([r, c]) => ({ r, c })), (x) => x.c, 1)[0];
                      return top ? (
                        <div style={{ background: "#FEF2F2", borderRadius: 8, padding: 12, fontSize: 13, color: COLORS.danger, fontWeight: 600 }}>
                          "{top.r}" — {pct(top.c, rejected.length)} of rejections
                        </div>
                      ) : null;
                    })()}
                  </div>
                </div>
              </div>
            )}

            {(queue === "question" || queue === "answer") && (
              <div style={card}>
                <SectionHeading>Approval Rate by Category</SectionHeading>
                {(() => {
                  const cats = countBy(filtered, (r) => r.category);
                  const data = topN(
                    Object.entries(cats).map(([cat, total]) => {
                      const catRows = filtered.filter((r) => r.category === cat);
                      const apr = catRows.filter((r) => r.action === "Approved").length;
                      return { cat, total, approvalRate: total ? (apr / total) * 100 : 0 };
                    }),
                    (x) => x.total,
                    8
                  );
                  return (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={data} layout="vertical">
                        <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                        <YAxis
                          type="category"
                          dataKey="cat"
                          width={110}
                          tick={{ fontSize: 10 }}
                          tickFormatter={(v) => (v.length > 13 ? v.slice(0, 12) + "…" : v)}
                        />
                        <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => `${Number(v).toFixed(1)}%`} />
                        <Bar dataKey="approvalRate" name="Approval Rate" fill={COLORS.success} radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  );
                })()}
              </div>
            )}
          </div>
        </>
      )}

      {subTab === "Weekly" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
            <div style={card}>
              <SectionHeading>Top Rejection Reasons</SectionHeading>
              <RejectionReasonChart rows={filtered} color={qColor} />
            </div>
            <div style={card}>
              <SectionHeading>Language Distribution</SectionHeading>
              <LanguageDonut rows={filtered} />
            </div>
          </div>

          <div style={card}>
            <SectionHeading>Weekly Trend</SectionHeading>
            <MonthlyTrendChart dataByMonth={weeklyData} />
          </div>

          <div style={card}>
            <SectionHeading>Rejection by Category (Top 8)</SectionHeading>
            <CategoryBreakdown rows={filtered} />
          </div>
        </>
      )}

      {subTab === "Daily" && (
        <>
          <div style={card}>
            <SectionHeading>Daily Volume & Rejection Rate</SectionHeading>
            <DailyTrendChart rows={filtered} barColor={qColor} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
            <div style={card}>
              <SectionHeading>Top Rejection Reasons</SectionHeading>
              <RejectionReasonChart rows={filtered} color={qColor} />
            </div>
            <div style={card}>
              <SectionHeading>Language Distribution</SectionHeading>
              <LanguageDonut rows={filtered} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ allRows, selectedMonths }: { allRows: UGCRow[]; selectedMonths: MonthKey[] }) {
  const activeMths = MONTHS.filter((m) => selectedMonths.includes(m.key));
  const filtered = allRows.filter((r) => activeMths.some((m) => m.month === r.month));

  const total = filtered.length;
  const rejected = filtered.filter((r) => r.action === "Rejected").length;
  const approved = filtered.filter((r) => r.action === "Approved").length;
  const rejRate = total ? (rejected / total) * 100 : 0;

  // Month-over-month deltas (first vs last selected month)
  let deltaTotal: { text: string; direction: "neutral" } | undefined;
  let deltaApproved: { text: string; direction: "neutral" } | undefined;
  let deltaRejected: { text: string; direction: "neutral" } | undefined;
  let deltaRate: { text: string; direction: "up-bad" | "down-good" | "neutral" } | undefined;
  if (selectedMonths.length >= 2) {
    const sorted = [...selectedMonths].sort();
    const mFirst = MONTHS.find((m) => m.key === sorted[0]);
    const mLast = MONTHS.find((m) => m.key === sorted[sorted.length - 1]);
    if (mFirst && mLast) {
      const rowsFirst = filtered.filter((r) => r.month === mFirst.month);
      const rowsLast = filtered.filter((r) => r.month === mLast.month);
      const aFirst = rowsFirst.filter((r) => r.action === "Approved").length;
      const aLast = rowsLast.filter((r) => r.action === "Approved").length;
      const rFirst = rowsFirst.filter((r) => r.action === "Rejected").length;
      const rLast = rowsLast.filter((r) => r.action === "Rejected").length;
      const dT = rowsLast.length - rowsFirst.length;
      const dA = aLast - aFirst;
      const dR = rLast - rFirst;
      deltaTotal = { text: dT >= 0 ? `+${fmtNum(dT)}` : fmtNum(dT), direction: "neutral" };
      deltaApproved = { text: dA >= 0 ? `+${fmtNum(dA)}` : fmtNum(dA), direction: "neutral" };
      deltaRejected = { text: dR >= 0 ? `+${fmtNum(dR)}` : fmtNum(dR), direction: "neutral" };
      const firstRate = rowsFirst.length ? (rFirst / rowsFirst.length) * 100 : 0;
      const lastRate = rowsLast.length ? (rLast / rowsLast.length) * 100 : 0;
      const dRate = lastRate - firstRate;
      deltaRate = {
        text: dRate >= 0 ? `+${dRate.toFixed(1)}pp` : `${dRate.toFixed(1)}pp`,
        direction: dRate > 0 ? "up-bad" : dRate < 0 ? "down-good" : "neutral",
      };
    }
  }

  const queueVolumeData = QUEUES.map((q) => ({
    queue: QUEUE_LABELS[q],
    total: filtered.filter((r) => r.queue_type === q).length,
    rejected: filtered.filter((r) => r.queue_type === q && r.action === "Rejected").length,
  }));

  const monthlyData = MONTHS.filter((m) => selectedMonths.includes(m.key)).map(({ label, month }) => {
    const mRows = filtered.filter((r) => r.month === month);
    const mRej = mRows.filter((r) => r.action === "Rejected").length;
    return {
      label,
      volume: mRows.length,
      rejectionCount: mRej,
      rejectionRate: mRows.length ? (mRej / mRows.length) * 100 : 0,
    };
  });

  return (
    <div style={{ display: "grid", gap: 24 }}>
      {/* Top KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
        <KpiCard label="Total Reviewed" value={total} delta={deltaTotal} />
        <KpiCard label="Total Approved" value={approved} color={COLORS.success} sub={pct(approved, total)} delta={deltaApproved} />
        <KpiCard label="Total Rejected" value={rejected} color={COLORS.danger} sub={pct(rejected, total)} delta={deltaRejected} />
        <KpiCard
          label="Overall Rejection Rate"
          value={`${rejRate.toFixed(1)}%`}
          color={rejRate > 40 ? COLORS.danger : rejRate > 20 ? COLORS.amber : COLORS.success}
          delta={deltaRate}
        />
      </div>

      {/* Queue summary cards */}
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text, marginBottom: 14, borderLeft: `3px solid ${COLORS.primary}`, paddingLeft: 10 }}>
          Queue Summary
        </div>
        <QueueSummaryCards allRows={filtered} />
      </div>

      {/* Heatmap + Monthly trend */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={card}>
          <SectionHeading>Rejection Rate Heatmap — Queue × Month</SectionHeading>
          <RejectionHeatmap allRows={allRows} />
        </div>
        <div style={card}>
          <SectionHeading>Monthly Volume & Rejection Trend (All Queues)</SectionHeading>
          <MonthlyTrendChart dataByMonth={monthlyData} />
        </div>
      </div>

      {/* Weekly per-queue rejection rate */}
      <div style={card}>
        <SectionHeading>Weekly Rejection Trend — All Queues</SectionHeading>
        <WeeklyByQueueChart rows={filtered} />
      </div>

      {/* Daily combined */}
      <div style={card}>
        <SectionHeading>Daily Volume & Rejection Rate</SectionHeading>
        <DailyTrendChart rows={filtered} />
      </div>

      {/* Volume by queue bar */}
      <div style={card}>
        <SectionHeading>Volume by Queue</SectionHeading>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={queueVolumeData}>
            <XAxis dataKey="queue" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={fmtNum} tick={{ fontSize: 11 }} scale="sqrt" domain={[0, "auto"]} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => fmtNum(Number(v))} />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="total" name="Total" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
            <Bar dataKey="rejected" name="Rejected" fill={COLORS.danger} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top reasons across all queues */}
      <div style={card}>
        <SectionHeading>Top Rejection Reasons — All Queues Combined</SectionHeading>
        <RejectionReasonChart rows={filtered} />
      </div>
    </div>
  );
}

// ─── Nav / Shell ──────────────────────────────────────────────────────────────

function Nav({ onLogout, tab, setTab }: { onLogout: () => void; tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <div style={{ background: "#fff", borderBottom: `1px solid ${COLORS.border}`, position: "sticky", top: 0, zIndex: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <img src={logo} alt="Netscribes" style={{ height: 30, width: "auto" }} />
          <div
            style={{
              background: "#EFF6FF",
              color: COLORS.primary,
              padding: "5px 12px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.03em",
            }}
          >
            Flipkart UGC — Rejection Intelligence
          </div>
        </div>
        <button
          onClick={onLogout}
          style={{
            padding: "7px 14px",
            background: "#fff",
            color: COLORS.text,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Logout
        </button>
      </div>
      <div style={{ display: "flex", gap: 2, padding: "0 20px", overflowX: "auto" }}>
        {TABS.map((t) => {
          const active = tab === t;
          const color = t === "Overview" ? COLORS.primary : QUEUE_COLORS[t.toLowerCase() as QueueType] || COLORS.primary;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "10px 16px",
                background: "transparent",
                color: active ? color : COLORS.muted,
                border: "none",
                borderBottom: active ? `3px solid ${color}` : "3px solid transparent",
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                cursor: "pointer",
                fontFamily: "inherit",
                whiteSpace: "nowrap",
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

// ─── Filter Bar ───────────────────────────────────────────────────────────────

function FilterBar({
  selectedMonths,
  setSelectedMonths,
  loadingState,
}: {
  selectedMonths: MonthKey[];
  setSelectedMonths: (m: MonthKey[]) => void;
  loadingState: Record<string, boolean>;
}) {
  const toggle = (key: MonthKey) => {
    setSelectedMonths(
      selectedMonths.includes(key)
        ? selectedMonths.length > 1
          ? selectedMonths.filter((m) => m !== key)
          : selectedMonths
        : [...selectedMonths, key]
    );
  };

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 10,
        padding: "12px 20px",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.muted }}>Month:</span>
      {MONTHS.map((m) => {
        const active = selectedMonths.includes(m.key);
        const isLoading = Object.values(loadingState).some(Boolean);
        return (
          <button
            key={m.key}
            onClick={() => toggle(m.key)}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: `1.5px solid ${active ? COLORS.primary : COLORS.border}`,
              background: active ? "#EFF6FF" : "#fff",
              color: active ? COLORS.primary : COLORS.muted,
              fontSize: 13,
              fontWeight: active ? 700 : 500,
              cursor: isLoading ? "wait" : "pointer",
              fontFamily: "inherit",
              transition: "all 0.15s",
            }}
          >
            {m.label}
          </button>
        );
      })}
      {/* Per-queue spinner list removed — unified progress bar lives below the FilterBar. */}
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

export default function RejectionDashboard({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>("Overview");
  const [selectedMonths, setSelectedMonths] = useState<MonthKey[]>(["2026_2", "2026_3", "2026_4"]);
  const [loadedData, setLoadedData] = useState<LoadedMonth[]>([]);
  const [loadingState, setLoadingState] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number; current: string }>({
    done: 0,
    total: 0,
    current: "",
  });

  // Small queues load first so Overview renders quickly.
  // Text + Image (chunked, large) load after in the background.
  const SMALL_QUEUES: QueueType[] = ["video", "question", "answer"];
  const LARGE_QUEUES: QueueType[] = ["text", "image"];
  const activeQueues: QueueType[] =
    tab === "Overview" ? QUEUES : [tab.toLowerCase() as QueueType];

  // Use a ref to track which queue+month combos are already loaded or in-flight.
  // This avoids stale closure bugs with useCallback([loadedData]).
  const loadedKeysRef = useRef<Set<string>>(new Set());

  // Concurrency-limited fetch queue with priority. The active tab's queue is
  // bumped to the front when the user switches tabs, so subtab data starts
  // downloading immediately instead of waiting behind already-queued items.
  const MAX_CONCURRENT = 2;
  const fetchQueueRef = useRef<{ queue: QueueType; monthKey: MonthKey; priority: number }[]>([]);
  const activeWorkersRef = useRef(0);
  const fetchRunnerRef = useRef<(q: QueueType, m: MonthKey) => Promise<void>>(() => Promise.resolve());

  const pump = () => {
    while (activeWorkersRef.current < MAX_CONCURRENT && fetchQueueRef.current.length > 0) {
      fetchQueueRef.current.sort((a, b) => b.priority - a.priority);
      const next = fetchQueueRef.current.shift()!;
      activeWorkersRef.current++;
      fetchRunnerRef.current(next.queue, next.monthKey).finally(() => {
        activeWorkersRef.current--;
        pump();
      });
    }
  };

  const enqueueFetch = (queue: QueueType, monthKey: MonthKey, priority: number) => {
    const cacheKey = `${queue}__${monthKey}`;
    if (loadedKeysRef.current.has(cacheKey)) return;
    const existing = fetchQueueRef.current.find((x) => x.queue === queue && x.monthKey === monthKey);
    if (existing) {
      if (priority > existing.priority) existing.priority = priority;
      return;
    }
    fetchQueueRef.current.push({ queue, monthKey, priority });
    // Reserve progress units up-front so the user sees the full file count
    // (e.g. "0 / 21") immediately, not just the items currently in flight.
    const fileUnits = LARGE_QUEUES.includes(queue) ? 2 : 1;
    setProgress((p) => ({ ...p, total: p.total + fileUnits }));
    pump();
  };

  const fetchIfNeeded = async (queue: QueueType, monthKey: MonthKey) => {
    const cacheKey = `${queue}__${monthKey}`;
    if (loadedKeysRef.current.has(cacheKey)) return;
    loadedKeysRef.current.add(cacheKey); // mark immediately to prevent duplicate fetches

    const m = MONTHS.find((mm) => mm.key === monthKey);
    if (!m) return;

    const stateKey = `${queue}_${monthKey}`;
    setLoadingState((prev) => ({ ...prev, [stateKey]: true }));
    // Each large queue file is split into 2 parts; small queues are single files.
    // Total units were already reserved in enqueueFetch — only update `current` here.
    const fileUnits = LARGE_QUEUES.includes(queue) ? 2 : 1;
    setProgress((p) => ({ ...p, current: `${queue} ${m.label}` }));
    try {
      const rows = await fetchQueueMonth(queue, m.year, m.month, () => {
        setProgress((p) => ({ ...p, done: p.done + 1, current: `${queue} ${m.label}` }));
      });
      const tagged = rows.map((r) => ({
        ...r,
        // Source files store queue_type capitalized ("Question", "Image", …)
        // but all filters compare against the lowercase QueueType key, so
        // force it to the canonical lowercase value here.
        queue_type: queue,
        month: r.month || m.month,
        year: r.year || m.year,
        month_label: r.month_label || m.label,
      }));
      setLoadedData((prev) => [...prev, { key: monthKey, queue, rows: tagged }]);
    } catch (e: any) {
      loadedKeysRef.current.delete(cacheKey); // allow retry on error
      setErrors((prev) => [...prev, `${queue} ${m.label}: ${e?.message || String(e)}`]);
      // Skip this file's units so the bar still completes
      setProgress((p) => ({ ...p, done: Math.min(p.done + fileUnits, p.total) }));
    } finally {
      setLoadingState((prev) => {
        const n = { ...prev };
        delete n[stateKey];
        return n;
      });
    }
  };
  fetchRunnerRef.current = fetchIfNeeded;

  useEffect(() => {
    // Always enqueue every queue × month so subtab switches don't trigger
    // a fresh download, but boost the active subtab's priority so it jumps
    // to the front of the pending queue (currently-running fetches finish
    // first, then prioritized ones run next).
    const activeQueue = tab === "Overview" ? null : (tab.toLowerCase() as QueueType);
    // Small queues get higher base priority than large (faster to render Overview).
    const basePriority = (q: QueueType) => (SMALL_QUEUES.includes(q) ? 2 : 1);
    for (const queue of QUEUES) {
      for (const monthKey of selectedMonths) {
        const priority = queue === activeQueue ? 100 : basePriority(queue);
        enqueueFetch(queue, monthKey, priority);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, selectedMonths]);

  const allRows = useMemo(() => loadedData.flatMap((d) => d.rows), [loadedData]);

  const isLoading = Object.values(loadingState).some(Boolean);
  const pctDone =
    progress.total > 0 ? Math.min(100, Math.round((progress.done / progress.total) * 100)) : 0;

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .rej-spinner {
          width: 32px; height: 32px;
          border: 3px solid #E5E7EB;
          border-top-color: #1A56DB;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
      `}</style>
      <div style={{ minHeight: "100vh", background: COLORS.bg, fontFamily: "DM Sans, sans-serif" }}>
        <Nav onLogout={onLogout} tab={tab} setTab={setTab} />
        <div style={{ padding: "20px 24px", maxWidth: 1320, margin: "0 auto", display: "grid", gap: 20 }}>
          <FilterBar
            selectedMonths={selectedMonths}
            setSelectedMonths={setSelectedMonths}
            loadingState={loadingState}
          />

          {isLoading && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                background: "#fff",
                border: `1px solid ${COLORS.border}`,
                borderRadius: 10,
                padding: "12px 18px",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}
            >
              <div className="rej-spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: COLORS.muted }}>
                  <span>
                    Loading rejection data — {progress.done}/{progress.total} files ({pctDone}%)
                  </span>
                  {progress.current && (
                    <span style={{ fontSize: 11, color: COLORS.muted, marginLeft: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {progress.current}
                    </span>
                  )}
                </div>
                <div style={{ width: "100%", height: 6, background: "#E5E7EB", borderRadius: 4, overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${pctDone}%`,
                      height: "100%",
                      background: COLORS.primary,
                      transition: "width 0.25s ease",
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {errors.length > 0 && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: 12, fontSize: 12, color: COLORS.danger }}>
              <strong>Some files could not be loaded:</strong>
              <ul style={{ margin: "6px 0 0 16px" }}>
                {errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          {allRows.length === 0 && !isLoading && errors.length === 0 && (
            <div style={{ textAlign: "center", padding: 60, color: COLORS.muted, fontSize: 14 }}>
              No data loaded. Add <code>fk_ugc_&#123;queue&#125;_2026_&#123;02|03|04&#125;.json.gz</code> files to <code>/public/</code>.
            </div>
          )}

          {/* Render as soon as ANY data arrives — don't wait for all 15 files */}
          {allRows.length > 0 && (
            <>
              {tab === "Overview" && (
                <OverviewTab allRows={allRows} selectedMonths={selectedMonths} />
              )}
              {tab !== "Overview" && (
                <QueueDeepDive
                  queue={tab.toLowerCase() as QueueType}
                  allRows={allRows}
                  selectedMonths={selectedMonths}
                  loadingState={loadingState}
                />
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
