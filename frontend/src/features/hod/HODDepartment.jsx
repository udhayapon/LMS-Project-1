import { useEffect, useState, useMemo } from "react";

import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";
import API from "../../api";
import "../../App.css";

const PAGE_SIZE = 20;

// donut ring (used by Results)
function Donut({ percent, color, label, centerText }) {
  const r = 35;
  const circ = 2 * Math.PI * r;
  const offset = circ - (circ * percent) / 100;
  return (
    <svg width="92" height="92" viewBox="0 0 92 92">
      <circle cx="46" cy="46" r={r} fill="none" stroke="#eef0f4" strokeWidth="10" />
      <circle
        cx="46" cy="46" r={r} fill="none" stroke={color} strokeWidth="10"
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
        transform="rotate(-90 46 46)"
      />
      <text x="46" y="43" textAnchor="middle" fontSize="18" fontWeight="700" fill="#0f172a">
        {centerText}
      </text>
      <text x="46" y="58" textAnchor="middle" fontSize="10" fill="#667085">
        {label}
      </text>
    </svg>
  );
}

export default function HODDepartment() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isHod, setIsHod] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [active, setActive] = useState(0);
  const [tab, setTab] = useState("overview");

  // results
  const [resultsData, setResultsData] = useState([]);
  const [resultsLoaded, setResultsLoaded] = useState(false);
  const [semSel, setSemSel] = useState("all");

  // attendance
  const [attData, setAttData] = useState([]);
  const [attLoaded, setAttLoaded] = useState(false);
  const [attYear, setAttYear] = useState("all");

  // student tab controls
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchDepartment();
  }, []);

  const fetchDepartment = async () => {
    try {
      const res = await API.get("users/my-department/");
      setIsHod(res.data?.is_hod || false);
      setDepartments(res.data?.departments || []);
    } catch {
      setIsHod(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "results" && !resultsLoaded) {
      API.get("users/hod-results/")
        .then((res) => setResultsData(res.data?.departments || []))
        .catch(() => setResultsData([]))
        .finally(() => setResultsLoaded(true));
    }
    if (tab === "attendance" && !attLoaded) {
      API.get("users/hod-attendance/")
        .then((res) => setAttData(res.data?.departments || []))
        .catch(() => setAttData([]))
        .finally(() => setAttLoaded(true));
    }
  }, [tab, resultsLoaded, attLoaded]);

  const dept = departments[active];
  const deptResults = resultsData[active];
  const deptAtt = attData[active];

  useEffect(() => {
    setSearch("");
    setYearFilter("all");
    setPage(1);
    setSemSel("all");
    setAttYear("all");
  }, [active, tab]);

  const bucket = useMemo(() => {
    if (!deptResults) return null;
    if (semSel === "all") return deptResults.all;
    return deptResults.by_semester?.[semSel] || null;
  }, [deptResults, semSel]);

  const problemSubjects = useMemo(
    () => (bucket ? bucket.subjects.filter((s) => s.failed > 0) : []),
    [bucket]
  );
  const cleanCount = useMemo(
    () => (bucket ? bucket.subjects.filter((s) => s.failed === 0).length : 0),
    [bucket]
  );

  const attRisk = useMemo(() => {
    if (!deptAtt) return [];
    if (attYear === "all") return deptAtt.at_risk;
    return deptAtt.at_risk.filter((r) => String(r.year) === String(attYear));
  }, [deptAtt, attYear]);

  const filteredStudents = useMemo(() => {
    if (!dept) return [];
    return dept.students.filter((s) => {
      const matchSearch =
        !search ||
        s.username.toLowerCase().includes(search.toLowerCase()) ||
        (s.roll_number || "").toLowerCase().includes(search.toLowerCase());
      const matchYear =
        yearFilter === "all" || String(s.year) === String(yearFilter);
      return matchSearch && matchYear;
    });
  }, [dept, search, yearFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / PAGE_SIZE));
  const pageStudents = filteredStudents.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const yearCounts = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    if (dept) dept.students.forEach((s) => { if (counts[s.year] !== undefined) counts[s.year]++; });
    return counts;
  }, [dept]);

  const semYearLabel = (sem) => `Sem ${sem} · Year ${Math.ceil(sem / 2)}`;

  return (
    <div className="app">
      <Navbar setOpen={setOpen} />
      <div className="layout">
        <Sidebar open={open} setOpen={setOpen} />
        <div className="main">
          <div className="content">
            <div className="sd-root">

              <h1 className="sd-hello">My Department</h1>
              <p className="sd-sub">
                {isHod && dept ? `Head of Department — ${dept.name}` : "Department overview"}
              </p>

              {loading && <div className="sd-panel">Loading…</div>}

              {!loading && !isHod && (
                <div className="sd-panel">
                  You are not assigned as Head of Department for any department.
                </div>
              )}

              {!loading && isHod && dept && (
                <>
                  {departments.length > 1 && (
                    <div className="sd-seg" style={{ marginBottom: 16 }}>
                      {departments.map((d, i) => (
                        <button key={d.id} className={i === active ? "on" : ""} onClick={() => setActive(i)}>
                          {d.name}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* ===== TABS ===== */}
                  <div className="sd-seg" style={{ marginBottom: 22 }}>
                    <button className={tab === "overview" ? "on" : ""} onClick={() => setTab("overview")}>Overview</button>
                    <button className={tab === "results" ? "on" : ""} onClick={() => setTab("results")}>Results</button>
                    <button className={tab === "attendance" ? "on" : ""} onClick={() => setTab("attendance")}>Attendance</button>
                    <button className={tab === "teachers" ? "on" : ""} onClick={() => setTab("teachers")}>Faculty</button>
                    <button className={tab === "students" ? "on" : ""} onClick={() => setTab("students")}>Students</button>
                  </div>

                  {/* ===== OVERVIEW ===== */}
                  {tab === "overview" && (
                    <>
                      {/* main department stats */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                        <div className="sd-card">
                          <div className="sd-label">Total Students</div>
                          <div className="sd-val">{dept.total_students}</div>
                        </div>
                        <div className="sd-card">
                          <div className="sd-label">Total Faculty</div>
                          <div className="sd-val">{dept.total_teachers}</div>
                        </div>
                        <div className="sd-card">
                          <div className="sd-label">Total Subjects</div>
                          <div className="sd-val">{dept.total_subjects}</div>
                        </div>

                        <div className="sd-card">
                          <div className="sd-label">Attendance %</div>
                          <div className="sd-val" style={{ color: dept.attendance_percent != null && dept.attendance_percent < 75 ? "#dc2626" : "#0f172a" }}>
                            {dept.attendance_percent != null ? `${dept.attendance_percent}%` : "—"}
                          </div>
                        </div>
                        <div className="sd-card">
                          <div className="sd-label">Pass Percentage</div>
                          <div className="sd-val" style={{ color: "#15803d" }}>
                            {dept.pass_percent != null ? `${dept.pass_percent}%` : "—"}
                          </div>
                        </div>
                        <div className="sd-card">
                          <div className="sd-label">Students with Arrears</div>
                          <div className="sd-val" style={{ color: dept.arrears > 0 ? "#dc2626" : "#0f172a" }}>
                            {dept.arrears}
                          </div>
                        </div>
                      </div>

                      {/* year-wise breakdown */}
                      <div className="sd-panel" style={{ marginTop: 16 }}>
                        <div className="sd-pt">Students by Year</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                          {[1, 2, 3, 4].map((y) => (
                            <div key={y} style={{ border: "1px solid #eaecf0", borderRadius: 12, padding: "14px 16px", textAlign: "center" }}>
                              <div style={{ fontSize: 12, color: "#667085", fontWeight: 600 }}>Year {y}</div>
                              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{yearCounts[y]}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* ===== RESULTS ===== */}
                  {tab === "results" && (
                    <>
                      {!resultsLoaded && <div className="sd-panel">Loading results…</div>}

                      {resultsLoaded && (!deptResults || deptResults.all.evaluated === 0) && (
                        <div className="sd-panel">No published results yet for this department.</div>
                      )}

                      {resultsLoaded && deptResults && deptResults.all.evaluated > 0 && (
                        <>
                          <div className="sd-panel" style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                            <strong style={{ fontSize: 14 }}>Show results for:</strong>
                            <select value={semSel} onChange={(e) => setSemSel(e.target.value)} style={{ minWidth: 200 }}>
                              <option value="all">All Semesters (combined)</option>
                              {deptResults.semesters.map((sem) => (
                                <option key={sem} value={String(sem)}>{semYearLabel(sem)}</option>
                              ))}
                            </select>
                          </div>

                          {bucket && bucket.evaluated > 0 ? (
                            <>
                              <div className="sd-panel" style={{ display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap" }}>
                                <Donut percent={bucket.pass_percent} color="#1D9E75" label="pass" centerText={`${bucket.pass_percent}%`} />
                                <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
                                  <div><div className="sd-label">Passed</div><div className="sd-val" style={{ color: "#15803d" }}>{bucket.passed}</div></div>
                                  <div><div className="sd-label">Failed (arrears)</div><div className="sd-val" style={{ color: "#dc2626" }}>{bucket.failed}</div></div>
                                  <div><div className="sd-label">Evaluated</div><div className="sd-val">{bucket.evaluated}</div></div>
                                </div>
                              </div>

                              <div className="sd-panel" style={{ marginTop: 16 }}>
                                <div className="sd-pt">Subjects needing attention</div>
                                {problemSubjects.length > 0 ? (
                                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    {problemSubjects.map((s) => {
                                      const danger = s.fail_rate >= 40;
                                      const bg = danger ? "#fef2f2" : "#fff7ed";
                                      const fg = danger ? "#dc2626" : "#b45309";
                                      const bd = danger ? "#fecaca" : "#fed7aa";
                                      return (
                                        <div key={s.subject} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", background: bg, border: `1px solid ${bd}`, borderRadius: 10 }}>
                                          <span style={{ fontSize: 13, fontWeight: 600, color: fg }}>⚠ {s.subject}</span>
                                          <span style={{ fontSize: 12.5, fontWeight: 600, color: fg }}>{s.failed} failed · {s.pass_rate}% pass</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div style={{ fontSize: 13, color: "#15803d" }}>✓ No subjects with arrears — all passing.</div>
                                )}
                                {cleanCount > 0 && (
                                  <div style={{ fontSize: 13, color: "#15803d", marginTop: 14 }}>
                                    ✓ {cleanCount} other subject{cleanCount > 1 ? "s" : ""}: 100% pass
                                  </div>
                                )}
                              </div>

                              <div className="sd-panel" style={{ marginTop: 16 }}>
                                <div className="sd-pt">All subjects</div>
                                <table className="sd-tbl">
                                  <thead>
                                    <tr>
                                      <th>Subject</th>
                                      <th style={{ textAlign: "center" }}>Pass</th>
                                      <th style={{ textAlign: "center" }}>Fail</th>
                                      <th style={{ textAlign: "right" }}>Pass %</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {bucket.subjects.map((s) => (
                                      <tr key={s.subject}>
                                        <td>{s.subject}</td>
                                        <td className="sd-num" style={{ textAlign: "center", color: "#15803d" }}>{s.passed}</td>
                                        <td className="sd-num" style={{ textAlign: "center", color: s.failed > 0 ? "#dc2626" : "#98a2b3", fontWeight: s.failed > 0 ? 600 : 400 }}>{s.failed}</td>
                                        <td className="sd-num" style={{ textAlign: "right" }}>{s.pass_rate}%</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </>
                          ) : (
                            <div className="sd-panel">No results for the selected semester.</div>
                          )}
                        </>
                      )}
                    </>
                  )}

                  {/* ===== ATTENDANCE ===== */}
                  {tab === "attendance" && (
                    <>
                      {!attLoaded && <div className="sd-panel">Loading attendance…</div>}

                      {attLoaded && deptAtt && (
                        <>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                            <div className="sd-card">
                              <div className="sd-label">Below 75%</div>
                              <div className="sd-val" style={{ color: "#dc2626" }}>{deptAtt.below_75}</div>
                            </div>
                            <div className="sd-card">
                              <div className="sd-label">Near 75% (75–80)</div>
                              <div className="sd-val" style={{ color: "#b45309" }}>{deptAtt.near_75}</div>
                            </div>
                            <div className="sd-card">
                              <div className="sd-label">Total students</div>
                              <div className="sd-val">{deptAtt.total_students}</div>
                            </div>
                          </div>

                          <div className="sd-panel" style={{ marginTop: 16 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
                              <div className="sd-pt" style={{ margin: 0 }}>Low attendance — needs attention ({attRisk.length})</div>
                              <select value={attYear} onChange={(e) => setAttYear(e.target.value)}>
                                <option value="all">All Years</option>
                                <option value="1">Year 1</option>
                                <option value="2">Year 2</option>
                                <option value="3">Year 3</option>
                                <option value="4">Year 4</option>
                              </select>
                            </div>

                            {attRisk.length > 0 ? (
                              <table className="sd-tbl">
                                <thead>
                                  <tr>
                                    <th>Student</th>
                                    <th>Roll No</th>
                                    <th>Year</th>
                                    <th style={{ textAlign: "right" }}>Attendance</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {attRisk.map((r) => (
                                    <tr key={r.id}>
                                      <td>{r.username}</td>
                                      <td className="sd-num">{r.roll_number || "-"}</td>
                                      <td className="sd-num">{r.year ? `Year ${r.year}` : "-"}</td>
                                      <td className="sd-num" style={{ textAlign: "right", fontWeight: 600, color: r.level === "danger" ? "#dc2626" : "#b45309" }}>
                                        {r.percent}%
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <div style={{ fontSize: 13, color: "#15803d" }}>✓ No students below 80% — attendance looks healthy.</div>
                            )}
                          </div>
                        </>
                      )}

                      {attLoaded && !deptAtt && (
                        <div className="sd-panel">No attendance data for this department.</div>
                      )}
                    </>
                  )}

                  {/* ===== FACULTY ===== */}
                  {tab === "teachers" && (
                    <div className="sd-panel">
                      <div className="sd-pt">Faculty ({dept.total_teachers})</div>

                      {dept.teachers.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          {dept.teachers.map((t) => (
                            <div key={t.id} style={{ border: "1px solid #eaecf0", borderRadius: 12, padding: "14px 16px" }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>

                                {/* left: name + id + subjects inline */}
                                <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", flex: 1, minWidth: 0 }}>
                                  <div style={{ minWidth: 150 }}>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{t.username}</div>
                                    <div style={{ fontSize: 12, color: "#667085", marginTop: 2 }}>
                                      {t.employee_id || "-"}
                                    </div>
                                  </div>

                                  {t.subjects.length > 0 ? (
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                      {t.subjects.map((s, idx) => (
                                        <span
                                          key={idx}
                                          style={{
                                            fontSize: 12,
                                            background: "#eef4ff",
                                            color: "#1d4ed8",
                                            border: "1px solid #dbeafe",
                                            borderRadius: 999,
                                            padding: "4px 11px",
                                          }}
                                        >
                                          {s.subject}
                                          {s.year ? ` · Y${s.year}` : ""}
                                          {s.semester ? ` S${s.semester}` : ""}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span style={{ fontSize: 12.5, color: "#98a2b3" }}>No subjects assigned</span>
                                  )}
                                </div>

                                {/* right: subject count */}
                                <span style={{ fontSize: 12, color: "#667085", whiteSpace: "nowrap" }}>
                                  {t.subject_count} subject{t.subject_count !== 1 ? "s" : ""}
                                </span>

                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="sd-empty">No faculty in this department.</div>
                      )}
                    </div>
                  )}

                  {/* ===== STUDENTS ===== */}
                  {tab === "students" && (
                    <div className="sd-panel">
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                        <div className="sd-pt" style={{ margin: 0 }}>Students ({filteredStudents.length})</div>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <input placeholder="Search name or roll no…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ minWidth: 200 }} />
                          <select value={yearFilter} onChange={(e) => { setYearFilter(e.target.value); setPage(1); }}>
                            <option value="all">All Years</option>
                            <option value="1">Year 1</option>
                            <option value="2">Year 2</option>
                            <option value="3">Year 3</option>
                            <option value="4">Year 4</option>
                          </select>
                        </div>
                      </div>

                      <table className="sd-tbl">
                        <thead><tr><th>Name</th><th>Roll No</th><th>Course</th><th>Year</th><th>Semester</th></tr></thead>
                        <tbody>
                          {pageStudents.length > 0 ? (
                            pageStudents.map((s) => (
                              <tr key={s.id}>
                                <td>{s.username}</td>
                                <td className="sd-num">{s.roll_number || "-"}</td>
                                <td>{s.course_name || "-"}</td>
                                <td className="sd-num">{s.year ? `Year ${s.year}` : "-"}</td>
                                <td className="sd-num">{s.semester ? `Sem ${s.semester}` : "-"}</td>
                              </tr>
                            ))
                          ) : (
                            <tr><td colSpan="5" className="sd-empty">No students match.</td></tr>
                          )}
                        </tbody>
                      </table>

                      {totalPages > 1 && (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 16 }}>
                          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={pageBtn(page === 1)}>← Prev</button>
                          <span style={{ fontSize: 13, color: "#667085" }}>Page {page} of {totalPages}</span>
                          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={pageBtn(page === totalPages)}>Next →</button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const pageBtn = (disabled) => ({
  background: "#fff",
  color: disabled ? "#cbd5e1" : "#334155",
  border: "1px solid #d8dee9",
  borderRadius: 8,
  padding: "7px 14px",
  fontSize: 13,
  fontWeight: 600,
  cursor: disabled ? "default" : "pointer",
});