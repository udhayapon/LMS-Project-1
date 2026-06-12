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
  const [editingUser, setEditingUser] = useState(null);
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [search, setSearch] = useState("");

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

  // ================= LOAD =================
  useEffect(() => {
    fetchUsers();
    fetchDepartments();
    fetchCourses();
  }, []);

  // ================= FETCH USERS =================
  const fetchUsers = async () => {
    try {
      const res = await API.get("users/");
      const data = res.data?.results || res.data;
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      alert("Failed to load students");
    }
  };

  // ================= FETCH DEPARTMENTS =================
  const fetchDepartments = async () => {
    try {
      const res = await API.get("users/departments/");
      const data = res.data?.results || res.data;
      setDepartments(Array.isArray(data) ? data : []);
    } catch {
      alert("Failed to load departments");
    }
  };

  // ================= FETCH COURSES =================
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

  // ================= EDIT =================
  const handleEdit = (u) => {
    setEditingUser(u);
    setNewUser({
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

  // ================= RESET FORM =================
  const resetForm = () => {
    setNewUser({
      username: "",
      password: "",
      email: "",
      role: "student",
      department: "",
      course: "",
      year: "",
      semester: ""
    });
  };

  // ================= CANCEL =================
  const handleCancelEdit = () => {
    setEditingUser(null);
    resetForm();
  };

  // ================= UPDATE =================
  const handleUpdateStudent = async () => {
    try {
      const payload = { ...newUser };
      if (!payload.password) delete payload.password;
      await API.patch(`users/${editingUser.id}/`, payload);
      fetchUsers();
      handleCancelEdit();
      alert("Student updated");
    } catch (err) {
      const errorData = err.response?.data;
      if (errorData?.email) alert("Email already exists");
      else if (errorData?.username) alert("Username already exists");
      else alert("Update failed");
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

           

            {/* ================= FORM ================= */}
            <div className="card">
              <h3>{editingUser ? "Edit Student" : "Add Student"}</h3>
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
                  placeholder={editingUser ? "New Password (optional)" : "Password"}
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
                <button
                  className="btn-primary"
                  onClick={editingUser ? handleUpdateStudent : handleAddStudent}
                >
                  {editingUser ? "Update Student" : "Create Student"}
                </button>
                {editingUser && (
                  <button className="btn-delete" onClick={handleCancelEdit}>Cancel</button>
                )}
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
                            <button className="btn-edit" onClick={() => handleEdit(u)}>Edit</button>
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
    </div>
  );
}