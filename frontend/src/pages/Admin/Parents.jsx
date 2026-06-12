import { useEffect, useState } from "react";

import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";
import API from "../../api";

import "../../App.css";

export default function Parents() {

  // ================= STATES =================
  const [open, setOpen] = useState(false);
  const [parents, setParents] = useState([]);
  const [students, setStudents] = useState([]);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [selectedChildren, setSelectedChildren] = useState([]);
  const [childQuery, setChildQuery] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");

  // ================= LOAD =================
  const fetchData = async () => {
    try {
      const res = await API.get("/manage/parents/");
      setParents(res.data?.parents || []);
      setStudents(res.data?.students || []);
    } catch (err) {
      console.log("Parents fetch error:", err);
      alert("Could not load parents");
    }
  };

  useEffect(() => { fetchData(); }, []);

  // ================= RESET =================
  const resetForm = () => {
    setUsername("");
    setPassword("");
    setSelectedChildren([]);
    setChildQuery("");
    setEditingId(null);
  };

  // ================= CREATE =================
  const createParent = async () => {
    if (!username.trim() || !password.trim()) {
      alert("Username and password are required");
      return;
    }
    try {
      await API.post("/manage/parents/", {
        username: username.trim(),
        password: password.trim(),
        children: selectedChildren,
      });
      alert("Parent created successfully");
      resetForm();
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || "Could not create parent");
    }
  };

  // ================= EDIT =================
  const startEdit = (p) => {
    setEditingId(p.profile_id);
    setUsername(p.username);
    setPassword("");
    setSelectedChildren(p.children.map((c) => c.id));
    setChildQuery("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const updateChildren = async () => {
    try {
      await API.post(`/manage/parents/${editingId}/children/`, {
        children: selectedChildren,
      });
      alert("Children updated");
      resetForm();
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || "Could not update children");
    }
  };

  // ================= DELETE =================
  const deleteParent = async (profileId) => {
    if (!window.confirm("Delete this parent account?")) return;
    try {
      await API.delete(`/manage/parents/${profileId}/`);
      alert("Parent deleted");
      if (editingId === profileId) resetForm();
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || "Could not delete parent");
    }
  };

  // ================= CHILD SELECTION =================
  const toggleChild = (id) =>
    setSelectedChildren((l) =>
      l.includes(id) ? l.filter((x) => x !== id) : [...l, id]
    );

  const childMatches = !childQuery.trim()
    ? []
    : students.filter((s) =>
        s.username.toLowerCase().includes(childQuery.trim().toLowerCase())
      );

  const selectedStudents = selectedChildren
    .map((id) => students.find((s) => s.id === id))
    .filter(Boolean);

  // ================= FILTER =================
  const filteredParents = parents.filter((p) =>
    p.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="app">
      <Navbar setOpen={setOpen} />
      <div className="layout">
        <Sidebar open={open} setOpen={setOpen} />
        <div className="main">

          <div className="content">

            {/* ================= HEADER ================= */}
            <div className="header-box">
              <h2>Parent Management</h2>
              <p>Manage parent accounts and linked students</p>
            </div>

            {/* ================= FORM ================= */}
            <div className="card">
              <h3>{editingId ? "Edit Parent" : "Add Parent"}</h3>

              <div className="form-grid">
                <input
                  type="text"
                  placeholder="Parent Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={!!editingId}
                />

                {!editingId && (
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                )}

                {/* Child search — dropdown floats so the row stays single-line */}
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    placeholder="Search students to link..."
                    value={childQuery}
                    onChange={(e) => setChildQuery(e.target.value)}
                    style={{ width: "100%" }}
                  />

                  {childQuery.trim() && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        zIndex: 30,
                        width: "100%",
                        minWidth: 240,
                        marginTop: 6,
                        border: "1px solid #e2e8f0",
                        borderRadius: 8,
                        maxHeight: 200,
                        overflowY: "auto",
                        background: "#fff",
                        boxShadow: "0 6px 20px rgba(15,23,42,0.08)",
                      }}
                    >
                      {childMatches.length === 0 ? (
                        <div style={{ padding: "10px 12px", fontSize: 13, color: "#94a3b8" }}>
                          No students found for "{childQuery}"
                        </div>
                      ) : (
                        childMatches.map((s) => {
                          const checked = selectedChildren.includes(s.id);
                          return (
                            <label
                              key={s.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "8px 12px",
                                fontSize: 13,
                                cursor: "pointer",
                                background: checked ? "#eef4ff" : "#fff",
                                borderBottom: "1px solid #f1f5f9",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleChild(s.id)}
                                style={{ accentColor: "#2563eb" }}
                              />
                              <span>{s.username}</span>
                              {s.course_name && (
                                <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 600, color: "#6366f1" }}>
                                  {s.course_name}
                                </span>
                              )}
                            </label>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                {/* Action buttons sit in the same row */}
                {editingId ? (
                  <>
                    <button className="btn-primary" onClick={updateChildren}>
                      Update Children
                    </button>
                    <button className="btn-delete" onClick={resetForm}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button className="btn-primary" onClick={createParent}>
                    Create Parent
                  </button>
                )}
              </div>

              {/* Selected children chips — below the row */}
              {selectedStudents.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
                  {selectedStudents.map((s) => (
                    <span
                      key={s.id}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 12,
                        padding: "4px 10px",
                        borderRadius: 16,
                        background: "#dbeafe",
                        color: "#1e40af",
                      }}
                    >
                      {s.username}
                      <span
                        onClick={() => toggleChild(s.id)}
                        style={{ cursor: "pointer", fontWeight: 600, lineHeight: 1 }}
                      >
                        ×
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* ================= TABLE ================= */}
            <div className="card">

              {/* ================= FILTERS ================= */}
              <div className="top-filters" style={{ alignItems: "center" }}>
                <input
                  className="search-box"
                  placeholder="Search Parent..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <span style={{ marginLeft: "auto", fontSize: 14, color: "#64748b" }}>
                  Total Parents: {parents.length}
                </span>
              </div>

              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Parent</th>
                      <th>Children</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredParents.map((p) => (
                      <tr key={p.profile_id}>
                        <td>{p.username}</td>
                        <td>
                          {p.children.length > 0
                            ? p.children.map((c) => c.username).join(", ")
                            : "-"}
                        </td>
                        <td>
                          <div className="action-buttons">
                            <button className="btn-edit" onClick={() => startEdit(p)}>
                              Edit
                            </button>
                            <button
                              className="btn-delete"
                              onClick={() => deleteParent(p.profile_id)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredParents.length === 0 && (
                      <tr>
                        <td colSpan="3" style={{ textAlign: "center" }}>
                          No parents found
                        </td>
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