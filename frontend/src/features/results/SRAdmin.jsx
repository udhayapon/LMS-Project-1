import { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";
import API from "../../api";
import "../../styles/Attendance.css";

// mirror of services.py — preview only; backend recomputes on save
const GRADE_BANDS = [
  [90, "O"], [80, "A+"], [70, "A"], [60, "B+"], [50, "B"], [40, "C"], [0, "F"],
];
const PASS_PERCENT = 40;
const previewGrade = (scored, max) => {
  if (scored === "" || scored == null || !max) return { grade: "—", pass: null };
  const pct = (Number(scored) / Number(max)) * 100;
  const band = GRADE_BANDS.find(([t]) => pct >= t);
  return { grade: band[1], pass: pct >= PASS_PERCENT };
};

export default function SRAdmin({ embedded = false }) {
  const [open, setOpen] = useState(false);

  const [subjects, setSubjects] = useState([]);   // all teaching assignments
  const [selectedCourse, setSelectedCourse] = useState("");
  const [selectedYear, setSelectedYear]     = useState("");
  const [selectedTA, setSelectedTA] = useState("");   // teaching assignment (for subject id + course/year/sem)
  const [maxMarks, setMaxMarks]     = useState(100);

  const [students, setStudents] = useState([]);
  const [marks, setMarks]       = useState({});   // { studentId: value }
  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [importing, setImporting]   = useState(false);

  // ── all teaching assignments ──
  useEffect(() => {
    API.get("/teaching-assignments/").then((res) => {
      setSubjects(res.data?.results || res.data || []);
    });
  }, []);

  // ── cascade lists ──
  const courses = [...new Set(subjects.map((s) => s.course_name))].sort();
  const years = selectedCourse
    ? [...new Set(subjects.filter((s) => s.course_name === selectedCourse).map((s) => s.year_number))].sort((a, b) => a - b)
    : [];
  const filteredSubjects = subjects.filter((s) =>
    (!selectedCourse || s.course_name === selectedCourse) &&
    (!selectedYear || String(s.year_number) === String(selectedYear))
  );

  // the chosen assignment object (gives us subject id + course/year/semester)
  const chosenTA = subjects.find((s) => String(s.id) === String(selectedTA));

  // ── shared roster + existing-marks loader (used on select + after import) ──
  const loadRoster = async () => {
    if (!chosenTA) return;
    setLoading(true);
    try {
      const [stuRes, srRes] = await Promise.all([
        API.get(`/exam-students/?course=${chosenTA.course}&year=${chosenTA.year_number}&semester=${chosenTA.semester}`),
        API.get(`/semester-results/?semester=${chosenTA.semester}`),
      ]);
      const roster = stuRes.data?.results || stuRes.data || [];
      setStudents(roster);

      const results = srRes.data?.results || srRes.data || [];
      const init = {};
      roster.forEach((e) => { init[e.student] = ""; });
      results.forEach((res) => {
        const entry = (res.entries || []).find(
          (en) => en.subject_name === chosenTA.subject_name
        );
        if (entry && entry.marks_obtained != null) {
          init[res.student] = entry.marks_obtained;
          if (entry.max_marks) setMaxMarks(entry.max_marks);
        }
      });
      setMarks(init);
    } finally {
      setLoading(false);
    }
  };

  // ── roster (class-wide) + any existing entries when subject changes ──
  useEffect(() => {
    if (!selectedTA || !chosenTA) { setStudents([]); setMarks({}); return; }
    loadRoster();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTA]);

  const setValue = (studentId, value) => {
    setMarks((prev) => ({ ...prev, [studentId]: value }));
  };

  const saveResults = async () => {
    if (!selectedTA || !chosenTA) return alert("Please select a subject.");
    setSaving(true);
    const records = students.map((e) => ({
      student: e.student,
      marks_obtained: marks[e.student] === "" ? null : Number(marks[e.student]),
    }));
    try {
      await API.post("/semester-results/save_results/", {
        subject: chosenTA.subject,          // subject id from the assignment
        semester: chosenTA.semester,
        max_marks: maxMarks,
        records,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert(err.response?.data?.detail || "Error saving results. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // publish every result for this semester
  const publishSemester = async () => {
    if (!chosenTA) return;
    if (!window.confirm(`Publish all Semester ${chosenTA.semester} results to students?`)) return;
    setPublishing(true);
    try {
      const res = await API.get(`/semester-results/?semester=${chosenTA.semester}`);
      const results = res.data?.results || res.data || [];
      await Promise.all(
        results.map((r) => API.post(`/semester-results/${r.id}/publish/`))
      );
      alert(`Semester ${chosenTA.semester} results published.`);
    } catch (err) {
      alert(err.response?.data?.detail || "Error publishing. Please try again.");
    } finally {
      setPublishing(false);
    }
  };

  // ── CSV: download template (roster + blank marks) ──
  const downloadTemplate = async () => {
    if (!chosenTA) return alert("Please select a subject.");
    try {
      const res = await API.get(
        `/results-template/?course=${chosenTA.course}&year=${chosenTA.year_number}&semester=${chosenTA.semester}&subject=${chosenTA.subject}`,
        { responseType: "blob" }
      );
      const url = URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${chosenTA.subject_name}-sem${chosenTA.semester}-marks.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.response?.data?.detail || "Could not download template.");
    }
  };

  // ── CSV: upload filled marks ──
  const uploadCSV = async (file) => {
    if (!chosenTA || !file) return;
    setImporting(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("subject", chosenTA.subject);
    fd.append("semester", chosenTA.semester);
    fd.append("max_marks", maxMarks);
    try {
      const res = await API.post("/results-import/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      alert(res.data?.message || "Marks imported.");
      await loadRoster();   // reload so imported marks show in the grid
    } catch (err) {
      alert(err.response?.data?.detail || "Could not import CSV. Check the file format.");
    } finally {
      setImporting(false);
    }
  };

  const body = (
    <>
      <div className="att-header">
        <div>
          <h1 className="att-title">Semester Result</h1>
          <p className="att-subtitle">Enter final marks and publish to students</p>
        </div>
      </div>

      <div className="att-card">
        <h2 className="att-card-title">Enter Marks</h2>

        {/* Course → Year → Subject cascade */}
        <div className="att-filter-grid">
          <div className="att-field">
            <label className="att-label">Course</label>
            <select className="att-input" value={selectedCourse}
              onChange={(e) => { setSelectedCourse(e.target.value); setSelectedYear(""); setSelectedTA(""); }}>
              <option value="">— All Courses —</option>
              {courses.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="att-field">
            <label className="att-label">Year</label>
            <select className="att-input" value={selectedYear}
              onChange={(e) => { setSelectedYear(e.target.value); setSelectedTA(""); }}
              disabled={!selectedCourse}>
              <option value="">— All Years —</option>
              {years.map((y) => <option key={y} value={y}>Year {y}</option>)}
            </select>
          </div>
          <div className="att-field">
            <label className="att-label">Subject</label>
            <select className="att-input" value={selectedTA}
              onChange={(e) => setSelectedTA(e.target.value)}>
              <option value="">— Select Subject —</option>
              {filteredSubjects.map((s) => (
                <option key={s.id} value={s.id}>{s.subject_name} (Sem {s.semester})</option>
              ))}
            </select>
          </div>
        </div>

        {/* CSV import/export — visible once a subject is chosen */}
        {selectedTA && (
          <div style={{ display: "flex", gap: 10, alignItems: "center", margin: "4px 0 16px", flexWrap: "wrap" }}>
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
              Download the roster, fill the marks column in Excel, then upload.
            </span>
          </div>
        )}

        {loading ? (
          <div className="att-state"><div className="att-spinner" /><p>Loading students…</p></div>
        ) : !selectedTA ? (
          <div className="att-state"><p>Select a subject above to enter final marks.</p></div>
        ) : students.length === 0 ? (
          <div className="att-state"><p>No students found for this course, year and semester.</p></div>
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
                    <th className="center">Grade</th>
                    <th className="center">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((e, idx) => {
                    const val = marks[e.student] ?? "";
                    const pv = previewGrade(val, maxMarks);
                    return (
                      <tr key={e.student}>
                        <td>{idx + 1}</td>
                        <td className="att-td-name">{e.student_name}</td>
                        <td><span className="att-roll">{e.student_roll_no || "—"}</span></td>
                        <td className="center">
                          <input
                            className="att-input"
                            type="number"
                            min={0}
                            max={maxMarks}
                            style={{ width: 80, textAlign: "center" }}
                            value={val}
                            onChange={(ev) => setValue(e.student, ev.target.value)}
                          />
                        </td>
                        <td className="center"><b>{pv.grade}</b></td>
                        <td className="center">
                          {pv.pass == null ? (
                            <span style={{ color: "#9ca3af" }}>—</span>
                          ) : pv.pass ? (
                            <span style={{ color: "#16a34a", fontSize: 13 }}>Pass</span>
                          ) : (
                            <span style={{ color: "#dc2626", fontSize: 13 }}>Fail</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Save bar */}
            <div className="att-save-bar">
              <button className={`att-save-btn${saving ? " loading" : ""}`}
                onClick={saveResults} disabled={saving}>
                {saving ? "Saving…" : "Save Marks"}
              </button>
              {saved && <span className="att-saved-msg">Marks saved successfully</span>}
            </div>

            {/* Publish bar */}
            <div className="att-save-bar" style={{ marginTop: 8, borderTop: "1px solid #eee", paddingTop: 12 }}>
              <span style={{ fontSize: 13, color: "#6b7280" }}>
                Once all subjects for Semester {chosenTA?.semester} are entered, publish to release results to students.
              </span>
              <button className="att-btn-outline" onClick={publishSemester} disabled={publishing}>
                {publishing ? "Publishing…" : `Publish Semester ${chosenTA?.semester}`}
              </button>
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
            <div className="att-page">{body}</div>
          </div>
        </div>
      </div>
    </div>
  );
}