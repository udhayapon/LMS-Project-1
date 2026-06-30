import { useEffect, useState } from "react";

import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";
import API from "../../api";
import "../../App.css";

const CATEGORIES = [
  { value: "fdp", label: "FDP / Training Attended" },
  { value: "workshop_attended", label: "Workshop / Seminar Attended" },
  { value: "workshop_conducted", label: "Workshop / Seminar Conducted" },
  { value: "conference", label: "Conference Paper Presented" },
  { value: "journal", label: "Journal Publication" },
  { value: "certification", label: "Certification / MOOC (NPTEL etc.)" },
  { value: "guest_lecture", label: "Guest Lecture Delivered" },
  { value: "committee", label: "Committee / Cell Membership" },
  { value: "project", label: "Project / Grant / Consultancy" },
  { value: "other", label: "Other" },
];

const ROLES = [
  { value: "attended", label: "Attended" },
  { value: "conducted", label: "Conducted / Organized" },
  { value: "presented", label: "Presented" },
  { value: "published", label: "Published" },
  { value: "member", label: "Member" },
  { value: "other", label: "Other" },
];

const emptyForm = {
  category: "fdp",
  title: "",
  organizer: "",
  activity_role: "attended",
  date: "",
  academic_year: "",
  proof: null,
};

export default function FacultyContributions() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  const showToast = (msg) => {
    setToast(msg);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(""), 2200);
  };

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const load = async () => {
    setLoading(true);
    try {
      const r = await API.get("users/participation/");
      setItems(r.data || []);
    } catch (err) {
      console.error("Load participation error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const catLabel = (v) => CATEGORIES.find((c) => c.value === v)?.label || v;

  const add = async () => {
    setError("");
    if (!form.title || !form.date) {
      setError("Please fill the title and date.");
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("category", form.category);
      fd.append("title", form.title);
      fd.append("organizer", form.organizer);
      fd.append("activity_role", form.activity_role);
      fd.append("date", form.date);
      fd.append("academic_year", form.academic_year);
      if (form.proof) fd.append("proof", form.proof);

      await API.post("users/participation/add/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setForm(emptyForm);
      // clear the file input element
      const fileInput = document.getElementById("proof-input");
      if (fileInput) fileInput.value = "";
      await load();
      showToast("✓ Added");
    } catch (err) {
      const data = err?.response?.data;
      setError(data?.detail || data?.title?.[0] || data?.date?.[0] || "Could not add. Please check the fields.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    try {
      await API.delete(`users/participation/${id}/delete/`);
      setItems((list) => list.filter((x) => x.id !== id));
      showToast("✓ Removed");
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  return (
    <div className="app">
      <Navbar setOpen={setOpen} />
      <div className="layout">
        <Sidebar open={open} setOpen={setOpen} />
        <div className="main">
          <div className="content">
            <div className="sd-root">

              {toast && (
                <div
                  style={{
                    position: "fixed", top: 24, left: "50%", transform: "translateX(-50%)",
                    zIndex: 1000, background: "#15803d", color: "#fff", fontSize: 14, fontWeight: 600,
                    padding: "11px 22px", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,.22)",
                  }}
                >
                  {toast}
                </div>
              )}

              <h1 className="sd-hello">My Contributions</h1>
              <p className="sd-sub">Record your FDPs, papers, workshops and other activities for IQAC / NAAC.</p>

              {/* ===== ADD FORM ===== */}
              <div className="sd-panel" style={{ marginBottom: 20 }}>
                <div className="sd-pt">Add an activity</div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span className="sd-label">Type</span>
                    <select value={form.category} onChange={(e) => setField("category", e.target.value)}>
                      {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </label>

                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span className="sd-label">Your role</span>
                    <select value={form.activity_role} onChange={(e) => setField("activity_role", e.target.value)}>
                      {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </label>

                  <label style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: "1 / -1" }}>
                    <span className="sd-label">Title</span>
                    <input
                      value={form.title}
                      placeholder="e.g. AI Workshop at IIT Madras"
                      onChange={(e) => setField("title", e.target.value)}
                    />
                  </label>

                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span className="sd-label">Organizer / Venue</span>
                    <input
                      value={form.organizer}
                      placeholder="e.g. IIT Madras"
                      onChange={(e) => setField("organizer", e.target.value)}
                    />
                  </label>

                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span className="sd-label">Date</span>
                    <input type="date" value={form.date} onChange={(e) => setField("date", e.target.value)} />
                  </label>

                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span className="sd-label">Academic year</span>
                    <input
                      value={form.academic_year}
                      placeholder="e.g. 2025-26"
                      onChange={(e) => setField("academic_year", e.target.value)}
                    />
                  </label>

                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span className="sd-label">Proof (certificate / PDF / image)</span>
                    <input
                      id="proof-input"
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => setField("proof", e.target.files?.[0] || null)}
                    />
                  </label>
                </div>

                {error && <div style={{ color: "#dc2626", fontSize: 13, marginTop: 10 }}>{error}</div>}

                <div style={{ marginTop: 14 }}>
                  <button
                    onClick={add}
                    disabled={saving}
                    style={{
                      background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 8,
                      padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: saving ? "default" : "pointer",
                    }}
                  >
                    {saving ? "Adding…" : "Add Activity"}
                  </button>
                </div>
              </div>

              {/* ===== MY LIST ===== */}
              <div className="sd-panel">
                <div className="sd-pt">My activities ({items.length})</div>

                {loading ? (
                  <div className="sd-empty">Loading…</div>
                ) : items.length === 0 ? (
                  <div className="sd-empty">No activities added yet.</div>
                ) : (
                  <table className="sd-tbl">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Type</th>
                        <th>Date</th>
                        <th>Proof</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it) => (
                        <tr key={it.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{it.title}</div>
                            {it.organizer && <div style={{ fontSize: 12, color: "#667085" }}>{it.organizer}</div>}
                          </td>
                          <td>{it.category_label || catLabel(it.category)}</td>
                          <td className="sd-num">{it.date}</td>
                          <td>
                            {it.proof_url ? (
                              <a href={it.proof_url} target="_blank" rel="noreferrer" style={{ color: "#1d4ed8", fontSize: 13 }}>
                                View
                              </a>
                            ) : (
                              <span style={{ color: "#98a2b3", fontSize: 13 }}>—</span>
                            )}
                          </td>
                          <td className="sd-num">
                            <button
                              onClick={() => remove(it.id)}
                              style={{
                                background: "#fff", color: "#dc2626", border: "1px solid #fecaca",
                                borderRadius: 8, padding: "5px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                              }}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}