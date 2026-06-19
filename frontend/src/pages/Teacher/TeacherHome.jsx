import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../api";
import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";
import "../../App.css";

const I = {
  book: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  users: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  file: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  quiz: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  calendar: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  chart: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  message: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
};

// pull an id out of a field that might be a bare id or a nested object
const idOf = (v) => (v && typeof v === "object" ? v.id : v);

export default function TeacherHome() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState({
    subjects: 0, students: 0, assignments: 0, lectures: 0, quizzes: 0, materials: 0,
  });
  const [rows, setRows] = useState([]);     // [{ id, title, subject, submitted, total }]
  const [quizRows, setQuizRows] = useState([]); // [{ id, title, subject, done, total }]
  const [loaded, setLoaded] = useState(false);

  const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  };

  useEffect(() => {
    API.get("/teacher-dashboard/")
      .then((res) => setStats((s) => ({ ...s, ...res.data })))
      .catch((err) => console.log("Error fetching dashboard:", err));

    loadSubmissionProgress();
  }, []);

  const loadSubmissionProgress = async () => {
    try {
      const [aRes, sRes, eRes, qRes, qaRes] = await Promise.all([
        API.get("/assignments/"),
        API.get("/submissions/"),
        API.get("/enrollments/"),
        API.get("/quizzes/"),
        API.get("/quiz-attempts/"),
      ]);
      const pick = (r) => r.data?.results || r.data || [];
      const assignments = pick(aRes);
      const submissions = pick(sRes);
      const enrollments = pick(eRes);
      const quizzes = pick(qRes);
      const attempts = pick(qaRes);

      // class size per teaching_assignment (count of enrolled students)
      const classSize = {};
      enrollments.forEach((e) => {
        const taId = idOf(e.teaching_assignment);
        if (taId != null) classSize[taId] = (classSize[taId] || 0) + 1;
      });

      // submissions count per assignment id
      const subCount = {};
      submissions.forEach((s) => {
        const aId = idOf(s.assignment);
        if (aId != null) subCount[aId] = (subCount[aId] || 0) + 1;
      });

      const subjectOf = (x) =>
        x.subject_name ||
        x.teaching_assignment?.subject?.name ||
        x.teaching_assignment?.subject_name ||
        x.course_name ||
        "";

      const built = assignments.map((a) => {
        const taId = idOf(a.teaching_assignment);
        const total = classSize[taId] || 0;
        const submitted = subCount[a.id] || 0;
        return { id: a.id, title: a.title || a.name || "Assignment", subject: subjectOf(a), submitted, total };
      });
      built.sort((x, y) => (y.total - y.submitted) - (x.total - x.submitted));
      setRows(built);

      // quiz attempts count per quiz id
      const attCount = {};
      attempts.forEach((qa) => {
        const qId = idOf(qa.quiz);
        if (qId != null) attCount[qId] = (attCount[qId] || 0) + 1;
      });

      const builtQuizzes = quizzes.map((q) => {
        const taId = idOf(q.teaching_assignment);
        const total = classSize[taId] || 0;
        const done = attCount[q.id] || 0;
        return { id: q.id, title: q.title || q.name || "Quiz", subject: subjectOf(q), done, total };
      });
      builtQuizzes.sort((x, y) => (y.total - y.done) - (x.total - x.done));
      setQuizRows(builtQuizzes);

      setLoaded(true);
    } catch (err) {
      console.log("Submission progress error:", err);
      setLoaded(true);
    }
  };

  const kpis = [
    { icon: "book", accent: "#0ea5e9", label: "My subjects", value: stats.subjects, meta: "Teaching this term" },
    { icon: "users", accent: "#10b981", label: "My students", value: stats.students, meta: "Across all classes" },
    { icon: "file", accent: "#6366f1", label: "Assignments", value: stats.assignments, meta: "Created" },
    { icon: "quiz", accent: "#8b5cf6", label: "Quizzes", value: stats.quizzes, meta: "Created" },
  ];

  const actions = [
    { label: "My subjects", icon: "book", accent: "#0ea5e9", to: "/courses" },
    { label: "Take attendance", icon: "calendar", accent: "#10b981", to: "/teacher/attendance" },
    { label: "Class progress", icon: "chart", accent: "#6366f1", to: "/teacher-progress" },
    { label: "Messages", icon: "message", accent: "#8b5cf6", to: "/teacher/messages" },
  ];

  // only the ones still needing attention (someone hasn't submitted / attempted)
  const pendingRows = rows.filter((r) => r.total - r.submitted > 0);
  const pendingQuizRows = quizRows.filter((r) => r.total - r.done > 0);

  // while loading, keep the left column; after load, only if anything is pending
  const showSubs = !loaded || pendingRows.length > 0;
  const showQuizzes = !loaded || pendingQuizRows.length > 0;
  const leftHasContent = showSubs || showQuizzes;

  const QuickActions = () => (
    <div className="sd-panel">
      <div className="sd-pt">Quick actions</div>
      <div className="sd-qa">
        {actions.map((a) => (
          <button key={a.label} onClick={() => navigate(a.to)}>
            <div className="sd-tile" style={{ background: a.accent + "18", color: a.accent }}>{I[a.icon]}</div>
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="app">
      <Navbar setOpen={setOpen} />
      <div className="layout">
        <Sidebar open={open} setOpen={setOpen} />
        <div className="main">
          <div className="content">
            <div className="sd-root">

              <h1 className="sd-hello">{greeting()}, {user?.username || "Teacher"}</h1>
              <p className="sd-sub">Your subjects, students and activity at a glance.</p>

              <div className="sd-kpis">
                {kpis.map((k, i) => (
                  <div className="sd-card" key={i}>
                    <div className="sd-ch">
                      <div className="sd-tile" style={{ background: k.accent + "18", color: k.accent }}>{I[k.icon]}</div>
                    </div>
                    <div className="sd-label">{k.label}</div>
                    <div className="sd-val">{k.value}</div>
                    <div className="sd-meta">{k.meta}</div>
                  </div>
                ))}
              </div>

              {leftHasContent ? (
                <div className="sd-grid">
                  {/* left: submissions + quizzes (pending only) */}
                  <div className="sd-stack">

                    {showSubs && (
                      <div className="sd-panel">
                        <div className="sd-pt">Submissions by assignment</div>
                        {!loaded ? (
                          <div className="sd-empty">Loading submissions…</div>
                        ) : (
                          pendingRows.map((r) => {
                            const pct = r.total ? Math.round((r.submitted / r.total) * 100) : 0;
                            const pending = Math.max(r.total - r.submitted, 0);
                            const color = pct >= 80 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444";
                            return (
                              <div className="sd-prow" key={r.id}>
                                <div className="sd-ptop">
                                  <b>{r.title}</b>
                                  <span className="sd-ppct sd-num" style={{ color }}>{r.submitted}/{r.total}</span>
                                </div>
                                <div className="sd-pbar">
                                  <span style={{ width: `${pct}%`, background: color }} />
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontSize: 12, color: "#667085" }}>
                                  <span>{r.subject || "\u00A0"}</span>
                                  <span>{pending} not submitted</span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}

                    {showQuizzes && (
                      <div className="sd-panel">
                        <div className="sd-pt">Quizzes by completion</div>
                        {!loaded ? (
                          <div className="sd-empty">Loading quizzes…</div>
                        ) : (
                          pendingQuizRows.map((r) => {
                            const pct = r.total ? Math.round((r.done / r.total) * 100) : 0;
                            const pending = Math.max(r.total - r.done, 0);
                            const color = pct >= 80 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444";
                            return (
                              <div className="sd-prow" key={r.id}>
                                <div className="sd-ptop">
                                  <b>{r.title}</b>
                                  <span className="sd-ppct sd-num" style={{ color }}>{r.done}/{r.total}</span>
                                </div>
                                <div className="sd-pbar">
                                  <span style={{ width: `${pct}%`, background: color }} />
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontSize: 12, color: "#667085" }}>
                                  <span>{r.subject || "\u00A0"}</span>
                                  <span>{pending} not attempted</span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>

                  {/* right: quick actions */}
                  <QuickActions />
                </div>
              ) : (
                /* everything complete — no pending panels, actions go full width */
                <QuickActions />
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}