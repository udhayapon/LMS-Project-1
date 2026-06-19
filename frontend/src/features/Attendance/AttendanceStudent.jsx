import { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";
import API from "../../api";
import "../../styles/Attendance.css";

const DOT_LABEL = { present: "P", absent: "A", duty_leave: "DL" };

const fmtDate = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
};

export default function AttendanceStudent() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState("daily");

  // class period numbers from admin's timetable (e.g. [1,2,3,4,5,6,7,8])
  const [hours, setHours] = useState([]);

  // top summary (semester start → today, all subjects)
  const [summary, setSummary] = useState(null); // { present, absent, duty, total, pct }

  const [fromDate, setFromDate]   = useState("");
  const [toDate, setToDate]       = useState("");
  const [dailyData, setDailyData] = useState([]);
  const [dailyRaw, setDailyRaw]   = useState([]);
  const [dailyLoading, setDailyLoading] = useState(false);

  const [cwFrom, setCwFrom]               = useState("");
  const [cwTo, setCwTo]                   = useState("");
  const [courseReport, setCourseReport]   = useState([]);
  const [cwLoading, setCwLoading]         = useState(false);

  // ── load the real periods admin created (class periods only) ──
  useEffect(() => {
    const loadPeriods = async () => {
      try {
        const res = await API.get("/timeslots/");
        const slots = res.data || [];
        const classHours = slots
          .filter((s) => !s.is_break)               // breaks aren't marked for attendance
          .map((s) => Number(s.period_no))
          .filter((n) => !Number.isNaN(n))
          .sort((a, b) => a - b);
        // de-dup while keeping order
        setHours([...new Set(classHours)]);
      } catch (err) {
        console.error("Load periods error:", err);
        setHours([]);   // fall back below, derived from the data
      }
    };
    loadPeriods();
  }, []);

  // ── summary: semester start → today, across all subjects ──
  useEffect(() => {
    const loadSummary = async () => {
      try {
        let fromParam = "";
        try {
          const semRes = await API.get("/semester/");
          const sem = (semRes.data || [])[0];
          if (sem && sem.start_date) fromParam = sem.start_date;
        } catch { /* no semester → fall back to all-time below */ }

        const today = new Date().toISOString().slice(0, 10);
        // with a semester start: that range; otherwise all of the student's records
        const url = fromParam
          ? `/attendance/?from_date=${fromParam}&to_date=${today}`
          : `/attendance/`;
        const res = await API.get(url);
        const data = res.data?.results || res.data || [];

        let present = 0, absent = 0, duty = 0;
        data.forEach((a) => {
          if (a.status === "present") present++;
          else if (a.status === "duty_leave") duty++;
          else if (a.status === "absent") absent++;
        });
        const total = present + absent + duty;
        const pct = total ? Math.round(((present + duty) / total) * 100) : 0;
        setSummary({ present, absent, duty, total, pct });
      } catch (err) {
        console.error("Summary load error:", err);
      }
    };
    loadSummary();
  }, []);

  // If periods haven't loaded (or none exist), fall back to the hours
  // actually present in the fetched attendance so the table still shows.
  const hoursFor = (records) => {
    if (hours.length) return hours;
    const found = [...new Set(records.map((a) => Number(a.hour)).filter((n) => !Number.isNaN(n)))]
      .sort((a, b) => a - b);
    return found.length ? found : [1, 2, 3, 4, 5, 6, 7, 8];
  };

  const fetchDaily = async () => {
    if (!fromDate || !toDate) return alert("Please select both From Date and To Date.");
    setDailyLoading(true);
    try {
      const res  = await API.get(`/attendance/?from_date=${fromDate}&to_date=${toDate}`);
      const data = res.data?.results || res.data || [];
      setDailyRaw(data);
      const grouped = {};
      data.forEach((a) => {
        if (!grouped[a.date]) grouped[a.date] = {};
        grouped[a.date][a.hour] = a.status;
      });
      setDailyData(Object.keys(grouped).sort().map((date) => ({ date, hours: grouped[date] })));
    } catch { alert("Error fetching attendance."); }
    finally { setDailyLoading(false); }
  };

  const resetDaily = () => { setFromDate(""); setToDate(""); setDailyData([]); setDailyRaw([]); };

  const fetchCourseWise = async () => {
    if (!cwFrom || !cwTo) return alert("Please select both From Date and To Date.");
    setCwLoading(true);
    try {
      const res  = await API.get(`/attendance/?from_date=${cwFrom}&to_date=${cwTo}`);
      const data = res.data?.results || res.data || [];
      const subjectMap = {};
      data.forEach((a) => {
        const key = a.teaching_assignment;
        if (!subjectMap[key]) subjectMap[key] = { subject: a.subject_name, course: a.course_name, total: 0, present: 0, duty: 0 };
        subjectMap[key].total++;
        if (a.status === "present")         subjectMap[key].present++;
        else if (a.status === "duty_leave") subjectMap[key].duty++;
      });
      setCourseReport(Object.values(subjectMap));
    } catch { alert("Error fetching report."); }
    finally { setCwLoading(false); }
  };

  const resetCourseWise = () => { setCwFrom(""); setCwTo(""); setCourseReport([]); };

  const handlePrintDaily = () => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const printHours = hoursFor(dailyRaw);
    const hourHeaders = printHours.map(h => `<th>Hour ${h}</th>`).join("");
    const rows = dailyData.map((row) => {
      const hasAny = Object.keys(row.hours).length > 0;
      if (!hasAny) return `<tr><td class="date-col" style="color:#dc2626">${fmtDate(row.date)}</td><td colspan="${printHours.length}" style="text-align:center;color:#dc2626;font-style:italic">Holiday / No Classes</td></tr>`;
      const cells = printHours.map(h => {
        const s = row.hours[h];
        if (s === "present")    return `<td class="p">P</td>`;
        if (s === "absent")     return `<td class="a">A</td>`;
        if (s === "duty_leave") return `<td class="dl">DL</td>`;
        return `<td class="dash">—</td>`;
      }).join("");
      return `<tr><td class="date-col">${fmtDate(row.date)}</td>${cells}</tr>`;
    }).join("");
    const html = `<html><head><title>Daily Attendance</title>
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:13px;padding:30px}
    .title{text-align:center;font-size:16px;font-weight:bold;border:2px solid #000;padding:8px;border-bottom:none}
    .info-table{width:100%;border-collapse:collapse;border:2px solid #000;border-top:none}
    .info-table td{border:1px solid #000;padding:7px 10px}
    .rule{text-align:center;border:1px solid #000;border-top:none;padding:7px;margin-bottom:12px}
    table.att{width:100%;border-collapse:collapse}
    table.att th{border:1px solid #ccc;padding:7px 5px;background:#f5f5f5;text-align:center;font-weight:bold}
    table.att td{border:1px solid #ccc;padding:6px 5px;text-align:center}
    .date-col{text-align:left!important;padding-left:10px!important;font-weight:600}
    .p{color:#16a34a;font-weight:bold}.a{color:#dc2626;font-weight:bold}.dl{color:#d97706;font-weight:bold}.dash{color:#ccc}
    @media print{@page{size:A4 landscape;margin:15mm}}</style></head>
    <body>
      <div class="title">Daily Attendance</div>
      <table class="info-table"><tr>
        <td><b>Student Name:</b> ${user.username || "-"}</td>
        <td><b>Roll No:</b> ${user.roll_number || "-"}</td>
        <td><b>Course:</b> ${dailyRaw[0]?.course_name || "-"}</td>
        <td><b>Year:</b> ${dailyRaw[0]?.year_number || "-"}</td>
        <td><b>Semester:</b> ${dailyRaw[0]?.semester || "-"}</td>
      </tr></table>
      <div class="rule">Using attendance rule from <b>${fmtDate(fromDate)}</b> to <b>${fmtDate(toDate)}</b></div>
      <table class="att"><thead><tr><th class="date-col">Dates</th>${hourHeaders}</tr></thead><tbody>${rows}</tbody></table>
      <p style="font-size:12px;color:#555;margin-top:10px">P = Present &nbsp; A = Absent &nbsp; DL = Duty Leave</p>
    </body></html>`;
    const win = window.open("", "_blank"); win.document.write(html); win.document.close(); win.print();
  };

  const handlePrintCourseWise = () => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const rows = courseReport.map((c, idx) => {
      const ahPct = c.total > 0 ? ((c.present / c.total) * 100).toFixed(2) : "0.00";
      const dlPct = c.total > 0 ? (((c.present + c.duty) / c.total) * 100).toFixed(2) : "0.00";
      const isLow = parseFloat(ahPct) < 75;
      return `<tr style="color:${isLow ? "#dc2626" : "#000"}">
        <td style="border:1px solid #ccc;padding:6px;text-align:center">${idx + 1}</td>
        <td style="border:1px solid #ccc;padding:8px 6px"><b>${c.subject}</b>${c.course ? ` (${c.course})` : ""}</td>
        <td style="border:1px solid #ccc;padding:6px;text-align:center">${c.total}</td>
        <td style="border:1px solid #ccc;padding:6px;text-align:center">${c.present}</td>
        <td style="border:1px solid #ccc;padding:6px;text-align:center">${c.duty}</td>
        <td style="border:1px solid #ccc;padding:6px;text-align:center">${c.present + c.duty}</td>
        <td style="border:1px solid #ccc;padding:6px;text-align:center;${isLow ? "color:#dc2626;font-weight:700" : "color:#16a34a;font-weight:700"}">${ahPct}%</td>
        <td style="border:1px solid #ccc;padding:6px;text-align:center;font-weight:600">${dlPct}%</td>
      </tr>`;
    }).join("");
    const html = `<html><head><title>Course Wise Attendance</title>
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:13px;padding:24px}
    .college{text-align:center;font-size:18px;font-weight:bold;margin-bottom:6px}
    .rtitle{text-align:center;font-size:14px;font-weight:bold;border:2px solid #000;padding:8px;margin-bottom:12px}
    table{width:100%;border-collapse:collapse}th{background:#f1f5f9;border:1px solid #ccc;padding:7px;text-align:center;font-weight:bold}
    @media print{@page{size:A4 landscape;margin:12mm}}</style></head>
    <body>
      <div class="college">Learning Management System</div>
      <div class="rtitle">Course Wise Attendance Report</div>
      <p style="font-size:13px;margin-bottom:10px"><b>Student:</b> ${user.username || "-"} &nbsp; <b>Roll No:</b> ${user.roll_number || "-"} &nbsp; <b>Date Range:</b> ${fmtDate(cwFrom)} to ${fmtDate(cwTo)}</p>
      <table><thead><tr><th>Sl.No</th><th>Course Name</th><th>TH</th><th>AH</th><th>DL</th><th>AH+DL</th><th>AH%</th><th>AH+DL%</th></tr></thead><tbody>${rows}</tbody></table>
      <p style="font-size:11px;color:#888;margin-top:8px">* Red = below 75% | TH: Total Hours | AH: Attended | DL: Duty Leave</p>
    </body></html>`;
    const win = window.open("", "_blank"); win.document.write(html); win.document.close(); win.print();
  };

  // hours to render in the on-screen daily table
  const dailyHours = hoursFor(dailyRaw);

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
                  <h1 className="att-title">My Attendance</h1>
                  <p className="att-subtitle">View your attendance records</p>
                </div>
              </div>

              {/* ── Summary (semester to date, all subjects) ── */}
              {summary && summary.total > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: 12, margin: "0 0 18px" }}>
                  <div style={{ background: "#fff", border: "1px solid #eaecf0", borderRadius: 14, padding: "16px 18px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "#667085", marginBottom: 6 }}>Overall attendance</div>
                    <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1, color: summary.pct >= 75 ? "#16a34a" : summary.pct >= 60 ? "#d97706" : "#dc2626", fontVariantNumeric: "tabular-nums" }}>{summary.pct}%</div>
                    <div style={{ fontSize: 12, color: "#98a2b3", marginTop: 6 }}>Since semester start</div>
                  </div>
                  <div style={{ background: "#fff", border: "1px solid #eaecf0", borderRadius: 14, padding: "16px 18px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "#667085", marginBottom: 6 }}>Present</div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: "#16a34a", fontVariantNumeric: "tabular-nums" }}>{summary.present + summary.duty}</div>
                    {summary.duty > 0 && <div style={{ fontSize: 11.5, color: "#98a2b3", marginTop: 5 }}>incl. {summary.duty} duty leave</div>}
                  </div>
                  <div style={{ background: "#fff", border: "1px solid #eaecf0", borderRadius: 14, padding: "16px 18px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "#667085", marginBottom: 6 }}>Absent</div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: "#dc2626", fontVariantNumeric: "tabular-nums" }}>{summary.absent}</div>
                  </div>
                  <div style={{ background: "#fff", border: "1px solid #eaecf0", borderRadius: 14, padding: "16px 18px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "#667085", marginBottom: 6 }}>Total classes</div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>{summary.total}</div>
                  </div>
                </div>
              )}

              {/* ── Tabs ── */}
              <div className="att-tabs">
                <button className={`att-tab${view === "daily" ? " active" : ""}`} onClick={() => setView("daily")}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
                    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  Daily Attendance
                </button>
                <button className={`att-tab${view === "coursewise" ? " active" : ""}`} onClick={() => setView("coursewise")}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
                  </svg>
                  Course Wise Report
                </button>
              </div>

              {/* ════════ DAILY ATTENDANCE ════════ */}
              {view === "daily" && (
                <div className="att-card">
                  <h2 className="att-card-title">Daily Attendance</h2>

                  <div className="att-filter-row">
                    <div className="att-field">
                      <label className="att-label">From Date</label>
                      <input className="att-input att-input-date" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                    </div>
                    <div className="att-field">
                      <label className="att-label">To Date</label>
                      <input className="att-input att-input-date" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                    </div>
                    <div className="att-btn-row">
                      <button className="att-btn-primary" onClick={fetchDaily}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                        Search
                      </button>
                      <button className="att-btn-outline" onClick={resetDaily}>Reset</button>
                      {dailyData.length > 0 && (
                        <button className="att-btn-outline" onClick={handlePrintDaily}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                            <polyline points="6 9 6 2 18 2 18 9"/>
                            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                            <rect x="6" y="14" width="12" height="8"/>
                          </svg>
                          Print
                        </button>
                      )}
                    </div>
                  </div>

                  {dailyLoading ? (
                    <div className="att-state"><div className="att-spinner" /><p>Loading…</p></div>
                  ) : dailyData.length === 0 ? (
                    <div className="att-state"><p>Select a date range and click Search to view attendance.</p></div>
                  ) : (
                    <>
                      <p className="att-rule-note">
                        Using attendance rule from <b>{fmtDate(fromDate)}</b> to <b>{fmtDate(toDate)}</b>
                      </p>
                      <div className="att-table-wrap">
                        <table className="att-table">
                          <thead>
                            <tr>
                              <th>Dates</th>
                              {dailyHours.map((h) => <th key={h} className="center">Hour {h}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {dailyData.map((row, idx) => {
                              const hasAny = Object.keys(row.hours).length > 0;
                              return (
                                <tr key={idx}>
                                  <td className={`att-td-date${!hasAny ? " holiday" : ""}`}>
                                    {fmtDate(row.date)}
                                  </td>
                                  {!hasAny ? (
                                    <td colSpan={dailyHours.length} className="att-holiday-cell">Holiday / No Classes</td>
                                  ) : (
                                    dailyHours.map((h) => {
                                      const status = row.hours[h];
                                      return (
                                        <td key={h} className="center">
                                          {status
                                            ? <span className={`att-dot ${status}`}>{DOT_LABEL[status]}</span>
                                            : <span className="att-dot-empty">—</span>
                                          }
                                        </td>
                                      );
                                    })
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Legend */}
                      <div className="att-dot-legend">
                        <span className="att-legend-item"><span className="att-dot present">P</span> Present</span>
                        <span className="att-legend-item"><span className="att-dot absent">A</span> Absent</span>
                        <span className="att-legend-item"><span className="att-dot duty_leave">DL</span> Duty Leave</span>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ════════ COURSE WISE REPORT ════════ */}
              {view === "coursewise" && (
                <div className="att-card">
                  <h2 className="att-card-title">Course Wise Report</h2>

                  <div className="att-filter-row">
                    <div className="att-field">
                      <label className="att-label">From Date</label>
                      <input className="att-input att-input-date" type="date" value={cwFrom} onChange={(e) => setCwFrom(e.target.value)} />
                    </div>
                    <div className="att-field">
                      <label className="att-label">To Date</label>
                      <input className="att-input att-input-date" type="date" value={cwTo} onChange={(e) => setCwTo(e.target.value)} />
                    </div>
                    <div className="att-btn-row">
                      <button className="att-btn-primary" onClick={fetchCourseWise}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                        Search
                      </button>
                      <button className="att-btn-outline" onClick={resetCourseWise}>Reset</button>
                      {courseReport.length > 0 && (
                        <button className="att-btn-outline" onClick={handlePrintCourseWise}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                            <polyline points="6 9 6 2 18 2 18 9"/>
                            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                            <rect x="6" y="14" width="12" height="8"/>
                          </svg>
                          Print
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="att-legend">
                    <span><b>TH</b> Total Hours</span>
                    <span><b>AH</b> Attended Hours</span>
                    <span><b>DL</b> Duty Leave</span>
                    <span><b>AH+DL</b> Attended + Duty Leave</span>
                    <span><b>AH%</b> Attendance %</span>
                    <span><b>AH+DL%</b> With Duty Leave %</span>
                  </div>

                  {cwLoading ? (
                    <div className="att-state"><div className="att-spinner" /><p>Loading…</p></div>
                  ) : courseReport.length === 0 ? (
                    <div className="att-state"><p>Select a date range and click Search to view your report.</p></div>
                  ) : (
                    <>
                      {cwFrom && cwTo && (
                        <p className="att-rule-note">
                          Using attendance rule from <b>{fmtDate(cwFrom)}</b> to <b>{fmtDate(cwTo)}</b>
                        </p>
                      )}
                      <div className="att-table-wrap">
                        <table className="att-table">
                          <thead>
                            <tr>
                              <th>Sl.No</th>
                              <th>Course Name</th>
                              <th className="center">TH</th>
                              <th className="center">AH</th>
                              <th className="center">DL</th>
                              <th className="center">AH+DL</th>
                              <th className="center">AH%</th>
                              <th className="center">AH+DL%</th>
                            </tr>
                          </thead>
                          <tbody>
                            {courseReport.map((c, idx) => {
                              const ahPct = c.total > 0 ? ((c.present / c.total) * 100).toFixed(2) : "0.00";
                              const dlPct = c.total > 0 ? (((c.present + c.duty) / c.total) * 100).toFixed(2) : "0.00";
                              const isLow = parseFloat(ahPct) < 75;
                              return (
                                <tr key={idx} className={isLow ? "att-row-low" : ""}>
                                  <td>{idx + 1}</td>
                                  <td>
                                    <span className="att-td-name">{c.subject}</span>
                                    {c.course && <span className="att-td-sub"> ({c.course})</span>}
                                  </td>
                                  <td className="center">{c.total}</td>
                                  <td className="center">{c.present}</td>
                                  <td className="center">{c.duty}</td>
                                  <td className="center">{c.present + c.duty}</td>
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