import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import API from "../api";
import "../styles/Notification.css";

// LMS notification types
const LMS_TYPES = {
  discussion: {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    color: "#3b82f6",
    bg: "#eff6ff",
  },
  assignment: {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    color: "#10b981",
    bg: "#f0fdf4",
  },
  quiz: {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    color: "#f59e0b",
    bg: "#fffbeb",
  },
  marks: {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    color: "#8b5cf6",
    bg: "#f5f3ff",
  },
  announcement: {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
      </svg>
    ),
    color: "#ef4444",
    bg: "#fff1f2",
  },
  default: {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
    color: "#6b7280",
    bg: "#f3f4f6",
  },
};

function getType(type = "") {
  const t = type.toLowerCase();
  if (t.includes("discussion") || t.includes("message")) return "discussion";
  if (t.includes("assignment") || t.includes("upload")) return "assignment";
  if (t.includes("quiz")) return "quiz";
  if (t.includes("grade") || t.includes("mark"))return "marks";
  if (t.includes("announce")) return "announcement";
  return "default";
}

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const TABS = [
  "All",
  "Assignment",
  "Quiz",
  "Lecture",
  "Material",
  "Discussion",
  "Marks"
];

export default function Notifications() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("All");
  const [sortOrder, setSortOrder] = useState("Recent");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    try {
      const res = await API.get("/notifications/");
      setNotifications(res.data?.results || res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (id) => {
    try {
      await API.post(`/notifications/${id}/mark_read/`);
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const markAllRead = async () => {
    try {
      await API.post("/notifications/mark_all_read/");
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const filtered = notifications
    .filter((n) => {
      if (activeTab === "All") return true;
      return (n.notification_type || "").toLowerCase().includes(activeTab.toLowerCase());
    })
    .sort((a, b) =>
      sortOrder === "Recent"
        ? new Date(b.created_at) - new Date(a.created_at)
        : new Date(a.created_at) - new Date(b.created_at)
    );

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleNotificationClick = async (notification) => {
  try {
    if (!notification.is_read) {
      await API.post(
        `/notifications/${notification.id}/mark_read/`
      );
    }

    const user = JSON.parse(
      localStorage.getItem("user")
    );

    const role = user?.role?.toLowerCase();

    // Marks page
    if (
      notification.notification_type === "marks"
    ) {
      navigate("/student/grades");
      return;
    }

    // Subject page
    if (notification.teaching_assignment) {
      if (role === "teacher") {
        navigate(
          `/teacher/subject/${notification.teaching_assignment}`
        );
      } else {
        navigate(
          `/student/subject/${notification.teaching_assignment}`
        );
      }
    }

  } catch (err) {
    console.error(err);
  }
};
  return (
    <div className="app">
      <Navbar setOpen={setOpen} />
      <div className="layout">
        <Sidebar open={open} setOpen={setOpen} />

        <div className="main">
          <div className="content">
            <div className="notif-page">

              {/* ── Controls ── */}
              <div className="notif-controls">

                <div className="notif-tabs">
                  {TABS.map((tab) => (
                    <button
                      key={tab}
                      className={`notif-tab${activeTab === tab ? " active" : ""}`}
                      onClick={() => setActiveTab(tab)}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <div className="notif-actions-row">
                  {unreadCount > 0 && (
                    <button className="notif-mark-all-btn" onClick={markAllRead}>
                      Mark All Read
                    </button>
                  )}

                  <div className="notif-sort-wrapper">
                    <button
                      className="notif-sort-btn"
                      onClick={() => setShowSortMenu((p) => !p)}
                    >
                      {sortOrder}
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                    {showSortMenu && (
                      <div className="notif-sort-menu">
                        {["Recent", "Oldest"].map((opt) => (
                          <button
                            key={opt}
                            className={`notif-sort-option${sortOrder === opt ? " selected" : ""}`}
                            onClick={() => { setSortOrder(opt); setShowSortMenu(false); }}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button className="notif-filter-btn">
                    Filter
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13">
                      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* ── List ── */}
              <div className="notif-list">
                {loading ? (
                  <div className="notif-state">
                    <div className="notif-spinner" />
                    <p>Loading notifications…</p>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="notif-state">
                    <div className="notif-state-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="44" height="44">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                      </svg>
                    </div>
                    <h3>No Notifications</h3>
                    <p>You're all caught up.</p>
                  </div>
                ) : (
                  filtered.map((n) => {
                    const tk = getType(n.notification_type);
                    const { icon, color, bg } = LMS_TYPES[tk];
                    return (
                      <div
                        key={n.id}
                        className={`notif-item${n.is_read ? " read" : " unread"}`}
                        onClick={() => handleNotificationClick(n)}
                      >
                        <div
                          className="notif-icon"
                          style={{ background: bg, color }}
                        >
                          {icon}
                        </div>

                        <div className="notif-body">
                          <h4 className="notif-title">{n.title}</h4>
                          <p className="notif-message">{n.message}</p>
                        </div>

                        <div className="notif-meta">
                          <span className="notif-time">{timeAgo(n.created_at)}</span>
                          {!n.is_read && <span className="notif-dot" />}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}