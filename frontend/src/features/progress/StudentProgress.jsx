import React, { useEffect, useState } from "react";
import API from "../../api";
import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";
import "../../App.css";

// health color by value (matches the old 75 / 50 thresholds)
const hue = (v) => {
  const n = Number(v) || 0;
  return n >= 75 ? "#16a34a" : n >= 50 ? "#d97706" : "#dc2626";
};

const clamp = (v) => Math.min(Math.max(Number(v) || 0, 0), 100);

// ── donut ring (overall %) ──
function Ring({ pct, size = 92, stroke = 9 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (clamp(pct) / 100) * circ;
  const color = hue(pct);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef0f4" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="48%" textAnchor="middle" dominantBaseline="central"
        style={{ fontSize: size * 0.24, fontWeight: 700, fill: "#0f172a", fontVariantNumeric: "tabular-nums" }}>
        {Math.round(clamp(pct))}%
      </text>
      <text x="50%" y="66%" textAnchor="middle" dominantBaseline="central"
        style={{ fontSize: 9.5, fill: "#98a2b3", textTransform: "uppercase", letterSpacing: ".04em" }}>
        overall
      </text>
    </svg>
  );
}

// ── one mini bar ──
function MiniBar({ label, value, color }) {
  const pct = clamp(value);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginTop: 7 }}>
      <span style={{ width: 76, color: "#667085", flex: "0 0 auto" }}>{label}</span>
      <div style={{ flex: 1, height: 6, borderRadius: 999, background: "#eef0f4", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: color }} />
      </div>
      <span style={{ width: 34, textAlign: "right", fontWeight: 600, flex: "0 0 auto", fontVariantNumeric: "tabular-nums", color: "#0f172a" }}>
        {Math.round(pct)}%
      </span>
    </div>
  );
}

// ── subject card ──
function SubjectCard({ item }) {
  const pending = item.pending_activities || [];
  return (
    <div style={{
      background: "#fff", border: "1px solid #eaecf0", borderRadius: 16, padding: "16px 18px",
      boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.04)",
    }}>
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <Ring pct={item.overall_progress} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.subject}
          </div>
          <div style={{ fontSize: 12.5, color: "#98a2b3", marginBottom: 6 }}>{item.course}</div>
          <MiniBar label="Attendance"  value={item.attendance_percent} color="#2563eb" />
          <MiniBar label="Assignments" value={item.assignment_percent} color="#16a34a" />
          <MiniBar label="Quiz avg"    value={item.quiz_average}       color="#d97706" />
        </div>
      </div>

      {/* pending activities — compact */}
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #f1f3f6" }}>
        {pending.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "#98a2b3" }}>No pending activities</div>
        ) : (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#667085", marginBottom: 8 }}>
              Pending · {pending.length}
            </div>
            {pending.map((a, i) => {
              const isQuiz = (a.type || "").toLowerCase() === "quiz";
              const tint = isQuiz ? { bg: "#f5f3ff", fg: "#7c3aed" } : { bg: "#eef4ff", fg: "#2563eb" };
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, padding: "5px 0" }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: tint.bg, color: tint.fg, flex: "0 0 auto", textTransform: "capitalize" }}>
                    {a.type}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.title}
                  </span>
                  <span style={{ color: "#98a2b3", flex: "0 0 auto" }}>
                    {a.due_date ? new Date(a.due_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}
                  </span>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

// ── main ──
export default function StudentProgress() {
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadProgress(); }, []);

  const loadProgress = async () => {
    setLoading(true);
    try {
      const res = await API.get("/my-progress/");
      setProgress(res.data || []);
    } catch (err) {
      console.log("Progress error", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <Navbar setOpen={setOpen} />
      <div className="layout">
        <Sidebar open={open} setOpen={setOpen} />
        <div className="main">
          <div className="content">

            {/* header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <h1 style={{ fontSize: 26, fontWeight: 700, color: "#0f172a", margin: 0 }}>My Progress</h1>
                <p style={{ fontSize: 14, color: "#667085", margin: "4px 0 0" }}>
                  Attendance, assignments, quizzes and pending activities by subject.
                </p>
              </div>
              {!loading && progress.length > 0 && (
                <span style={{ fontSize: 13, color: "#667085", whiteSpace: "nowrap" }}>
                  {progress.length} subject{progress.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            {/* loading */}
            {loading && (
              <div style={{ textAlign: "center", color: "#98a2b3", padding: "60px 0", fontSize: 14 }}>
                Loading your progress…
              </div>
            )}

            {/* empty */}
            {!loading && progress.length === 0 && (
              <div style={{ textAlign: "center", color: "#98a2b3", padding: "60px 0", fontSize: 14 }}>
                No progress data available yet.
              </div>
            )}

            {/* cards grid — 2 per row, reflow to 1 when narrow */}
            {!loading && progress.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 }}>
                {progress.map((item, i) => <SubjectCard key={i} item={item} />)}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}