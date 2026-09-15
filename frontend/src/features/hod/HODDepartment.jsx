import { useEffect, useState, useMemo } from "react";

import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";
import API from "../../api";
import HOdTutors from "./HOdTutors";
import OnDutyHod from "./OnDutyHod";
import StaffLeaveHod from "./StaffLeaveHod";
import GridPanel from "../timetable/GridPanel";
import "../../App.css";
import "../../styles/Attendance.css";
import "../../styles/TimetableBuilder.css";

const PAGE_SIZE = 20;

// donut ring (used by Results + Class Performance)
function Donut({ percent, color, label, centerText }) {
  const r = 35;
  const circ = 2 * Math.PI * r;
  const offset = circ - (circ * (percent || 0)) / 100;
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

// pass-rate colour: <75 danger, 75-85 warn, else healthy
const passColor = (v) =>
  v == null ? "#0f172a" : v < 75 ? "#dc2626" : v < 85 ? "#b45309" : "#15803d";

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

  // class performance (cards in Overview; tutor map reused by Results)
  const [classData, setClassData] = useState([]);
  const [classLoaded, setClassLoaded] = useState(false);

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
    // class performance feeds the Overview cards AND the tutor label in Results
    if ((tab === "overview" || tab === "results") && !classLoaded) {
      API.get("users/hod-class-performance/")
        .then((res) => setClassData(res.data?.departments || []))
        .catch(() => setClassData([]))
        .finally(() => setClassLoaded(true));
    }
    if (tab === "results" && !resultsLoaded) {
      API.get("users/hod-results/")
        .then((res) => setResultsData(res.data?.departments || []))
        .catch(() => setResultsData([]))
        .finally(() => setResultsLoaded(true));
    }
  }, [tab, resultsLoaded, classLoaded]);

  const dept = departments[active];
  const deptResults = resultsData[active];
  const deptClasses = classData[active];

  // course ids for this department (limits the timetable Course dropdown)
  const deptCourseIds = useMemo(() => {
    if (dept?.courses?.length) return dept.courses.map((c) => c.id);
    // fallback: derive from students if the backend "courses" key isn't present yet
    const ids = new Set();
    (dept?.students || []).forEach((s) => { if (s.course_id) ids.add(s.course_id); });
    return [...ids];
  }, [dept]);

  useEffect(() => {
    setSearch("");
    setYearFilter("all");
    setPage(1);
    setSemSel("all");
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

  // year -> tutor name, from the class-performance data
  const tutorByYear = useMemo(() => {
    const m = {};
    if (deptClasses?.classes) {
      deptClasses.classes.forEach((c) => {
        if (c.tutor_name) m[c.year] = c.tutor_name;
      });
    }
    return m;
  }, [deptClasses]);

  // tutor for the selected semester's year (only when a single semester is picked)
  const resultsTutor =
    semSel !== "all" ? tutorByYear[Math.ceil(Number(semSel) / 2)] || null : null;

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
                  <div className="tabs" style={{ marginBottom: 22, flexWrap: "wrap" }}>
                    <button className={tab === "overview" ? "btn-primary" : ""} onClick={() => setTab("overview")}>Overview</button>
                    <button className={tab === "results" ? "btn-primary" : ""} onClick={() => setTab("results")}>Results</button>
                    <button className={tab === "timetable" ? "btn-primary" : ""} onClick={() => setTab("timetable")}>Timetable</button>
                    <button className={tab === "teachers" ? "btn-primary" : ""} onClick={() => setTab("teachers")}>Faculty</button>
                    <button className={tab === "students" ? "btn-primary" : ""} onClick={() => setTab("students")}>Students</button>
                    <button className={tab === "tutors" ? "btn-primary" : ""} onClick={() => setTab("tutors")}>Class Advisors</button>
                    <button className={tab === "onduty" ? "btn-primary" : ""} onClick={() => setTab("onduty")}>On Duty</button>
                    <button className={tab === "staffleave" ? "btn-primary" : ""} onClick={() => setTab("staffleave")}>Staff Leave</button>
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

                      {/* ===== CLASS PERFORMANCE (pass rate per year) ===== */}
                      {!classLoaded && (
                        <div className="sd-panel" style={{ marginTop: 16 }}>Loading class performance…</div>
                      )}

                      {classLoaded && (!deptClasses || !deptClasses.classes?.length) && (
                        <div className="sd-panel" style={{ marginTop: 16 }}>No class performance data for this department.</div>
                      )}

                      {classLoaded && deptClasses && deptClasses.classes?.length > 0 && (
                        <div className="sd-panel" style={{ marginTop: 16 }}>
                          <div className="sd-pt">Class Performance (pass rate)</div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
                            {deptClasses.classes.map((c) => {
                              const lowPass = c.pass_percent != null && c.pass_percent < 85;
                              const pc = passColor(c.pass_percent);
                              return (
                                <div
                                  key={c.year}
                                  style={{ border: "1px solid #eaecf0", borderRadius: 12, padding: 14 }}
                                >
                                  {/* header */}
                                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                                    <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Year {c.year}</span>
                                    {lowPass && (
                                      <span style={{ fontSize: 11, fontWeight: 600, color: "#b45309", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 999, padding: "2px 9px", whiteSpace: "nowrap" }}>
                                        ⚠ low pass
                                      </span>
                                    )}
                                  </div>

                                  {/* pass donut */}
                                  <div style={{ display: "flex", justifyContent: "center", margin: "8px 0 4px" }}>
                                    <Donut
                                      percent={c.pass_percent}
                                      color={pc}
                                      label="pass"
                                      centerText={c.pass_percent != null ? `${c.pass_percent}%` : "—"}
                                    />
                                  </div>

                                  {/* secondary stats */}
                                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 10px", marginTop: 8 }}>
                                    <div>
                                      <div className="sd-label">Students</div>
                                      <div style={{ fontSize: 18, fontWeight: 700 }}>{c.student_count}</div>
                                    </div>
                                    <div>
                                      <div className="sd-label">Attendance</div>
                                      <div style={{ fontSize: 18, fontWeight: 700, color: c.attendance_percent != null && c.attendance_percent < 75 ? "#dc2626" : "#0f172a" }}>
                                        {c.attendance_percent != null ? `${c.attendance_percent}%` : "—"}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="sd-label">Class Advisor</div>
                                      <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", lineHeight: 1.3, marginTop: 2 }}>{c.tutor_name || "—"}</div>
                                    </div>
                                    <div>
                                      <div className="sd-label">Arrears</div>
                                      <div style={{ fontSize: 18, fontWeight: 700, color: c.arrears > 0 ? "#dc2626" : "#0f172a" }}>{c.arrears}</div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
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
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
                                  <div className="sd-pt" style={{ margin: 0 }}>All subjects</div>
                                  {resultsTutor && (
                                    <span style={{ fontSize: 12.5, color: "#667085" }}>Class advisor: {resultsTutor}</span>
                                  )}
                                </div>
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

                  {/* ===== TIMETABLE ===== */}
                  {tab === "timetable" && (
                    <div className="sd-panel">
                      <div className="sd-pt">Department Timetable</div>
                      <p style={{ fontSize: 13, color: "#667085", marginTop: -4, marginBottom: 14 }}>
                        Build the weekly grid for your department's classes. Periods, semester and
                        holidays are set by the admin.
                      </p>
                      <GridPanel courseFilter={deptCourseIds} />
                    </div>
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

                  {/* ===== TUTORS ===== */}
                  {tab === "tutors" && <HOdTutors />}

                  {/* ===== ON DUTY ===== */}
                  {tab === "onduty" && <OnDutyHod />}
                  {tab === "staffleave" && <StaffLeaveHod />}

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