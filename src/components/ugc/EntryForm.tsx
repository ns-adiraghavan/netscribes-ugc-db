import { useMemo, useState } from "react";

const COLORS = {
  primary: "#1A56DB",
  danger: "#E02424",
  success: "#057A55",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
};

const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 8,
  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  padding: 24,
};

type Platform = "flipkart" | "myntra";

const FK_FIELDS: { key: string; label: string }[] = [
  { key: "eng_text", label: "English Text" },
  { key: "hin_text", label: "Hindi Text" },
  { key: "eng_text_p0", label: "English Text P0" },
  { key: "hin_text_p0", label: "Hindi Text P0" },
  { key: "eng_text_p2", label: "English Text P2" },
  { key: "hin_text_p2", label: "Hindi Text P2" },
  { key: "eng_image", label: "English Image" },
  { key: "hin_image", label: "Hindi Image" },
  { key: "question", label: "Question" },
  { key: "answer", label: "Answer" },
  { key: "video", label: "Video" },
];

const MYN_FIELDS: { key: string; label: string }[] = [
  { key: "text_total", label: "Text Total" },
  { key: "image_total", label: "Image Total" },
  { key: "video", label: "Video" },
];

const FK_COLS: [string, string][] = [
  ["year", "Year"],
  ["week", "Week"],
  ["month_label", "Month"],
  ["date", "Date"],
  ["in_eng_text", "Inflow: English Text"],
  ["in_hin_text", "Inflow: Hindi Text"],
  ["in_eng_text_p0", "Inflow: English Text P0"],
  ["in_hin_text_p0", "Inflow: Hindi Text P0"],
  ["in_eng_text_p2", "Inflow: English Text P2"],
  ["in_hin_text_p2", "Inflow: Hindi Text P2"],
  ["in_eng_image", "Inflow: English Image"],
  ["in_hin_image", "Inflow: Hindi Image"],
  ["in_text_total", "Inflow: Text Total"],
  ["in_image_total", "Inflow: Image Total"],
  ["in_question", "Inflow: Question"],
  ["in_answer", "Inflow: Answer"],
  ["in_video", "Inflow: Video"],
  ["out_eng_text", "Outflow: English Text"],
  ["out_hin_text", "Outflow: Hindi Text"],
  ["out_eng_text_p0", "Outflow: English Text P0"],
  ["out_hin_text_p0", "Outflow: Hindi Text P0"],
  ["out_eng_text_p2", "Outflow: English Text P2"],
  ["out_hin_text_p2", "Outflow: Hindi Text P2"],
  ["out_eng_image", "Outflow: English Image"],
  ["out_hin_image", "Outflow: Hindi Image"],
  ["out_text_total", "Outflow: Text Total"],
  ["out_image_total", "Outflow: Image Total"],
  ["out_question", "Outflow: Question"],
  ["out_answer", "Outflow: Answer"],
  ["out_video", "Outflow: Video"],
  ["total_received", "Total Received"],
  ["total_delivered", "Total Delivered"],
  ["tat", "TAT"],
  ["pending_count", "Pending Count"],
  ["callout", "Callouts"],
];

const MYN_COLS: [string, string][] = [
  ["year", "Year"],
  ["week", "Week"],
  ["month_label", "Month"],
  ["date", "Date"],
  ["in_text_total", "Inflow: Text Total"],
  ["in_image_total", "Inflow: Image Total"],
  ["in_video", "Inflow: Video"],
  ["out_text_total", "Outflow: Text Total"],
  ["out_image_total", "Outflow: Image Total"],
  ["out_video", "Outflow: Video"],
  ["total_received", "Total Received"],
  ["total_delivered", "Total Delivered"],
  ["tat", "TAT"],
  ["pending_count", "Pending Count"],
  ["callout", "Callouts"],
];

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 8,
  fontSize: 13,
  fontFamily: "inherit",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: COLORS.muted,
  marginBottom: 4,
};

const num = (v: any) => {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

function csvEscape(v: any): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCSV(records: any[], platform: Platform) {
  const cols = platform === "flipkart" ? FK_COLS : MYN_COLS;
  const header = cols.map(([, h]) => csvEscape(h)).join(",");
  const rows = records.map((r) => cols.map(([k]) => csvEscape(r[k])).join(","));
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = platform === "flipkart" ? "flipkart_ugc_export.csv" : "myntra_ugc_export.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function weekOfYear(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00Z");
  const onejan = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((+d - +onejan) / 86400000 + onejan.getUTCDay() + 1) / 7);
}

function defaultMonthLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${months[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
}

export default function EntryForm({
  records,
  setRecords,
  platform,
}: {
  records: any[];
  setRecords: (fn: (prev: any[]) => any[]) => void;
  platform: Platform;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [week, setWeek] = useState(`Week - ${weekOfYear(today)}`);
  const [month, setMonth] = useState(defaultMonthLabel(today));
  const [tat, setTat] = useState("");
  const [pending, setPending] = useState("");
  const [inflow, setInflow] = useState<Record<string, string>>({});
  const [outflow, setOutflow] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fields = platform === "flipkart" ? FK_FIELDS : MYN_FIELDS;

  const totals = useMemo(() => {
    if (platform === "flipkart") {
      const inText =
        num(inflow.eng_text) + num(inflow.hin_text) + num(inflow.eng_text_p0) +
        num(inflow.hin_text_p0) + num(inflow.eng_text_p2) + num(inflow.hin_text_p2);
      const inImg = num(inflow.eng_image) + num(inflow.hin_image);
      const inTot = inText + inImg + num(inflow.question) + num(inflow.answer) + num(inflow.video);
      const outText =
        num(outflow.eng_text) + num(outflow.hin_text) + num(outflow.eng_text_p0) +
        num(outflow.hin_text_p0) + num(outflow.eng_text_p2) + num(outflow.hin_text_p2);
      const outImg = num(outflow.eng_image) + num(outflow.hin_image);
      const outTot = outText + outImg + num(outflow.question) + num(outflow.answer) + num(outflow.video);
      return { inText, inImg, inTot, outText, outImg, outTot };
    }
    const inTot = num(inflow.text_total) + num(inflow.image_total) + num(inflow.video);
    const outTot = num(outflow.text_total) + num(outflow.image_total) + num(outflow.video);
    return { inText: 0, inImg: 0, inTot, outText: 0, outImg: 0, outTot };
  }, [inflow, outflow, platform]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess("");
    if (!date) {
      setError("Date is required.");
      return;
    }
    if (totals.inTot <= 0) {
      setError("Total Received must be greater than 0.");
      return;
    }
    setError("");

    const numOrNull = (v: string) => (v === "" || v == null ? null : num(v));
    const yearVal = Number(date.slice(0, 4));
    const pendingVal = pending === "" ? null : num(pending);

    let record: any;
    if (platform === "flipkart") {
      record = {
        year: yearVal,
        week,
        month_label: month,
        date,
        in_eng_text: numOrNull(inflow.eng_text),
        in_hin_text: numOrNull(inflow.hin_text),
        in_eng_text_p0: numOrNull(inflow.eng_text_p0),
        in_hin_text_p0: numOrNull(inflow.hin_text_p0),
        in_eng_text_p2: numOrNull(inflow.eng_text_p2),
        in_hin_text_p2: numOrNull(inflow.hin_text_p2),
        in_eng_image: numOrNull(inflow.eng_image),
        in_hin_image: numOrNull(inflow.hin_image),
        in_text_total: totals.inText,
        in_image_total: totals.inImg,
        in_question: numOrNull(inflow.question),
        in_answer: numOrNull(inflow.answer),
        in_video: numOrNull(inflow.video),
        out_eng_text: numOrNull(outflow.eng_text),
        out_hin_text: numOrNull(outflow.hin_text),
        out_eng_text_p0: numOrNull(outflow.eng_text_p0),
        out_hin_text_p0: numOrNull(outflow.hin_text_p0),
        out_eng_text_p2: numOrNull(outflow.eng_text_p2),
        out_hin_text_p2: numOrNull(outflow.hin_text_p2),
        out_eng_image: numOrNull(outflow.eng_image),
        out_hin_image: numOrNull(outflow.hin_image),
        out_text_total: totals.outText,
        out_image_total: totals.outImg,
        out_question: numOrNull(outflow.question),
        out_answer: numOrNull(outflow.answer),
        out_video: numOrNull(outflow.video),
        total_received: totals.inTot,
        total_delivered: totals.outTot,
        tat: tat || null,
        pending_count: pendingVal,
        callout: null,
      };
    } else {
      record = {
        year: yearVal,
        week,
        month_label: month,
        date,
        in_text_total: numOrNull(inflow.text_total),
        in_image_total: numOrNull(inflow.image_total),
        in_video: numOrNull(inflow.video),
        out_text_total: numOrNull(outflow.text_total),
        out_image_total: numOrNull(outflow.image_total),
        out_video: numOrNull(outflow.video),
        total_received: totals.inTot,
        total_delivered: totals.outTot,
        tat: tat || null,
        pending_count: pendingVal,
        callout: null,
      };
    }

    setRecords((prev) => [...prev, record]);
    setSuccess(`Entry for ${date} added to this session.`);
    setInflow({});
    setOutflow({});
    setTat("");
    setPending("");
  };

  const headerCol: React.CSSProperties = {
    fontSize: 12,
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    fontWeight: 600,
    marginBottom: 12,
  };

  return (
    <div style={card}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: COLORS.text, margin: "0 0 20px" }}>Add New Day</h2>

      <form onSubmit={handleSubmit}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
          <div>
            <label style={labelStyle}>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Week</label>
            <input value={week} onChange={(e) => setWeek(e.target.value)} placeholder="Week - 21" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Month Label</label>
            <input value={month} onChange={(e) => setMonth(e.target.value)} placeholder="May-25" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>TAT</label>
            <input value={tat} onChange={(e) => setTat(e.target.value)} placeholder="H:MM:SS" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Pending</label>
            <input type="number" value={pending} onChange={(e) => setPending(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1px 1fr", gap: 24, alignItems: "start" }}>
          <div>
            <div style={headerCol}>INFLOW</div>
            <div style={{ display: "grid", gap: 10 }}>
              {fields.map((f) => (
                <div key={`in-${f.key}`}>
                  <label style={labelStyle}>{f.label}</label>
                  <input
                    type="number"
                    value={inflow[f.key] || ""}
                    onChange={(e) => setInflow({ ...inflow, [f.key]: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: COLORS.border, width: 1, alignSelf: "stretch" }} />
          <div>
            <div style={headerCol}>OUTFLOW</div>
            <div style={{ display: "grid", gap: 10 }}>
              {fields.map((f) => (
                <div key={`out-${f.key}`}>
                  <label style={labelStyle}>{f.label}</label>
                  <input
                    type="number"
                    value={outflow[f.key] || ""}
                    onChange={(e) => setOutflow({ ...outflow, [f.key]: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ background: "#F9FAFB", borderRadius: 8, padding: 16, marginTop: 20, display: "flex", gap: 32, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12, color: COLORS.muted }}>Total Received</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.text }}>{totals.inTot.toLocaleString()}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: COLORS.muted }}>Total Delivered</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.text }}>{totals.outTot.toLocaleString()}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
          <button
            type="submit"
            style={{ padding: "10px 20px", background: COLORS.primary, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
          >
            Submit Entry
          </button>
          <button
            type="button"
            onClick={() => downloadCSV(records, platform)}
            style={{ padding: "10px 20px", background: "#fff", color: COLORS.primary, border: `1px solid ${COLORS.primary}`, borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
          >
            Download CSV
          </button>
        </div>

        {error && <div style={{ color: COLORS.danger, fontSize: 13, marginTop: 12 }}>{error}</div>}
        {success && (
          <div style={{ background: "#F0FDF4", color: COLORS.success, fontSize: 13, padding: "10px 14px", borderRadius: 8, marginTop: 12, border: `1px solid ${COLORS.success}` }}>
            {success}
          </div>
        )}

        <p style={{ fontSize: 12, fontStyle: "italic", color: COLORS.muted, marginTop: 16 }}>
          To save permanently, add the row to the Excel file and re-run the Python script.
        </p>
      </form>
    </div>
  );
}