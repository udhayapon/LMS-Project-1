// Frontend/src/features/teachingplan/TeacherTeachingPlan.jsx
import React, { useEffect, useState } from "react";
import API from "../../api";
import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";
import "../../styles/TeachingPlans.css";

const DEMO_SUBJECTS = [{ id: "demo1", label: "English Essentials – I" }];
const DEMO_SEMS = ["Semester 1"];

const PREVIEW_COUNT = 5;

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmt = (iso) => {
  const [, m, d] = (iso || "").split("-").map(Number);
  return m ? `${MON[m - 1]} ${d}` : iso;
};

// status -> { label, action, tint class, bar class }
const STATUS_META = {
  approved:    { label: "Approved",      action: "View",     tint: "tp-tint--teal",  bar: "tp-subj-bar--teal" },
  submitted:   { label: "Submitted",     action: "View",     tint: "tp-tint--blue",  bar: "tp-subj-bar--blue" },
  draft:       { label: "Draft",         action: "Continue", tint: "tp-tint--amber", bar: "tp-subj-bar--amber" },
  rejected:    { label: "Needs changes", action: "Continue", tint: "tp-tint--red",   bar: "tp-subj-bar--red" },
  not_started: { label: "Not started",   action: "Start",    tint: "tp-tint--grey",  bar: "tp-subj-bar--grey" },
};

// A plan in these states is locked — the teacher can look but not edit.
const LOCKED_STATUSES = ["submitted", "approved"];

// ================= HELPERS =================
function CountBox({ n, label, variant }) {
  return (
    <div className={`tp-count tp-count--${variant}`}>
      <div className="tp-count-n">{n}</div>
      <div className="tp-count-label">{label}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="tp-field-label">{label}</label>
      {children}
    </div>
  );
}

function TTLegend({ swatch, label }) {
  return (
    <span className="tp-tt-legend-item">
      <span className={`tp-tt-swatch tp-tt-swatch--${swatch}`} />
      {label}
    </span>
  );
}

function TimetablePanel({ subjectLabel, subjectId, onClose }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    API.get("teaching-plans/my_timetable/")
      .then((res) => setData(res.data))
      .catch(() => setData({ weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], rows: [] }));
  }, []);

  const isPlan = (c) => c && subjectId != null && String(c.subject_id) === String(subjectId);

  const cellClass = (c) => {
    if (!c) return "tp-tt-cell tp-tt-cell--free";
    if (isPlan(c)) return "tp-tt-cell tp-tt-cell--plan";
    return "tp-tt-cell tp-tt-cell--other";
  };

  return (
    <div className="tp-modal-overlay" onClick={onClose}>
      <div className="tp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tp-modal-head">
          <div>
            <div className="tp-modal-title">My assigned timetable</div>
            <div className="tp-modal-sub">by period</div>
          </div>
          <button className="tp-modal-close" aria-label="Close" onClick={onClose}>✕</button>
        </div>

        <div className="tp-modal-body">
          {!data ? (
            <div className="tp-note">Loading…</div>
          ) : (
            <table className="tp-tt-table">
              <thead>
                <tr>
                  <th className="tp-tt-th tp-tt-th--period">Period</th>
                  {data.weekdays.map((w) => <th key={w} className="tp-tt-th">{w}</th>)}
                </tr>
              </thead>
              <tbody className="tp-tt-body">
                {data.rows.map((row, ri) =>
                  row.is_break ? (
                    <tr key={ri}>
                      <td colSpan={data.weekdays.length + 1} className="tp-tt-cellwrap">
                        <div className="tp-tt-break">{row.label}</div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={ri}>
                      <td className="tp-tt-period">{row.label}</td>
                      {row.cells.map((c, ci) => (
                        <td key={ci} className="tp-tt-cellwrap">
                          <div className={cellClass(c)}>{c ? c.name : "—"}</div>
                        </td>
                      ))}
                    </tr>
                  )
                )}
              </tbody>
            </table>
          )}

          <div className="tp-tt-legend">
            <TTLegend swatch="plan" label={subjectLabel || "This subject"} />
            <TTLegend swatch="other" label="Other subjects" />
            <TTLegend swatch="free" label="Free period" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ================= MAIN COMPONENT =================
export default function TeacherTeachingPlan() {
  const [open, setOpen] = useState(false);

  const [subjects, setSubjects] = useState(DEMO_SUBJECTS);
  const [sems, setSems] = useState(DEMO_SEMS);

  // null = show the panel; an id = show the form for that subject
  const [subjectId, setSubjectId] = useState(null);
  const [semSel, setSemSel] = useState(DEMO_SEMS[0]);

  const [allDays, setAllDays] = useState([]);
  const [allotted, setAllotted] = useState(0);
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState("");
  const [showTT, setShowTT] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [syllabus, setSyllabus] = useState("");
  const [showAllDays, setShowAllDays] = useState(false);

  const [subjStatus, setSubjStatus] = useState([]);
  const [curStatus, setCurStatus] = useState(null);

  const locked = LOCKED_STATUSES.includes(curStatus);

  const subjectLabel = subjects.find((s) => String(s.id) === String(subjectId))?.label
    || subjStatus.find((s) => String(s.subject_id) === String(subjectId))?.subject
    || "";

  // The class is a PROPERTY OF THE SUBJECT'S TIMETABLE ASSIGNMENT — never a free
  // choice. It used to be a dropdown defaulting to classes[0], with no link to the
  // selected subject, so a teacher could save a plan against a class they don't
  // teach that subject to. The student view matches on this exact string, so the
  // plan then rendered for nobody — no error, just an empty page.
  const classForSubject =
    subjStatus.find((s) => String(s.subject_id) === String(subjectId))?.class_label || "";

  const classDays = allDays.filter((d) => !d.holiday);
  const holidays = allDays.filter((d) => d.holiday);

  // options (subjects / semesters) — do NOT auto-select a subject
  useEffect(() => {
    API.get("teaching-plans/options/")
      .then((res) => {
        if (res.data?.subjects?.length) setSubjects(res.data.subjects);
        if (res.data?.semesters?.length) { setSems(res.data.semesters); setSemSel(res.data.semesters[0]); }
      })
      .catch(() => {});
  }, []);

  const loadStatus = () => {
    API.get("teaching-plans/subject_status/")
      .then((res) => setSubjStatus(res.data?.subjects || []))
      .catch(() => setSubjStatus([]));
  };
  useEffect(() => { loadStatus(); }, []);

  useEffect(() => {
    const s = subjStatus.find((x) => String(x.subject_id) === String(subjectId));
    setCurStatus(s ? s.status : null);
  }, [subjStatus, subjectId]);

  const subjectLabelFor = (id) =>
    (subjStatus.find((s) => String(s.subject_id) === String(id))?.subject) || "";

  const firstRow = (list) => {
    const first = list.find((d) => !d.holiday);
    return first ? [{ ...first, topic: "" }] : [];
  };

  // when a subject is chosen, load its class days + any saved plan
  useEffect(() => {
    if (!subjectId || String(subjectId).startsWith("demo")) return;
    setMsg("");
    setSyllabus("");
    setShowAllDays(false);
    API.get(`teaching-plans/class_days/?subject=${subjectId}`)
      .then(async (res) => {
        const days = Array.isArray(res.data?.days) ? res.data.days : [];
        setAllotted(res.data?.allotted || 0);
        setAllDays(days);

        let savedUnits = [];
        try {
          const mine = await API.get("teaching-plans/my/");
          const plan = (mine.data || []).find(
            (p) => String(p.subject_id ?? p.subject) === String(subjectId) ||
                   p.subject === subjectLabelFor(subjectId)
          );
          if (plan && Array.isArray(plan.units)) savedUnits = plan.units;
        } catch { /* none saved */ }

        const classDayList = days.filter((d) => !d.holiday);

        if (savedUnits.length) {
          // Trust what was SAVED (due + period_no) — do NOT rebuild by position.
          // The old code took only the topic and re-derived the date from the
          // index in classDayList. Add one holiday and that list shortens, so
          // every topic silently shifts to the wrong day. Look each unit up by
          // its own date + period instead.
          const byKey = new Map(
            classDayList.map((d) => [`${d.date}__${d.period_no}`, d])
          );
          const rebuilt = savedUnits
            .slice()
            .sort((a, b) => (a.sequence_no || 0) - (b.sequence_no || 0))
            .map((u) => {
              const match = byKey.get(`${u.due}__${u.period_no}`);
              if (match) return { ...match, topic: u.topic || "" };
              // the slot is no longer in the timetable — keep what was saved
              return {
                date: u.due,
                period_no: u.period_no,
                hours: u.hours || 0,
                weekday: "",
                period_label: `Period ${u.period_no ?? "?"}`,
                time_label: "",
                topic: u.topic || "",
              };
            })
            .filter((r) => r.date);

          setRows(rebuilt.length ? rebuilt : firstRow(classDayList));
        } else {
          setRows(firstRow(classDayList));
        }
      })
      .catch(() => { setAllotted(0); setAllDays([]); setRows([]); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId]);

  const plannedHours = rows.reduce((a, r) => a + (r.hours || 0), 0);

  // key on period_no (the real value), not period_label (a display string)
  const keyOf = (d) => `${d.date}__${d.period_no ?? ""}`;

  const addUnit = () => {
    const used = new Set(rows.map((r) => keyOf(r)));
    const next = classDays.find((d) => !used.has(keyOf(d)));
    if (next) setRows((prev) => [...prev, { ...next, topic: "" }]);
  };
  // one click = every remaining class day from the timetable
  const addAllUnits = () => {
    const used = new Set(rows.map((r) => keyOf(r)));
    const rest = classDays.filter((d) => !used.has(keyOf(d)));
    if (!rest.length) return;
    setRows((prev) => [...prev, ...rest.map((d) => ({ ...d, topic: "" }))]);
  };
  const removeUnit = (k) => setRows((prev) => prev.filter((r) => keyOf(r) !== k));
  const setTopic = (k, val) => setRows((prev) => prev.map((r) => (keyOf(r) === k ? { ...r, topic: val } : r)));

  const lastDate = rows.length ? rows[rows.length - 1].date : null;
  const shownHolidays = lastDate ? holidays.filter((h) => h.date <= lastDate) : [];
  const display = [...rows, ...shownHolidays].sort((a, b) => (a.date < b.date ? -1 : 1));

  // collapse the long list — show a handful, expand on demand
  const visibleDisplay = showAllDays ? display : display.slice(0, PREVIEW_COUNT);
  const hiddenCount = display.length - visibleDisplay.length;

  const visibleRows = showAllDays ? rows : rows.slice(0, PREVIEW_COUNT);
  const hiddenRowCount = rows.length - visibleRows.length;

  const moreToAdd = rows.length < classDays.length;

  // ================= AI: SUGGEST TOPICS =================
  // Sends ONLY the subject id, the number of class days, and the syllabus the
  // teacher pasted. No student data, no names, no marks. The AI fills the topic
  // inputs; the teacher reviews and edits before saving. Nothing auto-saves.
  const suggestTopics = async () => {
    if (!rows.length) {
      setMsg("Add at least one class day first.");
      return;
    }

    const filled = rows.filter((r) => (r.topic || "").trim()).length;
    if (filled > 0) {
      const ok = window.confirm(
        `This will replace the ${filled} topic${filled === 1 ? "" : "s"} you have already typed. Continue?`
      );
      if (!ok) return;
    }

    setAiLoading(true);
    setMsg("");
    try {
      const res = await API.post("teaching-plans/suggest_topics/", {
        subject: subjectId,
        count: rows.length,
        syllabus: syllabus.trim(),
      });
      const topics = res.data?.topics || [];
      setRows((prev) => prev.map((r, i) => ({ ...r, topic: topics[i] ?? r.topic })));
      setMsg("Topics suggested by AI. Please review and edit them before submitting.");
    } catch (err) {
      setMsg(
        err.response?.data?.detail ||
        "Could not generate topics. Please try again."
      );
    } finally {
      setAiLoading(false);
    }
  };

  const save = async (status) => {
    const payload = {
      subject: subjectId,
      class_section: classForSubject,   // from the timetable, never a dropdown
      semester: semSel,
      allotted_hours: allotted,
      status,
      units: rows.map((r, i) => ({
        topic: r.topic,
        hours: r.hours,
        // The serializer declares `due` (source=complete_by). Sending the key
        // `complete_by` instead makes DRF silently DISCARD the date — which is
        // exactly how all 42 units ended up with no date at all.
        due: r.date,
        period_no: r.period_no,
        sequence_no: i + 1,
      })),
    };
    try {
      await API.post("teaching-plans/", payload);
      setMsg(status === "submitted" ? "Submitted to HOD for review." : "Saved as draft.");
      if (status === "submitted") setShowAllDays(false);
      loadStatus();
    } catch (err) {
      const d = err.response?.data;
      setMsg(
        d?.detail ||
        (Array.isArray(d?.subject) ? d.subject[0] : d?.subject) ||
        "Could not save the plan. Please try again."
      );
    }
  };

  const noTimetable = classDays.length === 0;
  const counts = subjStatus.reduce((a, s) => { a[s.status] = (a[s.status] || 0) + 1; return a; }, {});

  const openSubject = (id) => { setSubjectId(id); setShowAllDays(false); window.scrollTo(0, 0); };
  const backToPanel = () => { setSubjectId(null); setMsg(""); setShowAllDays(false); window.scrollTo(0, 0); };

  return (
    <div className="app">
      <Navbar setOpen={setOpen} />
      <div className="layout">
        <Sidebar open={open} setOpen={setOpen} />
        <div className="main">
          <div className="content">

            <h1 className="tp-title">Teaching plan</h1>
            <p className="tp-subtitle">
              {subjectId
                ? (locked
                    ? "This plan has been submitted. You can view it, but not edit it."
                    : "Fill the topic for each class day, then submit to your HOD.")
                : "Your subjects at a glance. Pick one to write or edit its plan."}
            </p>

            {/* ========== PANEL (shown when no subject is selected) ========== */}
            {!subjectId && (
              subjStatus.length > 0 ? (
                <div className="tp-w920">
                  <div className="tp-count-grid">
                    <CountBox n={counts.approved || 0}    label="Approved"    variant="teal" />
                    <CountBox n={counts.submitted || 0}   label="Submitted"   variant="blue" />
                    <CountBox n={(counts.draft || 0) + (counts.rejected || 0)} label="Draft" variant="amber" />
                    <CountBox n={counts.not_started || 0} label="Not started" variant="grey" />
                  </div>

                  <div className="tp-subj-list">
                    {subjStatus.map((s) => {
                      const m = STATUS_META[s.status] || STATUS_META.not_started;
                      return (
                        <div className="tp-subj-row" key={s.subject_id} onClick={() => openSubject(s.subject_id)}>
                          <div className={`tp-subj-bar ${m.bar}`} />
                          <div className="tp-subj-main">
                            <div className="tp-subj-name">{s.subject}</div>
                            <div className="tp-subj-meta">
                              {s.class_label}
                              {s.allotted_hours ? ` · ${s.planned_hours} / ${s.allotted_hours} hrs`
                                                : s.status === "not_started" ? " · no plan yet" : ""}
                            </div>
                          </div>
                          <span className={`tp-chip ${m.tint}`}>{m.label}</span>
                          <button className="tp-btn-primary"
                            onClick={(e) => { e.stopPropagation(); openSubject(s.subject_id); }}>
                            {m.action}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="tp-panel-note">
                  No subjects assigned to you yet. Ask the admin to add your teaching assignments.
                </div>
              )
            )}

            {/* ========== FORM (shown only after a subject is chosen) ========== */}
            {subjectId && (
              <div className="tp-form-card">
                <button className="tp-back-btn tp-mb14" onClick={backToPanel}>
                  ← Back to my subjects
                </button>

                <div className="tp-form-head">
                  <div className="tp-form-title">Teaching plan · {subjectLabel}</div>
                  <button className="tp-link-btn" onClick={() => setShowTT(true)}>▦ View timetable</button>
                </div>

                {curStatus && curStatus !== "not_started" && (
                  <div className={`tp-banner ${(STATUS_META[curStatus] || {}).tint || ""}`}>
                    {curStatus === "submitted" && "Submitted · waiting for HOD review."}
                    {curStatus === "approved" && "Approved by HOD · published to the class."}
                    {curStatus === "draft" && "Draft · not submitted yet. Continue where you left off."}
                    {curStatus === "rejected" && "Sent back by HOD · please revise and resubmit."}
                  </div>
                )}

                {!locked && (
                  <div className="tp-hint">
                    Add each class day and type the topic. The class, date, period and hours all come from your timetable. Holidays are shown greyed and skipped automatically.
                  </div>
                )}

                <div className="tp-field-grid-2">
                  <Field label="Subject">
                    <select className="tp-input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                      {subjStatus.length
                        ? subjStatus.map((s) => <option key={s.subject_id} value={s.subject_id}>{s.subject}</option>)
                        : subjects.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Class (from your timetable)">
                    <input className="tp-input tp-input--readonly" readOnly value={classForSubject || "—"} />
                  </Field>
                </div>
                <div className="tp-field-grid-2 tp-mb18">
                  <Field label="Semester">
                    <select className="tp-input" value={semSel} disabled={locked}
                      onChange={(e) => setSemSel(e.target.value)}>
                      {sems.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </Field>
                  <Field label="Allotted hours (from timetable)">
                    <input className="tp-input tp-input--readonly" readOnly value={`${allotted} hrs`} />
                  </Field>
                </div>

                {/* ===== AI PANEL: paste the syllabus, generate topics ===== */}
                {!noTimetable && !locked && (
                  <div className="tp-ai-panel">
                    <div className="tp-ai-head">
                      <span className="tp-ai-title">✨ Generate topics with AI</span>
                    </div>
                    <textarea
                      className="tp-ai-textarea"
                      value={syllabus}
                      onChange={(e) => setSyllabus(e.target.value)}
                      placeholder="Paste your syllabus here — units, topics, or the university outline."
                    />
                    <div className="tp-ai-foot">
                      <span className="tp-ai-hint">
                        Optional. Leave blank and the AI works from the subject name alone.
                      </span>
                      <button
                        className="tp-btn-primary tp-btn-sm"
                        onClick={suggestTopics}
                        disabled={aiLoading || !rows.length}
                      >
                        {aiLoading
                          ? "Generating…"
                          : `Generate for ${rows.length} class day${rows.length === 1 ? "" : "s"}`}
                      </button>
                    </div>
                  </div>
                )}

                <div className="tp-units-head tp-section-rule">
                  <span className="tp-units-title">Topic for each class</span>
                  <span className="tp-units-count">
                    {rows.length} class{rows.length === 1 ? "" : "es"}
                  </span>
                </div>

                {noTimetable ? (
                  <div className="tp-note">
                    No timetable found for this subject yet. Ask the admin to add it to the timetable.
                  </div>
                ) : locked ? (
                  /* ===== READ-ONLY VIEW (submitted / approved) ===== */
                  <>
                    <div className={`tp-units-list${showAllDays ? " tp-units-list--scroll" : ""}`}>
                      {visibleRows.map((r, i) => (
                        <div className="tp-unit" key={keyOf(r)}>
                          <div className="tp-unit-idx">{i + 1}</div>
                          <div className="tp-unit-topic">{r.topic || "—"}</div>
                          <div className="tp-unit-meta">
                            {fmt(r.date)} · {r.period_label} · {r.hours} {r.hours > 1 ? "hrs" : "hr"}
                          </div>
                        </div>
                      ))}
                    </div>

                    {rows.length > PREVIEW_COUNT && (
                      <div className="tp-units-toggle" onClick={() => setShowAllDays((v) => !v)}>
                        {showAllDays
                          ? "Show fewer"
                          : `Show all ${rows.length} classes (${hiddenRowCount} more)`}
                      </div>
                    )}
                  </>
                ) : (
                  /* ===== EDITABLE VIEW (draft / rejected / new) ===== */
                  <>
                    <div className="tp-day-grid tp-day-head">
                      <div>Date</div><div>Day · period</div><div>Hours</div><div>Topic for the day</div><div></div>
                    </div>

                    {visibleDisplay.map((r) =>
                      r.holiday ? (
                        <div className="tp-holiday-row" key={r.date}>
                          <div className="tp-holiday-date">{fmt(r.date)}</div>
                          <div className="tp-holiday-text">⊘ {r.weekday} · Holiday — {r.holiday_name} · skipped</div>
                        </div>
                      ) : (
                        <div className="tp-day-grid tp-day-row" key={keyOf(r)}>
                          <div className="tp-day-date">{fmt(r.date)}</div>
                          <div className="tp-day-block">
                            <div className="tp-day-weekday">{r.weekday}</div>
                            <div className="tp-day-period">{r.period_label} · {r.time_label}</div>
                          </div>
                          <div className="tp-day-hours">{r.hours} {r.hours > 1 ? "hrs" : "hr"}</div>
                          <input className="tp-input" value={r.topic} placeholder="What will you teach?"
                            onChange={(e) => setTopic(keyOf(r), e.target.value)} />
                          <button className="tp-day-remove" aria-label="Remove day" onClick={() => removeUnit(keyOf(r))}>✕</button>
                        </div>
                      )
                    )}

                    {display.length > PREVIEW_COUNT && (
                      <div className="tp-units-toggle" onClick={() => setShowAllDays((v) => !v)}>
                        {showAllDays
                          ? "Show fewer"
                          : `Show all ${display.length} rows (${hiddenCount} more)`}
                      </div>
                    )}

                    {moreToAdd ? (
                      <div className="tp-add-row">
                        <button className="tp-add-unit" onClick={addUnit}>+ Add unit</button>
                        <button className="tp-add-unit" onClick={addAllUnits}>
                          + Add all {classDays.length - rows.length} remaining class day{classDays.length - rows.length === 1 ? "" : "s"}
                        </button>
                      </div>
                    ) : (
                      <div className="tp-all-added">All class days for the semester added.</div>
                    )}
                  </>
                )}

                <div className="tp-form-foot">
                  <div className="tp-form-foot-info">
                    {rows.length} class day{rows.length === 1 ? "" : "s"} · {plannedHours} / {allotted} hrs
                    {shownHolidays.length ? ` · ${shownHolidays.length} holiday skipped` : ""}
                  </div>
                  {locked ? (
                    <div className="tp-form-foot-info">
                      {curStatus === "approved"
                        ? "Approved — no further changes needed."
                        : "Locked until your HOD reviews it."}
                    </div>
                  ) : (
                    <div className="tp-form-foot-actions">
                      <button className="tp-btn-outline tp-btn-sm" onClick={() => save("draft")}>Save draft</button>
                      <button className="tp-btn-primary tp-btn-sm" onClick={() => save("submitted")}>Submit for review</button>
                    </div>
                  )}
                </div>

                {msg && <div className="tp-msg">{msg}</div>}
              </div>
            )}

          </div>
        </div>
      </div>

      {showTT && <TimetablePanel subjectLabel={subjectLabel} subjectId={subjectId} onClose={() => setShowTT(false)} />}
    </div>
  );
}