import { useEffect, useState } from "react";
import Navbar from "../../components/Navbar";
import Sidebar from "../../components/Sidebar";
import API from "../../api";
import "../../styles/ParentModule.css";

export default function ParentFees() {
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState([]);
  const [activeChild, setActiveChild] = useState(null);
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(true);

  // pay popup state
  const [payFee, setPayFee] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");

  useEffect(() => {
    API.get("/parent/dashboard/")
      .then((res) => setChildren(res.data?.children || []))
      .catch((err) => console.log("children fetch error:", err));
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      // FeeViewSet already scopes to the parent's children.
      const res = await API.get("/fees/");
      setFees(res.data?.results || res.data || []);
    } catch (err) {
      console.log("Parent fees fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 15000);
    return () => clearInterval(t);
  }, []);

  // filter by selected child (client-side; Fee has student + student_name)
  const visible = fees.filter((f) => {
    if (activeChild === null) return true;
    const child = children.find((c) => c.id === activeChild);
    return (f.student?.id || f.student) === activeChild || f.student_name === child?.username;
  });

  // ── amount helpers (fall back gracefully if backend fields are missing) ──
  const paidVal = (f) =>
    Number(f.paid_amount ?? (f.status === "paid" ? f.amount : 0));
  const pendingVal = (f) =>
    Number(f.pending_amount ?? (Number(f.amount || 0) - paidVal(f)));

  const totalFees = visible.reduce((s, f) => s + Number(f.amount || 0), 0);
  const paid = visible.reduce((s, f) => s + paidVal(f), 0);
  const pending = totalFees - paid;
  const nextDue = visible
    .filter((f) => f.status !== "paid" && f.due_date)
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0];

  const fmtDate = (iso) =>
    iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
  const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

  // ── status badge (now handles "partial") ──
  const statusBadge = (f) => {
    if (f.status === "paid")
      return <span className="pm-badge green">Paid</span>;
    if (f.status === "partial")
      return <span className="pm-badge" style={{ background: "#fef3c7", color: "#92400e" }}>Partial</span>;
    return <span className="pm-badge red">Pending</span>;
  };

  // ── open / submit payment ──
  const openPay = (f) => {
    setPayFee(f);
    setPayAmount(String(pendingVal(f)));
    setPayError("");
  };

  const submitPay = async () => {
    const amt = Number(payAmount);
    const remaining = pendingVal(payFee);
    if (!amt || amt <= 0) { setPayError("Enter an amount greater than 0."); return; }
    if (amt > remaining)  { setPayError(`You can pay at most ${money(remaining)}.`); return; }
    try {
      setPaying(true);
      setPayError("");
      await API.post(`/fees/${payFee.id}/pay/`, { amount: amt });
      setPayFee(null);
      await fetchData();
    } catch (err) {
      setPayError(err.response?.data?.detail || "Payment failed. Try again.");
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="app">
      <Navbar setOpen={setOpen} />
      <div className="layout">
        <Sidebar open={open} setOpen={setOpen} />
        <div className="main">
          <div className="content">
            <div className="pm-page">

              <div className="pm-header">
                <h1>Fee Details</h1>
                <p>Payment history and pending dues</p>
              </div>

              <div className="pm-tabs">
                <div
                  className={`pm-tab ${activeChild === null ? "active" : ""}`}
                  onClick={() => setActiveChild(null)}
                >
                  All Children
                </div>
                {children.map((c) => (
                  <div
                    key={c.id}
                    className={`pm-tab ${activeChild === c.id ? "active" : ""}`}
                    onClick={() => setActiveChild(c.id)}
                  >
                    {c.username}
                  </div>
                ))}
              </div>

              {loading ? (
                <div className="pm-loading">Loading fees…</div>
              ) : (
                <div className="pm-two-col">
                  {/* ── Summary ── */}
                  <div className="pm-card">
                    <div className="pm-card-title">Fee Summary</div>
                    <div className="pm-fee-row">
                      <span className="pm-fee-label">Total fees</span>
                      <span className="pm-fee-val">{money(totalFees)}</span>
                    </div>
                    <div className="pm-fee-row">
                      <span className="pm-fee-label">Paid</span>
                      <span className="pm-fee-val green">{money(paid)}</span>
                    </div>
                    <div className="pm-fee-row">
                      <span className="pm-fee-label">Pending</span>
                      <span className="pm-fee-val red">{money(pending)}</span>
                    </div>
                    <div className="pm-fee-row">
                      <span className="pm-fee-label">Next due date</span>
                      <span className="pm-fee-val">{fmtDate(nextDue?.due_date)}</span>
                    </div>
                  </div>

                  {/* ── History ── */}
                  <div className="pm-card">
                    <div className="pm-card-title">Payment History</div>
                    {visible.length === 0 ? (
                      <div className="pm-empty">No fee records</div>
                    ) : (
                      <table className="pm-table">
                        <thead>
                          <tr>
                            <th>Child</th><th>Term</th><th>Total</th>
                            <th>Paid</th><th>Pending</th><th>Status</th><th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {visible.map((f) => (
                            <tr key={f.id}>
                              <td>{f.student_name}</td>
                              <td>{f.term}</td>
                              <td>{money(f.amount)}</td>
                              <td className="green">{money(paidVal(f))}</td>
                              <td className="red">{money(pendingVal(f))}</td>
                              <td>{statusBadge(f)}</td>
                              <td>
                                {f.status !== "paid" && (
                                  <button
                                    onClick={() => openPay(f)}
                                    style={{
                                      padding: "5px 14px", borderRadius: 8, border: "none",
                                      background: "#0f172a", color: "#fff", fontSize: 12,
                                      fontWeight: 600, cursor: "pointer",
                                    }}
                                  >
                                    Pay
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── PAY POPUP ── */}
      {payFee && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(15,23,42,.5)",
            zIndex: 1000, display: "flex", alignItems: "center",
            justifyContent: "center", padding: 20,
          }}
          onClick={(e) => e.target === e.currentTarget && !paying && setPayFee(null)}
        >
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 380, padding: 22 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>
              Pay Fee
            </div>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
              {payFee.student_name} · {payFee.term}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: "#64748b" }}>Total</span>
              <span style={{ fontWeight: 600 }}>{money(payFee.amount)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 16 }}>
              <span style={{ color: "#64748b" }}>Remaining</span>
              <span style={{ fontWeight: 700, color: "#b91c1c" }}>{money(pendingVal(payFee))}</span>
            </div>

            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>
              Amount to pay (₹)
            </label>
            <input
              type="number"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              style={{
                width: "100%", padding: "9px 12px", borderRadius: 8,
                border: "1px solid #e2e8f0", fontSize: 14, boxSizing: "border-box",
              }}
            />

            {payError && (
              <div style={{ color: "#b91c1c", fontSize: 12, marginTop: 8 }}>{payError}</div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
              <button
                onClick={() => setPayFee(null)}
                disabled={paying}
                style={{
                  padding: "9px 16px", borderRadius: 10, border: "1px solid #e2e8f0",
                  background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#374151",
                }}
              >
                Cancel
              </button>
              <button
                onClick={submitPay}
                disabled={paying}
                style={{
                  padding: "9px 18px", borderRadius: 10, border: "none",
                  background: "#0f172a", color: "#fff", fontSize: 13, fontWeight: 600,
                  cursor: paying ? "default" : "pointer", opacity: paying ? 0.7 : 1,
                }}
              >
                {paying ? "Paying…" : "Pay Now"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}