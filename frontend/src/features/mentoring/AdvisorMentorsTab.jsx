// frontend/src/features/mentoring/AdvisorMentorsTab.jsx
import { useCallback, useEffect, useState } from "react";

import {
  bandClass,
  errorText,
  getTeamMentors,
  setTeamMentor,
  submitTeams,
  yearLabel,
} from "./teamApi";

export default function AdvisorMentorsTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [confirming, setConfirming] = useState(false);

  const flash = (m) => {
    setToast(m);
    setTimeout(() => setToast(""), 4000);
  };

  const load = useCallback(async (resuggest = false) => {
    setLoading(true);
    setError("");
    try {
      setData(await getTeamMentors(resuggest));
    } catch (err) {
      setError(errorText(err, "Could not load the mentor list."));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const change = async (teamId, mentorId) => {
    setBusy(true);
    try {
      await setTeamMentor(teamId, mentorId || null);
      await load();
    } catch (err) {
      flash(errorText(err, "Could not set that mentor."));
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    setBusy(true);
    setConfirming(false);
    try {
      const d = await submitTeams();
      flash(d.detail);
      await load();
    } catch (err) {
      flash(errorText(err, "Could not send to the HOD."));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="ma-panel"><div className="ma-empty">Loading…</div></div>;
  }
  if (error) {
    return <div className="ma-note red"><b>Could not load</b>{error}</div>;
  }
  if (!data) return null;

  const c = data.cards;
  const pool = data.mentor_pool;

  const actions = (
    <>
      <button className="ma-btn small" disabled={busy}
              onClick={() => load(true)}>
        Suggest again
      </button>
      <button className="ma-btn primary" disabled={busy || !data.can_submit}
              title={data.can_submit ? "" : "Every team needs a mentor first"}
              onClick={() => setConfirming(true)}>
        Send {c.teams} team{c.teams === 1 ? "" : "s"} to the HOD
      </button>
    </>
  );

  return (
    <>
      {!data.formation_closed && (
        <div className="ma-note amber">
          <b>Team formation is still open</b>
          You can pick mentors now, but nothing goes to the HOD until you close
          formation on the Teams tab.
        </div>
      )}

      {data.already_submitted && (
        <div className="ma-note green">
          <b>Already sent to the HOD</b>
          Every team is waiting on {data.class.course_name} HOD. You will be told
          when a decision is made.
        </div>
      )}

      {c.without_mentor > 0 && (
        <div className="ma-note amber">
          <b>
            {c.without_mentor} team{c.without_mentor === 1 ? "" : "s"} still need a mentor
          </b>
          The send button stays off until every team has one. Those rows are
          highlighted below.
        </div>
      )}

      {pool.shortfall > 0 && (
        <div className="ma-note blue">
          <b>Fewer eligible teachers than teams</b>
          {pool.note}
        </div>
      )}

      {/* ---------- summary strip + actions ---------- */}
      <div className="tm-strip">
        <div className="tm-sv">
          <b>{c.teams}</b>
          <span>Teams</span>
          <em>{data.class.course_name} · {yearLabel(data.class.year)} Year</em>
        </div>
        <div className="tm-sdiv" />
        <div className="tm-sv">
          <b className={c.without_mentor ? "warn" : ""}>{c.with_mentor}</b>
          <span>Have a mentor</span>
          <em>{c.without_mentor ? `${c.without_mentor} still empty` : "All set"}</em>
        </div>
        <div className="tm-sdiv" />
        <div className="tm-sv">
          <b>{c.you_changed}</b>
          <span>You changed</span>
          <em>Marked in the table</em>
        </div>
        <div className="tm-sdiv" />
        <div className="tm-sv">
          <b>{pool.eligible}</b>
          <span>Eligible teachers</span>
          <em>Of {pool.total_teachers} in the department</em>
        </div>
        <div className="tm-sright">{actions}</div>
      </div>

      {/* ---------- confirm ---------- */}
      {confirming && (
        <div className="ma-note blue">
          <b>Send {c.teams} teams to the HOD?</b>
          Students only see a mentor once the HOD approves. You cannot change
          these afterwards.
          <div style={{ marginTop: 11, display: "flex", gap: 9 }}>
            <button className="ma-btn primary small" onClick={send} disabled={busy}>
              Yes, send it
            </button>
            <button className="ma-btn small" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ---------- the table ---------- */}
      <div className="ma-panel">
        <div className="ma-panel-head">
          <div>
            <h3>Teams and mentors</h3>
            <p>One mentor per team — the students share them</p>
          </div>
        </div>

        {c.teams === 0 ? (
          <div className="ma-empty">
            No team has been formed yet. Start on the Teams tab.
          </div>
        ) : (
          <div className="ma-scroll">
            <table className="ma-table">
              <thead>
                <tr>
                  <th style={{ width: 90 }}>Team</th>
                  <th>A student</th>
                  <th>B student</th>
                  <th>C student</th>
                  <th style={{ width: 200 }}>Mentor</th>
                  <th style={{ width: 130 }} />
                </tr>
              </thead>
              <tbody>
                {data.teams.map((t) => (
                  <tr key={t.team_id}
                      className={!t.mentor_id ? "tm-row-missing" : ""}>
                    <td><b>Team {String(t.number).padStart(2, "0")}</b></td>
                    <StudentCell list={t.a} band="A" />
                    <StudentCell list={t.b} band="B" />
                    <StudentCell list={t.c} band="C" />
                    <td>
                      <select
                        value={t.mentor_id || ""}
                        disabled={busy || t.submitted}
                        className={t.source === "changed" ? "tm-edited" : ""}
                        onChange={(e) => change(t.team_id, Number(e.target.value))}
                      >
                        <option value="">Choose a mentor…</option>
                        {data.mentor_options.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}{m.preferred ? "" : " (held back)"} · {m.assigned}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {t.submitted ? (
                        <span className="ma-pill ma-green">Sent</span>
                      ) : t.source === "changed" ? (
                        <span className="ma-pill ma-amber"
                              title={`Suggested: ${t.suggested_name}`}>
                          You changed
                        </span>
                      ) : t.mentor_id ? (
                        <span className="ma-pill ma-grey">Suggested</span>
                      ) : (
                        <span className="ma-pill ma-red">Needs a mentor</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="ma-panel-foot tm-sticky-foot">
          <span>
            {c.with_mentor} of {c.teams} team{c.teams === 1 ? "" : "s"} have a mentor
          </span>
          <div style={{ flex: 1 }} />
          {actions}
        </div>
      </div>

      {toast && <div className="ma-toast">{toast}</div>}
    </>
  );
}

// ================= ONE BAND CELL =================
function StudentCell({ list, band }) {
  if (!list.length) {
    return <td className="tm-none">No {band} student</td>;
  }
  return (
    <td>
      {list.map((s) => (
        <div key={s.student_id} className="tm-cell">
          <span className={bandClass(band)}>{band}</span>
          <div>
            <div className="nm">{s.name}</div>
            <div className="rl">
              {s.roll_number}{s.is_extra ? " · extra" : ""}
            </div>
          </div>
        </div>
      ))}
    </td>
  );
}