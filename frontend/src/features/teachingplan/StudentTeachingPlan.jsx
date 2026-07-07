// Frontend/src/features/teachingplan/StudentTeachingPlan.jsx
import React, { useEffect, useState } from "react";
import API from "../../api";
import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";
import "../../styles/TeachingPlans.css";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmt = (iso) => {
  const [, m, d] = (iso || "").split("-").map(Number);
  return m ? `${MON[m - 1]} ${d}` : iso;
};

// ================= HELPERS =================
function Tile({ label, value }) {
  return (
    <div className="tp-stat">
      <div className="tp-stat-label">{label}</div>
      <div className="tp-stat-value">{value}</div>
    </div>
  );
}

// ================= MAIN COMPONENT =================
export default function StudentTeachingPlan() {
  const [open, setOpen] = useState(false);
  const [plans, setPlans] = useState([]);   // approved plans for the student's class
  const [loaded, setLoaded] = useState(false);
  const [sel, setSel] = useState(null);      // which plan is opened
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    API.get("teaching-plans/student/")
      .then((res) => setPlans(Array.isArray(res.data) ? res.data : []))
      .catch(() => setPlans([]))
      .finally(() => setLoaded(true));
  }, []);

  const openPlan = (p) => { setSel(p); setShowAll(false); window.scrollTo(0, 0); };
  const back = () => setSel(null);

  // ================= DETAIL VIEW (one approved plan) =================
  if (sel) {
    const units = sel.units || [];
    const shown = showAll ? units : units.slice(0, 6);
    const totalHours = sel.allotted || units.reduce((a, u) => a + (Number(u.hours) || 0), 0);

    return (
      <div className="app">
        <Navbar setOpen={setOpen} />
        <div className="layout">
          <Sidebar open={open} setOpen={setOpen} />
          <div className="main">
            <div className="content tp-pad-bottom">
              <div className="tp-card tp-w820">

                <div className="tp-review-back-wrap">
                  <button className="tp-back-btn" onClick={back}>← Back to my subjects</button>
                </div>

                <div className="tp-plan-head">
                  <div className="tp-avatar tp-avatar--md tp-tint--blue">
                    {(sel.subject || "?").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="tp-review-head-info">
                    <div className="tp-plan-subject">{sel.subject}{sel.code ? ` – ${sel.code}` : ""}</div>
                    <div className="tp-plan-meta">Taught by {sel.teacher} · {sel.cls}</div>
                  </div>
                  <span className="tp-badge tp-tint--green">✓ Published</span>
                </div>

                <div className="tp-stats">
                  <Tile label="Total topics" value={`${units.length}`} />
                  <Tile label="Total hours" value={`${totalHours}`} />
                </div>

                <div className="tp-units">
                  <div className="tp-section-title">What you'll learn this semester</div>
                  <div className="tp-units-list">
                    {shown.map((u, i) => (
                      <div className="tp-unit" key={i}>
                        <div className="tp-unit-idx">{i + 1}</div>
                        <div className="tp-unit-topic">{u.topic}</div>
                        <div className="tp-unit-meta">{u.due ? fmt(u.due) : ""}</div>
                      </div>
                    ))}
                    {units.length > 6 && (
                      <div className="tp-units-toggle" onClick={() => setShowAll((v) => !v)}>
                        {showAll ? "Show fewer" : `Show all ${units.length} topics`}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ================= LIST VIEW (all approved subjects) =================
  return (
    <div className="app">
      <Navbar setOpen={setOpen} />
      <div className="layout">
        <Sidebar open={open} setOpen={setOpen} />
        <div className="main">
          <div className="content">

            <h1 className="tp-title">Teaching plans</h1>
            <p className="tp-subtitle">
              The approved plans your teachers have published for your class.
            </p>

            {!loaded ? (
              <div className="tp-loading">Loading…</div>
            ) : plans.length === 0 ? (
              <div className="tp-empty-box">
                <div className="tp-empty-icon">⏳</div>
                <div className="tp-empty-title">No plans published yet</div>
                <div className="tp-empty-text">
                  Your teachers' plans are still being reviewed. They'll appear here once the HOD approves them.
                </div>
              </div>
            ) : (
              <div className="tp-plan-list">
                {plans.map((p) => (
                  <div className="tp-plan-card" key={p.id} onClick={() => openPlan(p)}>
                    <div className="tp-avatar tp-tint--blue">
                      {(p.subject || "?").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="tp-plan-card-main">
                      <div className="tp-plan-card-title">{p.subject}{p.code ? ` – ${p.code}` : ""}</div>
                      <div className="tp-plan-card-meta">{p.teacher} · {(p.units || []).length} topics</div>
                    </div>
                    <span className="tp-badge tp-tint--green">✓ Published</span>
                    <button className="tp-btn-primary" onClick={(e) => { e.stopPropagation(); openPlan(p); }}>View</button>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}