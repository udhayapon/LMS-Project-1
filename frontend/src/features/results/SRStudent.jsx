import { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";
import API from "../../api";
import "../../styles/Attendance.css";

export default function SRStudent({ embedded = false }) {
  const [open, setOpen]       = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  // ── own published results (all semesters) ──
  useEffect(() => {
    API.get("/semester-results/")
      .then((res) => setResults(res.data?.results || res.data || []))
      .finally(() => setLoading(false));
  }, []);

  // newest semester first
  const sorted = [...results].sort((a, b) => b.semester - a.semester);

  // overall percentage for a semester
  const semesterPct = (entries) => {
    const scored = entries.filter((en) => en.marks_obtained != null);
    if (!scored.length) return null;
    const total = scored.reduce((s, en) => s + Number(en.marks_obtained), 0);
    const max = scored.reduce((s, en) => s + Number(en.max_marks), 0);
    return max ? ((total / max) * 100).toFixed(1) : null;
  };

  const allPass = (entries) => entries.every((en) => en.is_pass);

  // ── download one semester's result as a PDF (browser print) ──
  const downloadResult = (sem) => {
    const pct = semesterPct(sem.entries || []);
    const passed = allPass(sem.entries || []);
    const rows = (sem.entries || []).map((en, i) => `
      <tr>
        <td style="border:1px solid #ccc;padding:8px;text-align:center">${i + 1}</td>
        <td style="border:1px solid #ccc;padding:8px">${en.subject_name}</td>
        <td style="border:1px solid #ccc;padding:8px;text-align:center">${en.max_marks}</td>
        <td style="border:1px solid #ccc;padding:8px;text-align:center">${en.marks_obtained ?? "-"}</td>
        <td style="border:1px solid #ccc;padding:8px;text-align:center">${en.grade}</td>
        <td style="border:1px solid #ccc;padding:8px;text-align:center;color:${en.is_pass ? "#16a34a" : "#dc2626"}">${en.is_pass ? "Pass" : "Fail"}</td>
      </tr>`).join("");

    const html = `<html><head><title>Semester ${sem.semester} Result</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:Arial,sans-serif;font-size:13px;padding:24px}
        .title{text-align:center;font-size:18px;font-weight:700}
        .sub{text-align:center;font-size:14px;font-weight:600;border:2px solid #000;padding:8px;margin:8px 0 14px}
        .info{font-size:13px;margin-bottom:10px}
        table{width:100%;border-collapse:collapse}
        th{background:#f1f5f9;border:1px solid #ccc;padding:8px;font-weight:700}
        .foot{margin-top:12px;font-size:13px;font-weight:600}
        @media print{@page{size:A4;margin:14mm}}
      </style></head>
      <body>
        <div class="title">Learning Management System</div>
        <div class="sub">Semester ${sem.semester} — Statement of Marks</div>
        <p class="info"><b>Name:</b> ${user.username || ""} &nbsp;&nbsp; <b>Roll No:</b> ${user.roll_number || ""}</p>
        <table>
          <thead><tr>
            <th>Sl.No</th><th>Subject</th><th>Max</th><th>Scored</th><th>Grade</th><th>Result</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p class="foot">Overall: ${pct ?? "-"}% &nbsp;&nbsp; Result: ${passed ? "PASS" : "ARREARS"}</p>
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
          <h1 className="att-title">Semester Result</h1>
          <p className="att-subtitle">Your results — current and previous semesters</p>
        </div>
      </div>

      {loading ? (
        <div className="att-card">
          <div className="att-state"><div className="att-spinner" /><p>Loading results…</p></div>
        </div>
      ) : sorted.length === 0 ? (
        <div className="att-card">
          <div className="att-state">
            <p>No results have been published yet. They'll appear here once your department releases them.</p>
          </div>
        </div>
      ) : (
        sorted.map((sem) => {
          const pct = semesterPct(sem.entries || []);
          const passed = allPass(sem.entries || []);
          return (
            <div className="att-card" key={sem.id} style={{ marginBottom: 16 }}>
              <div className="att-summary-row" style={{ alignItems: "center", marginBottom: 8 }}>
                <h2 className="att-card-title" style={{ margin: 0 }}>
                  Semester {sem.semester}
                </h2>
                {pct != null && (
                  <span className="att-chip present">{pct}% overall</span>
                )}
                <span className={`att-chip ${passed ? "present" : "absent"}`}>
                  {passed ? "All Passed" : "Has Arrears"}
                </span>
                <button
                  className="att-btn-outline"
                  style={{ marginLeft: "auto" }}
                  onClick={() => downloadResult(sem)}
                >
                  Download PDF
                </button>
              </div>

              <div className="att-table-wrap">
                <table className="att-table">
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th className="center">Max</th>
                      <th className="center">Scored</th>
                      <th className="center">Grade</th>
                      <th className="center">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(sem.entries || []).map((en, idx) => (
                      <tr key={idx}>
                        <td className="att-td-name">{en.subject_name}</td>
                        <td className="center">{en.max_marks}</td>
                        <td className="center">
                          {en.marks_obtained != null ? <b>{en.marks_obtained}</b> : "—"}
                        </td>
                        <td className="center"><b>{en.grade}</b></td>
                        <td className="center">
                          {en.is_pass ? (
                            <span style={{ color: "#16a34a", fontSize: 13 }}>Pass</span>
                          ) : (
                            <span style={{ color: "#dc2626", fontSize: 13 }}>Fail</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}
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