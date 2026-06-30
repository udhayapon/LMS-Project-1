import { useEffect, useState } from "react";

import API from "../../api";

// ---- Confirm these against your courses/urls.py ----
const COURSES_URL = "/courses/";
const YEARS_URL = "/years/";

const SEMESTERS = Array.from({ length: 8 }, (_, i) => i + 1);

const DAYS = [
  { value: 0, label: "Mon" },
  { value: 1, label: "Tue" },
  { value: 2, label: "Wed" },
  { value: 3, label: "Thu" },
  { value: 4, label: "Fri" },
  { value: 5, label: "Sat" },
];

const fmt = (t) => {
  if (!t) return "";
  const [h, m] = String(t).split(":");
  let hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${m} ${ampm}`;
};

// status badge colours
const STATUS_STYLE = {
  draft:     { bg: "#f1f5f9", fg: "#475569", bd: "#e2e8f0", label: "Draft" },
  submitted: { bg: "#fff7ed", fg: "#b45309", bd: "#fed7aa", label: "Submitted — awaiting admin" },
  approved:  { bg: "#ecfdf5", fg: "#15803d", bd: "#bbf7d0", label: "Approved" },
  rejected:  { bg: "#fef2f2", fg: "#dc2626", bd: "#fecaca", label: "Rejected" },
};

/**
 * GridPanel
 * - Admin: <GridPanel /> (no courseFilter) -> all courses, no submit UI.
 * - HOD:   <GridPanel courseFilter={[1,2]} /> -> courses limited, Submit + status shown.
 */
export default function GridPanel({ goToPeriods, courseFilter = null }) {
  const isHodMode = !!(courseFilter && courseFilter.length);

  const [courses, setCourses] = useState([]);
  const [years, setYears] = useState([]);
  const [slots, setSlots] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [entries, setEntries] = useState([]);

  const [sel, setSel] = useState({ course: "", year: "", semester: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");

  // approval status for the chosen class
  const [approval, setApproval] = useState(null); // { status, remark }

  const showToast = (msg) => {
    setToast(msg);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(""), 2000);
  };

  const classReady = sel.year && sel.semester;

  // a submitted class is locked from editing
  const locked = isHodMode && approval?.status === "submitted";

  // courses + periods once
  useEffect(() => {
    API.get(COURSES_URL).then((r) => setCourses(r.data || [])).catch(() => {});
    API.get("/timeslots/").then((r) => setSlots(r.data || [])).catch(() => {});
  }, []);

  // limit the course list when a filter is supplied (HOD)
  const visibleCourses =
    courseFilter && courseFilter.length
      ? courses.filter((c) => courseFilter.map(String).includes(String(c.id)))
      : courses;

  // if the filter leaves exactly one course, preselect it
  useEffect(() => {
    if (
      courseFilter &&
      courseFilter.length &&
      visibleCourses.length === 1 &&
      !sel.course
    ) {
      setSel((s) => ({ ...s, course: String(visibleCourses[0].id) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courses, courseFilter]);

  // years when course changes
  useEffect(() => {
    setYears([]);
    setSel((s) => ({ ...s, year: "" }));
    if (!sel.course) return;
    API.get(`${YEARS_URL}?course=${sel.course}`)
      .then((r) => setYears(r.data || []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel.course]);

  // entries + assignments + status when class fully chosen
  useEffect(() => {
    if (!classReady) {
      setApproval(null);
      return;
    }
    loadClass();
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel.year, sel.semester]);

  const loadClass = async () => {
    setLoading(true);
    setError("");
    const q = `year=${sel.year}&semester=${sel.semester}`;
    try {
      const [e, a] = await Promise.all([
        API.get(`/timetable/?${q}`),
        API.get(`/timetable/options/?${q}`),
      ]);
      setEntries(e.data || []);
      setAssignments(a.data || []);
    } catch (err) {
      console.error("Load class error:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadStatus = async () => {
    if (!isHodMode) return;
    try {
      const r = await API.get(
        `/timetable/approval-status/?year=${sel.year}&semester=${sel.semester}`
      );
      setApproval(r.data || null);
    } catch {
      setApproval(null);
    }
  };

  const lookup = {};
  entries.forEach((e) => {
    lookup[`${e.day_of_week}_${e.time_slot}`] = e;
  });

  const place = async (day, slotId, assignmentId) => {
    if (!assignmentId) return;
    setError("");
    try {
      await API.post("/timetable/", {
        assignment: assignmentId,
        day_of_week: day,
        time_slot: slotId,
      });
      await loadClass();
      await loadStatus();   // an approved class drops to draft after an edit
      showToast("✓ Saved");
    } catch (err) {
      const data = err?.response?.data;
      const msg =
        (Array.isArray(data) ? data[0] : data?.detail) ||
        data?.non_field_errors?.[0] ||
        "Could not add — there may be a clash.";
      setError(msg);
    }
  };

  const remove = async (id) => {
    setError("");
    try {
      await API.delete(`/timetable/${id}/`);
      setEntries((list) => list.filter((x) => x.id !== id));
      await loadStatus();
      showToast("✓ Removed");
    } catch (err) {
      const msg = err?.response?.data?.detail || "Could not remove — please try again.";
      setError(msg);
    }
  };

  const submitForApproval = async () => {
    setError("");
    try {
      await API.post("/timetable/submit/", {
        year: sel.year,
        semester: sel.semester,
      });
      await loadStatus();
      showToast("✓ Submitted for approval");
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not submit.");
    }
  };

  const noPeriods = slots.length === 0;
  const st = approval ? STATUS_STYLE[approval.status] || STATUS_STYLE.draft : null;
  const canSubmit =
    isHodMode &&
    classReady &&
    entries.length > 0 &&
    (!approval || approval.status === "draft" || approval.status === "rejected");

  return (
    <div style={{ position: "relative" }}>
      {/* success toast — centered top */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            background: "#15803d",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            padding: "11px 22px",
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(0,0,0,.22)",
          }}
        >
          {toast}
        </div>
      )}

      {/* class selectors */}
      <div className="tb-controls">
        <select value={sel.course} onChange={(e) => setSel({ ...sel, course: e.target.value })}>
          <option value="">Department / Course</option>
          {visibleCourses.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          value={sel.year}
          onChange={(e) => setSel({ ...sel, year: e.target.value })}
          disabled={!sel.course}
        >
          <option value="">Year</option>
          {years.map((y) => (
            <option key={y.id} value={y.id}>Year {y.year_number}</option>
          ))}
        </select>

        <select value={sel.semester} onChange={(e) => setSel({ ...sel, semester: e.target.value })}>
          <option value="">Semester</option>
          {SEMESTERS.map((n) => (
            <option key={n} value={n}>Semester {n}</option>
          ))}
        </select>
      </div>

      {/* approval status bar (HOD only) */}
      {isHodMode && classReady && st && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            margin: "14px 0",
            padding: "12px 14px",
            background: st.bg,
            border: `1px solid ${st.bd}`,
            borderRadius: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: st.fg }}>{st.label}</span>
            {approval.status === "rejected" && approval.remark && (
              <span style={{ fontSize: 12.5, color: "#dc2626" }}>
                — Admin: {approval.remark}
              </span>
            )}
          </div>

          {canSubmit && (
            <button
              onClick={submitForApproval}
              style={{
                background: "#1d4ed8",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Submit for approval
            </button>
          )}
        </div>
      )}

      {error && <div className="tb-error">{error}</div>}

      {noPeriods ? (
        <div className="tb-empty">
          No periods set up yet.{" "}
          {goToPeriods ? (
            <button className="tb-link" onClick={goToPeriods}>Set up periods first →</button>
          ) : (
            <span>Ask the admin to set up the daily periods first.</span>
          )}
        </div>
      ) : !classReady ? (
        <div className="tb-empty">Select a department, year and semester to begin.</div>
      ) : loading ? (
        <div className="tb-empty">Loading…</div>
      ) : (
        <>
          {locked && (
            <div
              style={{
                fontSize: 12.5,
                color: "#b45309",
                marginBottom: 10,
              }}
            >
              This timetable is submitted and locked. The admin must approve or reject it before you can edit again.
            </div>
          )}
          <div className="tb-wrap">
            <table className="tb-grid">
              <thead>
                <tr>
                  <th className="tb-corner">Period</th>
                  {DAYS.map((d) => <th key={d.value}>{d.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {slots.map((slot) =>
                  slot.is_break ? (
                    <tr key={slot.id} className="tb-brkrow">
                      <td className="tb-per">
                        {slot.label || "Break"}<span>{fmt(slot.start_time)}–{fmt(slot.end_time)}</span>
                      </td>
                      <td colSpan={DAYS.length}>{slot.label || "Break"}</td>
                    </tr>
                  ) : (
                    <tr key={slot.id}>
                      <td className="tb-per">
                        P{slot.period_no}<span>{fmt(slot.start_time)}–{fmt(slot.end_time)}</span>
                      </td>
                      {DAYS.map((d) => {
                        const e = lookup[`${d.value}_${slot.id}`];
                        return (
                          <td key={d.value} className="tb-cell">
                            {e ? (
                              <div className="tb-blk">
                                {!locked && (
                                  <button className="tb-x" title="Remove" onClick={() => remove(e.id)}>×</button>
                                )}
                                <strong>{e.subject}</strong>
                                <small>{e.teacher_name}</small>
                              </div>
                            ) : locked ? (
                              <span className="tb-free">—</span>
                            ) : (
                              <select
                                className="tb-pick"
                                value=""
                                onChange={(ev) => place(d.value, slot.id, ev.target.value)}
                              >
                                <option value="">+</option>
                                {assignments.map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {a.subject} · {a.teacher_name}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}