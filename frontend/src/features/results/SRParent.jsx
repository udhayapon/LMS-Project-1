import { useEffect, useState } from "react";
import API from "../../api";
import "../../styles/Attendance.css";

export default function SRParent() {
  const [children, setChildren] = useState([]);
  const [activeChild, setActiveChild] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  // ---- load children ----
  useEffect(() => {
    API.get("/parent/dashboard/")
      .then((res) => setChildren(res.data?.children || []))
      .catch((err) => console.log("children fetch error:", err));
  }, []);

  // ---- load semester results for selected child (or all) ----
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const q = activeChild ? `?child=${activeChild}` : "";
        const res = await API.get(`/semester-results/${q}`);
        setResults(res.data?.results || res.data || []);
      } catch (err) {
        console.log("semester results error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChild]);

  return (
    <div className="att-card">
      {/* child selector tabs */}
      <div className="pm-tabs" style={{ marginBottom: 16 }}>
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

      <h2 className="att-card-title">Semester Results</h2>

      {loading ? (
        <div className="att-state"><div className="att-spinner" /><p>Loading…</p></div>
      ) : results.length === 0 ? (
        <div className="att-state"><p>No published results yet.</p></div>
      ) : (
        results.map((r) => {
          const entries = r.entries || [];
          const totalMax = entries.reduce((s, e) => s + Number(e.max_marks || 0), 0);
          const totalScored = entries.reduce((s, e) => s + Number(e.marks_obtained || 0), 0);
          const pct = totalMax ? ((totalScored / totalMax) * 100).toFixed(1) : "0.0";
          const hasArrears = entries.some((e) => !e.is_pass);
          return (
            <div key={r.id} style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#0f172a" }}>
                  Semester {r.semester}
                </h3>
                <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 12px", borderRadius: 20, background: "#dcfce7", color: "#166534" }}>
                  {pct}% overall
                </span>
                {hasArrears && (
                  <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 12px", borderRadius: 20, background: "#fee2e2", color: "#b91c1c" }}>
                    Has Arrears
                  </span>
                )}
              </div>

              <table className="att-table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th style={{ textAlign: "center" }}>Max</th>
                    <th style={{ textAlign: "center" }}>Scored</th>
                    <th style={{ textAlign: "center" }}>Grade</th>
                    <th style={{ textAlign: "center" }}>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id}>
                      <td>{e.subject_name || "—"}</td>
                      <td style={{ textAlign: "center" }}>{e.max_marks ?? "—"}</td>
                      <td style={{ textAlign: "center", fontWeight: 700 }}>{e.marks_obtained ?? "—"}</td>
                      <td style={{ textAlign: "center", fontWeight: 700 }}>{e.grade || "—"}</td>
                      <td style={{ textAlign: "center" }}>
                        <span style={{ color: e.is_pass ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
                          {e.is_pass ? "Pass" : "Fail"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })
      )}
    </div>
  );
}
