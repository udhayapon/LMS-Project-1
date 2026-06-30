import { useEffect, useState } from "react";

import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";
import API from "../../api";

import "../../App.css";

const ADMIN_TYPES = [
  { value: "admin", label: "Full Admin (Super Admin)" },
  { value: "accounts_admin", label: "Accounts Admin (Fees)" },
  { value: "exam_admin", label: "Examination Admin (Exams & Results)" },
  { value: "academic_admin", label: "Academic Admin (Courses & Subjects)" },
  { value: "iqac_admin", label: "IQAC Admin (Faculty Participation)" },
];

const ROLE_LABEL = {
  admin: "Full Admin",
  accounts_admin: "Accounts Admin",
  exam_admin: "Examination Admin",
  academic_admin: "Academic Admin",
  iqac_admin: "IQAC Admin",
};

export default function AdminUsers() {

  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState([]);

  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    email: "",
    role: "admin",
  });

  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({
    username: "",
    email: "",
    password: "",
    role: "admin",
  });

  // toast message
  const [toast, setToast] = useState(null); // { text, type }

  const showToast = (text, type = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 2800);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const res = await API.get("users/");
    setUsers(res.data?.results || res.data);
  };

  const handleAddUser = async () => {
    if (!newUser.username || !newUser.password) {
      showToast("Username and password are required.", "error");
      return;
    }
    try {
      await API.post("users/", newUser);
      fetchUsers();
      setNewUser({ username: "", password: "", email: "", role: "admin" });
      showToast("Admin created successfully.");
    } catch (err) {
      showToast(err.response?.data?.detail || "Could not create admin.", "error");
    }
  };

  const openEdit = (u) => {
    setEditing(u);
    setEditForm({
      username: u.username,
      email: u.email || "",
      password: "",
      role: u.role,
    });
  };

  const closeEdit = () => {
    setEditing(null);
    setEditForm({ username: "", email: "", password: "", role: "admin" });
  };

  const saveEdit = async () => {
    if (!editForm.username) {
      showToast("Username is required.", "error");
      return;
    }
    try {
      const payload = {
        username: editForm.username,
        email: editForm.email,
        role: editForm.role,
      };
      if (editForm.password) payload.password = editForm.password;

      await API.put(`users/${editing.id}/`, payload);
      fetchUsers();
      closeEdit();
      showToast("Changes updated successfully.");
    } catch (err) {
      showToast(err.response?.data?.detail || "Could not update admin.", "error");
    }
  };

  const handleDelete = async (u) => {
    if (!window.confirm(`Remove admin "${u.username}"? This cannot be undone.`)) return;
    try {
      await API.delete(`users/${u.id}/`);
      fetchUsers();
      showToast("Admin removed.");
    } catch (err) {
      showToast(err.response?.data?.error || err.response?.data?.detail || "Could not delete admin.", "error");
    }
  };

  const adminRoles = ["admin", "accounts_admin", "exam_admin", "academic_admin", "iqac_admin"];
  const admins = users.filter((u) => adminRoles.includes(u.role));

  return (
    <div className="app">

      <Navbar setOpen={setOpen} />

      <div className="layout">

        <Sidebar open={open} setOpen={setOpen} />

        <div className="main">

          <div className="content">

            <div className="header-box">
              <h2>Admin Management</h2>
            </div>

            <div className="card">
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
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                >
                  {ADMIN_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>

                <button className="btn-primary" onClick={handleAddUser}>
                  Create Admin
                </button>

              </div>
            </div>

            <div className="card">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Type</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map((u) => (
                    <tr key={u.id}>
                      <td>{u.username}</td>
                      <td>{u.email}</td>
                      <td>{ROLE_LABEL[u.role] || u.role}</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button
                          className="btn-primary"
                          style={{ padding: "6px 12px", marginRight: 6 }}
                          onClick={() => openEdit(u)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn-delete"
                          style={{ padding: "6px 12px" }}
                          onClick={() => handleDelete(u)}
                          disabled={u.role === "admin"}
                          title={u.role === "admin" ? "Full Admin cannot be deleted here" : "Remove admin"}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
              <h3 style={{ margin: 0, fontSize: 18 }}>Edit admin</h3>
              <span onClick={closeEdit} style={{ cursor: "pointer", fontSize: 20, color: "#64748b" }}>×</span>
            </div>
            <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 18px" }}>
              Update this admin's details or role
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
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 6 }}>Admin type</div>
              <select
                value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                style={{ width: "100%" }}
              >
                {ADMIN_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
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

      {/* ================= TOAST MESSAGE ================= */}
      {toast && (
        <div
          style={{
            position: "fixed", bottom: 24, right: 24, zIndex: 2000,
            background: toast.type === "error" ? "#7f1d1d" : "#0f3d2e",
            color: "#fff", padding: "14px 20px", borderRadius: 12,
            display: "flex", alignItems: "center", gap: 10,
            boxShadow: "0 12px 30px rgba(0,0,0,.25)",
          }}
        >
          <span
            style={{
              width: 24, height: 24, borderRadius: "50%",
              background: toast.type === "error" ? "#dc2626" : "#16a34a",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
            }}
          >
            {toast.type === "error" ? "!" : "✓"}
          </span>
          <span>{toast.text}</span>
        </div>
      )}

    </div>
  );
}