import { useEffect, useState } from "react";
import Navbar from "../../components/Navbar";
import Sidebar from "../../components/Sidebar";
import API from "../../api";
import "../../styles/ParentModule.css";

export default function ParentAttendance() {
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState([]);
  const [activeChild, setActiveChild] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get("/parent/dashboard/")
      .then((res) => setChildren(res.data?.children || []))
      .catch((err) => console.log("children fetch error:", err));
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const q = activeChild ? `?child=${activeChild}` : "";
      console.log("Active Child:", activeChild);
      const res = await API.get(`/attendance/${q}`);
      console.log("Attendance Response:", res.data);
      setRecords(res.data?.results || res.data || []);
    } catch (err) {
      console.log("Parent attendance fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChild]);

  // ── overall totals ──
  const total = records.length;
  const present = records.filter((r) => (r.status || "").toLowerCase() === "present").length;
  const absent = total - present;

  // ── subject-wise breakdown ──
  const bySubject = {};
  records.forEach((r) => {
    const key = `${r.student_name} • ${r.subject_name}`;
    if (!bySubject[key]) {
      bySubject[key] = { child: r.student_name, subject: r.subject_name, total: 0, present: 0 };
    }
    bySubject[key].total += 1;
    if ((r.status || "").toLowerCase() === "present") bySubject[key].present += 1;
  });
  const subjectRows = Object.values(bySubject).map((s) => {
    const pct = s.total ? Math.round((s.present / s.total) * 100) : 0;
    return { ...s, absent: s.total - s.present, pct };
  });

  const pctBadge = (pct) => {
    if (pct >= 90) return "pm-badge green";
    if (pct >= 75) return "pm-badge yellow";
    return "pm-badge red";
  };

  return (
    <div className="app">
      <Navbar setOpen={setOpen} />
      <div className="layout">
        <Sidebar open={open} setOpen={setOpen} />
        <div className="main">
          <div className="content">
            <div className="pm-page">

              <div className="pm-header">
                <h1>Attendance</h1>
                <p>Attendance records for your children</p>
              </div>

              <div className="pm-tabs">
                <div
                  className={`pm-tab ${activeChild === null ? "active" : ""}`}
                  onClick={() => setActiveChild(null)}
                >
                  All Children
                </div>
                {children.map((c) => (
                  <div
                    key={c.id}
                    className={`pm-tab ${activeChild === c.id ? "active" : ""}`}
                    onClick={() => setActiveChild(c.id)}
                  >
                    {c.username}
                  </div>
                ))}
              </div>

              {loading ? (
                <div className="pm-loading">Loading attendance…</div>
              ) : (
                <>
                  <div className="pm-stat-grid three">
                    <div className="pm-stat-card">
                      <div className="pm-stat-label">Total classes</div>
                      <div className="pm-stat-val">{total}</div>
                    </div>
                    <div className="pm-stat-card">
                      <div className="pm-stat-label">Present</div>
                      <div className="pm-stat-val green">{present}</div>
                    </div>
                    <div className="pm-stat-card">
                      <div className="pm-stat-label">Absent</div>
                      <div className="pm-stat-val red">{absent}</div>
                    </div>
                  </div>

                  <div className="pm-card">
                    <div className="pm-card-title">Subject-wise attendance</div>
                    {subjectRows.length === 0 ? (
                      <div className="pm-empty">No attendance recorded</div>
                    ) : (
                      <table className="pm-table">
                        <thead>
                          <tr>
                            <th>Child</th><th>Subject</th><th>Total</th>
                            <th>Present</th><th>Absent</th><th>%</th><th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {subjectRows.map((s, i) => (
                            <tr key={i}>
                              <td>{s.child}</td>
                              <td>{s.subject}</td>
                              <td>{s.total}</td>
                              <td>{s.present}</td>
                              <td>{s.absent}</td>
                              <td>{s.pct}%</td>
                              <td><span className={pctBadge(s.pct)}>
                                {s.pct >= 90 ? "Good" : s.pct >= 75 ? "Average" : "Low"}
                              </span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
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