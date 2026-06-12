import React, { useEffect, useState } from "react";
import API from "../../api";
import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";
import "../../styles/Progress.css";

// ── progress bar ──────────────────────────────────────────────────────────────
function Bar({ value, color }) {
  const pct = Math.min(Math.max(Number(value) || 0, 0), 100);
  return (
    <div className="prg-bar-track">
      <div className="prg-bar-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

// ── value color class ─────────────────────────────────────────────────────────
function valCls(v) {
  const n = Number(v) || 0;
  return n >= 75 ? "good" : n >= 50 ? "warn" : "low";
}

// ── single subject card ───────────────────────────────────────────────────────
function SubjectCard({ item }) {
  const metrics = [
    { label: "Attendance",   key: "attendance_percent",  color: "#2563eb" },
    { label: "Assignments",  key: "assignment_percent",  color: "#16a34a" },
    { label: "Quiz Average", key: "quiz_average",        color: "#d97706" },
    { label: "Overall",      key: "overall_progress",    color: "#7c3aed" },
  ];

  return (
    <div className="prg-subject-card">

      {/* ── Subject header ── */}
      <div className="prg-subject-head">
        <div>
          <h2 className="prg-subject-name">{item.subject}</h2>
          <span className="prg-subject-course">{item.course}</span>
        </div>
        <div className={`prg-overall-badge ${valCls(item.overall_progress)}`}>
          <span className="prg-overall-num">{Number(item.overall_progress) || 0}%</span>
          <span className="prg-overall-label">Overall</span>
        </div>
      </div>

      {/* ── Metric rows ── */}
      <div className="prg-metric-list">
        {metrics.map(({ label, key, color }) => {
          const pct = Math.min(Math.max(Number(item[key]) || 0, 0), 100);
          return (
            <div key={key} className="prg-metric-row">
              <span className="prg-metric-label">{label}</span>
              <div className="prg-metric-bar">
                <Bar value={pct} color={color} />
              </div>
              <span className={`prg-metric-val ${valCls(pct)}`}>{pct}%</span>
            </div>
          );
        })}
      </div>

      {/* ── Pending activities ── */}
      <div className="prg-pending">
        <h3 className="prg-pending-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          Pending Activities
          {item.pending_activities?.length > 0 && (
            <span className="prg-pending-count">{item.pending_activities.length}</span>
          )}
        </h3>

        {!item.pending_activities?.length ? (
          <p className="prg-pending-empty">No pending activities</p>
        ) : (
          <div className="prg-pending-table-wrap">
            <table className="prg-pending-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Title</th>
                  <th>Due Date</th>
                </tr>
              </thead>
              <tbody>
                {item.pending_activities.map((a, i) => (
                  <tr key={i}>
                    <td>
                      <span className={`prg-type-badge ${a.type?.toLowerCase()}`}>
                        {a.type}
                      </span>
                    </td>
                    <td className="prg-td-title">{a.title}</td>
                    <td className="prg-td-date">
                      {a.due_date ? new Date(a.due_date).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────
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
            <div className="prg-page">

              {/* ── Header ── */}
              <div className="prg-header">
                <div>
                  <h1 className="prg-title">My Progress</h1>
                  <p className="prg-subtitle">
                    Track attendance, assignments, quizzes and pending activities
                  </p>
                </div>
                {!loading && progress.length > 0 && (
                  <span className="prg-subject-count">
                    {progress.length} subject{progress.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {/* ── Loading ── */}
              {loading && (
                <div className="prg-state">
                  <div className="prg-spinner" />
                  <p>Loading your progress…</p>
                </div>
              )}

              {/* ── Empty ── */}
              {!loading && progress.length === 0 && (
                <div className="prg-state">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
                    width="44" height="44" style={{ color: "#cbd5e1" }}>
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                  </svg>
                  <p>No progress data available yet.</p>
                </div>
              )}

              {/* ── Subject cards ── */}
              {!loading && progress.map((item, i) => (
                <SubjectCard key={i} item={item} />
              ))}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}