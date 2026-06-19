import { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";
import API from "../../api";
import "../../styles/Attendance.css";

export default function HallTicketAdmin({ embedded = false }) {
  const [open, setOpen] = useState(false);

  const [subjects, setSubjects] = useState([]);   // teaching assignments (for cascade)
  const [selectedCourse, setSelectedCourse] = useState("");
  const [selectedYear, setSelectedYear]     = useState("");
  const [selectedSem, setSelectedSem]       = useState("");

  const [roster, setRoster]     = useState([]);
  const [loading, setLoading]   = useState(false);
  const [fineAmount, setFineAmount] = useState(500);
  const [generating, setGenerating] = useState(false);

  // exam schedule: { [subjectId]: { exam_date, session, id } }
  const [schedule, setSchedule] = useState({});
  const [savingSchedule, setSavingSchedule] = useState(false);

  // ── teaching assignments for the cascade ──
  useEffect(() => {
    API.get("/teaching-assignments/").then((res) => {
      setSubjects(res.data?.results || res.data || []);
    });
  }, []);

  const courses = [...new Set(subjects.map((s) => s.course_name))].sort();
  const years = selectedCourse
    ? [...new Set(subjects.filter((s) => s.course_name === selectedCourse).map((s) => s.year_number))].sort((a, b) => a - b)
    : [];
  const semesters = (selectedCourse && selectedYear)
    ? [...new Set(subjects
        .filter((s) => s.course_name === selectedCourse && String(s.year_number) === String(selectedYear))
        .map((s) => s.semester))].sort((a, b) => a - b)
    : [];

  const courseId = subjects.find((s) => s.course_name === selectedCourse)?.course;

  // subjects in the chosen class (unique by subject id)
  const classSubjects = (() => {
    if (!selectedCourse || !selectedYear || !selectedSem) return [];
    const seen = {};
    subjects
      .filter((s) =>
        s.course_name === selectedCourse &&
        String(s.year_number) === String(selectedYear) &&
        String(s.semester) === String(selectedSem)
      )
      .forEach((s) => { seen[s.subject] = { id: s.subject, name: s.subject_name }; });
    return Object.values(seen);
  })();

  // ── load roster + existing exam schedule when class changes ──
  const loadData = () => {
    if (!courseId || !selectedYear || !selectedSem) { setRoster([]); setSchedule({}); return; }
    setLoading(true);

    Promise.all([
      API.get(`/hall-ticket/roster/?course=${courseId}&year=${selectedYear}&semester=${selectedSem}`),
      API.get(`/exam-schedules/?semester=${selectedSem}`),
    ])
      .then(([rosterRes, schedRes]) => {
        setRoster(rosterRes.data?.results || rosterRes.data || []);

        const sched = schedRes.data?.results || schedRes.data || [];
        const map = {};
        sched.forEach((e) => {
          map[e.subject] = { id: e.id, exam_date: e.exam_date, session: e.session };
        });
        setSchedule(map);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourse, selectedYear, selectedSem]);

  const setSchedField = (subjectId, field, value) => {
    setSchedule((prev) => ({
      ...prev,
      [subjectId]: { ...prev[subjectId], [field]: value },
    }));
  };

  // save all exam dates for this class
  const saveSchedule = async () => {
    setSavingSchedule(true);
    try {
      await Promise.all(
        classSubjects.map((sub) => {
          const row = schedule[sub.id];
          if (!row || !row.exam_date) return null; // skip subjects with no date set
          const payload = {
            subject: sub.id,
            semester: Number(selectedSem),
            exam_date: row.exam_date,
            session: row.session || "FN",
          };
          // update existing or create new
          return row.id
            ? API.patch(`/exam-schedules/${row.id}/`, payload)
            : API.post("/exam-schedules/", payload);
        }).filter(Boolean)
      );
      alert("Exam schedule saved.");
      loadData();
    } catch (err) {
      alert(err.response?.data?.detail || "Error saving exam schedule.");
    } finally {
      setSavingSchedule(false);
    }
  };

  const generateFines = async () => {
    if (!courseId || !selectedYear || !selectedSem) return;
    if (!window.confirm(`Generate ₹${fineAmount} attendance fine for all below-75% students in this class?`)) return;
    setGenerating(true);
    try {
      const res = await API.post("/hall-ticket/generate-fines/", {
        course: courseId,
        year: selectedYear,
        semester: selectedSem,
        amount: fineAmount,
      });
      alert(res.data?.message || "Fines generated.");
      loadData();
    } catch (err) {
      alert(err.response?.data?.detail || "Error generating fines.");
    } finally {
      setGenerating(false);
    }
  };

  const eligibleCount = roster.filter((r) => r.eligible).length;

  const body = (
    <>
      <div className="att-header">
        <div>
          <h1 className="att-title">Hall Ticket — Exam Setup & Eligibility</h1>
          <p className="att-subtitle">Set exam dates, check attendance eligibility, manage fines</p>
        </div>
      </div>

      <div className="att-card">
        <h2 className="att-card-title">Select Class</h2>

        {/* Course → Year → Semester cascade */}
        <div className="att-filter-grid">
          <div className="att-field">
            <label className="att-label">Course</label>
            <select className="att-input" value={selectedCourse}
              onChange={(e) => { setSelectedCourse(e.target.value); setSelectedYear(""); setSelectedSem(""); }}>
              <option value="">— Select Course —</option>
              {courses.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="att-field">
            <label className="att-label">Year</label>
            <select className="att-input" value={selectedYear}
              onChange={(e) => { setSelectedYear(e.target.value); setSelectedSem(""); }}
              disabled={!selectedCourse}>
              <option value="">— Select Year —</option>
              {years.map((y) => <option key={y} value={y}>Year {y}</option>)}
            </select>
          </div>
          <div className="att-field">
            <label className="att-label">Semester</label>
            <select className="att-input" value={selectedSem}
              onChange={(e) => setSelectedSem(e.target.value)}
              disabled={!selectedYear}>
              <option value="">— Select Semester —</option>
              {semesters.map((s) => <option key={s} value={s}>Semester {s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ===== EXAM SCHEDULE ===== */}
      {selectedSem && classSubjects.length > 0 && (
        <div className="att-card">
          <h2 className="att-card-title">Exam Schedule</h2>
          <div className="att-table-wrap">
            <table className="att-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th className="center">Exam Date</th>
                  <th className="center">Session</th>
                </tr>
              </thead>
              <tbody>
                {classSubjects.map((sub) => {
                  const row = schedule[sub.id] || {};
                  return (
                    <tr key={sub.id}>
                      <td className="att-td-name">{sub.name}</td>
                      <td className="center">
                        <input
                          className="att-input"
                          type="date"
                          value={row.exam_date || ""}
                          onChange={(e) => setSchedField(sub.id, "exam_date", e.target.value)}
                        />
                      </td>
                      <td className="center">
                        <select
                          className="att-input"
                          style={{ width: 120 }}
                          value={row.session || "FN"}
                          onChange={(e) => setSchedField(sub.id, "session", e.target.value)}
                        >
                          <option value="FN">FN (Forenoon)</option>
                          <option value="AN">AN (Afternoon)</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="att-save-bar">
            <button className="att-save-btn" onClick={saveSchedule} disabled={savingSchedule}>
              {savingSchedule ? "Saving…" : "Save Exam Schedule"}
            </button>
          </div>
        </div>
      )}

      {/* ===== ELIGIBILITY ROSTER ===== */}
      <div className="att-card">
        <h2 className="att-card-title">Eligibility Roster</h2>

        {loading ? (
          <div className="att-state"><div className="att-spinner" /><p>Loading roster…</p></div>
        ) : !selectedSem ? (
          <div className="att-state"><p>Select course, year and semester above.</p></div>
        ) : roster.length === 0 ? (
          <div className="att-state"><p>No students found for this class.</p></div>
        ) : (
          <>
            <div className="att-summary-row" style={{ alignItems: "center" }}>
              <span className="att-chip present">{eligibleCount} eligible</span>
              <span className="att-chip absent">{roster.length - eligibleCount} not eligible</span>

              <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                <label className="att-label" style={{ margin: 0 }}>Fine ₹</label>
                <input
                  className="att-input"
                  type="number"
                  min={0}
                  style={{ width: 90 }}
                  value={fineAmount}
                  onChange={(e) => setFineAmount(e.target.value)}
                />
                <button className="att-btn-outline" onClick={generateFines} disabled={generating}>
                  {generating ? "Generating…" : "Generate Fines"}
                </button>
              </span>
            </div>

            <div className="att-table-wrap">
              <table className="att-table">
                <thead>
                  <tr>
                    <th>Sl.No</th>
                    <th>Student Name</th>
                    <th>Roll No</th>
                    <th className="center">Attendance</th>
                    <th className="center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((r, idx) => (
                    <tr key={r.student} className={!r.eligible ? "att-row-low" : ""}>
                      <td>{idx + 1}</td>
                      <td className="att-td-name">{r.student_name}</td>
                      <td><span className="att-roll">{r.student_roll_no || "—"}</span></td>
                      <td className="center">
                        {r.attendance_percent != null ? `${r.attendance_percent}%` : "—"}
                      </td>
                      <td className="center">
                        {r.eligible ? (
                          <span style={{ color: "#16a34a", fontSize: 13 }}>
                            {r.reason === "fine_paid" ? "Eligible (fine paid)" : "Eligible"}
                          </span>
                        ) : r.has_unpaid_fine ? (
                          <span style={{ color: "#b45309", fontSize: 13 }}>Fine pending</span>
                        ) : (
                          <span style={{ color: "#dc2626", fontSize: 13 }}>Not eligible</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );

  if (embedded) return body;

  return (
    <div className="app">
      <Navbar setOpen={setOpen} />
      <div className="layout">
        <Sidebar open={open} setOpen={setOpen} />
        <div className="main">
          <div className="content">
            <div className="att-page">{body}</div>
          </div>
        </div>
      </div>
    </div>
  );
}