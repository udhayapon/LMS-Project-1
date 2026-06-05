import { useEffect, useState } from "react";

import API from "../../api";

// A panel rendered INSIDE TimetableBuilder (which provides Navbar/Sidebar/layout).
export default function PeriodsPanel({ onChanged }) {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // add form
  const [form, setForm] = useState({
    type: "class",
    period_no: "",
    label: "",
    start_time: "",
    end_time: "",
  });
  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // inline edit
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({
    type: "class",
    period_no: "",
    label: "",
    start_time: "",
    end_time: "",
  });
  const setEditField = (k, v) => setEditForm((f) => ({ ...f, [k]: v }));

  const fetchSlots = async () => {
    try {
      const res = await API.get("/timeslots/");
      setSlots(res.data || []);
    } catch (err) {
      console.error("Load periods error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSlots();
  }, []);

  const addSlot = async () => {
    setError("");
    if (!form.period_no || !form.start_time || !form.end_time) {
      setError("Please fill the period number, start time and end time.");
      return;
    }
    setSaving(true);
    try {
      await API.post("/timeslots/", {
        period_no: Number(form.period_no),
        start_time: form.start_time,
        end_time: form.end_time,
        label: form.type === "break" ? form.label || "Break" : "",
        is_break: form.type === "break",
      });
      setForm({ type: "class", period_no: "", label: "", start_time: "", end_time: "" });
      fetchSlots();
      onChanged && onChanged();
      alert("Period added");
    } catch (err) {
      const data = err?.response?.data;
      setError(
        data?.period_no?.[0] ||
          data?.detail ||
          "Could not add. A period with that number may already exist."
      );
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (s) => {
    setError("");
    setEditId(s.id);
    setEditForm({
      type: s.is_break ? "break" : "class",
      period_no: s.period_no,
      label: s.label || "",
      start_time: String(s.start_time).slice(0, 5),
      end_time: String(s.end_time).slice(0, 5),
    });
  };

  const cancelEdit = () => {
    setEditId(null);
  };

  const saveEdit = async (id) => {
    setError("");
    if (!editForm.period_no || !editForm.start_time || !editForm.end_time) {
      setError("Please fill the period number, start time and end time.");
      return;
    }
    try {
      await API.put(`/timeslots/${id}/`, {
        period_no: Number(editForm.period_no),
        start_time: editForm.start_time,
        end_time: editForm.end_time,
        label: editForm.type === "break" ? editForm.label || "Break" : "",
        is_break: editForm.type === "break",
      });
      setEditId(null);
      fetchSlots();
      onChanged && onChanged();
      alert("Period updated");
    } catch (err) {
      const data = err?.response?.data;
      setError(data?.period_no?.[0] || data?.detail || "Could not save changes.");
    }
  };

  const removeSlot = async (id) => {
    try {
      await API.delete(`/timeslots/${id}/`);
      setSlots((list) => list.filter((s) => s.id !== id));
      onChanged && onChanged();
      alert("Period deleted");
    } catch (err) {
      console.error("Delete period error:", err);
      setError("Could not delete this period.");
    }
  };

  const fmt = (t) => {
    if (!t) return "";
    const [h, m] = String(t).split(":");
    let hour = parseInt(h, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;
    return `${hour}:${m} ${ampm}`;
  };

  return (
    <div>
      {/* ADD */}
      <div className="tb-card">
        <h3 className="tb-card-title">Add a period</h3>

        <div className="tb-form">
          <label className="tb-field">
            <span>Type</span>
            <select value={form.type} onChange={(e) => setField("type", e.target.value)}>
              <option value="class">Class</option>
              <option value="break">Break / Lunch</option>
            </select>
          </label>

          <label className="tb-field">
            <span>Period No.</span>
            <input
              type="number"
              min="1"
              value={form.period_no}
              placeholder="e.g. 1"
              onChange={(e) => setField("period_no", e.target.value)}
            />
          </label>

          {form.type === "break" && (
            <label className="tb-field">
              <span>Label</span>
              <input
                value={form.label}
                placeholder="e.g. Lunch"
                onChange={(e) => setField("label", e.target.value)}
              />
            </label>
          )}

          <label className="tb-field">
            <span>Start</span>
            <input type="time" value={form.start_time} onChange={(e) => setField("start_time", e.target.value)} />
          </label>

          <label className="tb-field">
            <span>End</span>
            <input type="time" value={form.end_time} onChange={(e) => setField("end_time", e.target.value)} />
          </label>

          <button className="tb-btn" onClick={addSlot} disabled={saving}>
            {saving ? "Adding…" : "Add Period"}
          </button>
        </div>

        {error && <div className="tb-error">{error}</div>}
        <p className="tb-hint">
          Give breaks/lunch a period number too, so they sit in the right place in the daily order.
        </p>
      </div>

      {/* LIST */}
      <div className="tb-card">
        <h3 className="tb-card-title">Current schedule</h3>
        {loading ? (
          <p className="tb-state">Loading…</p>
        ) : slots.length === 0 ? (
          <p className="tb-state">No periods yet. Add your first one above.</p>
        ) : (
          <table className="tb-list">
            <thead>
              <tr>
                <th>Period</th>
                <th>Time</th>
                <th>Type</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {slots.map((s) =>
                editId === s.id ? (
                  /* ----- INLINE EDIT ROW ----- */
                  <tr key={s.id}>
                    <td>
                      <div className="tb-edit-cell">
                        <select
                          value={editForm.type}
                          onChange={(e) => setEditField("type", e.target.value)}
                        >
                          <option value="class">Class</option>
                          <option value="break">Break / Lunch</option>
                        </select>
                        <input
                          type="number"
                          min="1"
                          value={editForm.period_no}
                          onChange={(e) => setEditField("period_no", e.target.value)}
                          style={{ width: "70px" }}
                        />
                        {editForm.type === "break" && (
                          <input
                            value={editForm.label}
                            placeholder="Label"
                            onChange={(e) => setEditField("label", e.target.value)}
                            style={{ width: "110px" }}
                          />
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="tb-edit-cell">
                        <input
                          type="time"
                          value={editForm.start_time}
                          onChange={(e) => setEditField("start_time", e.target.value)}
                        />
                        <input
                          type="time"
                          value={editForm.end_time}
                          onChange={(e) => setEditField("end_time", e.target.value)}
                        />
                      </div>
                    </td>
                    <td>
                      {editForm.type === "break"
                        ? <span className="tb-pill brk">Break</span>
                        : <span className="tb-pill cls">Class</span>}
                    </td>
                    <td className="tb-right">
                      <div className="tb-actions">
                        <button className="tb-btn tb-btn-sm" onClick={() => saveEdit(s.id)}>Save</button>
                        <button className="tb-cancel" onClick={cancelEdit}>Cancel</button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  /* ----- NORMAL ROW ----- */
                  <tr key={s.id}>
                    <td><strong>{s.is_break ? s.label || "Break" : `Period ${s.period_no}`}</strong></td>
                    <td>{fmt(s.start_time)} – {fmt(s.end_time)}</td>
                    <td>
                      {s.is_break
                        ? <span className="tb-pill brk">Break</span>
                        : <span className="tb-pill cls">Class</span>}
                    </td>
                    <td className="tb-right">
                      <div className="tb-actions">
                        <button className="tb-edit" onClick={() => startEdit(s)}>Edit</button>
                        <button className="tb-del" onClick={() => removeSlot(s.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}