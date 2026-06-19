import { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";
import API from "../../api";
import "../../styles/Attendance.css";

const IA_NUMBERS = [
  { num: 1, label: "IA 1" },
  { num: 2, label: "IA 2" },
  { num: 3, label: "IA 3" },
];

export default function IATeacher({ embedded = false }) {
  const [open, setOpen] = useState(false);

  const [subjects, setSubjects]     = useState([]);
  const [selectedTA, setSelectedTA] = useState("");
  const [iaNumber, setIaNumber]     = useState(1);
  const [maxMarks, setMaxMarks]     = useState(50);

  const [students, setStudents]     = useState([]);
  const [marks, setMarks]           = useState({}); // { studentId: { value, absent } }
  const [isLocked, setIsLocked]     = useState(false);

  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [importing, setImporting]   = useState(false);

  // ── teacher's own subjects ──
  useEffect(() => {
    API.get("/teaching-assignments/?my=true").then((res) => {
      setSubjects(res.data?.results || res.data || []);
    });
  }, []);

  // ── roster when subject changes ──
  useEffect(() => {
    if (!selectedTA) { setStudents([]); setMarks({}); return; }
    setLoading(true);
    API.get(`/enrollments/?teaching_assignment=${selectedTA}`)
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
        setStudents(data);
      })
      .finally(() => setLoading(false));
  }, [selectedTA]);

  // ── existing marks + lock state when subject/IA/roster changes ──
  const loadMarks = () => {
    if (!selectedTA || students.length === 0) return;

    const init = {};
    students.forEach((e) => { init[e.student] = { value: "", absent: false }; });

    API.get(`/internal-assessments/?teaching_assignment=${selectedTA}`)
      .then((res) => {
        const slots = res.data?.results || res.data || [];
        const slot = slots.find((s) => Number(s.number) === Number(iaNumber));
        if (slot) {
          setIsLocked(!!slot.is_locked);
          setMaxMarks(slot.max_marks || 50);
          (slot.marks || []).forEach((m) => {
            init[m.student] = {
              value: m.marks_obtained ?? "",
              absent: !!m.is_absent,
            };
          });
        } else {
          setIsLocked(false);
          setMaxMarks(50);
        }
        setMarks(init);
      });
  };

  useEffect(() => {
    loadMarks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTA, iaNumber, students]);

  const setValue = (studentId, value) => {
    setMarks((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], value },
    }));
  };

  const toggleAbsent = (studentId) => {
    setMarks((prev) => {
      const cur = prev[studentId] || { value: "", absent: false };
      const absent = !cur.absent;
      return { ...prev, [studentId]: { value: absent ? "" : cur.value, absent } };
    });
  };

  const saveMarks = async () => {
    if (!selectedTA) return alert("Please select a subject.");
    if (isLocked) return;
    setSaving(true);
    const records = students.map((e) => {
      const cell = marks[e.student] || {};
      return {
        student: e.student,
        is_absent: !!cell.absent,
        marks_obtained:
          cell.absent || cell.value === "" || cell.value == null
            ? null
            : Number(cell.value),
      };
    });
    try {
      await API.post("/internal-assessments/save_marks/", {
        teaching_assignment: selectedTA,
        number: iaNumber,
        max_marks: maxMarks,
        records,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert(err.response?.data?.detail || "Error saving marks. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── CSV: download template ──
  const downloadTemplate = async () => {
    if (!selectedTA) return alert("Please select a subject.");
    try {
      const res = await API.get(
        `/ia-template/?teaching_assignment=${selectedTA}`,
        { responseType: "blob" }
      );
      const url = URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `ia${iaNumber}-marks.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.response?.data?.detail || "Could not download template.");
    }
  };

  // ── CSV: upload filled marks ──
  const uploadCSV = async (file) => {
    if (!selectedTA || !file) return;
    if (isLocked) return alert("This IA is locked.");
    setImporting(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("teaching_assignment", selectedTA);
    fd.append("number", iaNumber);
    fd.append("max_marks", maxMarks);
    try {
      const res = await API.post("/ia-import/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      alert(res.data?.message || "Marks imported.");
      loadMarks();   // reload grid so imported marks show
    } catch (err) {
      alert(err.response?.data?.detail || "Could not import CSV. Check the file format.");
    } finally {
      setImporting(false);
    }
  };

  // summary
  const entered = students.filter((e) => {
    const c = marks[e.student];
    return c && !c.absent && c.value !== "" && c.value != null;
  }).length;
  const absentCount = students.filter((e) => marks[e.student]?.absent).length;
  const avg = (() => {
    const vals = students
      .map((e) => marks[e.student])
      .filter((c) => c && !c.absent && c.value !== "" && c.value != null)
      .map((c) => (Number(c.value) / maxMarks) * 100);
    if (!vals.length) return null;
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
  })();

  const body = (
    <>
      <div className="att-header">
        <div>
          <h1 className="att-title">Internal Assessment</h1>
          <p className="att-subtitle">Enter IA marks for your subjects</p>
        </div>
      </div>

      <div className="att-card">
        <h2 className="att-card-title">Enter Marks</h2>

        {/* Filters */}
        <div className="att-filter-grid">
          <div className="att-field">
            <label className="att-label">Subject</label>
            <select
              className="att-input"
              value={selectedTA}
              onChange={(e) => setSelectedTA(e.target.value)}
            >
              <option value="">— Select Subject —</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.subject_name} — {s.course_name} (Year {s.year_number}, Sem {s.semester})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* IA selector */}
        <div className="att-tabs" style={{ marginTop: 4 }}>
          {IA_NUMBERS.map((ia) => (
            <button
              key={ia.num}
              className={`att-tab${iaNumber === ia.num ? " active" : ""}`}
              onClick={() => setIaNumber(ia.num)}
            >
              {ia.label}
            </button>
          ))}
        </div>

        {/* CSV import/export — visible once a subject is chosen and not locked */}
        {selectedTA && !isLocked && (
          <div style={{ display: "flex", gap: 10, alignItems: "center", margin: "8px 0 4px", flexWrap: "wrap" }}>
            <button className="att-btn-outline" onClick={downloadTemplate}>
              ⬇ Download Template
            </button>
            <label className="att-btn-outline" style={{ cursor: "pointer", margin: 0 }}>
              {importing ? "Importing…" : "⬆ Upload CSV"}
              <input
                type="file"
                accept=".csv"
                style={{ display: "none" }}
                disabled={importing}
                onChange={(e) => { uploadCSV(e.target.files[0]); e.target.value = ""; }}
              />
            </label>
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              Download the roster, fill the marks column in Excel, then upload. (Blank = absent)
            </span>
          </div>
        )}

        {/* Lock banner */}
        {isLocked && (
          <div className="att-state" style={{ color: "#b45309" }}>
            <p>This IA is locked by admin and declared to students — entry is read-only.</p>
          </div>
        )}

        {/* States / table */}
        {loading ? (
          <div className="att-state"><div className="att-spinner" /><p>Loading students…</p></div>
        ) : !selectedTA ? (
          <div className="att-state"><p>Select a subject above to enter marks.</p></div>
        ) : students.length === 0 ? (
          <div className="att-state"><p>No students enrolled in this subject.</p></div>
        ) : (
          <>
            <div className="att-table-wrap">
              <table className="att-table">
                <thead>
                  <tr>
                    <th>Sl.No</th>
                    <th>Student Name</th>
                    <th>Roll No</th>
                    <th className="center">Marks / {maxMarks}</th>
                    <th className="center">Absent</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((e, idx) => {
                    const cell = marks[e.student] || { value: "", absent: false };
                    return (
                      <tr key={e.id}>
                        <td>{idx + 1}</td>
                        <td className="att-td-name">{e.student_name}</td>
                        <td><span className="att-roll">{e.student_roll_no || "—"}</span></td>
                        <td className="center">
                          {cell.absent ? (
                            <span style={{ color: "#9ca3af", fontWeight: 600 }}>AB</span>
                          ) : (
                            <input
                              className="att-input"
                              type="number"
                              min={0}
                              max={maxMarks}
                              style={{ width: 80, textAlign: "center" }}
                              disabled={isLocked}
                              value={cell.value}
                              onChange={(ev) => setValue(e.student, ev.target.value)}
                            />
                          )}
                        </td>
                        <td className="center">
                          <button
                            className={`att-status-btn absent${cell.absent ? " active" : ""}`}
                            disabled={isLocked}
                            onClick={() => toggleAbsent(e.student)}
                          >
                            AB
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Summary */}
            <div className="att-summary-row">
              <span className="att-chip present">{entered} Entered</span>
              <span className="att-chip duty">{avg != null ? `${avg}% Avg` : "—"}</span>
              <span className="att-chip absent">{absentCount} Absent</span>
            </div>

            {/* Save bar */}
            <div className="att-save-bar">
              <button
                className={`att-save-btn${saving ? " loading" : ""}`}
                onClick={saveMarks}
                disabled={saving || isLocked}
              >
                {saving ? "Saving…" : "Save Marks"}
              </button>
              {saved && <span className="att-saved-msg">Marks saved successfully</span>}
            </div>
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
            <div className="att-page">
              {body}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}