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
  const [editingUser, setEditingUser] = useState(null);

  const [newUser, setNewUser] = useState({
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
      alert(JSON.stringify(err.response?.data));
    }
  };

  // ================= DELETE =================
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this teacher?")) return;
    try {
      await API.delete(`users/${id}/`);
      fetchUsers();
    } catch (err) {
      console.log(err);
    }
  };

  // ================= EDIT =================
  const handleEdit = (u) => {
    setEditingUser(u);
    setNewUser({
      username: u.username,
      password: "",
      email: u.email || "",
      role: "teacher",
      department: u.department || ""
    });
  };

  // ================= UPDATE =================
  const handleUpdate = async () => {
    try {
      const payload = { ...newUser };
      if (!payload.password) delete payload.password;
      await API.patch(`users/${editingUser.id}/`, payload);
      fetchUsers();
      resetForm();
      setEditingUser(null);
      alert("Teacher updated successfully");
    } catch (err) {
      console.log(err);
      alert(JSON.stringify(err.response?.data));
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

  // ================= CANCEL =================
  const handleCancel = () => {
    setEditingUser(null);
    resetForm();
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

            
            {/* ================= FORM ================= */}
            <div className="card">
              <h3>{editingUser ? "Edit Teacher" : "Add Teacher"}</h3>
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
                <button
                  className="btn-primary"
                  onClick={editingUser ? handleUpdate : handleAddUser}
                >
                  {editingUser ? "Update Teacher" : "Create Teacher"}
                </button>
                {editingUser && (
                  <button className="btn-delete" onClick={handleCancel}>Cancel</button>
                )}
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
                            <button className="btn-edit" onClick={() => handleEdit(u)}>Edit</button>
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
    </div>
  );
}