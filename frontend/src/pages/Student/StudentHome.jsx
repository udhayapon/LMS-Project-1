import { useEffect, useState } from "react";
import API from "../../api";
import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";
import "../../App.css";

const I = {
  book: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  file: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  quiz: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  bell: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
};

// attendance health color: green ≥75, amber 60–74, red below
const attColor = (p) => (p >= 75 ? "#10b981" : p >= 60 ? "#f59e0b" : "#ef4444");

// SVG donut ring (no library). Shows pct in the center.
function Ring({ pct, size = 116, stroke = 11 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(pct, 100) / 100) * circ;
  const color = attColor(pct);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef0f4" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
        style={{ fontSize: size * 0.26, fontWeight: 700, fill: "#0f172a", fontVariantNumeric: "tabular-nums" }}>
        {pct}%
      </text>
    </svg>
  );
}

export default function StudentHome() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [open, setOpen] = useState(false);

  const [courses, setCourses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [lectures, setLectures] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [quizAttempts, setQuizAttempts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [attendance, setAttendance] = useState([]);   // per-subject: {subject, pct, present, total}
  const [attLoaded, setAttLoaded] = useState(false);

  useEffect(() => { loadData(); loadAttendance(); }, []);

  const loadData = async () => {
    try {
      const [enrollRes, assignRes, lectureRes, quizRes, submissionRes, attemptRes, notificationRes] =
        await Promise.all([
          API.get("/enrollments/"),
          API.get("/assignments/"),
          API.get("/lectures/"),
          API.get("/quizzes/"),
          API.get("/submissions/"),
          API.get("/quiz-attempts/"),
          API.get("/notifications/?unread=true"),
        ]);

      const pick = (r) => r.data?.results || r.data || [];
      const enrollments = pick(enrollRes);
      const allAssignments = pick(assignRes);
      const allLectures = pick(lectureRes);
      const allQuizzes = pick(quizRes);
      const allSubmissions = pick(submissionRes);
      const allAttempts = pick(attemptRes);

      const myEnrollments = enrollments.filter((e) => (e.student?.id || e.student) === user.id);
      setCourses(myEnrollments);

      const teachingIds = myEnrollments.map((e) => e.teaching_assignment?.id || e.teaching_assignment);
      const inMine = (x) => teachingIds.includes(x.teaching_assignment?.id || x.teaching_assignment);

      setAssignments(allAssignments.filter(inMine));
      setLectures(allLectures.filter(inMine));
      setQuizzes(allQuizzes.filter(inMine));
      setSubmissions(allSubmissions.filter((s) => (s.student?.id || s.student) === user.id));
      setQuizAttempts(allAttempts.filter((a) => (a.student?.id || a.student) === user.id));
      setNotifications(pick(notificationRes));
    } catch (err) {
      console.log("Student dashboard error:", err);
    }
  };

  // ── Attendance: semester dates → records in range → group by subject ──
  const loadAttendance = async () => {
    try {
      // 1) semester range (same source as the timetable builder)
      const semRes = await API.get("/semester/");
      const sem = (semRes.data || [])[0];
      if (!sem || !sem.start_date || !sem.end_date) {
        setAttLoaded(true);   // no dates set → panel shows a quiet message
        return;
      }

      // 2) my attendance for that range
      const res = await API.get(
        `/attendance/?from_date=${sem.start_date}&to_date=${sem.end_date}`
      );
      const data = res.data?.results || res.data || [];

      // 3) group by teaching assignment, tally present/total (same as course-wise report)
      const map = {};
      data.forEach((a) => {
        const key = a.teaching_assignment;
        if (!map[key]) map[key] = { subject: a.subject_name || "Subject", present: 0, total: 0 };
        map[key].total++;
        if (a.status === "present" || a.status === "duty_leave") map[key].present++;
      });

      const rows = Object.values(map)
        .map((s) => ({ ...s, pct: s.total ? Math.round((s.present / s.total) * 100) : 0 }))
        .sort((a, b) => a.pct - b.pct);   // lowest attendance first — most actionable

      setAttendance(rows);
      setAttLoaded(true);
    } catch (err) {
      console.log("Attendance load error:", err);
      setAttLoaded(true);
    }
  };

  const pendingAssignments = Math.max(assignments.length - submissions.length, 0);
  const pendingQuizzes = Math.max(quizzes.length - quizAttempts.length, 0);
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "");

  // overall attendance across all subjects
  const attTotals = attendance.reduce(
    (acc, s) => ({ present: acc.present + s.present, total: acc.total + s.total }),
    { present: 0, total: 0 }
  );
  const overallAtt = attTotals.total ? Math.round((attTotals.present / attTotals.total) * 100) : 0;

  // Real activity timeline: merge submissions + quiz attempts, newest first
  const feed = [
    ...submissions.map((s) => ({
      icon: "file", tint: "#6366f1", t: s.submitted_at,
      title: "Submitted an assignment", sub: s.assignment_title || s.subject_name || "Assignment",
    })),
    ...quizAttempts.map((q) => ({
      icon: "quiz", tint: "#8b5cf6", t: q.submitted_at,
      title: "Completed a quiz", sub: `${q.quiz_title || "Quiz"} · scored ${q.score}`,
    })),
  ].sort((a, b) => new Date(b.t) - new Date(a.t)).slice(0, 6);

  const kpis = [
    { icon: "book", accent: "#0ea5e9", label: "Enrolled courses", value: courses.length, meta: "Active this semester" },
    { icon: "file", accent: "#6366f1", label: "Assignments", value: `${submissions.length}/${assignments.length}`,
      chip: pendingAssignments > 0 ? `${pendingAssignments} pending` : "all submitted",
      chipTone: pendingAssignments > 0 ? "warn" : "ok", meter: pct(submissions.length, assignments.length), m: "#6366f1" },
    { icon: "quiz", accent: "#8b5cf6", label: "Quizzes", value: `${quizAttempts.length}/${quizzes.length}`,
      chip: pendingQuizzes > 0 ? `${pendingQuizzes} pending` : "all done",
      chipTone: pendingQuizzes > 0 ? "warn" : "ok", meter: pct(quizAttempts.length, quizzes.length), m: "#8b5cf6" },
    { icon: "bell", accent: "#f59e0b", label: "Notifications", value: notifications.length,
      chip: notifications.length > 0 ? "unread" : "caught up", chipTone: notifications.length > 0 ? "warn" : "ok" },
  ];

  return (
    <div className="app">
      <Navbar setOpen={setOpen} />
      <div className="layout">
        <Sidebar open={open} setOpen={setOpen} />
        <div className="main">
          <div className="content">
            <div className="sd-root">

              <h1 className="sd-hello">Welcome back, {user?.username || "Student"}</h1>
              <p className="sd-sub">Here's where things stand today.</p>

              <div className="sd-kpis">
                {kpis.map((k, i) => (
                  <div className="sd-card" key={i}>
                    <div className="sd-ch">
                      <div className="sd-tile" style={{ background: k.accent + "18", color: k.accent }}>{I[k.icon]}</div>
                      {k.chip && <span className={`sd-chip ${k.chipTone}`}>{k.chip}</span>}
                    </div>
                    <div className="sd-label">{k.label}</div>
                    <div className="sd-val">{k.value}</div>
                    {k.meta && <div className="sd-meta">{k.meta}</div>}
                    {k.meter !== undefined && (
                      <div className="sd-meter"><span style={{ width: `${k.meter}%`, background: k.m }} /></div>
                    )}
                  </div>
                ))}
              </div>

              <div className="sd-grid">
                {/* LEFT: attendance (donut) + activity */}
                <div className="sd-stack">

                  {/* attendance — overall ring + per-subject rings */}
                  <div className="sd-panel">
                    <div className="sd-pt">Attendance</div>
                    {!attLoaded ? (
                      <div className="sd-empty">Loading attendance…</div>
                    ) : attendance.length === 0 ? (
                      <div className="sd-empty">No attendance recorded yet this semester.</div>
                    ) : (
                      <div style={{ display: "flex", gap: 22, alignItems: "center", flexWrap: "wrap" }}>
                        {/* overall ring */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                          <Ring pct={overallAtt} size={124} stroke={12} />
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: "#667085" }}>Overall</div>
                          <div style={{ fontSize: 11.5, color: "#98a2b3" }}>
                            {attTotals.present}/{attTotals.total} hours present
                          </div>
                        </div>

                        {/* per-subject mini rings — 2 per row */}
                        <div style={{ flex: 1, minWidth: 240, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", columnGap: 18, rowGap: 16 }}>
                          {attendance.map((s, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <Ring pct={s.pct} size={46} stroke={6} />
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 13.5, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {s.subject}
                                </div>
                                <div style={{ fontSize: 12, color: "#98a2b3" }}>
                                  {s.present}/{s.total} present
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* recent activity */}
                  <div className="sd-panel">
                    <div className="sd-pt">Recent activity</div>
                    {feed.length === 0 ? (
                      <div className="sd-empty">Nothing yet. Submit an assignment or take a quiz to get started.</div>
                    ) : (
                      feed.map((a, i) => (
                        <div className="sd-frow" key={i}>
                          <div className="sd-node" style={{ background: a.tint + "18", color: a.tint }}>{I[a.icon]}</div>
                          <div className="sd-fmain">
                            <div className="sd-ftitle">{a.title}</div>
                            <div className="sd-fsub">{a.sub}</div>
                          </div>
                          <div className="sd-ftime">{fmt(a.t)}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* RIGHT: progress + notifications */}
                <div className="sd-stack">
                  <div className="sd-panel">
                    <div className="sd-pt">Your progress</div>
                    <div className="sd-prow">
                      <div className="sd-ptop"><b>Assignments</b><span className="sd-ppct">{pct(submissions.length, assignments.length)}%</span></div>
                      <div className="sd-pbar"><span style={{ width: `${pct(submissions.length, assignments.length)}%`, background: "#6366f1" }} /></div>
                    </div>
                    <div className="sd-prow">
                      <div className="sd-ptop"><b>Quizzes</b><span className="sd-ppct">{pct(quizAttempts.length, quizzes.length)}%</span></div>
                      <div className="sd-pbar"><span style={{ width: `${pct(quizAttempts.length, quizzes.length)}%`, background: "#8b5cf6" }} /></div>
                    </div>
                    <div className="sd-prow">
                      <div className="sd-ptop"><b>Lectures available</b><span className="sd-ppct sd-num">{lectures.length}</span></div>
                    </div>
                  </div>

                  <div className="sd-panel">
                    <div className="sd-pt">Recent notifications</div>
                    {notifications.length === 0 ? (
                      <div className="sd-empty">You're all caught up.</div>
                    ) : (
                      notifications.slice(0, 5).map((n) => (
                        <div className="sd-nrow" key={n.id}>
                          <div className="sd-ndot" />
                          <div>
                            <div className="sd-ntitle">{n.title}</div>
                            <div className="sd-ntime">{n.created_at ? new Date(n.created_at).toLocaleString() : ""}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}