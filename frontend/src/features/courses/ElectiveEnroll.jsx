import { useEffect, useState } from "react";

import API from "../../api";
import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";
import "../../App.css";

export default function ElectiveEnroll() {
  const [open, setOpen] = useState(false);
  const [electives, setElectives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);   // TA id currently saving
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const showToast = (msg) => {
    setToast(msg);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(""), 2200);
  };

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const r = await API.get("/my-electives/");
      setElectives(r.data || []);
    } catch (err) {
      console.error("Load electives error:", err);
      setError("Could not load electives. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async (e) => {
    setError("");
    setBusyId(e.teaching_assignment);
    const willEnroll = !e.enrolled;
    try {
      await API.request({
        url: "/elective-enroll/",
        method: willEnroll ? "post" : "delete",
        data: { teaching_assignment: e.teaching_assignment },
      });
      // update just this row
      setElectives((list) =>
        list.map((x) =>
          x.teaching_assignment === e.teaching_assignment
            ? { ...x, enrolled: willEnroll }
            : x
        )
      );
      showToast(willEnroll ? `Enrolled in ${e.subject}` : `Removed ${e.subject}`);
    } catch (err) {
      console.error("Toggle elective error:", err);
      setError(
        err?.response?.data?.detail ||
          "Could not save that choice. Please try again."
      );
    } finally {
      setBusyId(null);
    }
  };

  const chosenCount = electives.filter((e) => e.enrolled).length;

  return (
    <div className="app">
      <Navbar setOpen={setOpen} />

      <div className="layout">
        <Sidebar open={open} setOpen={setOpen} />

        <div className="main">
          <div className="content">

            {toast && (
              <div
                style={{
                  position: "fixed", top: 24, left: "50%", transform: "translateX(-50%)",
                  zIndex: 1000, background: "#15803d", color: "#fff", fontSize: 14,
                  fontWeight: 600, padding: "11px 22px", borderRadius: 12,
                  boxShadow: "0 8px 24px rgba(0,0,0,.22)",
                }}
              >
                {toast}
              </div>
            )}

            {/* ================= HEADER ================= */}
            <div className="header-box">
              <h2>Choose Your Electives</h2>
              <p>
                Pick the elective subjects you want this semester. You are enrolled
                the moment you choose — untick any time to change your mind.
              </p>
            </div>

            {error && <div className="tb-error">{error}</div>}

            {/* ================= LIST ================= */}
            <div className="card">
              {loading ? (
                <p style={{ color: "#94a3b8" }}>Loading…</p>
              ) : electives.length === 0 ? (
                <p style={{ color: "#64748b" }}>
                  No electives are offered for your class this semester.
                </p>
              ) : (
                <>
                  <p style={{ color: "#64748b", marginTop: 0 }}>
                    {chosenCount} chosen of {electives.length} offered
                  </p>

                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Code</th>
                          <th>Subject</th>
                          <th>Teacher</th>
                          <th>Credits</th>
                          <th style={{ textAlign: "right" }}>Choose</th>
                        </tr>
                      </thead>
                      <tbody>
                        {electives.map((e) => (
                          <tr key={e.teaching_assignment}>
                            <td>{e.code || "—"}</td>
                            <td><strong>{e.subject}</strong></td>
                            <td>{e.teacher_name}</td>
                            <td>{e.credits ?? 0}</td>
                            <td style={{ textAlign: "right" }}>
                              <button
                                className={e.enrolled ? "btn-delete" : "btn-primary"}
                                onClick={() => toggle(e)}
                                disabled={busyId === e.teaching_assignment}
                              >
                                {busyId === e.teaching_assignment
                                  ? "Saving…"
                                  : e.enrolled
                                  ? "Chosen ✓ — Remove"
                                  : "Choose"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}