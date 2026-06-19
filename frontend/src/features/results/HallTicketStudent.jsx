import { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";
import API from "../../api";
import "../../styles/Attendance.css";

export default function HallTicketStudent({ embedded = false }) {
  const [open, setOpen]       = useState(false);
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying]   = useState(false);

  const load = () => {
    setLoading(true);
    API.get("/hall-ticket/")
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // pay the attendance fine via the existing fee pay endpoint
  const payFine = async () => {
    if (!data?.fine_id) return;
    if (!window.confirm(`Pay ₹${data.fine_amount} attendance fine to unlock your hall ticket?`)) return;
    setPaying(true);
    try {
      await API.post(`/fees/${data.fine_id}/pay/`, { amount: data.fine_amount });
      load(); // re-check eligibility — should now be unlocked
    } catch (err) {
      alert(err.response?.data?.detail || "Payment failed. Please try again.");
    } finally {
      setPaying(false);
    }
  };

  // build + print the hall ticket PDF (browser print)
  const downloadTicket = () => {
    const rows = (data.subjects || []).map((s, i) => `
      <tr>
        <td style="border:1px solid #ccc;padding:8px;text-align:center">${i + 1}</td>
        <td style="border:1px solid #ccc;padding:8px;text-align:center">${s.code || "-"}</td>
        <td style="border:1px solid #ccc;padding:8px">${s.name}</td>
        <td style="border:1px solid #ccc;padding:8px;text-align:center">${s.exam_date || "-"}</td>
        <td style="border:1px solid #ccc;padding:8px;text-align:center">${s.session || "-"}</td>
      </tr>`).join("");

    const html = `<html><head><title>Hall Ticket</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:Arial,sans-serif;font-size:13px;padding:28px}
        .title{text-align:center;font-size:18px;font-weight:700}
        .sub{text-align:center;font-size:14px;font-weight:600;border:2px solid #000;padding:8px;margin:8px 0 16px}
        .head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px}
        .info{font-size:14px;margin-bottom:6px}
        .photo{width:110px;height:130px;border:1px solid #000;display:flex;align-items:center;justify-content:center;font-size:11px;color:#888;text-align:center}
        table{width:100%;border-collapse:collapse;margin-top:10px}
        th{background:#f1f5f9;border:1px solid #ccc;padding:8px;font-weight:700}
        .sign{margin-top:50px;display:flex;justify-content:space-between;font-size:13px}
        @media print{@page{size:A4;margin:16mm}}
      </style></head>
      <body>
        <div class="title">Learning Management System</div>
        <div class="sub">Examination Hall Ticket</div>

        <div class="head">
          <div>
            <p class="info"><b>Name:</b> ${data.student_name || ""}</p>
            <p class="info"><b>Register No:</b> ${data.roll_number || ""}</p>
          </div>
          <div class="photo">Affix<br/>Photo</div>
        </div>

        <table>
          <thead><tr>
            <th style="width:60px">Sl.No</th>
            <th style="width:110px">Code</th>
            <th>Subject</th>
            <th style="width:120px">Date</th>
            <th style="width:90px">Session</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>

        <div class="sign">
          <span>Student Signature</span>
          <span>Controller of Examinations</span>
        </div>
      </body></html>`;

    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
    win.print();
  };

  const body = (
    <>
      <div className="att-header">
        <div>
          <h1 className="att-title">Hall Ticket</h1>
          <p className="att-subtitle">Download your examination hall ticket</p>
        </div>
      </div>

      <div className="att-card">
        {loading ? (
          <div className="att-state"><div className="att-spinner" /><p>Checking eligibility…</p></div>
        ) : !data ? (
          <div className="att-state"><p>Unable to load hall ticket status.</p></div>
        ) : (
          <>
            {/* Status summary */}
            <div className="att-summary-row" style={{ alignItems: "center", marginBottom: 12 }}>
              <span className="att-chip">
                Attendance: {data.attendance_percent != null ? `${data.attendance_percent}%` : "No records"}
              </span>
              <span className="att-chip">Required: {data.threshold}%</span>
              <span className={`att-chip ${data.eligible ? "present" : "absent"}`}>
                {data.eligible ? "Eligible" : "Not eligible"}
              </span>
            </div>

            {/* Eligible → download */}
            {data.eligible ? (
              <>
                <p style={{ fontSize: 14, color: "#374151", marginBottom: 12 }}>
                  {data.reason === "fine_paid"
                    ? "Your attendance fine is paid. You can download your hall ticket."
                    : "You meet the attendance requirement. You can download your hall ticket."}
                </p>

                <div className="att-table-wrap" style={{ marginBottom: 12 }}>
                  <table className="att-table">
                    <thead>
                      <tr>
                        <th>Sl.No</th>
                        <th>Code</th>
                        <th>Subject</th>
                        <th className="center">Date</th>
                        <th className="center">Session</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.subjects || []).map((s, i) => (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          <td>{s.code || "—"}</td>
                          <td className="att-td-name">{s.name}</td>
                          <td className="center">{s.exam_date || "—"}</td>
                          <td className="center">{s.session || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button className="att-save-btn" onClick={downloadTicket}>
                  Download Hall Ticket
                </button>
              </>
            ) : (
              // Not eligible → explain + pay if a fine exists
              <div className="att-state" style={{ color: "#b45309" }}>
                <p style={{ marginBottom: 12 }}>
                  Your attendance is{" "}
                  <b>{data.attendance_percent != null ? `${data.attendance_percent}%` : "below requirement"}</b>
                  , under the required {data.threshold}%.
                </p>

                {data.fine_id ? (
                  <>
                    <p style={{ marginBottom: 12 }}>
                      Pay the attendance shortage fine of <b>₹{data.fine_amount}</b> to unlock your hall ticket.
                    </p>
                    <button className="att-save-btn" onClick={payFine} disabled={paying}>
                      {paying ? "Processing…" : `Pay ₹${data.fine_amount} Fine`}
                    </button>
                  </>
                ) : (
                  <p>
                    Please contact the examination office regarding your attendance shortage.
                  </p>
                )}
              </div>
            )}
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