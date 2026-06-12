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
  play: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
  folder: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
  calendar: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  chart: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  message: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
};

export default function TeacherHome() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState({
    subjects: 0, students: 0, assignments: 0, lectures: 0, quizzes: 0, materials: 0,
  });

  const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  };

  useEffect(() => {
    API.get("/teacher-dashboard/")
      .then((res) => setStats((s) => ({ ...s, ...res.data })))
      .catch((err) => console.log("Error fetching dashboard:", err));
  }, []);

  const kpis = [
    { icon: "book", accent: "#0ea5e9", label: "My subjects", value: stats.subjects, meta: "Teaching this term" },
    { icon: "users", accent: "#10b981", label: "My students", value: stats.students, meta: "Across all classes" },
    { icon: "file", accent: "#6366f1", label: "Assignments", value: stats.assignments, meta: "Created" },
    { icon: "quiz", accent: "#8b5cf6", label: "Quizzes", value: stats.quizzes, meta: "Created" },
  ];

  // "Published content" panel — bars scaled to the largest count
  const content = [
    { label: "Lectures", value: stats.lectures, accent: "#0ea5e9", icon: "play" },
    { label: "Study materials", value: stats.materials, accent: "#f59e0b", icon: "folder" },
    { label: "Assignments", value: stats.assignments, accent: "#6366f1", icon: "file" },
    { label: "Quizzes", value: stats.quizzes, accent: "#8b5cf6", icon: "quiz" },
  ];
  const maxC = Math.max(1, ...content.map((c) => c.value));

  const actions = [
    { label: "My subjects", icon: "book", accent: "#0ea5e9", to: "/courses" },
    { label: "Take attendance", icon: "calendar", accent: "#10b981", to: "/teacher/attendance" },
    { label: "Class progress", icon: "chart", accent: "#6366f1", to: "/teacher-progress" },
    { label: "Messages", icon: "message", accent: "#8b5cf6", to: "/teacher/messages" },
  ];

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

              <div className="sd-grid">
                {/* left: published content */}
                <div className="sd-panel">
                  <div className="sd-pt">Published content</div>
                  {content.map((c) => (
                    <div className="sd-prow" key={c.label}>
                      <div className="sd-ptop"><b>{c.label}</b><span className="sd-ppct sd-num">{c.value}</span></div>
                      <div className="sd-pbar"><span style={{ width: `${(c.value / maxC) * 100}%`, background: c.accent }} /></div>
                    </div>
                  ))}
                </div>

                {/* right: quick actions */}
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
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}