import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";
import API from "../../api";
import "../../App.css";

const I = {
  users: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  student: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>,
  teacher: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h20v14H2z"/><path d="M8 21h8M12 17v4"/></svg>,
  book: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  link: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  users2: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  calendar: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
};

export default function Dashboard() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total_users: 0, total_students: 0, total_teachers: 0,
    total_parents: 0, total_courses: 0, total_enrollments: 0,
  });

  const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  };

  useEffect(() => {
    API.get("admin-dashboard/")
      .then((res) => setStats(res.data))
      .catch((err) => console.error("Dashboard error:", err))
      .finally(() => setLoading(false));
  }, []);

  const v = (n) => (loading ? "…" : n);

  const kpis = [
    { icon: "users", accent: "#0ea5e9", label: "Total users", value: v(stats.total_users),
      meta: `${stats.total_students} students · ${stats.total_teachers} teachers` },
    { icon: "student", accent: "#10b981", label: "Students", value: v(stats.total_students), to: "/students" },
    { icon: "teacher", accent: "#6366f1", label: "Teachers", value: v(stats.total_teachers), to: "/teachers" },
    { icon: "users2", accent: "#8b5cf6", label: "Parents", value: v(stats.total_parents), to: "/parents-admin" },
    { icon: "book", accent: "#f59e0b", label: "Courses", value: v(stats.total_courses), to: "/courses" },
  ];

  const actions = [
    { label: "Manage students", icon: "student", accent: "#10b981", to: "/students" },
    { label: "Manage teachers", icon: "teacher", accent: "#6366f1", to: "/teachers" },
    { label: "Manage parents", icon: "users2", accent: "#8b5cf6", to: "/parents-admin" },
    { label: "Enrollments", icon: "link", accent: "#0ea5e9", to: "/enrollments" },
    { label: "Timetable builder", icon: "calendar", accent: "#f59e0b", to: "/timetable-builder" },
  ];

  return (
    <div className="app">
      <Navbar setOpen={setOpen} />
      <div className="layout">
        <Sidebar open={open} setOpen={setOpen} />
        <div className="main">
          <div className="content">
            <div className="sd-root">

              <h1 className="sd-hello">{greeting()}, {user?.username || "Admin"}</h1>
              <p className="sd-sub">Your LMS at a glance.</p>

              {/* KPIs + Quick actions share one 4-col grid:
                  row 1 = 4 stat cards, row 2 = Courses + Quick actions (span 3) */}
              <div className="sd-kpis" style={{ alignItems: "start" }}>
                {kpis.map((k, i) => (
                  <div
                    className={`sd-card ${k.to ? "clickable" : ""}`}
                    key={i}
                    onClick={k.to ? () => navigate(k.to) : undefined}
                  >
                    <div className="sd-ch">
                      <div className="sd-tile" style={{ background: k.accent + "18", color: k.accent }}>{I[k.icon]}</div>
                    </div>
                    <div className="sd-label">{k.label}</div>
                    <div className="sd-val">{k.value}</div>
                    {k.meta && <div className="sd-meta">{k.meta}</div>}
                  </div>
                ))}

                {/* Quick actions — fills the empty space beside Courses */}
                <div className="sd-panel" style={{ gridColumn: "span 3", margin: 0 }}>
                  <div className="sd-pt">Quick actions</div>
                  <div className="sd-qa" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
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