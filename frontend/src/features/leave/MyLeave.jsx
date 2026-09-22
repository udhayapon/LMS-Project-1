// ============================================================================
//  NEW FILE: frontend/src/features/leave/MyLeave.jsx
//  Teacher screen. Apply for leave, follow the HOD's decision.
// ============================================================================
import { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";
import API from "../../api";
import "../../styles/Attendance.css";
import "../../styles/StaffLeave.css";

// must match StaffLeaveRequest.LeaveType in attendance/models.py
const LEAVE_TYPES = [
  { value: "casual", label: "Casual leave", proof: false },
  { value: "medical", label: "Medical leave", proof: true },
  { value: "on_duty", label: "On duty (conference / FDP / workshop)", proof: true },
  { value: "compensatory", label: "Compensatory leave", proof: false },
  { value: "other", label: "Other", proof: false },
];

const SESSIONS = [
  { value: "full", label: "Full day" },
  { value: "forenoon", label: "Forenoon" },
  { value: "afternoon", label: "Afternoon" },
];

const STATUS_HELP = [
  { key: "pending", text: "Waiting for HOD", help: "Waiting for HOD approval" },
  { key: "approved", text: "Approved", help: "HOD approved the leave" },
  { key: "rejected", text: "Rejected", help: "HOD rejected the leave" },
  { key: "cancelled", text: "Cancelled", help: "Teacher cancelled the request" },
  { key: "recorded", text: "Recorded", help: "HOD leave saved and backup informed. No approval needed" },
];

const fmtDate = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
};

const badgeOf = (status) =>
  STATUS_HELP.find((s) => s.key === status) || { key: status, text: status };

const typeLabel = (r) => r.leave_type_label || r.leave_type;

const errText = (err) => {
  const data = err?.response?.data;
  if (!data) return "Something went wrong. Try again.";
  if (typeof data === "string") return data;
  if (data.detail) return data.detail;
  const first = Object.values(data)[0];
  return Array.isArray(first) ? first[0] : String(first);
};

export default function MyLeave() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState("apply");

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  // form
  const [type, setType] = useState("casual");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [session, setSession] = useState("full");
  const [reason, setReason] = useState("");
  const [proof, setProof] = useState(null);
  const [backup, setBackup] = useState("");
  const [covering, setCovering] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // preview from the server (day count + affected periods + approver)
  const [preview, setPreview] = useState(null);

  // details view
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const singleDay = from && from === to;
  const isHod = !!preview?.is_hod;
  const needsProof = LEAVE_TYPES.find((t) => t.value === type)?.proof;

  const loadList = async () => {
    setLoading(true);
    try {
      const res = await API.get("users/staff-leave/");
      setList(res.data?.results || res.data || []);
    } catch (err) {
      console.error("Staff leave load error:", err);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { loadList(); }, []);

  const loadCovering = async () => {
    try {
      const res = await API.get("users/staff-leave/covering/");
      setCovering(res.data?.results || res.data || []);
    } catch (err) {
      console.error("Covering load error:", err);
    }
  };
  useEffect(() => { loadCovering(); }, []);

  // server decides the day count and the affected periods — never the browser
  useEffect(() => {
    if (!from || !to || to < from) { setPreview(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await API.get("users/staff-leave/preview/", {
          params: { from, to, session },
        });
        if (!cancelled) setPreview(res.data);
      } catch (err) {
        if (!cancelled) setPreview(null);
      }
    })();
    return () => { cancelled = true; };
  }, [from, to, session]);

  useEffect(() => { setFormError(""); }, [type, from, to, session, backup]);
  const onFromChange = (value) => {
    setFrom(value);
    if (!to || to < value) setTo(value);
  };
  const onToChange = (value) => {
    setTo(value);
    if (value !== from) setSession("full");
  };

  const submit = async () => {
    setFormError("");
    if (!from || !to) return setFormError("Choose the leave dates.");
    if (to < from) return setFormError("The end date cannot be before the start date.");
    if (reason.trim().length < 5) return setFormError("Write a short reason.");
    if (needsProof && !proof) return setFormError("Attach proof for this leave type.");
    if (isHod && !backup) return setFormError("Choose who will cover your work during this leave.");

    const body = new FormData();
    body.append("leave_type", type);
    body.append("from_date", from);
    body.append("to_date", to);
    body.append("session", singleDay ? session : "full");
    body.append("reason", reason.trim());
    if (proof) body.append("proof", proof);
    if (isHod) body.append("backup", backup);

    setSubmitting(true);
    try {
      await API.post("users/staff-leave/create/", body, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setType("casual"); setFrom(""); setTo(""); setSession("full");
      setReason(""); setProof(null); setPreview(null); setBackup("");
      const input = document.getElementById("leave-proof-input");
      if (input) input.value = "";
      await loadList();
      setView("mine");
    } catch (err) {
      setFormError(errText(err));
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async (id) => {
    try {
      await API.post(`users/staff-leave/${id}/cancel/`);
      await loadList();
    } catch (err) {
      alert(errText(err));
    }
  };

  const openDetail = async (id) => {
    setDetailLoading(true);
    setDetail({ id });
    try {
      const res = await API.get(`users/staff-leave/${id}/`);
      setDetail(res.data);
    } catch (err) {
      alert(errText(err));
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  // stat cards — approved days this year, by type
  const year = String(new Date().getFullYear());
  const takenDays = (t) =>
    list
      .filter((r) => (r.status === "approved" || r.status === "recorded") && r.leave_type === t && String(r.from_date).startsWith(year))
      .reduce((sum, r) => sum + Number(r.days || 0), 0);
  const pendingCount = list.filter((r) => r.status === "pending").length;

  const periodsBox = (periods, note) => (
    <div className="sl-classes">
      <div className="sl-classes-title">Classes during this leave ({periods.length})</div>
      {periods.length === 0 ? (
        <div className="sl-classes-empty">No classes in the selected dates.</div>
      ) : (
        <ul className="sl-classes-list">
          {periods.map((p) => (
            <li key={p.entry_id + p.date}>
              <span className="sl-classes-day">{p.day_of_week.slice(0, 3)} {fmtDate(p.date)}</span>
              <span>Period {p.period_no}: {p.subject}, {p.course} Year {p.year}</span>
            </li>
          ))}
        </ul>
      )}
      {note && <div className="sl-classes-note">{note}</div>}
    </div>
  );

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
                  <h1 className="att-title">My Leave</h1>
                  <p className="att-subtitle">Apply for leave and follow your HOD's decision.</p>
                </div>
              </div>

              <div className="att-summary-grid">
                <div className="att-sum-card">
                  <div className="att-sum-label">Casual leave taken</div>
                  <div className="att-sum-value dark">{takenDays("casual")}</div>
                  <div className="att-sum-hint">Days this year</div>
                </div>
                <div className="att-sum-card">
                  <div className="att-sum-label">Medical leave taken</div>
                  <div className="att-sum-value dark">{takenDays("medical")}</div>
                  <div className="att-sum-hint">Days this year</div>
                </div>
                <div className="att-sum-card">
                  <div className="att-sum-label">On duty taken</div>
                  <div className="att-sum-value dark">{takenDays("on_duty")}</div>
                  <div className="att-sum-hint">Days this year</div>
                </div>
                <div className="att-sum-card">
                  <div className="att-sum-label">Waiting for HOD</div>
                  <div className="att-sum-value dark">{pendingCount}</div>
                  <div className="att-sum-hint">Requests</div>
                </div>
              </div>

              {covering.length > 0 && (
                <div className="sl-covering">
                  <div className="sl-covering-title">You are covering for your HOD</div>
                  {covering.map((c) => (
                    <div key={c.id} className="sl-covering-row">
                      <b>{c.teacher_name}</b> is on leave from {fmtDate(c.from_date)}
                      {c.to_date !== c.from_date ? ` to ${fmtDate(c.to_date)}` : ""}.
                      You are handling department work during this period.
                    </div>
                  ))}
                </div>
              )}

              <div className="att-tabs">
                <button
                  className={`att-tab${view === "apply" ? " active" : ""}`}
                  onClick={() => { setView("apply"); setDetail(null); }}
                >
                  Apply leave
                </button>
                <button
                  className={`att-tab${view === "mine" ? " active" : ""}`}
                  onClick={() => { setView("mine"); setDetail(null); }}
                >
                  My requests ({list.length})
                </button>
              </div>

              {/* ════════ APPLY ════════ */}
              {view === "apply" && (
                <div className="att-card">
                  <h2 className="att-card-title">Apply for leave</h2>

                  <div className="att-od-form-grid">
                    <div className="att-field">
                      <label className="att-label">Leave type</label>
                      <select className="att-input" value={type} onChange={(e) => setType(e.target.value)}>
                        {LEAVE_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="att-field">
                      <label className="att-label">From Date</label>
                      <input
                        className="att-input att-input-date"
                        type="date"
                        value={from}
                        onChange={(e) => onFromChange(e.target.value)}
                      />
                    </div>
                    <div className="att-field">
                      <label className="att-label">To Date</label>
                      <input
                        className="att-input att-input-date"
                        type="date"
                        value={to}
                        min={from || undefined}
                        onChange={(e) => onToChange(e.target.value)}
                      />
                    </div>
                    <div className="att-field">
                      <label className="att-label">Session</label>
                      <select
                        className="att-input"
                        value={session}
                        disabled={!singleDay}
                        onChange={(e) => setSession(e.target.value)}
                      >
                        {SESSIONS.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                      <div className="sl-hint">
                        {singleDay ? "Half day allowed for a single date" : "Full day only for more than one date"}
                      </div>
                    </div>
                  </div>

                  <div className="sl-two-col">
                    <div>
                      <div className="att-field">
                        <label className="att-label">Reason</label>
                        <textarea
                          className="att-od-textarea"
                          rows={2}
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="e.g. Attending a two-day FDP on concrete technology at Anna University"
                        />
                      </div>
                      <div className="att-field">
                        <label className="att-label">
                          Proof {needsProof ? "(required)" : "(optional)"}
                        </label>
                        <input
                          id="leave-proof-input"
                          className="att-od-file"
                          type="file"
                          onChange={(e) => setProof(e.target.files?.[0] || null)}
                        />
                        <div className="sl-hint">Medical certificate or invitation letter. PDF or image.</div>
                      </div>
                    </div>

                    {periodsBox(
                      preview?.periods || [],
                      preview?.substitute_note ||
                        "These classes may need a substitute teacher. Approving leave does not assign one."
                    )}
                  </div>

                  {isHod && (
                    <div className="att-field sl-backup">
                      <label className="att-label">During my absence (backup)</label>
                      <select className="att-input" value={backup} onChange={(e) => setBackup(e.target.value)}>
                        <option value="">Select a teacher from your department</option>
                        {(preview?.backup_options || []).map((t) => (
                          <option key={t.id} value={t.id}>{t.username}</option>
                        ))}
                      </select>
                      <div className="sl-hint">
                        As HOD, your leave is recorded, not approved. The teacher you choose will see a handover notice.
                      </div>
                    </div>
                  )}

                  {preview?.covering_warning && (
                    <div className="sl-warn">⚠ {preview.covering_warning}</div>
                  )}

                  {preview?.blocked_reason && (
                    <div className="sl-blocked">{preview.blocked_reason}</div>
                  )}
                  {formError && <div className="sl-error">{formError}</div>}

                  <div className="sl-foot">
                    <span className="sl-total">Total: {preview?.days ?? 0} {Number(preview?.days) === 1 ? "day" : "days"}</span>
                    {preview?.approver && (
                      <span className="sl-to">
                        Goes to <b>{preview.approver}</b>
                        {preview.approver_department ? `, HOD of ${preview.approver_department},` : ""} for approval
                      </span>
                    )}
                    {isHod && (
                      <span className="sl-to">Recorded as HOD leave. No approval needed.</span>
                    )}
                    <button
                      className="att-btn-primary sl-submit"
                      onClick={submit}
                      disabled={submitting || !!preview?.blocked_reason}
                    >
                      {submitting ? "Sending…" : isHod ? "Submit leave" : "Send to HOD"}
                    </button>
                  </div>
                </div>
              )}

              {/* ════════ MY REQUESTS ════════ */}
              {view === "mine" && (
                <div className="att-card">
                  {detail ? (
                    <>
                      <div className="sl-detail-head">
                        <button className="att-btn-outline" onClick={() => setDetail(null)}>← Back</button>
                        <h2 className="att-card-title sl-detail-title">Leave details</h2>
                        {detail.status && (
                          <span className={`att-od-badge ${badgeOf(detail.status).key}`}>
                            {badgeOf(detail.status).text}
                          </span>
                        )}
                      </div>
                      {detailLoading ? (
                        <div className="att-state"><div className="att-spinner" /><p>Loading…</p></div>
                      ) : (
                        <div className="sl-detail">
                          <div className="sl-row"><div className="sl-k">Leave type</div><div>{typeLabel(detail)}</div></div>
                          <div className="sl-row"><div className="sl-k">From and to</div>
                            <div>{fmtDate(detail.from_date)}{detail.to_date !== detail.from_date ? ` to ${fmtDate(detail.to_date)}` : ""}{detail.session !== "full" ? `, ${detail.session_label}` : ""}</div>
                          </div>
                          <div className="sl-row"><div className="sl-k">Number of days</div><div>{Number(detail.days)}</div></div>
                          <div className="sl-row"><div className="sl-k">Reason</div><div>{detail.reason}</div></div>
                          <div className="sl-row"><div className="sl-k">Proof</div>
                            <div>{detail.proof_url
                              ? <a className="att-od-proof" href={detail.proof_url} target="_blank" rel="noreferrer">View proof</a>
                              : <span className="sl-na">Not attached</span>}</div>
                          </div>
                          <div className="sl-row"><div className="sl-k">Approver</div><div>{detail.hod_name || (detail.backup_name ? "Not needed (HOD leave)" : "—")}</div></div>
                          {detail.backup_name && (
                            <div className="sl-row"><div className="sl-k">Backup</div><div>{detail.backup_name}</div></div>
                          )}
                          <div className="sl-row"><div className="sl-k">Applied on</div><div>{fmtDate((detail.created_at || "").slice(0, 10))}</div></div>
                          <div className="sl-row"><div className="sl-k">Decision</div>
                            <div>{detail.decided_at
                              ? `${badgeOf(detail.status).text} on ${fmtDate(detail.decided_at.slice(0, 10))}`
                              : detail.status === "recorded"
                                ? "Recorded, no approval needed"
                                : <span className="sl-na">Not decided yet</span>}</div>
                          </div>
                          <div className="sl-row"><div className="sl-k">HOD remark</div>
                            <div>{detail.hod_remark || <span className="sl-na">None</span>}</div>
                          </div>
                          <div className="sl-row"><div className="sl-k">Affected periods</div>
                            <div>{periodsBox(detail.affected_periods || [], "")}</div>
                          </div>
                          <div className="sl-row"><div className="sl-k">Substitute status</div>
                            <div><span className="sl-na">Not arranged. Substitution is a later phase.</span></div>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <h2 className="att-card-title">My requests</h2>
                      {loading ? (
                        <div className="att-state"><div className="att-spinner" /><p>Loading…</p></div>
                      ) : list.length === 0 ? (
                        <div className="att-state"><p>Your leave requests will show here once you apply.</p></div>
                      ) : (
                        <div className="att-od-list">
                          {list.map((r) => {
                            const badge = badgeOf(r.status);
                            return (
                              <div key={r.id} className="att-od-item">
                                <div className="att-od-row">
                                  <div className="att-od-main">
                                    <div className="att-od-cat">{typeLabel(r)}</div>
                                    <div className="att-od-dates">
                                      {fmtDate(r.from_date)}
                                      {r.to_date !== r.from_date ? ` → ${fmtDate(r.to_date)}` : ""}
                                      {", "}{r.session !== "full" ? r.session_label : `${Number(r.days)} ${Number(r.days) === 1 ? "day" : "days"}`}
                                    </div>
                                  </div>
                                  <div className="att-od-reason-cell">{r.reason}</div>
                                  <div className="att-od-actions">
                                    <button className="att-btn-outline" onClick={() => openDetail(r.id)}>Details</button>
                                    {(r.status === "pending" || r.status === "recorded") && (
                                      <button className="att-btn-outline" onClick={() => cancel(r.id)}>Cancel request</button>
                                    )}
                                    <span className={`att-od-badge ${badge.key}`}>{badge.text}</span>
                                  </div>
                                </div>
                                {r.hod_remark && <div className="att-od-remark"><b>HOD:</b> {r.hod_remark}</div>}
                                {r.backup_name && <div className="att-od-remark"><b>Backup:</b> {r.backup_name}</div>}
                                {r.proof_url && (
                                  <a className="att-od-proof" href={r.proof_url} target="_blank" rel="noreferrer">View proof</a>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="sl-legend">
                        <div className="sl-legend-title">What each status means</div>
                        {STATUS_HELP.map((s) => (
                          <div key={s.key} className="sl-legend-row">
                            <span className={`att-od-badge ${s.key}`}>{s.text}</span>
                            <span>{s.help}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}