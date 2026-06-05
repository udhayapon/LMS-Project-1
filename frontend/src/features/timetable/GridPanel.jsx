import { useEffect, useState } from "react";

import API from "../../api";

// ---- Confirm these against your courses/urls.py ----
// COURSES_URL should return: [{ id, name }]
// YEARS_URL called as `${YEARS_URL}?course=<id>` should return: [{ id, year_number }]
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

export default function GridPanel({ goToPeriods }) {
  const [courses, setCourses] = useState([]);
  const [years, setYears] = useState([]);
  const [slots, setSlots] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [entries, setEntries] = useState([]);

  const [sel, setSel] = useState({ course: "", year: "", semester: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const classReady = sel.year && sel.semester;

  // courses + periods once
  useEffect(() => {
    API.get(COURSES_URL).then((r) => setCourses(r.data || [])).catch(() => {});
    API.get("/timeslots/").then((r) => setSlots(r.data || [])).catch(() => {});
  }, []);

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

  // entries + assignments when class fully chosen
  useEffect(() => {
    if (!classReady) return;
    loadClass();
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
      loadClass();
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
    try {
      await API.delete(`/timetable/${id}/`);
      setEntries((list) => list.filter((x) => x.id !== id));
    } catch (err) {
      console.error("Remove error:", err);
    }
  };

  const noPeriods = slots.length === 0;

  return (
    <div>
      {/* class selectors */}
      <div className="tb-controls">
        <select value={sel.course} onChange={(e) => setSel({ ...sel, course: e.target.value })}>
          <option value="">Department / Course</option>
          {courses.map((c) => (
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

      {error && <div className="tb-error">{error}</div>}

      {noPeriods ? (
        <div className="tb-empty">
          No periods set up yet.{" "}
          <button className="tb-link" onClick={goToPeriods}>Set up periods first →</button>
        </div>
      ) : !classReady ? (
        <div className="tb-empty">Select a department, year and semester to begin.</div>
      ) : loading ? (
        <div className="tb-empty">Loading…</div>
      ) : (
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
                              <button className="tb-x" title="Remove" onClick={() => remove(e.id)}>×</button>
                              <strong>{e.subject}</strong>
                              <small>{e.teacher_name}</small>
                            </div>
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
      )}
    </div>
  );
}