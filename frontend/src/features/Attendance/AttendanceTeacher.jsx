import { useEffect, useState, useRef } from "react";
import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";
import API from "../../api";
import "../../styles/Attendance.css";

const fmtTime = (t) => {
  if (!t) return "";
  const [h, m] = String(t).split(":");
  let hr = parseInt(h, 10);
  const ap = hr >= 12 ? "PM" : "AM";
  hr = hr % 12 || 12;
  return `${hr}:${m} ${ap}`;
};

// local "today" in YYYY-MM-DD (avoids UTC off-by-one in IST)
const todayLocal = () => {
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().split("T")[0];
};

// normalize a FK that may come back as an id (5) or an object ({id:5})
const idOf = (v) => {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return String(v.id ?? v.pk ?? "");
  return String(v);
};

export default function AttendanceTeacher() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState("mark");

  const [subjects, setSubjects]         = useState([]);
  const [selectedTA, setSelectedTA]     = useState("");
  const [selectedDate, setSelectedDate] = useState(todayLocal());
  const [selectedHour, setSelectedHour] = useState("");
  const [students, setStudents]         = useState([]);
  const [attendance, setAttendance]     = useState({});
  const [loading, setLoading]           = useState(false);
  const [saving, setSaving]             = useState(false);
  const [saved, setSaved]               = useState(false);
  const [periods, setPeriods]           = useState([]);
  const [timeSlots, setTimeSlots]       = useState([]);
  const [periodsLoading, setPeriodsLoading] = useState(false);
  const [semester, setSemester]         = useState(null);

  // ── students with an approved OD covering the selected date ──
  const [odStudentIds, setOdStudentIds] = useState([]);

  const [reportTA, setReportTA]         = useState("");
  const [fromDate, setFromDate]         = useState("");
  const [toDate, setToDate]             = useState("");
  const [reportData, setReportData]     = useState([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [dailyData, setDailyData]       = useState(null);

  // ── teaching assignments (this teacher's classes) ──
  useEffect(() => {
    API.get("/teaching-assignments/?my=true").then((res) => {
      setSubjects(res.data?.results || res.data || []);
    });
  }, []);

  // ── all time slots (period times) ──
  useEffect(() => {
    API.get("/timeslots/").then((res) => {
      setTimeSlots(res.data?.results || res.data || []);
    });
  }, []);

  // ── active semester (date window) ──
  useEffect(() => {
    API.get("/semester/").then((res) => {
      const data = res.data?.results || res.data || [];
      setSemester(Array.isArray(data) ? data[0] : data);
    });
  }, []);

  // ── approved-OD students for the selected date ──
  useEffect(() => {
    if (!selectedDate) { setOdStudentIds([]); return; }
    API.get(`/attendance/od_students/?date=${selectedDate}`)
      .then((res) => {
        const ids = (res.data?.student_ids || []).map((id) => Number(id));
        setOdStudentIds(ids);
      })
      .catch(() => setOdStudentIds([]));
  }, [selectedDate]);

  // ── students when subject changes ──
  useEffect(() => {
    if (!selectedTA) { setStudents([]); return; }
    setLoading(true);
    API.get(`/enrollments/?teaching_assignment=${selectedTA}`)
      .then((res) => {
        const raw = res.data;
        const data = Array.isArray(raw) ? raw : (raw?.results || []);
        setStudents(data);
        const init = {};
        data.forEach((e) => {
          // OD students default to duty_leave; everyone else present
          init[e.student] = odStudentIds.includes(Number(e.student)) ? "duty_leave" : "present";
        });
        setAttendance(init);
      })
      .finally(() => setLoading(false));
  }, [selectedTA, odStudentIds]);

  // ── periods for this class on the selected date (timetable + semester window) ──
  useEffect(() => {
    if (!selectedTA || !selectedDate) { setPeriods([]); setSelectedHour(""); return; }

    // block dates outside the active semester window
    if (semester) {
      if (
        (semester.start_date && selectedDate < semester.start_date) ||
        (semester.end_date && selectedDate > semester.end_date)
      ) {
        setPeriods([]); setSelectedHour(""); return;
      }
    }

    const jsDay = new Date(selectedDate + "T00:00:00").getDay();
    if (jsDay === 0) { setPeriods([]); setSelectedHour(""); return; } // Sunday
    const weekday = jsDay - 1; // Mon=0 .. Sat=5

    setPeriodsLoading(true);
    API.get("/timetable/?scope=teacher")
      .then((res) => {
        const entries = res.data?.results || res.data || [];

        const todays = entries.filter(
          (e) => idOf(e.assignment) === String(selectedTA) && e.day_of_week === weekday
        );

        const slotMap = {};
        timeSlots.forEach((s) => { slotMap[s.period_no] = s; });

        const list = todays
          .map((e) => {
            const slot = slotMap[e.period_no];
            return {
              hour: e.period_no,
              label: slot
                ? `Period ${e.period_no} (${fmtTime(slot.start_time)}–${fmtTime(slot.end_time)})`
                : `Period ${e.period_no}`,
            };
          })
          .sort((a, b) => a.hour - b.hour)
          .filter((p, i, arr) => i === 0 || arr[i - 1].hour !== p.hour);

        setPeriods(list);
        setSelectedHour(list.length > 0 ? list[0].hour : "");
      })
      .finally(() => setPeriodsLoading(false));
  }, [selectedTA, selectedDate, timeSlots, semester]);

  // ── load existing attendance for the chosen period ──
  useEffect(() => {
    if (!selectedTA || !selectedDate || !selectedHour) return;
    API.get(`/attendance/?teaching_assignment=${selectedTA}&from_date=${selectedDate}&to_date=${selectedDate}`)
      .then((res) => {
        const data = res.data?.results || res.data || [];
        const hourData = data.filter((a) => a.hour === Number(selectedHour));
        if (hourData.length > 0) {
          const existing = {};
          hourData.forEach((a) => { existing[a.student] = a.status; });
          setAttendance((prev) => ({ ...prev, ...existing }));
        }
      });
  }, [selectedTA, selectedDate, selectedHour]);

  const isOd = (studentId) => odStudentIds.includes(Number(studentId));

  const markAll = (status) => {
    const all = {};
    students.forEach((e) => {
      // never override an approved-OD student
      all[e.student] = isOd(e.student) ? "duty_leave" : status;
    });
    setAttendance(all);
  };

  const setStatus = (studentId, status) => {
    if (isOd(studentId)) return;   // locked — approved OD
    setAttendance((prev) => ({ ...prev, [studentId]: status }));
  };

  const saveAttendance = async () => {
    if (!selectedTA || !selectedDate) return alert("Please select subject and date.");
    if (!selectedHour) return alert("No period scheduled — attendance cannot be saved for this day.");
    setSaving(true);
    const records = students.map((e) => ({
      student: e.student,
      // force duty_leave for approved-OD students regardless of UI state
      status: isOd(e.student) ? "duty_leave" : (attendance[e.student] || "absent"),
    }));
    try {
      await API.post("/attendance/bulk_mark/", {
        teaching_assignment: selectedTA,
        date: selectedDate,
        hour: Number(selectedHour),
        records,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      alert("Error saving attendance. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const fetchReport = async () => {
    if (!reportTA || !fromDate || !toDate) return alert("Please select subject and both dates.");
    setReportLoading(true);
    try {
      const res = await API.get(
        `/attendance/?teaching_assignment=${reportTA}&from_date=${fromDate}&to_date=${toDate}`
      );
      const data = res.data?.results || res.data || [];
      const studentMap = {};
      data.forEach((a) => {
        if (!studentMap[a.student]) {
          studentMap[a.student] = { name: a.student_name, roll: a.student_roll_no || "-", present: 0, absent: 0, duty: 0, total: 0 };
        }
        studentMap[a.student].total++;
        if (a.status === "present")         studentMap[a.student].present++;
        else if (a.status === "absent")     studentMap[a.student].absent++;
        else if (a.status === "duty_leave") studentMap[a.student].duty++;
      });
      setReportData(Object.values(studentMap));

      const dailyMap = {};
      const allDatesSet = new Set();
      const allHoursSet = new Set();
      data.forEach((a) => {
        allDatesSet.add(a.date); allHoursSet.add(a.hour);
        if (!dailyMap[a.student]) {
          dailyMap[a.student] = { name: a.student_name, roll: a.student_roll_no || "-", dates: {} };
        }
        if (!dailyMap[a.student].dates[a.date]) dailyMap[a.student].dates[a.date] = {};
        dailyMap[a.student].dates[a.date][a.hour] = a.status;
      });
      setDailyData({ students: Object.values(dailyMap), dates: [...allDatesSet].sort(), hours: [...allHoursSet].sort((a, b) => a - b) });
    } catch {
      alert("Error fetching report.");
    } finally {
      setReportLoading(false);
    }
  };

  const handlePrint = () => {
    const subject = subjects.find((s) => String(s.id) === String(reportTA));
    const subjectName = subject ? `${subject.subject_name} (Sem ${subject.semester})` : "";
    const rows = reportData.map((s, idx) => {
      const ahPct = s.total > 0 ? ((s.present / s.total) * 100).toFixed(2) : "0.00";
      const dlPct = s.total > 0 ? (((s.present + s.duty) / s.total) * 100).toFixed(2) : "0.00";
      const isLow = parseFloat(ahPct) < 75;
      return `<tr style="color:${isLow ? "#dc2626" : "#000"}">
        <td style="border:1px solid #ccc;padding:6px;text-align:center">${idx + 1}</td>
        <td style="border:1px solid #ccc;padding:6px">${s.name}</td>
        <td style="border:1px solid #ccc;padding:6px;text-align:center">${s.roll}</td>
        <td style="border:1px solid #ccc;padding:6px;text-align:center">${s.total}</td>
        <td style="border:1px solid #ccc;padding:6px;text-align:center">${s.present}</td>
        <td style="border:1px solid #ccc;padding:6px;text-align:center">${s.duty}</td>
        <td style="border:1px solid #ccc;padding:6px;text-align:center">${s.present + s.duty}</td>
        <td style="border:1px solid #ccc;padding:6px;text-align:center;${isLow ? "color:#dc2626;font-weight:700" : "color:#16a34a;font-weight:700"}">${ahPct}%</td>
        <td style="border:1px solid #ccc;padding:6px;text-align:center;font-weight:600">${dlPct}%</td>
      </tr>`;
    }).join("");
    const html = `<html><head><title>Attendance Report</title>
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:13px;padding:20px}
    .title{text-align:center;font-size:17px;font-weight:700;margin-bottom:4px}
    .sub{text-align:center;font-size:13px;font-weight:600;border:2px solid #000;padding:6px;margin-bottom:10px}
    .info{font-size:12px;margin-bottom:8px}table{width:100%;border-collapse:collapse;font-size:12px}
    th{background:#f1f5f9;border:1px solid #ccc;padding:7px;text-align:center;font-weight:700}
    @media print{@page{size:A4 landscape;margin:10mm}}</style></head>
    <body>
      <div class="title">Learning Management System</div>
      <div class="sub">Course Wise Attendance Report</div>
      <p class="info"><b>Subject:</b> ${subjectName} &nbsp;&nbsp; <b>Period:</b> ${fromDate} to ${toDate}</p>
      <table><thead><tr>
        <th>Sl.No</th><th>Student Name</th><th>Roll No</th>
        <th>TH</th><th>AH</th><th>DL</th><th>AH+DL</th><th>AH%</th><th>AH+DL%</th>
      </tr></thead><tbody>${rows}</tbody></table>
      <p style="font-size:11px;color:#888;margin-top:8px">* Red = below 75% | TH: Total Hours | AH: Attended | DL: Duty Leave</p>
    </body></html>`;
    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
    win.print();
  };

  const resetReport = () => { setReportTA(""); setFromDate(""); setToDate(""); setReportData([]); setDailyData(null); };

  const presentCount = Object.values(attendance).filter((v) => v === "present").length;
  const absentCount  = Object.values(attendance).filter((v) => v === "absent").length;
  const dutyCount    = Object.values(attendance).filter((v) => v === "duty_leave").length;

  // helper for the "no periods" message
  const noPeriodReason = () => {
    if (semester && semester.start_date && selectedDate < semester.start_date)
      return `Semester has not started yet (begins ${semester.start_date}).`;
    if (semester && semester.end_date && selectedDate > semester.end_date)
      return `Semester has ended (ended ${semester.end_date}).`;
    const jsDay = new Date(selectedDate + "T00:00:00").getDay();
    if (jsDay === 0) return "Sunday — no classes scheduled.";
    return "No class scheduled for this subject on this day (free hour / holiday).";
  };

  return (
    <div className="app">
      <Navbar setOpen={setOpen} />
      <div className="layout">
        <Sidebar open={open} setOpen={setOpen} />
        <div className="main">
          <div className="content">
            <div className="att-page">

              {/* ── Header ── */}
              <div className="att-header">
                <div>
                  <h1 className="att-title">Attendance</h1>
                  <p className="att-subtitle">Mark and view student attendance</p>
                </div>
              </div>

              {/* ── Tabs ── */}
              <div className="att-tabs">
                <button
                  className={`att-tab${view === "mark" ? " active" : ""}`}
                  onClick={() => setView("mark")}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Mark Attendance
                </button>
                <button
                  className={`att-tab${view === "report" ? " active" : ""}`}
                  onClick={() => setView("report")}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <path d="M3 9h18M9 21V9"/>
                  </svg>
                  View Report
                </button>
              </div>

              {/* ════════ MARK ATTENDANCE ════════ */}
              {view === "mark" && (
                <div className="att-card">
                  <h2 className="att-card-title">Mark Attendance</h2>

                  {/* Filters */}
                  <div className="att-filter-grid">
                    <div className="att-field">
                      <label className="att-label">Subject</label>
                      <select className="att-input" value={selectedTA} onChange={(e) => setSelectedTA(e.target.value)}>
                        <option value="">— Select Subject —</option>
                        {subjects.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.subject_name} — {s.course_name} (Year {s.year_number}, Sem {s.semester})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="att-field">
                      <label className="att-label">Date</label>
                      <input className="att-input" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
                    </div>
                    <div className="att-field">
                      <label className="att-label">Period</label>
                      <select className="att-input" value={selectedHour} onChange={(e) => setSelectedHour(Number(e.target.value))} disabled={periods.length === 0}>
                        {periods.length === 0
                          ? <option value="">— No class this day —</option>
                          : periods.map((p) => <option key={p.hour} value={p.hour}>{p.label}</option>)
                        }
                      </select>
                    </div>
                  </div>

                  {/* Quick mark */}
                  {students.length > 0 && periods.length > 0 && (
                    <div className="att-quick-bar">
                      <span className="att-quick-label">Mark all:</span>
                      <button className="att-quick-btn present" onClick={() => markAll("present")}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12"><polyline points="20 6 9 17 4 12"/></svg>
                        All Present
                      </button>
                      <button className="att-quick-btn absent" onClick={() => markAll("absent")}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        All Absent
                      </button>
                    </div>
                  )}

                  {/* States */}
                  {loading ? (
                    <div className="att-state"><div className="att-spinner" /><p>Loading students…</p></div>
                  ) : !selectedTA ? (
                    <div className="att-state"><p>Select a subject above to mark attendance.</p></div>
                  ) : periodsLoading ? (
                    <div className="att-state"><div className="att-spinner" /><p>Loading periods…</p></div>
                  ) : periods.length === 0 ? (
                    <div className="att-state"><p>{noPeriodReason()}</p></div>
                  ) : students.length === 0 ? (
                    <div className="att-state"><p>No students enrolled in this subject.</p></div>
                  ) : (
                    <>
                      <div className="att-table-wrap">
                        <table className="att-table">
                          <thead>
                            <tr>
                              <th>Sl.No</th>
                              <th>Student Name</th>
                              <th>Roll No</th>
                              <th className="center">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {students.map((e, idx) => {
                              const od = isOd(e.student);
                              const status = od ? "duty_leave" : (attendance[e.student] || "absent");
                              return (
                                <tr key={e.id}>
                                  <td>{idx + 1}</td>
                                  <td className="att-td-name">
                                    {e.student_name}
                                    {od && <span className="att-od-tag">OD</span>}
                                  </td>
                                  <td><span className="att-roll">{e.student_roll_no || "—"}</span></td>
                                  <td className="center">
                                    {od ? (
                                      <span className="att-status-btn duty active att-status-locked">DL · On Duty</span>
                                    ) : (
                                      <div className="att-status-group">
                                        <button className={`att-status-btn present${status === "present" ? " active" : ""}`} onClick={() => setStatus(e.student, "present")}>P</button>
                                        <button className={`att-status-btn absent${status === "absent" ? " active" : ""}`} onClick={() => setStatus(e.student, "absent")}>A</button>
                                        <button className={`att-status-btn duty${status === "duty_leave" ? " active" : ""}`} onClick={() => setStatus(e.student, "duty_leave")}>DL</button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Summary chips */}
                      <div className="att-summary-row">
                        <span className="att-chip present">{presentCount} Present</span>
                        <span className="att-chip absent">{absentCount} Absent</span>
                        <span className="att-chip duty">{dutyCount} Duty Leave</span>
                      </div>

                      {/* Save bar */}
                      <div className="att-save-bar">
                        <button className={`att-save-btn${saving ? " loading" : ""}`} onClick={saveAttendance} disabled={saving}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                            <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
                          </svg>
                          {saving ? "Saving…" : "Save Attendance"}
                        </button>
                        {saved && (
                          <span className="att-saved-msg">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                            Attendance saved successfully
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ════════ VIEW REPORT ════════ */}
              {view === "report" && (
                <div className="att-card">
                  <h2 className="att-card-title">Course Wise Attendance Report</h2>

                  <div className="att-filter-grid">
                    <div className="att-field">
                      <label className="att-label">Subject</label>
                      <select className="att-input" value={reportTA} onChange={(e) => setReportTA(e.target.value)}>
                        <option value="">— Select Subject —</option>
                        {subjects.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.subject_name} — {s.course_name} (Year {s.year_number}, Sem {s.semester})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="att-field">
                      <label className="att-label">From Date</label>
                      <input className="att-input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                    </div>
                    <div className="att-field">
                      <label className="att-label">To Date</label>
                      <input className="att-input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                    </div>
                  </div>

                  <div className="att-btn-row">
                    <button className="att-btn-primary" onClick={fetchReport} disabled={reportLoading}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                      </svg>
                      {reportLoading ? "Loading…" : "Search"}
                    </button>
                    <button className="att-btn-outline" onClick={resetReport}>Reset</button>
                    {reportData.length > 0 && (
                      <button className="att-btn-outline" onClick={handlePrint}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                          <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                          <rect x="6" y="14" width="12" height="8"/>
                        </svg>
                        Print
                      </button>
                    )}
                  </div>

                  {/* Legend */}
                  <div className="att-legend">
                    <span><b>TH</b> Total Hours</span>
                    <span><b>AH</b> Attended Hours</span>
                    <span><b>DL</b> Duty Leave</span>
                    <span><b>AH+DL</b> Attended + Duty Leave</span>
                    <span><b>AH%</b> Attendance %</span>
                    <span><b>AH+DL%</b> Attendance with Duty Leave %</span>
                  </div>

                  {fromDate && toDate && reportData.length > 0 && (
                    <p className="att-rule-note">Attendance rule applied from <b>{fromDate}</b> to <b>{toDate}</b></p>
                  )}

                  {reportLoading ? (
                    <div className="att-state"><div className="att-spinner" /><p>Loading report…</p></div>
                  ) : reportData.length === 0 ? (
                    <div className="att-state"><p>Select subject and date range, then click Search.</p></div>
                  ) : (
                    <>
                      <div className="att-table-wrap">
                        <table className="att-table">
                          <thead>
                            <tr>
                              <th>Sl.No</th>
                              <th>Student Name</th>
                              <th>Roll No</th>
                              <th className="center">TH</th>
                              <th className="center">AH</th>
                              <th className="center">DL</th>
                              <th className="center">AH+DL</th>
                              <th className="center">AH%</th>
                              <th className="center">AH+DL%</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reportData.map((s, idx) => {
                              const ahPct = s.total > 0 ? ((s.present / s.total) * 100).toFixed(2) : "0.00";
                              const dlPct = s.total > 0 ? (((s.present + s.duty) / s.total) * 100).toFixed(2) : "0.00";
                              const isLow = parseFloat(ahPct) < 75;
                              return (
                                <tr key={idx} className={isLow ? "att-row-low" : ""}>
                                  <td>{idx + 1}</td>
                                  <td className="att-td-name">{s.name}</td>
                                  <td><span className="att-roll">{s.roll}</span></td>
                                  <td className="center">{s.total}</td>
                                  <td className="center">{s.present}</td>
                                  <td className="center">{s.duty}</td>
                                  <td className="center">{s.present + s.duty}</td>
                                  <td className={`center att-pct${isLow ? " low" : " good"}`}>{ahPct}%</td>
                                  <td className="center att-pct">{dlPct}%</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <p className="att-footnote">* Rows highlighted in red indicate attendance below 75%</p>
                    </>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}