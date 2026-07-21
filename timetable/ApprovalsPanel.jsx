import { useEffect, useState } from "react";

import API from "../../api";

// status badge — self-contained colours so it works regardless of CSS
const STATUS = {
  draft:     { bg: "#f1f5f9", fg: "#475569", bd: "#e2e8f0", label: "Draft" },
  submitted: { bg: "#fff7ed", fg: "#b45309", bd: "#fed7aa", label: "Submitted" },
  approved:  { bg: "#ecfdf5", fg: "#15803d", bd: "#bbf7d0", label: "Approved" },
  rejected:  { bg: "#fef2f2", fg: "#dc2626", bd: "#fecaca", label: "Rejected" },
};

function Badge({ status }) {
  const s = STATUS[status] || STATUS.draft;
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 12,
        fontWeight: 700,
        color: s.fg,
        background: s.bg,
        border: `1px solid ${s.bd}`,
        borderRadius: 999,
        padding: "3px 12px",
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}

// Panel rendered INSIDE TimetableBuilder (which provides Navbar/Sidebar/layout).
export default function ApprovalsPanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  const [rejecting, setRejecting] = useState(null);
  const [remark, setRemark] = useState("");

  const showToast = (msg) => {
    setToast(msg);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(""), 2000);
  };

  const load = async () => {
    setLoading(true);
    try {
      const r = await API.get("/timetable/approvals/");
      setRows(r.data || []);
    } catch (err) {
      console.error("Approvals load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const approve = async (id) => {
    try {
      await API.post(`/timetable/approvals/${id}/action/`, { action: "approve" });
      showToast("✓ Approved");
      load();
    } catch (err) {
      console.error("Approve error:", err);
    }
  };

  const confirmReject = async (id) => {
    try {
      await API.post(`/timetable/approvals/${id}/action/`, {
        action: "reject",
        remark: remark.trim(),
      });
      setRejecting(null);
      setRemark("");
      showToast("✓ Rejected");
      load();
    } catch (err) {
      console.error("Reject error:", err);
    }
  };

  const pending = rows.filter((r) => r.status === "submitted");
  const others = rows.filter((r) => r.status !== "submitted");

  const cls = (r) => `${r.course || "—"} · Year ${r.year_number ?? "—"} · Sem ${r.semester}`;

  return (
    <div>
      {/* centered success toast */}
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

      {/* ===== PENDING ===== */}
      <div className="tb-card">
        <h3 className="tb-card-title">Pending approval ({pending.length})</h3>

        {loading ? (
          <p className="tb-state">Loading…</p>
        ) : pending.length === 0 ? (
          <p className="tb-state">No timetables waiting for approval.</p>
        ) : (
          <table className="tb-list">
            <thead>
              <tr>
                <th>Class</th>
                <th>Submitted by</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((r) => (
                <tr key={r.id}>
                  <td><strong>{cls(r)}</strong></td>
                  <td>{r.submitted_by || "—"}</td>
                  <td className="tb-right">
                    {rejecting === r.id ? (
                      <div className="tb-edit-cell">
                        <input
                          value={remark}
                          placeholder="Reason for the HOD"
                          onChange={(e) => setRemark(e.target.value)}
                          style={{ minWidth: "180px" }}
                        />
                        <button className="tb-btn tb-btn-sm" onClick={() => confirmReject(r.id)}>
                          Confirm
                        </button>
                        <button className="tb-cancel" onClick={() => { setRejecting(null); setRemark(""); }}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="tb-actions">
                        <button className="tb-btn tb-btn-sm" onClick={() => approve(r.id)}>
                          Approve
                        </button>
                        <button className="tb-del" onClick={() => { setRejecting(r.id); setRemark(""); }}>
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ===== ALL TIMETABLES ===== */}
      {!loading && others.length > 0 && (
        <div className="tb-card">
          <h3 className="tb-card-title">All timetables</h3>
          <table className="tb-list">
            <thead>
              <tr>
                <th>Class</th>
                <th>Status</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {others.map((r) => (
                <tr key={r.id}>
                  <td><strong>{cls(r)}</strong></td>
                  <td><Badge status={r.status} /></td>
                  <td style={{ color: r.status === "rejected" ? "#dc2626" : "#64748b", fontSize: 13 }}>
                    {r.status === "rejected" ? (r.remark || "Rejected") : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}