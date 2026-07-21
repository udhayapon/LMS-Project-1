import { useEffect, useRef, useState } from "react";
import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";
import API from "../../api";
import "../../styles/Attendance.css";

// ── date helpers ──────────────────────────────────────────────────────────────
// Everything the user SEES is DD/MM/YYYY. Everything sent to the server is ISO
// (YYYY-MM-DD), which is what Django expects. The two never mix.
//
// NOTE: we do NOT use <input type="date">. That control is drawn by the browser
// using the machine's locale — on a US-locale machine it renders MM/DD/YYYY and
// no CSS or attribute can override it. Hence the custom input + calendar below.

const MONTHS = ["January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"];
const DOW = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

// "2026-06-09" -> "09/06/2026"
const toDisplay = (iso) => {
  if (!iso) return "";
  const [y, m, d] = String(iso).split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
};

// "09/06/2026" -> "2026-06-09"  ("" if the date isn't real)
const toISO = (display) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((display || "").trim());
  if (!m) return "";
  const [, dd, mm, yyyy] = m;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  // reject 31/02/2026 — JS would silently roll it over to 3 March
  if (d.getFullYear() !== Number(yyyy) ||
      d.getMonth() !== Number(mm) - 1 ||
      d.getDate() !== Number(dd)) return "";
  return `${yyyy}-${mm}-${dd}`;
};

// Date object -> "2026-06-09"
const dateToISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// COLLEGE POLICY: no exams on Saturday or Sunday.
// (The college does TEACH on Saturdays — the class timetable has Saturday periods —
// but exams are weekday-only. Two different rules; don't conflate them.)
const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6;
const weekendName = (d) => (d.getDay() === 0 ? "Sunday" : "Saturday");

// used by the read-only text elsewhere on the page
const fmt = (iso) => toDisplay(iso) || "—";

const CAL_HEIGHT = 340;   // roughly how tall the popup is, for the flip-up check

// ── calendar popup ────────────────────────────────────────────────────────────
// Monday-first grid. Weekends are DISABLED and struck through — grey alone reads
// as "faint", not "unavailable", which is what confused people.
function Calendar({ value, onPick, onClose }) {
  const start = value ? new Date(value + "T00:00:00") : new Date();
  const [view, setView] = useState({ y: start.getFullYear(), m: start.getMonth() });

  const first = new Date(view.y, view.m, 1);
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  // JS getDay() is 0=Sun..6=Sat; shift so Monday is column 0
  const lead = (first.getDay() + 6) % 7;

  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(view.y, view.m, d));

  const move = (n) => {
    const m = view.m + n;
    if (m < 0) setView({ y: view.y - 1, m: 11 });
    else if (m > 11) setView({ y: view.y + 1, m: 0 });
    else setView({ y: view.y, m });
  };

  const todayISO = dateToISO(new Date());

  return (
    <div className="cal-pop" onClick={(e) => e.stopPropagation()}>
      <div className="cal-head">
        <button type="button" className="cal-nav" onClick={() => move(-1)} aria-label="Previous month">‹</button>
        <span className="cal-title">{MONTHS[view.m]} {view.y}</span>
        <button type="button" className="cal-nav" onClick={() => move(1)} aria-label="Next month">›</button>
      </div>

      <div className="cal-grid cal-dow">
        {DOW.map((d, i) => (
          <span key={d} className={i >= 5 ? "is-wk" : ""}>{d}</span>
        ))}
      </div>

      <div className="cal-grid">
        {cells.map((d, i) => {
          if (!d) return <span key={`x${i}`} className="cal-blank" />;
          const iso = dateToISO(d);
          const off = isWeekend(d);
          const cls = [
            "cal-day",
            iso === value ? "is-sel" : "",
            iso === todayISO ? "is-today" : "",
            off ? "is-off" : "",
          ].filter(Boolean).join(" ");
          return (
            <button
              key={iso}
              type="button"
              className={cls}
              disabled={off}                                   // grey means grey
              title={off ? `${weekendName(d)} — no exams` : ""}
              onClick={() => { if (!off) { onPick(iso); onClose(); } }}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>

      <div className="cal-foot">
        <span className="cal-key">Weekends unavailable</span>
        <button type="button" className="cal-clear" onClick={() => { onPick(""); onClose(); }}>Clear</button>
      </div>
    </div>
  );
}

// ── DD/MM/YYYY field: the input and the calendar icon share ONE border ────────
// `status` is the row's state ("conflict" | "warn" | "ok" | "none") so the whole
// control carries the colour, rather than the input and the icon disagreeing.
function DateInput({ value, onChange, status }) {
  const [text, setText] = useState(toDisplay(value));
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const wrapRef = useRef(null);

  // keep in step when the parent changes the value (e.g. "Arrange Exams")
  useEffect(() => { setText(toDisplay(value)); }, [value]);

  // click anywhere else -> close the calendar
  useEffect(() => {
    if (!open) return;
    const away = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  // Rows near the bottom of the page have no room below — open the calendar
  // upward instead, or half of it ends up off-screen.
  const toggle = () => {
    if (!open && wrapRef.current) {
      const rect = wrapRef.current.getBoundingClientRect();
      setDropUp(window.innerHeight - rect.bottom < CAL_HEIGHT);
    }
    setOpen((v) => !v);
  };

  const handleType = (e) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 8);   // ddmmyyyy
    let out = digits;
    if (digits.length > 4) out = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    else if (digits.length > 2) out = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    setText(out);
    onChange(digits.length === 8 ? toISO(out) : "");
  };

  const complete = text.length === 10;
  const bad = complete && !toISO(text);   // e.g. 31/02/2026

  const cls = [
    "dp-wrap",
    bad || status === "conflict" ? "is-bad" : "",
    !bad && status === "warn" ? "is-warn" : "",
    dropUp ? "is-up" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={cls} ref={wrapRef}>
      <input
        className="dp-input"
        type="text"
        inputMode="numeric"
        placeholder="dd/mm/yyyy"
        value={text}
        onChange={handleType}
        maxLength={10}
        title="Type dd/mm/yyyy, or use the calendar"
      />
      <button
        type="button"
        className="dp-btn"
        onClick={toggle}
        aria-label="Open calendar"
      >
        📅
      </button>
      {open && (
        <Calendar
          value={value || ""}
          onPick={(iso) => onChange(iso)}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

export default function HallTicketAdmin({ embedded = false }) {
  const [open, setOpen] = useState(false);

  // ── catalog-driven class picker ──
  const [courses, setCourses] = useState([]);   // [{id, name}]
  const [years, setYears]     = useState([]);   // [{id, year_number, subjects:[...]}]
  const [selectedCourse, setSelectedCourse] = useState(""); // course id
  const [selectedYear, setSelectedYear]     = useState(""); // year_number
  const [selectedSem, setSelectedSem]       = useState(""); // semester number

  const [roster, setRoster]     = useState([]);
  const [loading, setLoading]   = useState(false);
  const [fineAmount, setFineAmount] = useState(500);
  const [generating, setGenerating] = useState(false);

  // exam schedule: { [subjectId]: { exam_date, session, id } }   exam_date is ISO
  const [schedule, setSchedule] = useState({});
  const [savingSchedule, setSavingSchedule] = useState(false);

  // controls
  const [gap, setGap] = useState(2);
  const [defaultSession, setDefaultSession] = useState("FN");
  const [pref, setPref] = useState("");
  const [startNote, setStartNote] = useState("");
  const [drafting, setDrafting] = useState(false);

  // overview: classes that already have a schedule
  const [scheduledClasses, setScheduledClasses] = useState([]);

  // ── load all courses once ──
  useEffect(() => {
    API.get("courses/")
      .then((r) => setCourses(r.data?.results || r.data || []))
      .catch(() => setCourses([]));
  }, []);

  // ── load the "scheduled classes" overview ──
  const loadScheduledClasses = () => {
    API.get("scheduled-classes/")
      .then((r) => setScheduledClasses(r.data?.results || r.data || []))
      .catch(() => setScheduledClasses([]));
  };
  useEffect(() => { loadScheduledClasses(); }, []);

  const openClass = (c) => {
    setSelectedCourse(String(c.course_id));
    setSelectedYear(String(c.year));
    setSelectedSem(String(c.semester));
  };

  // ── load that course's years (each with nested subjects) ──
  useEffect(() => {
    if (!selectedCourse) { setYears([]); return; }
    API.get(`years/?course=${selectedCourse}`)
      .then((r) => setYears(r.data?.results || r.data || []))
      .catch(() => setYears([]));
  }, [selectedCourse]);

  const courseId = selectedCourse;

  // year numbers available for this course
  const yearOptions = [...new Set(years.map((y) => y.year_number))].sort((a, b) => a - b);

  // the selected year row (holds the nested subjects)
  const selectedYearObj = years.find((y) => String(y.year_number) === String(selectedYear));

  // semesters that actually have subjects in this year
  const semesters = selectedYearObj
    ? [...new Set((selectedYearObj.subjects || []).map((s) => s.semester))].sort((a, b) => a - b)
    : [];

  // subjects for the chosen year + semester
  const classSubjects = (selectedYearObj && selectedSem)
    ? (selectedYearObj.subjects || [])
        .filter((s) => String(s.semester) === String(selectedSem))
        .map((s) => ({ id: s.id, name: s.name, code: s.code || "" }))
    : [];

  // ── load roster + existing exam schedule when the class changes ──
  const loadData = () => {
    if (!courseId || !selectedYear || !selectedSem) { setRoster([]); setSchedule({}); return; }
    setLoading(true);
    Promise.all([
      API.get(`/hall-ticket/roster/?course=${courseId}&year=${selectedYear}&semester=${selectedSem}`),
      API.get(`/exam-schedules/?semester=${selectedSem}`),
    ])
      .then(([rosterRes, schedRes]) => {
        setRoster(rosterRes.data?.results || rosterRes.data || []);
        const sched = schedRes.data?.results || schedRes.data || [];
        const map = {};
        sched.forEach((e) => {
          map[e.subject] = { id: e.id, exam_date: e.exam_date, session: e.session };
        });
        setSchedule(map);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourse, selectedYear, selectedSem]);

  const setSchedField = (subjectId, field, value) => {
    setSchedule((prev) => ({
      ...prev,
      [subjectId]: { ...prev[subjectId], [field]: value },
    }));
  };

  // ── Arrange (auto) / Draft with AI — fills the schedule map ──
  const runArrange = async (mode) => {
    if (!courseId || !selectedYear || !selectedSem) { alert("Pick a class first."); return; }
    setDrafting(true);
    try {
      const res = await API.post("/exam-schedules/draft/", {
        course: courseId,
        year: selectedYear,
        semester: Number(selectedSem),
        mode,
        preference: pref,
        gap,
        session: defaultSession,
      });
      const draft = res.data?.draft || [];
      if (res.data?.ai_note) console.log("Scheduler note:", res.data.ai_note);

      // explain a start-date shift (e.g. asked Aug 8, but Aug 8–9 is a weekend)
      const reqStart = res.data?.requested_start;
      const actStart = res.data?.actual_start;
      const notes = [];
      if (reqStart && actStart && reqStart !== actStart) {
        notes.push(`Requested ${fmt(reqStart)} — first working day is ${fmt(actStart)} (weekend/holiday skipped).`);
      }
      if (res.data?.gap_note) {
        notes.push(res.data.gap_note);
      }

      // The BACKEND still skips only Sundays and 2nd Saturdays, so auto-arrange can
      // still land an exam on a normal Saturday. Flag it here rather than letting the
      // admin discover a red row with no explanation. (Fix the backend rule to match
      // and this warning simply stops firing.)
      const weekendHits = draft.filter((d) => isWeekend(new Date(d.exam_date + "T00:00:00"))).length;
      if (weekendHits) {
        notes.push(`${weekendHits} exam${weekendHits === 1 ? "" : "s"} landed on a weekend — please move to a weekday.`);
      }

      setStartNote(notes.join(" "));
      setSchedule((prev) => {
        const next = { ...prev };
        draft.forEach((d) => {
          next[d.subject] = { ...next[d.subject], exam_date: d.exam_date, session: d.session };
        });
        return next;
      });
    } catch (err) {
      alert(err.response?.data?.detail || "Could not build the schedule.");
    } finally {
      setDrafting(false);
    }
  };

  // ── status per row (clash / weekend / ok) ──
  const groups = {};
  classSubjects.forEach((s) => {
    const r = schedule[s.id];
    if (r?.exam_date) {
      const k = r.exam_date + "|" + (r.session || "FN");
      (groups[k] = groups[k] || []).push(s.id);
    }
  });
  const clashSet = new Set();
  Object.values(groups).forEach((ids) => { if (ids.length > 1) ids.forEach((id) => clashSet.add(id)); });

  const statusOf = (sub) => {
    const r = schedule[sub.id] || {};
    if (!r.exam_date) return { level: "none" };
    if (clashSet.has(sub.id))
      return { level: "conflict", color: "#ef4444", pill: "Conflict", msg: "Clash — another exam is on this date + session" };
    const d = new Date(r.exam_date + "T00:00:00");
    if (isWeekend(d))
      return { level: "conflict", color: "#ef4444", pill: "Conflict",
               msg: `${weekendName(d)} — no exams, choose a weekday` };
    return { level: "ok", color: "#2563eb", pill: "OK" };
  };

  const statuses = {};
  classSubjects.forEach((s) => { statuses[s.id] = statusOf(s); });
  const blockingCount = classSubjects.filter((s) => ["conflict", "warn"].includes(statuses[s.id].level)).length;
  const examCount = classSubjects.filter((s) => schedule[s.id]?.exam_date).length;
  const hasAnyDate = examCount > 0;

  // rows sorted by date (earliest first; blanks last)
  const sortedSubjects = [...classSubjects].sort((a, b) => {
    const da = schedule[a.id]?.exam_date || "9999";
    const db = schedule[b.id]?.exam_date || "9999";
    return da.localeCompare(db);
  });

  // scheduling window text
  const datesSet = classSubjects.map((s) => schedule[s.id]?.exam_date).filter(Boolean).sort();
  const windowText = datesSet.length
    ? `Scheduling between ${fmt(datesSet[0])} – ${fmt(datesSet[datesSet.length - 1])} · no exams on weekends`
    : "Exams are weekday-only — Saturdays and Sundays are not available";

  // ── save all exam dates for this class ──
  const saveSchedule = async () => {
    if (blockingCount > 0) {
      alert("Resolve all conflicts (weekend dates, clashes) before saving.");
      return;
    }
    setSavingSchedule(true);
    try {
      await Promise.all(
        classSubjects.map((sub) => {
          const row = schedule[sub.id];
          if (!row || !row.exam_date) return null;
          const payload = {
            subject: sub.id,
            semester: Number(selectedSem),
            exam_date: row.exam_date,     // always ISO
            session: row.session || "FN",
          };
          return row.id
            ? API.patch(`/exam-schedules/${row.id}/`, payload)
            : API.post("/exam-schedules/", payload);
        }).filter(Boolean)
      );
      alert("Exam schedule saved.");
      loadData();
      loadScheduledClasses();
    } catch (err) {
      alert(err.response?.data?.detail || "Error saving exam schedule.");
    } finally {
      setSavingSchedule(false);
    }
  };

  const generateFines = async () => {
    if (!courseId || !selectedYear || !selectedSem) return;
    if (!window.confirm(`Generate ₹${fineAmount} attendance fine for all below-75% students in this class?`)) return;
    setGenerating(true);
    try {
      const res = await API.post("/hall-ticket/generate-fines/", {
        course: courseId, year: selectedYear, semester: selectedSem, amount: fineAmount,
      });
      alert(res.data?.message || "Fines generated.");
      loadData();
    } catch (err) {
      alert(err.response?.data?.detail || "Error generating fines.");
    } finally {
      setGenerating(false);
    }
  };

  const eligibleCount = roster.filter((r) => r.eligible).length;

  const pillStyle = (level) => {
    if (level === "conflict") return { background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" };
    if (level === "warn")     return { background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a" };
    return { background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0" };
  };

  const body = (
    <>
      <style>{`
        .es-strip{display:flex;align-items:center;gap:18px;flex-wrap:wrap;padding-bottom:14px;border-bottom:1px solid #eef2f7}
        .es-group{display:flex;align-items:center;gap:8px;color:#334155;font-weight:600;font-size:14px}
        .es-step{display:flex;align-items:center;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden}
        .es-step button{border:none;background:#f8fafc;width:34px;height:34px;font-size:17px;cursor:pointer;color:#334155}
        .es-step button:disabled{opacity:.4;cursor:not-allowed}
        .es-step span{min-width:36px;text-align:center;font-weight:700}
        .es-btn-ai{background:#7c3aed;color:#fff;border:none;border-radius:8px;padding:10px 16px;font-weight:600;cursor:pointer}
        .es-btn-arrange{background:#2563eb;color:#fff;border:none;border-radius:8px;padding:10px 16px;font-weight:600;cursor:pointer}
        .es-btn-ai:disabled,.es-btn-arrange:disabled{opacity:.6;cursor:not-allowed}
        .es-help{font-size:12.5px;color:#64748b;padding:10px 0 2px}
        .es-link{color:#2563eb;font-weight:700;cursor:pointer;text-decoration:underline}
        .es-dot{width:11px;height:11px;border-radius:50%;display:inline-block;margin-right:10px;vertical-align:middle}
        .es-pill{font-size:12px;font-weight:600;padding:3px 11px;border-radius:20px;display:inline-block}
        .es-warn-text{font-size:12px;margin-top:5px}
        .es-footer{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-top:16px;padding-top:14px;border-top:1px solid #eef2f7}

        /* The table wrapper in Attendance.css clips with overflow:auto, which cut the
           calendar popup in half. The table is only four columns and never needs to
           scroll sideways, so let children escape the box. */
        .att-card .att-table-wrap{overflow:visible !important}

        /* ---- date field: input + calendar icon inside ONE border ---- */
        .dp-wrap{position:relative;display:inline-flex;align-items:center;
                 width:165px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;
                 transition:border-color .12s, box-shadow .12s}
        .dp-wrap:focus-within{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.12)}
        .dp-wrap.is-bad{border-color:#ef4444}
        .dp-wrap.is-warn{border-color:#f59e0b}
        /* the input carries no border of its own — the wrapper IS the control */
        .dp-input{flex:1;min-width:0;border:none !important;background:transparent !important;
                  box-shadow:none !important;outline:none;height:34px;padding:0 0 0 12px;
                  font-size:13.5px;color:#0f172a;font-family:inherit}
        .dp-btn{width:34px;height:34px;border:none;background:transparent;cursor:pointer;
                font-size:14px;line-height:1;flex-shrink:0;border-radius:0 7px 7px 0;opacity:.7}
        .dp-btn:hover{background:#f1f5f9;opacity:1}

        /* ---- calendar popup ----
           7 equal columns. Two things break that if you let them:
           (1) plain 1fr will not shrink a grid item below its content's min-width, so
               the day buttons overflow instead of fitting — hence minmax(0,1fr);
           (2) <button> carries default browser padding, which inflates each cell past
               its column — hence padding:0 and min-width:0 on .cal-day. */
        .cal-pop{position:absolute;top:calc(100% + 6px);left:0;z-index:60;
                 width:282px;box-sizing:border-box;
                 background:#fff;border:1px solid #e2e8f0;border-radius:12px;
                 box-shadow:0 10px 30px rgba(15,23,42,.14);padding:14px 16px 12px}
        /* rows near the bottom of the page open upward instead */
        .dp-wrap.is-up .cal-pop{top:auto;bottom:calc(100% + 6px)}

        .cal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
        .cal-title{font-size:15px;font-weight:600;color:#0f172a}
        .cal-nav{width:30px;height:30px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;
                 cursor:pointer;color:#334155;font-size:16px;line-height:1;padding:0}
        .cal-nav:hover{background:#f1f5f9}

        .cal-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:2px;width:100%}
        .cal-dow{margin-bottom:6px}
        .cal-dow span{text-align:center;font-size:11px;font-weight:600;color:#94a3b8;padding:4px 0}
        .cal-dow span.is-wk{color:#cbd5e1}
        .cal-blank{display:block;height:34px}

        .cal-day{width:100%;min-width:0;padding:0;height:34px;border:none;border-radius:8px;
                 background:#fff;cursor:pointer;font-size:13px;color:#0f172a;
                 box-sizing:border-box;font-family:inherit}
        .cal-day:hover{background:#eff6ff}
        /* Weekends: struck through on a tinted cell. Grey alone reads as "faint",
           not "unavailable" — that ambiguity is what caused the confusion. */
        .cal-day.is-off{color:#cbd5e1;background:#f8fafc;text-decoration:line-through;cursor:not-allowed}
        .cal-day.is-off:hover{background:#f8fafc;color:#cbd5e1}
        .cal-day:disabled{cursor:not-allowed}
        .cal-day.is-today{box-shadow:inset 0 0 0 1px #cbd5e1;font-weight:600}
        .cal-day.is-sel{background:#2563eb;color:#fff;font-weight:600}
        .cal-day.is-sel:hover{background:#1d4ed8}

        .cal-foot{display:flex;align-items:center;justify-content:space-between;margin-top:12px;padding-top:10px;border-top:1px solid #f1f5f9}
        .cal-key{font-size:11px;color:#94a3b8}
        .cal-clear{border:none;background:none;color:#2563eb;font-size:12px;cursor:pointer;padding:0}
      `}</style>

      <div className="att-header">
        <div>
          <h1 className="att-title">Hall Ticket — Exam Setup & Eligibility</h1>
          <p className="att-subtitle">Set exam dates, check attendance eligibility, manage fines</p>
        </div>
      </div>

      {/* ===== SELECT CLASS (from the course catalog) ===== */}
      <div className="att-card">
        <h2 className="att-card-title">Select Class</h2>
        <div className="att-filter-grid">
          <div className="att-field">
            <label className="att-label">Course</label>
            <select className="att-input" value={selectedCourse}
              onChange={(e) => { setSelectedCourse(e.target.value); setSelectedYear(""); setSelectedSem(""); }}>
              <option value="">— Select Course —</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="att-field">
            <label className="att-label">Year</label>
            <select className="att-input" value={selectedYear}
              onChange={(e) => { setSelectedYear(e.target.value); setSelectedSem(""); }}
              disabled={!selectedCourse}>
              <option value="">— Select Year —</option>
              {yearOptions.map((y) => <option key={y} value={y}>Year {y}</option>)}
            </select>
          </div>
          <div className="att-field">
            <label className="att-label">Semester</label>
            <select className="att-input" value={selectedSem}
              onChange={(e) => setSelectedSem(e.target.value)}
              disabled={!selectedYear}>
              <option value="">— Select Semester —</option>
              {semesters.map((s) => <option key={s} value={s}>Semester {s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ===== SCHEDULED CLASSES OVERVIEW ===== */}
      {scheduledClasses.length > 0 && (
        <div className="att-card">
          <h2 className="att-card-title">Scheduled classes ({scheduledClasses.length})</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {scheduledClasses.map((c, i) => {
              const active = String(c.course_id) === String(selectedCourse)
                && String(c.year) === String(selectedYear)
                && String(c.semester) === String(selectedSem);
              return (
                <div
                  key={i}
                  onClick={() => openClass(c)}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "13px 15px", borderRadius: 12, cursor: "pointer",
                    border: active ? "1px solid #2563eb" : "1px solid #e5e7eb",
                    background: active ? "#eff6ff" : "#fff",
                    transition: "background .15s, border-color .15s",
                  }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "#f8fafc"; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "#fff"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{
                      width: 38, height: 38, borderRadius: 10, background: "#eff6ff",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                    }}>🗓️</span>
                    <div>
                      <div style={{ fontWeight: 600 }}>{c.course_name}</div>
                      <div style={{ fontSize: 12.5, color: "#64748b" }}>Year {c.year} · Semester {c.semester}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <span style={{
                      background: "#eff6ff", color: "#1d4ed8", fontWeight: 600, fontSize: 12,
                      padding: "4px 11px", borderRadius: 20,
                    }}>{c.count} exam{c.count !== 1 ? "s" : ""}</span>
                    {c.first && (
                      <span style={{ fontSize: 12.5, color: "#64748b" }}>{fmt(c.first)} – {fmt(c.last)}</span>
                    )}
                    <span style={{ color: "#94a3b8", fontSize: 18 }}>›</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== EXAM SCHEDULE ===== */}
      {selectedSem && classSubjects.length > 0 && (
        <div className="att-card">
          <h2 className="att-card-title">Exam Schedule</h2>

          {/* controls strip */}
          <div className="es-strip">
            <div className="es-group">
              📅 Gap (days)
              <div className="es-step">
                <button onClick={() => setGap((g) => Math.max(1, g - 1))} disabled={gap <= 1}>−</button>
                <span>{gap}</span>
                <button onClick={() => setGap((g) => g + 1)}>+</button>
              </div>
            </div>
            <div className="es-group">
              🕑 Session
              <select className="att-input" style={{ width: 160 }}
                value={defaultSession} onChange={(e) => setDefaultSession(e.target.value)}>
                <option value="FN">FN — Forenoon</option>
                <option value="AN">AN — Afternoon</option>
              </select>
            </div>
            <input
              value={pref}
              onChange={(e) => setPref(e.target.value)}
              placeholder="e.g. august 3, 2 day gap, 2 exams per day, within 2 weeks"
              className="att-input"
              style={{ flex: 1, minWidth: 220, marginRight: 10 }}
              title="Understands: a month or date, a gap, exams per day, a window, a session. Other instructions are ignored."
            />
            <button className="es-btn-ai" onClick={() => runArrange("ai")} disabled={drafting}>
              {drafting ? "Working…" : "✦ Draft with AI"}
            </button>
            <button className="es-btn-arrange" onClick={() => runArrange("auto")} disabled={drafting}>
              {drafting ? "Working…" : "✳ Arrange Exams"}
            </button>
          </div>

          <div className="es-help">ⓘ {windowText}</div>

          {/* Only these five things are understood. Anything else typed into the box is
              silently ignored — say so plainly, or admins will type rules that do nothing. */}
          <div className="es-help" style={{ color: "#7c3aed" }}>
            💡 The box understands only: a month or date (august / august 3) · a gap ("2 day gap") · exams per day ("2 exams per day") · a window ("within 16 days") · a session ("morning"/"afternoon"). Other instructions are ignored — weekends are already blocked automatically.
          </div>

          {startNote && (
            <div className="es-help" style={{ color: "#b45309" }}>
              ↪ {startNote}
            </div>
          )}

          {!hasAnyDate ? (
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "14px 16px", background: "#f8fafc",
              border: "1px dashed #cbd5e1", borderRadius: 10,
              color: "#64748b", fontSize: 13.5, marginTop: 6,
            }}>
              <span style={{ fontSize: 18 }}>🗓️</span>
              <span>
                No exams yet — set the gap and session, then click{" "}
                <span className="es-link" onClick={() => runArrange("auto")}>Arrange Exams</span>.
              </span>
            </div>
          ) : (
            <>
              <div className="att-table-wrap">
                <table className="att-table">
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th className="center">Exam Date (dd/mm/yyyy)</th>
                      <th className="center">Session</th>
                      <th className="center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSubjects.map((sub) => {
                      const row = schedule[sub.id] || {};
                      const st = statuses[sub.id];
                      const tint = st.level === "conflict" ? "#fef2f2" : st.level === "warn" ? "#fffbeb" : undefined;
                      return (
                        <tr key={sub.id} style={tint ? { background: tint } : undefined}>
                          <td className="att-td-name" style={{ borderLeft: `4px solid ${st.color || "#e5e7eb"}`, paddingLeft: 12 }}>
                            <span className="es-dot" style={{ background: st.color || "#cbd5e1" }} />
                            {sub.code ? <b>{sub.code} </b> : null}{sub.name}
                          </td>
                          <td className="center">
                            <DateInput
                              value={row.exam_date || ""}
                              onChange={(iso) => setSchedField(sub.id, "exam_date", iso)}
                              status={st.level}
                            />
                            {st.msg && (
                              <div className="es-warn-text" style={{ color: st.color }}>⚠ {st.msg}</div>
                            )}
                          </td>
                          <td className="center">
                            <select
                              className="att-input"
                              style={{ width: 120 }}
                              value={row.session || "FN"}
                              onChange={(e) => setSchedField(sub.id, "session", e.target.value)}
                            >
                              <option value="FN">FN</option>
                              <option value="AN">AN</option>
                            </select>
                          </td>
                          <td className="center">
                            <span className="es-pill" style={pillStyle(st.level)}>{st.pill}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="es-footer">
                <div style={{ fontSize: 13, color: blockingCount ? "#b91c1c" : "#15803d", fontWeight: 600 }}>
                  {examCount} exam{examCount !== 1 ? "s" : ""} · {blockingCount} conflict{blockingCount !== 1 ? "s" : ""}
                  {blockingCount > 0 && (
                    <span style={{ color: "#64748b", fontWeight: 400, marginLeft: 8 }}>
                      — resolve all conflicts to enable Save
                    </span>
                  )}
                </div>
                <button className="att-save-btn" onClick={saveSchedule} disabled={savingSchedule || blockingCount > 0}>
                  {savingSchedule ? "Saving…" : "Save Exam Schedule"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ===== ELIGIBILITY ROSTER ===== */}
      <div className="att-card">
        <h2 className="att-card-title">Eligibility Roster</h2>
        {loading ? (
          <div className="att-state"><div className="att-spinner" /><p>Loading roster…</p></div>
        ) : !selectedSem ? (
          <div className="att-state"><p>Select course, year and semester above.</p></div>
        ) : roster.length === 0 ? (
          <div className="att-state"><p>No students found for this class.</p></div>
        ) : (
          <>
            <div className="att-summary-row" style={{ alignItems: "center" }}>
              <span className="att-chip present">{eligibleCount} eligible</span>
              <span className="att-chip absent">{roster.length - eligibleCount} not eligible</span>
              <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                <label className="att-label" style={{ margin: 0 }}>Fine ₹</label>
                <input
                  className="att-input"
                  type="number"
                  min={0}
                  style={{ width: 90 }}
                  value={fineAmount}
                  onChange={(e) => setFineAmount(e.target.value)}
                />
                <button className="att-btn-outline" onClick={generateFines} disabled={generating}>
                  {generating ? "Generating…" : "Generate Fines"}
                </button>
              </span>
            </div>
            <div className="att-table-wrap">
              <table className="att-table">
                <thead>
                  <tr>
                    <th>Sl.No</th>
                    <th>Student Name</th>
                    <th>Roll No</th>
                    <th className="center">Attendance</th>
                    <th className="center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((r, idx) => (
                    <tr key={r.student} className={!r.eligible ? "att-row-low" : ""}>
                      <td>{idx + 1}</td>
                      <td className="att-td-name">{r.student_name}</td>
                      <td><span className="att-roll">{r.student_roll_no || "—"}</span></td>
                      <td className="center">
                        {r.attendance_percent != null ? `${r.attendance_percent}%` : "—"}
                      </td>
                      <td className="center">
                        {r.eligible ? (
                          <span style={{ color: "#16a34a", fontSize: 13 }}>
                            {r.reason === "fine_paid" ? "Eligible (fine paid)" : "Eligible"}
                          </span>
                        ) : r.has_unpaid_fine ? (
                          <span style={{ color: "#b45309", fontSize: 13 }}>Fine pending</span>
                        ) : (
                          <span style={{ color: "#dc2626", fontSize: 13 }}>Not eligible</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );

  if (embedded) return body;
  return (
    <div className="app">
      <Navbar setOpen={setOpen} />
      <div className="layout">
        <Sidebar open={open} setOpen={setOpen} />
        <div className="main">
          <div className="content">
            <div className="att-page">{body}</div>
          </div>
        </div>
      </div>
    </div>
  );
}