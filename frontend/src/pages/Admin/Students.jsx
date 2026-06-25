import { useEffect, useState } from "react";

import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";
import API from "../../api";

import "../../App.css";

export default function Students() {

  // ================= STATES =================
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);

  // collapsible panels
  const [showBulk, setShowBulk] = useState(false);
  const [showPromote, setShowPromote] = useState(false);

  // promote states
  const [promoteCourse, setPromoteCourse] = useState("");
  const [promoteYear, setPromoteYear] = useState("");
  const [promoteSemester, setPromoteSemester] = useState("");
  const [promoting, setPromoting] = useState(false);

  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    email: "",
    role: "student",
    department: "",
    course: "",
    year: "",
    semester: ""
  });

  // ================= EDIT POPUP STATE =================
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({
    username: "",
    password: "",
    email: "",
    role: "student",
    department: "",
    course: "",
    year: "",
    semester: ""
  });

  // ================= LOAD =================
  useEffect(() => {
    fetchUsers();
    fetchDepartments();
    fetchCourses();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await API.get("users/");
      const data = res.data?.results || res.data;
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      alert("Failed to load students");
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await API.get("users/departments/");
      const data = res.data?.results || res.data;
      setDepartments(Array.isArray(data) ? data : []);
    } catch {
      alert("Failed to load departments");
    }
  };

  const fetchCourses = async () => {
    try {
      const res = await API.get("courses/");
      const data = res.data?.results || res.data;
      setCourses(Array.isArray(data) ? data : []);
    } catch {
      alert("Failed to load courses");
    }
  };

  // ================= ADD STUDENT =================
  const handleAddStudent = async () => {
    if (
      !newUser.username || !newUser.password || !newUser.email ||
      !newUser.department || !newUser.course || !newUser.year || !newUser.semester
    ) {
      return alert("Fill all fields");
    }
    try {
      const res = await API.post("users/", newUser);
      setUsers([...users, res.data]);
      resetForm();
      alert("Student created");
    } catch (err) {
      const errorData = err.response?.data;
      if (errorData?.email) alert("Email already exists");
      else if (errorData?.username) alert("Username already exists");
      else alert("Something went wrong");
    }
  };

  // ================= DELETE =================
  const handleDelete = async (id) => {
    if (!window.confirm("Delete student?")) return;
    try {
      await API.delete(`users/${id}/`);
      setUsers(users.filter((u) => u.id !== id));
      alert("Student deleted");
    } catch {
      alert("Delete failed");
    }
  };

  // ================= OPEN EDIT POPUP =================
  const openEdit = (u) => {
    setEditing(u);
    setEditForm({
      username: u.username,
      password: "",
      email: u.email || "",
      role: "student",
      department: u.department || "",
      course: u.course || "",
      year: u.year || "",
      semester: u.semester || ""
    });
  };

  const closeEdit = () => {
    setEditing(null);
    setEditForm({
      username: "", password: "", email: "", role: "student",
      department: "", course: "", year: "", semester: ""
    });
  };

  // ================= RESET FORM =================
  const resetForm = () => {
    setNewUser({
      username: "", password: "", email: "", role: "student",
      department: "", course: "", year: "", semester: ""
    });
  };

  // ================= UPDATE =================
  const saveEdit = async () => {
    if (
      !editForm.username || !editForm.email ||
      !editForm.department || !editForm.course || !editForm.year || !editForm.semester
    ) {
      return alert("Fill all fields");
    }
    try {
      const payload = { ...editForm };
      if (!payload.password) delete payload.password;
      await API.patch(`users/${editing.id}/`, payload);
      fetchUsers();
      closeEdit();
      alert("Student updated");
    } catch (err) {
      const errorData = err.response?.data;
      if (errorData?.email) alert("Email already exists");
      else if (errorData?.username) alert("Username already exists");
      else alert("Update failed");
    }
  };

  // ================= CSV: DOWNLOAD TEMPLATE =================
  const downloadTemplate = async () => {
    try {
      const res = await API.get("users/student-template/", { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "student-admission-template.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Could not download template.");
    }
  };

  // ================= CSV: UPLOAD + DOWNLOAD CREDENTIALS =================
  const uploadCSV = async (file) => {
    if (!file) return;
    setImporting(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await API.post("users/student-import/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const { message, created, errors } = res.data;
      alert(message + (errors?.length ? "\n\n" + errors.slice(0, 10).join("\n") : ""));

      if (created?.length) {
        const header = "username,roll_number,email,password\n";
        const rows = created.map(
          (c) => `${c.username},${c.roll_number},${c.email},${c.password}`
        );
        const blob = new Blob([header + rows.join("\n")], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "student-credentials.csv";
        a.click();
        URL.revokeObjectURL(url);
      }
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.detail || "Could not import CSV.");
    } finally {
      setImporting(false);
    }
  };

  // ================= PROMOTE STUDENTS =================
  const handlePromote = async () => {
    if (!promoteCourse || !promoteYear || !promoteSemester) {
      return alert("Select course, year and semester to promote.");
    }
    const courseName = courses.find((c) => String(c.id) === String(promoteCourse))?.name || "this course";
    const nextSem = Number(promoteSemester) + 1;
    if (Number(promoteSemester) >= 8) {
      return alert("Semester 8 is the final semester — these students cannot be promoted further.");
    }
    if (!window.confirm(
      `Promote all students in ${courseName}, Year ${promoteYear}, Semester ${promoteSemester} ` +
      `to Semester ${nextSem}?\n\nThis changes their year/semester. Their past results and marks are kept.`
    )) return;

    setPromoting(true);
    try {
      const res = await API.post("users/promote-students/", {
        course: promoteCourse,
        year: promoteYear,
        semester: promoteSemester,
      });
      alert(res.data?.detail || "Promotion complete.");
      setPromoteCourse(""); setPromoteYear(""); setPromoteSemester("");
      setShowPromote(false);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.detail || "Could not promote students.");
    } finally {
      setPromoting(false);
    }
  };

  // ================= FILTER =================
  const filteredUsers = users.filter((u) => {
    if (u.role !== "student") return false;
    const deptMatch =
      departmentFilter === "all" ||
      Number(u.department) === Number(departmentFilter);
    const searchMatch = u.username.toLowerCase().includes(search.toLowerCase());
    return deptMatch && searchMatch;
  });

  const totalStudents = users.filter((u) => u.role === "student").length;

  return (
    <div className="app">
      <Navbar setOpen={setOpen} />
      <div className="layout">
        <Sidebar open={open} setOpen={setOpen} />
        <div className="main">

          <div className="content">

            {/* ================= HEADER ================= */}
            <div className="header-box">
              <h2>Student Management</h2>
              <p>Manage student records</p>
            </div>

            {/* ================= ACTION BUTTONS ================= */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button
                onClick={() => { setShowBulk((v) => !v); setShowPromote(false); }}
                style={{ ...csvBtn, ...(showBulk ? activeBtn : {}) }}
              >
                ⬆ Bulk Admission (CSV)
              </button>
              <button
                onClick={() => { setShowPromote((v) => !v); setShowBulk(false); }}
                style={{ ...csvBtn, ...(showPromote ? activeBtn : {}) }}
              >
                ↑ Promote to Next Semester
              </button>
            </div>

            {/* ================= BULK CSV PANEL ================= */}
            {showBulk && (
              <div className="card" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <strong style={{ fontSize: 14, color: "#0f172a" }}>Bulk Admission (CSV):</strong>
                <button onClick={downloadTemplate} style={csvBtn}>
                  ⬇ Download Template
                </button>
                <label style={{ ...csvBtn, margin: 0 }}>
                  {importing ? "Importing…" : "⬆ Upload CSV"}
                  <input
                    type="file"
                    accept=".csv"
                    style={{ display: "none" }}
                    disabled={importing}
                    onChange={(e) => { uploadCSV(e.target.files[0]); e.target.value = ""; }}
                  />
                </label>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  Fill department &amp; course by name. After upload, a credentials file downloads — distribute it to students.
                </span>
              </div>
            )}

            {/* ================= PROMOTE PANEL ================= */}
            {showPromote && (
              <div className="card" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <strong style={{ fontSize: 14, color: "#0f172a" }}>Promote to Next Semester:</strong>

                <select value={promoteCourse} onChange={(e) => setPromoteCourse(e.target.value)} style={{ minWidth: 160 }}>
                  <option value="">Select Course</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                <select value={promoteYear} onChange={(e) => setPromoteYear(e.target.value)} style={{ minWidth: 110 }}>
                  <option value="">Year</option>
                  {[1, 2, 3, 4].map((y) => <option key={y} value={y}>Year {y}</option>)}
                </select>

                <select value={promoteSemester} onChange={(e) => setPromoteSemester(e.target.value)} style={{ minWidth: 130 }}>
                  <option value="">Semester</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => <option key={s} value={s}>Semester {s}</option>)}
                </select>

                <button
                  onClick={handlePromote}
                  disabled={promoting}
                  style={{ ...csvBtn, background: "#0f172a", color: "#fff", border: "none" }}
                >
                  {promoting ? "Promoting…" : "↑ Promote"}
                </button>

                <span style={{ fontSize: 12, color: "#64748b" }}>
                  Moves the whole class up one semester. Past results &amp; marks are kept.
                </span>
              </div>
            )}

            {/* ================= ADD FORM ================= */}
            <div className="card">
              <h3>Add Student</h3>
              <div className="form-grid">
                <input
                  placeholder="Username"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                />
                <select
                  value={newUser.department}
                  onChange={(e) => setNewUser({ ...newUser, department: Number(e.target.value) })}
                >
                  <option value="">Select Department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <select
                  value={newUser.course}
                  onChange={(e) => setNewUser({ ...newUser, course: Number(e.target.value) })}
                >
                  <option value="">Select Course</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <select
                  value={newUser.year}
                  onChange={(e) => setNewUser({ ...newUser, year: Number(e.target.value) })}
                >
                  <option value="">Select Year</option>
                  <option value="1">Year 1</option>
                  <option value="2">Year 2</option>
                  <option value="3">Year 3</option>
                  <option value="4">Year 4</option>
                </select>
                <select
                  value={newUser.semester}
                  onChange={(e) => setNewUser({ ...newUser, semester: Number(e.target.value) })}
                >
                  <option value="">Select Semester</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                    <option key={s} value={s}>Semester {s}</option>
                  ))}
                </select>
                <button className="btn-primary" onClick={handleAddStudent}>
                  Create Student
                </button>
              </div>
            </div>

            {/* ================= TABLE ================= */}
            <div className="card">
              {/* ================= FILTERS ================= */}
              <div className="top-filters" style={{ alignItems: "center" }}>

                <input
                  className="search-box"
                  placeholder="Search Student..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />

                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                >
                  <option value="all">All Departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>

                <span style={{ marginLeft: "auto", fontSize: "14px", color: "#64748b" }}>
                  Showing {filteredUsers.length} of {totalStudents}
                </span>

              </div>

              <div className="table-container">

                <table>
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Roll No</th>
                      <th>Department</th>
                      <th>Course</th>
                      <th>Year</th>
                      <th>Semester</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <tr key={u.id}>
                        <td>{u.username}</td>
                        <td>{u.roll_number}</td>
                        <td>{u.department_name || "-"}</td>
                        <td>{u.course_name || "-"}</td>
                        <td>{u.year ? `Year ${u.year}` : "-"}</td>
                        <td>{u.semester ? `Semester ${u.semester}` : "-"}</td>
                        <td>
                          <div className="action-buttons">
                            <button className="btn-edit" onClick={() => openEdit(u)}>Edit</button>
                            <button className="btn-delete" onClick={() => handleDelete(u.id)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan="7" style={{ textAlign: "center" }}>No students found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ================= EDIT POPUP ================= */}
      {editing && (
        <div
          onClick={closeEdit}
          style={{
            position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: 14, width: 460, maxWidth: "92%",
              maxHeight: "88vh", overflowY: "auto",
              padding: "24px 24px 20px", boxShadow: "0 20px 50px rgba(0,0,0,.25)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>Edit student</h3>
              <span onClick={closeEdit} style={{ cursor: "pointer", fontSize: 20, color: "#64748b" }}>×</span>
            </div>
            <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 18px" }}>
              Update this student's details
            </p>

            <div style={{ marginBottom: 14 }}>
              <div style={lbl}>Username</div>
              <input value={editForm.username}
                onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                style={{ width: "100%" }} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={lbl}>Email</div>
              <input value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                style={{ width: "100%" }} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={lbl}>Department</div>
              <select value={editForm.department}
                onChange={(e) => setEditForm({ ...editForm, department: Number(e.target.value) })}
                style={{ width: "100%" }}>
                <option value="">Select Department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={lbl}>Course</div>
              <select value={editForm.course}
                onChange={(e) => setEditForm({ ...editForm, course: Number(e.target.value) })}
                style={{ width: "100%" }}>
                <option value="">Select Course</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={lbl}>Year</div>
                <select value={editForm.year}
                  onChange={(e) => setEditForm({ ...editForm, year: Number(e.target.value) })}
                  style={{ width: "100%" }}>
                  <option value="">Year</option>
                  {[1, 2, 3, 4].map((y) => <option key={y} value={y}>Year {y}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <div style={lbl}>Semester</div>
                <select value={editForm.semester}
                  onChange={(e) => setEditForm({ ...editForm, semester: Number(e.target.value) })}
                  style={{ width: "100%" }}>
                  <option value="">Semester</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => <option key={s} value={s}>Sem {s}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={lbl}>New password <span style={{ color: "#94a3b8" }}>(leave blank to keep current)</span></div>
              <input type="password" placeholder="••••••••"
                value={editForm.password}
                onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                style={{ width: "100%" }} />
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn-delete" style={{ padding: "9px 18px" }} onClick={closeEdit}>
                Cancel
              </button>
              <button className="btn-primary" style={{ padding: "9px 18px" }} onClick={saveEdit}>
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// clean outline button — matches the semester results style
const csvBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "#ffffff",
  color: "#334155",
  border: "1px solid #d8dee9",
  borderRadius: 10,
  padding: "10px 18px",
  fontSize: 13.5,
  fontWeight: 600,
  cursor: "pointer",
};

// active (open) state for the toggle buttons
const activeBtn = {
  background: "#0f172a",
  color: "#fff",
  border: "1px solid #0f172a",
};

// label style for popup fields
const lbl = {
  fontSize: 13,
  color: "#64748b",
  marginBottom: 6,
};