import { useEffect, useMemo, useState } from "react";

import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";
import API from "../../api";
import "../../App.css";
import OnDutyTutor from "./OnDutyTutor";

const initials = (name = "") =>
  name.replace(/[^A-Za-z. ]/g, "").split(/[ .]/).filter(Boolean)
    .map((p) => p[0]).slice(0, 2).join("").toUpperCase();

export default function MyClass() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isTutor, setIsTutor] = useState(false);
  const [classes, setClasses] = useState([]);
  const [active, setActive] = useState(0);
  const [onlyAtRisk, setOnlyAtRisk] = useState(false);
  const [tab, setTab] = useState("class");   // "class" | "onduty"

  useEffect(() => {
    API.get("users/my-class/")
      .then((res) => {
        setIsTutor(res.data?.is_tutor || false);
        setClasses(res.data?.classes || []);
      })
      .catch(() => setIsTutor(false))
      .finally(() => setLoading(false));
  }, []);

  const cls = classes[active];

  // sort: at-risk first (arrears, then low attendance), then the rest
  const sortedStudents = useMemo(() => {
    const list = cls?.students ? [...cls.students] : [];
    const risk = (s) => {
      if (s.result_status === "failed") return 0;       // arrears = highest priority
      if (s.attendance_percent != null && s.attendance_percent < 75) return 1; // low attendance
      return 2;                                          // healthy
    };
    return list.sort((a, b) => {
      const r = risk(a) - risk(b);
      if (r !== 0) return r;
      // within same group, lowest attendance first
      const aa = a.attendance_percent ?? 999;
      const bb = b.attendance_percent ?? 999;
      return aa - bb;
    });
  }, [cls]);

  const visibleStudents = useMemo(() => {
    if (!onlyAtRisk) return sortedStudents;
    return sortedStudents.filter(
      (s) => s.result_status === "failed" ||
        (s.attendance_percent != null && s.attendance_percent < 75)
    );
  }, [sortedStudents, onlyAtRisk]);

  const attColor = (p) => (p == null ? "#98a2b3" : p < 75 ? "#dc2626" : "#15803d");

  return (
    <div className="app">
      <Navbar setOpen={setOpen} />
      <div className="layout">
        <Sidebar open={open} setOpen={setOpen} />
        <div className="main">
          <div className="content">
            <div className="sd-root">

              <h1 className="sd-hello">My Class</h1>
              <p className="sd-sub">
                {isTutor && cls ? `Tutor — ${cls.course_name} · Year ${cls.year_number}` : "Class overview"}
              </p>

              {loading && <div className="sd-panel">Loading…</div>}

              {!loading && !isTutor && (
                <div className="sd-panel">You are not assigned as a tutor for any class.</div>
              )}

              {!loading && isTutor && (
                <>
                  {/* main tabs */}
                  <div className="sd-seg" style={{ marginBottom: 16 }}>
                    <button className={tab === "class" ? "on" : ""} onClick={() => setTab("class")}>
                      Class
                    </button>
                    <button className={tab === "onduty" ? "on" : ""} onClick={() => setTab("onduty")}>
                      On Duty
                    </button>
                  </div>

                  {/* ════════ CLASS TAB ════════ */}
                  {tab === "class" && cls && (
                    <>
                      {/* switch between classes if tutor has more than one */}
                      {classes.length > 1 && (
                        <div className="sd-seg" style={{ marginBottom: 16 }}>
                          {classes.map((c, i) => (
                            <button key={i} className={i === active ? "on" : ""} onClick={() => { setActive(i); setOnlyAtRisk(false); }}>
                              {c.course_name} · Y{c.year_number}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* summary cards */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                        <div className="sd-card">
                          <div className="sd-label">Total Students</div>
                          <div className="sd-val">{cls.total_students}</div>
                        </div>
                        <div className="sd-card">
                          <div className="sd-label">Below 75% Attendance</div>
                          <div className="sd-val" style={{ color: cls.below_75 > 0 ? "#dc2626" : "#0f172a" }}>{cls.below_75}</div>
                        </div>
                        <div className="sd-card">
                          <div className="sd-label">Failing (Arrears)</div>
                          <div className="sd-val" style={{ color: cls.failing > 0 ? "#dc2626" : "#0f172a" }}>{cls.failing}</div>
                        </div>
                      </div>

                      {/* student table */}
                      <div className="sd-panel" style={{ marginTop: 16 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
                          <div className="sd-pt" style={{ margin: 0 }}>
                            Students ({visibleStudents.length})
                          </div>
                          <button
                            onClick={() => setOnlyAtRisk((v) => !v)}
                            style={{
                              background: onlyAtRisk ? "#0f172a" : "#fff",
                              color: onlyAtRisk ? "#fff" : "#334155",
                              border: "1px solid #d8dee9",
                              borderRadius: 8,
                              padding: "7px 14px",
                              fontSize: 13,
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            {onlyAtRisk ? "Showing at-risk only" : "Show at-risk only"}
                          </button>
                        </div>

                        <table className="sd-tbl">
                          <thead>
                            <tr>
                              <th>Student</th>
                              <th>Roll No</th>
                              <th style={{ textAlign: "center" }}>Attendance</th>
                              <th style={{ textAlign: "center" }}>Result</th>
                            </tr>
                          </thead>
                          <tbody>
                            {visibleStudents.length > 0 ? (
                              visibleStudents.map((s) => {
                                const isArrear = s.result_status === "failed";
                                return (
                                  <tr key={s.id}>
                                    <td>
                                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <span style={{
                                          width: 28, height: 28, borderRadius: "50%",
                                          background: isArrear ? "#fef2f2" : "#eef4ff",
                                          color: isArrear ? "#dc2626" : "#1d4ed8",
                                          fontSize: 11, fontWeight: 700,
                                          display: "flex", alignItems: "center", justifyContent: "center",
                                        }}>
                                          {initials(s.username)}
                                        </span>
                                        <span>{s.username}</span>
                                      </div>
                                    </td>
                                    <td className="sd-num">{s.roll_number || "-"}</td>
                                    <td className="sd-num" style={{ textAlign: "center", fontWeight: 600, color: attColor(s.attendance_percent) }}>
                                      {s.attendance_percent != null ? `${s.attendance_percent}%` : "—"}
                                    </td>
                                    <td style={{ textAlign: "center" }}>
                                      {isArrear && (
                                        <span style={{ fontSize: 12, fontWeight: 600, color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 999, padding: "3px 12px" }}>
                                          Arrear
                                        </span>
                                      )}
                                      {!isArrear && s.result_status === "passed" && (
                                        <span style={{ fontSize: 12, fontWeight: 600, color: "#15803d", background: "#f0faf4", border: "1px solid #c6ebd4", borderRadius: 999, padding: "3px 12px" }}>
                                          Pass
                                        </span>
                                      )}
                                      {s.result_status == null && (
                                        <span style={{ fontSize: 12, color: "#98a2b3" }}>—</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr><td colSpan="4" className="sd-empty">
                                {onlyAtRisk ? "No at-risk students — class looks healthy." : "No students in this class."}
                              </td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  {/* ════════ ON DUTY TAB ════════ */}
                  {tab === "onduty" && <OnDutyTutor />}
                </>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}