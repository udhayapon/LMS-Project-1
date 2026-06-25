import { useEffect, useState } from "react";

import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";
import API from "../../api";

import "../../App.css";

export default function Teachers() {

  // ================= STATES =================
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");

  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    email: "",
    role: "teacher",
    department: ""
  });

  // ================= EDIT POPUP STATE =================
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({
    username: "",
    password: "",
    email: "",
    role: "teacher",
    department: ""
  });

  // ================= LOAD =================
  useEffect(() => {
    fetchUsers();
    fetchDepartments();
  }, []);

  // ================= FETCH USERS =================
  const fetchUsers = async () => {
    try {
      const res = await API.get("users/");
      setUsers(res.data?.results || res.data);
    } catch (err) {
      console.log(err);
    }
  };

  // ================= FETCH DEPARTMENTS =================
  const fetchDepartments = async () => {
    try {
      const res = await API.get("users/departments/");
      setDepartments(res.data?.results || res.data);
    } catch (err) {
      console.log(err);
    }
  };

  // ================= ADD TEACHER =================
  const handleAddUser = async () => {
    if (!newUser.username || !newUser.password || !newUser.email || !newUser.department) {
      alert("Please fill all fields");
      return;
    }
    try {
      await API.post("users/", newUser);
      fetchUsers();
      resetForm();
      alert("Teacher created successfully");
    } catch (err) {
      console.log(err.response?.data);
      alert("Could not create teacher");
    }
  };

  // ================= DELETE =================
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this teacher?")) return;
    try {
      await API.delete(`users/${id}/`);
      fetchUsers();
      alert("Teacher removed");
    } catch (err) {
      console.log(err);
      alert("Could not delete teacher");
    }
  };

  // ================= OPEN EDIT POPUP =================
  const openEdit = (u) => {
    setEditing(u);
    setEditForm({
      username: u.username,
      password: "",
      email: u.email || "",
      role: "teacher",
      department: u.department || ""
    });
  };

  const closeEdit = () => {
    setEditing(null);
    setEditForm({ username: "", password: "", email: "", role: "teacher", department: "" });
  };

  // ================= UPDATE =================
  const saveEdit = async () => {
    if (!editForm.username || !editForm.email || !editForm.department) {
      alert("Please fill all fields");
      return;
    }
    try {
      const payload = { ...editForm };
      if (!payload.password) delete payload.password;
      await API.patch(`users/${editing.id}/`, payload);
      fetchUsers();
      closeEdit();
      alert("Teacher updated successfully");
    } catch (err) {
      console.log(err);
      alert("Could not update teacher");
    }
  };

  // ================= RESET =================
  const resetForm = () => {
    setNewUser({
      username: "",
      password: "",
      email: "",
      role: "teacher",
      department: ""
    });
  };

  // ================= FILTER & SORT TEACHERS =================
  const teachers = users
    .filter((u) => {
      if (u.role !== "teacher") return false;
      const searchMatch = u.username.toLowerCase().includes(search.toLowerCase());
      const deptMatch =
        departmentFilter === "all" ||
        String(u.department) === String(departmentFilter);
      return searchMatch && deptMatch;
    })
    .sort((a, b) => {
      const aNum = parseInt((a.employee_id || "").replace("TCH", ""));
      const bNum = parseInt((b.employee_id || "").replace("TCH", ""));
      return aNum - bNum;
    });

  const totalTeachers = users.filter((u) => u.role === "teacher").length;

  return (
    <div className="app">
      <Navbar setOpen={setOpen} />
      <div className="layout">
        <Sidebar open={open} setOpen={setOpen} />
        <div className="main">

          <div className="content">

            {/* ================= HEADER ================= */}
            <div className="header-box">
              <h2>Teacher Management</h2>
              <p>Manage teacher records</p>
            </div>

            {/* ================= ADD FORM ================= */}
            <div className="card">
              <h3>Add Teacher</h3>
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
                <button className="btn-primary" onClick={handleAddUser}>
                  Create Teacher
                </button>
              </div>
            </div>

            {/* ================= TABLE ================= */}
            <div className="card">
              {/* ================= FILTERS ================= */}
              <div className="top-filters" style={{ alignItems: "center" }}>

                <input
                  className="search-box"
                  placeholder="Search Teacher..."
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
                  Showing {teachers.length} of {totalTeachers}
                </span>

              </div>

              <div className="table-container">

                <table>

                  <thead>
                    <tr>
                      <th>Teacher</th>
                      <th>Employee ID</th>
                      <th>Department</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teachers.map((u) => (
                      <tr key={u.id}>
                        <td>{u.username}</td>
                        <td>{u.employee_id}</td>
                        <td>{u.department_name}</td>
                        <td>
                          <div className="action-buttons">
                            <button className="btn-edit" onClick={() => openEdit(u)}>Edit</button>
                            <button className="btn-delete" onClick={() => handleDelete(u.id)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {teachers.length === 0 && (
                      <tr>
                        <td colSpan="4" style={{ textAlign: "center" }}>No teachers found</td>
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
              background: "#fff", borderRadius: 14, width: 420, maxWidth: "90%",
              padding: "24px 24px 20px", boxShadow: "0 20px 50px rgba(0,0,0,.25)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>Edit teacher</h3>
              <span onClick={closeEdit} style={{ cursor: "pointer", fontSize: 20, color: "#64748b" }}>×</span>
            </div>
            <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 18px" }}>
              Update this teacher's details
            </p>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 6 }}>Username</div>
              <input
                value={editForm.username}
                onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                style={{ width: "100%" }}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 6 }}>Email</div>
              <input
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                style={{ width: "100%" }}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 6 }}>Department</div>
              <select
                value={editForm.department}
                onChange={(e) => setEditForm({ ...editForm, department: Number(e.target.value) })}
                style={{ width: "100%" }}
              >
                <option value="">Select Department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 6 }}>
                New password <span style={{ color: "#94a3b8" }}>(leave blank to keep current)</span>
              </div>
              <input
                type="password"
                placeholder="••••••••"
                value={editForm.password}
                onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                style={{ width: "100%" }}
              />
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