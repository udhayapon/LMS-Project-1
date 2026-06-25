import { useState } from "react";
import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";
import IATeacher from "./IATeacher";
import IAStudent from "./IAStudent";
import IAAdmin from "./IAAdmin";
import IAParent from "./IAParent";
import SRAdmin from "./SRAdmin";
import SRStudent from "./SRStudent";
import SRParent from "./SRParent";
import HallTicketAdmin from "./HallTicketAdmin";
import HallTicketStudent from "./HallTicketStudent";
import RevaluationAdmin from "./RevaluationAdmin";
import RevaluationStudent from "./RevaluationStudent";
import "../../styles/Attendance.css";

export default function Results() {
  const [open, setOpen] = useState(false);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const role = user.role;

  // exam_admin gets the same exam controls as the full admin
  const isExamAdmin = role === "admin" || role === "exam_admin";

  const ALL_TABS = [
    { id: "ia", label: "Internal Assessment" },
    { id: "sr", label: "Semester Result" },
    { id: "ht", label: "Hall Ticket" },
    { id: "reval", label: "Revaluation" },
  ];

  // teacher only enters IA; parent sees IA + semester result; student + admin/exam_admin see all
  let TABS;
  if (role === "teacher") {
    TABS = ALL_TABS.filter((t) => t.id === "ia");
  } else if (role === "parent") {
    TABS = ALL_TABS.filter((t) => t.id === "ia" || t.id === "sr");
  } else {
    TABS = ALL_TABS;
  }

  const [tab, setTab] = useState(TABS[0].id);

  const renderTab = () => {
    // ===== Internal Assessment =====
    if (tab === "ia") {
      if (role === "teacher") return <IATeacher embedded />;
      if (role === "student") return <IAStudent embedded />;
      if (isExamAdmin)        return <IAAdmin embedded />;
      if (role === "parent")  return <IAParent embedded />;
    }

    // ===== Semester Result =====
    if (tab === "sr") {
      if (isExamAdmin)        return <SRAdmin embedded />;
      if (role === "student") return <SRStudent embedded />;
      if (role === "parent")  return <SRParent embedded />;
    }

    // ===== Hall Ticket =====
    if (tab === "ht") {
      if (isExamAdmin)        return <HallTicketAdmin embedded />;
      if (role === "student") return <HallTicketStudent embedded />;
    }

    // ===== Revaluation =====
    if (tab === "reval") {
      if (isExamAdmin)        return <RevaluationAdmin embedded />;
      if (role === "student") return <RevaluationStudent embedded />;
    }

    return (
      <div className="att-card">
        <div className="att-state">
          <p>This section is coming soon.</p>
        </div>
      </div>
    );
  };

  return (
    <div className="app">
      <Navbar setOpen={setOpen} />
      <div className="layout">
        <Sidebar open={open} setOpen={setOpen} />
        <div className="main">
          <div className="content">
            <div className="att-page">

              <div className="att-header">
                <div>
                  <h1 className="att-title">Results</h1>
                  <p className="att-subtitle">
                    Internal assessment, semester results, hall ticket and revaluation
                  </p>
                </div>
              </div>

              <div className="att-tabs">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    className={`att-tab${tab === t.id ? " active" : ""}`}
                    onClick={() => setTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {renderTab()}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}