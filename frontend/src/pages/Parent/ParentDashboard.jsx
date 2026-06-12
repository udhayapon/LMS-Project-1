import { useEffect, useState } from "react";
import Navbar from "../../components/Navbar";
import Sidebar from "../../components/Sidebar";
import API from "../../api";
import "../../App.css";

// Icons
const I = {
  users: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  wallet: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>,
  file: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
};

export default function ParentDashboard() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [open, setOpen] = useState(false);

  const [data, setData] = useState(null);
  const [children, setChildren] = useState([]);
  const [grades, setGrades] = useState([]);
  const [quizGrades, setQuizGrades] = useState([]);
  const [activeChild, setActiveChild] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const dashRes = await API.get("/parent/dashboard/");
      setData(dashRes.data);
      setChildren(dashRes.data?.children || []);

      const subRes = await API.get("/submissions/");
      setGrades(subRes.data?.results || subRes.data || []);

      const quizRes = await API.get("/quiz-attempts/");
      setQuizGrades(quizRes.data?.results || quizRes.data || []);
    } catch (err) {
      console.log("Parent dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    const t = setInterval(fetchAll, 15000);
    return () => clearInterval(t);
  }, []);

  const matchChild = (record) => {
    if (activeChild === null) return true;
    const child = children.find((c) => c.id === activeChild);
    if (!child) return true;
    return (
      (record.student?.id || record.student) === activeChild ||
      record.student_name === child.username
    );
  };

  const attendanceEntries = Object.entries(data?.attendance_per_child || {});
  const visibleAttendance = activeChild === null
    ? attendanceEntries
    : attendanceEntries.filter(([name]) => {
        const child = children.find((c) => c.id === activeChild);
        return child && name === child.username;
      });

  const recentGrades = grades.filter(matchChild).slice(0, 6);
  const recentQuizzes = quizGrades.filter(matchChild).slice(0, 6);

  const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString() : "");
  const statusChip = (s = "") => {
    const v = s.toLowerCase();
    if (v === "evaluated" || v === "graded") return "ok";
    if (v === "pending" || v === "late") return "warn";
    return "muted";
  };

  const fees = Number(data?.pending_fees || 0);
  const att = Number(data?.avg_attendance || 0);
  const pendAssign = data?.pending_assignments ?? 0;

  const kpis = [
    { key: "kids", icon: "users", accent: "#0ea5e9", label: "Children enrolled",
      value: data?.children_enrolled ?? 0, meta: "Linked to your account" },
    { key: "fees", icon: "wallet", accent: "#f59e0b", label: "Pending fees",
      value: `₹${fees.toLocaleString("en-IN")}`,
      chip: fees > 0 ? "due" : "all paid", chipTone: fees > 0 ? "warn" : "ok" },
    { key: "att", icon: "check", accent: "#10b981", label: "Avg attendance",
      value: `${att}%`, meter: att, accentMeter: "#10b981" },
    { key: "pend", icon: "file", accent: "#6366f1", label: "Pending assignments",
      value: pendAssign, chip: pendAssign > 0 ? "to submit" : "all done",
      chipTone: pendAssign > 0 ? "warn" : "ok" },
  ];

  return (
    <div className="app">
      <Navbar setOpen={setOpen} />
      <div className="layout">
        <Sidebar open={open} setOpen={setOpen} />
        <div className="main">
          <div className="content">
            <div className="sd-root">

              <h1 className="sd-hello">Welcome back, {user?.username || "Parent"}</h1>
              <p className="sd-sub">Your children's activity at a glance.</p>

              {/* child segmented control */}
              <div className="sd-seg">
                <button className={activeChild === null ? "on" : ""} onClick={() => setActiveChild(null)}>All children</button>
                {children.map((c) => (
                  <button key={c.id} className={activeChild === c.id ? "on" : ""} onClick={() => setActiveChild(c.id)}>
                    {c.username}
                  </button>
                ))}
              </div>

              {loading && !data ? (
                <div className="sd-empty">Loading dashboard…</div>
              ) : (
                <>
                  {/* KPIs */}
                  <div className="sd-kpis">
                    {kpis.map((k) => (
                      <div className="sd-card" key={k.key}>
                        <div className="sd-ch">
                          <div className="sd-tile" style={{ background: k.accent + "18", color: k.accent }}>{I[k.icon]}</div>
                          {k.chip && <span className={`sd-chip ${k.chipTone}`}>{k.chip}</span>}
                        </div>
                        <div className="sd-label">{k.label}</div>
                        <div className="sd-val">{k.value}</div>
                        {k.meta && <div className="sd-meta">{k.meta}</div>}
                        {k.meter !== undefined && (
                          <div className="sd-meter"><span style={{ width: `${k.meter}%`, background: k.accentMeter }} /></div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="sd-grid">
                    {/* left: grades + quizzes */}
                    <div className="sd-stack">
                      <div className="sd-panel">
                        <div className="sd-pt">Recent grades</div>
                        {recentGrades.length === 0 ? (
                          <div className="sd-empty">No grades published yet.</div>
                        ) : (
                          <table className="sd-tbl">
                            <thead><tr><th>Child</th><th>Subject</th><th>Marks</th><th>Status</th></tr></thead>
                            <tbody>
                              {recentGrades.map((s) => (
                                <tr key={s.id}>
                                  <td>{s.student_name}</td>
                                  <td>{s.subject_name}</td>
                                  <td style={{ fontVariantNumeric: "tabular-nums" }}>
                                    {s.marks !== null && s.marks !== undefined ? `${s.marks}/${s.total_marks}` : "—"}
                                  </td>
                                  <td><span className={`sd-chip ${statusChip(s.status)}`}>{s.status}</span></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>

                      <div className="sd-panel">
                        <div className="sd-pt">Recent quiz results</div>
                        {recentQuizzes.length === 0 ? (
                          <div className="sd-empty">No quiz attempts yet.</div>
                        ) : (
                          <table className="sd-tbl">
                            <thead><tr><th>Child</th><th>Quiz</th><th>Score</th><th>Submitted</th></tr></thead>
                            <tbody>
                              {recentQuizzes.map((q) => (
                                <tr key={q.id}>
                                  <td>{q.student_name}</td>
                                  <td>{q.quiz_title}</td>
                                  <td style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{q.score}</td>
                                  <td style={{ color: "#667085" }}>{fmtTime(q.submitted_at)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>

                    {/* right: attendance + notifications */}
                    <div className="sd-stack">
                      <div className="sd-panel">
                        <div className="sd-pt">Attendance overview</div>
                        {visibleAttendance.length === 0 ? (
                          <div className="sd-empty">No attendance recorded.</div>
                        ) : (
                          visibleAttendance.map(([name, a]) => {
                            const pct = a.percentage || 0;
                            const color = pct >= 85 ? "#10b981" : pct >= 75 ? "#f59e0b" : "#ef4444";
                            return (
                              <div className="sd-prow" key={name}>
                                <div className="sd-ptop"><b>{name}</b><span className="sd-ppct">{pct}%</span></div>
                                <div className="sd-pbar"><span style={{ width: `${pct}%`, background: color }} /></div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      <div className="sd-panel">
                        <div className="sd-pt">Recent notifications</div>
                        {(data?.recent_notifications || []).length === 0 ? (
                          <div className="sd-empty">You're all caught up.</div>
                        ) : (
                          data.recent_notifications.map((n) => (
                            <div className="sd-nrow" key={n.id}>
                              <div className={`sd-ndot ${n.is_read ? "read" : ""}`} />
                              <div>
                                <div className="sd-ntitle">{n.title}</div>
                                <div className="sd-ntime">{fmtTime(n.created_at)}</div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}