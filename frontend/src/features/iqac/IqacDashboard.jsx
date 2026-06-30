import { useEffect, useState } from "react";

import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";
import API from "../../api";
import "../../App.css";

const CATEGORIES = [
  { value: "", label: "All types" },
  { value: "fdp", label: "FDP / Training Attended" },
  { value: "workshop_attended", label: "Workshop / Seminar Attended" },
  { value: "workshop_conducted", label: "Workshop / Seminar Conducted" },
  { value: "conference", label: "Conference Paper Presented" },
  { value: "journal", label: "Journal Publication" },
  { value: "certification", label: "Certification / MOOC" },
  { value: "guest_lecture", label: "Guest Lecture Delivered" },
  { value: "committee", label: "Committee / Cell Membership" },
  { value: "project", label: "Project / Grant / Consultancy" },
  { value: "other", label: "Other" },
];

export default function IqacDashboard() {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // filters
  const [year, setYear] = useState("");
  const [category, setCategory] = useState("");
  const [teacher, setTeacher] = useState("");

  const loadSummary = async (yr) => {
    try {
      const q = yr ? `?year=${yr}` : "";
      const r = await API.get(`users/iqac/participation/summary/${q}`);
      setSummary(r.data || null);
    } catch (err) {
      console.error("Summary error:", err);
      setSummary(null);
    }
  };

  const loadList = async () => {
    setLoading(true);
    try {
      const params = [];
      if (year) params.push(`year=${year}`);
      if (category) params.push(`category=${category}`);
      if (teacher) params.push(`teacher=${teacher}`);
      const q = params.length ? `?${params.join("&")}` : "";
      const r = await API.get(`users/iqac/participation/${q}`);
      setRows(r.data || []);
    } catch (err) {
      console.error("List error:", err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  // initial load
  useEffect(() => {
    loadSummary("");
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // reload list when filters change
  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, category, teacher]);

  // reload summary when year changes
  useEffect(() => {
    loadSummary(year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  return (
    <div className="app">
      <Navbar setOpen={setOpen} />
      <div className="layout">
        <Sidebar open={open} setOpen={setOpen} />
        <div className="main">
          <div className="content">
            <div className="sd-root">

              <h1 className="sd-hello">IQAC — Faculty Participation</h1>
              <p className="sd-sub">All faculty activities recorded for NAAC, with totals.</p>

              {/* ===== TOP STATS ===== */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
                <div className="sd-card">
                  <div className="sd-label">Total Activities</div>
                  <div className="sd-val">{summary?.total ?? "—"}</div>
                </div>
                <div className="sd-card">
                  <div className="sd-label">Faculty Involved</div>
                  <div className="sd-val">{summary?.by_teacher?.length ?? "—"}</div>
                </div>
                <div className="sd-card">
                  <div className="sd-label">Academic Year</div>
                  <div className="sd-val" style={{ fontSize: 20 }}>
                    <select
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      style={{ fontSize: 14, padding: "4px 6px" }}
                    >
                      <option value="">All years</option>
                      {(summary?.years || []).map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* ===== COUNTS PER CATEGORY ===== */}
              <div className="sd-panel" style={{ marginBottom: 16 }}>
                <div className="sd-pt">By category</div>
                {summary?.by_category?.length ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
                    {summary.by_category.map((c) => (
                      <div key={c.category} style={{ border: "1px solid #eaecf0", borderRadius: 10, padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 13, color: "#0f172a" }}>{c.label}</span>
                        <span style={{ fontSize: 18, fontWeight: 700, color: "#1d4ed8" }}>{c.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="sd-empty">No activities recorded yet.</div>
                )}
              </div>

              {/* ===== PER TEACHER ===== */}
              <div className="sd-panel" style={{ marginBottom: 16 }}>
                <div className="sd-pt">By faculty</div>
                {summary?.by_teacher?.length ? (
                  <table className="sd-tbl">
                    <thead>
                      <tr>
                        <th>Faculty</th>
                        <th>Employee ID</th>
                        <th>Department</th>
                        <th style={{ textAlign: "right" }}>Activities</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.by_teacher.map((t) => (
                        <tr
                          key={t.id}
                          onClick={() => setTeacher(String(t.id))}
                          style={{ cursor: "pointer" }}
                        >
                          <td>{t.name}</td>
                          <td className="sd-num">{t.employee_id || "—"}</td>
                          <td>{t.department}</td>
                          <td className="sd-num" style={{ textAlign: "right", fontWeight: 700 }}>{t.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="sd-empty">No faculty activities yet.</div>
                )}
              </div>

              {/* ===== FULL LIST + FILTERS ===== */}
              <div className="sd-panel">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
                  <div className="sd-pt" style={{ margin: 0 }}>All activities ({rows.length})</div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <select value={category} onChange={(e) => setCategory(e.target.value)}>
                      {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                    {teacher && (
                      <button
                        onClick={() => setTeacher("")}
                        style={{ background: "#fff", color: "#334155", border: "1px solid #d8dee9", borderRadius: 8, padding: "6px 12px", fontSize: 13, cursor: "pointer" }}
                      >
                        Clear faculty filter
                      </button>
                    )}
                  </div>
                </div>

                {loading ? (
                  <div className="sd-empty">Loading…</div>
                ) : rows.length === 0 ? (
                  <div className="sd-empty">No activities match.</div>
                ) : (
                  <table className="sd-tbl">
                    <thead>
                      <tr>
                        <th>Faculty</th>
                        <th>Title</th>
                        <th>Type</th>
                        <th>Role</th>
                        <th>Date</th>
                        <th>Proof</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{r.faculty_name}</div>
                            <div style={{ fontSize: 12, color: "#667085" }}>{r.department_name || "—"}</div>
                          </td>
                          <td>
                            <div>{r.title}</div>
                            {r.organizer && <div style={{ fontSize: 12, color: "#667085" }}>{r.organizer}</div>}
                          </td>
                          <td>{r.category_label}</td>
                          <td>{r.role_label}</td>
                          <td className="sd-num">{r.date}</td>
                          <td>
                            {r.proof_url ? (
                              <a href={r.proof_url} target="_blank" rel="noreferrer" style={{ color: "#1d4ed8", fontSize: 13 }}>
                                View
                              </a>
                            ) : (
                              <span style={{ color: "#98a2b3", fontSize: 13 }}>—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}