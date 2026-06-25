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

  // add-form state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [selectedChildren, setSelectedChildren] = useState([]);
  const [childQuery, setChildQuery] = useState("");

  // filters
  const [search, setSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");

  // ================= EDIT POPUP STATE =================
  const [editing, setEditing] = useState(null);
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editChildren, setEditChildren] = useState([]);
  const [editChildQuery, setEditChildQuery] = useState("");

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

  // ================= RESET ADD FORM =================
  const resetForm = () => {
    setUsername("");
    setPassword("");
    setSelectedChildren([]);
    setChildQuery("");
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

  // ================= OPEN EDIT POPUP =================
  const openEdit = (p) => {
    setEditing(p);
    setEditUsername(p.username);
    setEditPassword("");
    setEditChildren(p.children.map((c) => c.id));
    setEditChildQuery("");
  };

  const closeEdit = () => {
    setEditing(null);
    setEditUsername("");
    setEditPassword("");
    setEditChildren([]);
    setEditChildQuery("");
  };

  // ================= SAVE EDIT (name + password + children) =================
  const saveEdit = async () => {
    if (!editUsername.trim()) {
      alert("Username is required");
      return;
    }
    try {
      await API.post(`/manage/parents/${editing.profile_id}/children/`, {
        username: editUsername.trim(),
        password: editPassword.trim(),   // blank = keep current
        children: editChildren,
      });
      alert("Parent updated");
      closeEdit();
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || "Could not update parent");
    }
  };

  // ================= DELETE =================
  const deleteParent = async (profileId) => {
    if (!window.confirm("Delete this parent account?")) return;
    try {
      await API.delete(`/manage/parents/${profileId}/`);
      alert("Parent deleted");
      if (editing?.profile_id === profileId) closeEdit();
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || "Could not delete parent");
    }
  };

  // ================= CHILD SELECTION (add form) =================
  const toggleChild = (id) =>
    setSelectedChildren((l) =>
      l.includes(id) ? l.filter((x) => x !== id) : [...l, id]
    );

  // ================= CHILD SELECTION (edit popup) =================
  const toggleEditChild = (id) =>
    setEditChildren((l) =>
      l.includes(id) ? l.filter((x) => x !== id) : [...l, id]
    );

  // ---- taken IDs for the ADD form (all parents) ----
  const takenIdsAdd = new Set(
    parents.flatMap((p) => p.children.map((c) => c.id))
  );
  const availableAdd = students.filter((s) => !takenIdsAdd.has(s.id));
  const childMatches = !childQuery.trim()
    ? []
    : availableAdd.filter((s) =>
        s.username.toLowerCase().includes(childQuery.trim().toLowerCase())
      );
  const selectedStudents = selectedChildren
    .map((id) => students.find((s) => s.id === id))
    .filter(Boolean);

  // ---- taken IDs for the EDIT popup (exclude the parent being edited) ----
  const takenIdsEdit = new Set(
    parents
      .filter((p) => p.profile_id !== editing?.profile_id)
      .flatMap((p) => p.children.map((c) => c.id))
  );
  const availableEdit = students.filter((s) => !takenIdsEdit.has(s.id));
  const editChildMatches = !editChildQuery.trim()
    ? []
    : availableEdit.filter((s) =>
        s.username.toLowerCase().includes(editChildQuery.trim().toLowerCase())
      );
  const editSelectedStudents = editChildren
    .map((id) => students.find((s) => s.id === id))
    .filter(Boolean);

  // ================= FILTER =================
  const filteredParents = parents.filter((p) => {
    const parentOk = p.username.toLowerCase().includes(search.toLowerCase());
    const studentOk =
      !studentSearch.trim() ||
      p.children.some((c) =>
        c.username.toLowerCase().includes(studentSearch.trim().toLowerCase())
      );
    return parentOk && studentOk;
  });

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

            {/* ================= ADD FORM ================= */}
            <div className="card">
              <h3>Add Parent</h3>

              <div className="form-grid">
                <input
                  type="text"
                  placeholder="Parent Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />

                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />

                {/* Child search */}
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
                        position: "absolute", top: "100%", left: 0, zIndex: 30,
                        width: "100%", minWidth: 240, marginTop: 6,
                        border: "1px solid #e2e8f0", borderRadius: 8,
                        maxHeight: 200, overflowY: "auto",
                        background: "#fff", boxShadow: "0 6px 20px rgba(15,23,42,0.08)",
                      }}
                    >
                      {childMatches.length === 0 ? (
                        <div style={{ padding: "10px 12px", fontSize: 13, color: "#94a3b8" }}>
                          No unallocated students match "{childQuery}"
                        </div>
                      ) : (
                        childMatches.map((s) => {
                          const checked = selectedChildren.includes(s.id);
                          return (
                            <label key={s.id}
                              style={{
                                display: "flex", alignItems: "center", gap: 8,
                                padding: "8px 12px", fontSize: 13, cursor: "pointer",
                                background: checked ? "#eef4ff" : "#fff",
                                borderBottom: "1px solid #f1f5f9",
                              }}>
                              <input type="checkbox" checked={checked}
                                onChange={() => toggleChild(s.id)}
                                style={{ accentColor: "#2563eb" }} />
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

                <button className="btn-primary" onClick={createParent}>
                  Create Parent
                </button>
              </div>

              {/* Selected children chips */}
              {selectedStudents.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
                  {selectedStudents.map((s) => (
                    <span key={s.id}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12,
                        padding: "4px 10px", borderRadius: 16, background: "#dbeafe", color: "#1e40af",
                      }}>
                      {s.username}
                      <span onClick={() => toggleChild(s.id)} style={{ cursor: "pointer", fontWeight: 600, lineHeight: 1 }}>×</span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* ================= TABLE ================= */}
            <div className="card">

              <div className="top-filters" style={{ alignItems: "center", gap: 10 }}>
                <input className="search-box" placeholder="Search Parent..."
                  value={search} onChange={(e) => setSearch(e.target.value)} />
                <input className="search-box" placeholder="Search Student..."
                  value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} />
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
                            <button className="btn-edit" onClick={() => openEdit(p)}>Edit</button>
                            <button className="btn-delete" onClick={() => deleteParent(p.profile_id)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredParents.length === 0 && (
                      <tr>
                        <td colSpan="3" style={{ textAlign: "center" }}>No parents found</td>
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
              <h3 style={{ margin: 0, fontSize: 18 }}>Edit parent</h3>
              <span onClick={closeEdit} style={{ cursor: "pointer", fontSize: 20, color: "#64748b" }}>×</span>
            </div>
            <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 18px" }}>
              Edit details &amp; linked students
            </p>

            {/* parent username */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 6 }}>Parent username</div>
              <input
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>

            {/* new password */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 6 }}>
                New password <span style={{ color: "#94a3b8" }}>(leave blank to keep current)</span>
              </div>
              <input
                type="password"
                placeholder="••••••••"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>

            {/* child search in popup */}
            <div style={{ position: "relative", marginBottom: 14 }}>
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 6 }}>Add students</div>
              <input
                type="text"
                placeholder="Search students to link..."
                value={editChildQuery}
                onChange={(e) => setEditChildQuery(e.target.value)}
                style={{ width: "100%" }}
              />
              {editChildQuery.trim() && (
                <div
                  style={{
                    position: "absolute", top: "100%", left: 0, zIndex: 30,
                    width: "100%", marginTop: 6, border: "1px solid #e2e8f0", borderRadius: 8,
                    maxHeight: 200, overflowY: "auto", background: "#fff",
                    boxShadow: "0 6px 20px rgba(15,23,42,0.08)",
                  }}
                >
                  {editChildMatches.length === 0 ? (
                    <div style={{ padding: "10px 12px", fontSize: 13, color: "#94a3b8" }}>
                      No unallocated students match "{editChildQuery}"
                    </div>
                  ) : (
                    editChildMatches.map((s) => {
                      const checked = editChildren.includes(s.id);
                      return (
                        <label key={s.id}
                          style={{
                            display: "flex", alignItems: "center", gap: 8,
                            padding: "8px 12px", fontSize: 13, cursor: "pointer",
                            background: checked ? "#eef4ff" : "#fff",
                            borderBottom: "1px solid #f1f5f9",
                          }}>
                          <input type="checkbox" checked={checked}
                            onChange={() => toggleEditChild(s.id)}
                            style={{ accentColor: "#2563eb" }} />
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

            {/* selected children chips */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}>Linked students</div>
              {editSelectedStudents.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {editSelectedStudents.map((s) => (
                    <span key={s.id}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12,
                        padding: "4px 10px", borderRadius: 16, background: "#dbeafe", color: "#1e40af",
                      }}>
                      {s.username}
                      <span onClick={() => toggleEditChild(s.id)} style={{ cursor: "pointer", fontWeight: 600, lineHeight: 1 }}>×</span>
                    </span>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: "#94a3b8" }}>No students linked yet.</div>
              )}
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