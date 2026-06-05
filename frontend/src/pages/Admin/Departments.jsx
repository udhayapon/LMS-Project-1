import { useEffect, useState } from "react";

import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";

import API from "../../api";

import "../../App.css";

export default function Departments() {

  // ================= STATES =================
  const [open, setOpen] = useState(false);

  const [departments, setDepartments] = useState([]);

  const [name, setName] = useState("");

  const [editing, setEditing] = useState(null);

  const [toast, setToast] = useState(null);

  // ================= LOAD =================
  useEffect(() => {

    fetchDepartments();

  }, []);

  // ================= TOAST =================
  const showToast = (msg) => {

    setToast(msg);

    setTimeout(() => {

      setToast(null);

    }, 3000);
  };

  // ================= FETCH =================
  const fetchDepartments = async () => {

    try {

      const res = await API.get(
        "users/departments/"
      );

      const data =
        res.data?.results ||
        res.data;

      setDepartments(
        Array.isArray(data)
          ? data
          : []
      );

    } catch {

      showToast(
        "❌ Failed to load departments"
      );
    }
  };

  // ================= ADD =================
  const handleAdd = async () => {

    if (!name.trim()) {

      return showToast(
        "⚠️ Enter department name"
      );
    }

    try {

      await API.post(
        "users/departments/",
        {
          name
        }
      );

      setName("");

      fetchDepartments();

      showToast(
        "✅ Department added"
      );

    } catch (err) {

      showToast(
        "❌ " +
        JSON.stringify(
          err.response?.data
        )
      );
    }
  };

  // ================= EDIT =================
  const handleEdit = (d) => {

    setEditing(d);

    setName(d.name);
  };

  // ================= UPDATE =================
  const handleUpdate = async () => {

    if (!name.trim()) {

      return showToast(
        "⚠️ Enter department name"
      );
    }

    try {

      await API.patch(

        `users/departments/${editing.id}/`,

        {
          name
        }
      );

      setEditing(null);

      setName("");

      fetchDepartments();

      showToast(
        "✏️ Department updated"
      );

    } catch (err) {

      showToast(
        "❌ " +
        JSON.stringify(
          err.response?.data
        )
      );
    }
  };

  // ================= DELETE =================
  const handleDelete = async (id) => {

    if (
      !window.confirm(
        "Delete department?"
      )
    ) return;

    try {

      await API.delete(
        `users/departments/${id}/`
      );

      fetchDepartments();

      showToast(
        "🗑️ Department deleted"
      );

    } catch {

      showToast(
        "❌ Delete failed"
      );
    }
  };

  // ================= CANCEL =================
  const handleCancel = () => {

    setEditing(null);

    setName("");
  };

  return (

    <div className="app">

      {/* ================= NAVBAR ================= */}
      <Navbar
        setOpen={setOpen}
      />

      <div className="layout">

        {/* ================= SIDEBAR ================= */}
        <Sidebar
          open={open}
          setOpen={setOpen}
        />

        {/* ================= MAIN ================= */}
        <div className="main">

          <div className="content">

            {/* ================= HEADER ================= */}
            <div className="header-box">

              <h2>
                Departments
              </h2>

              <p>
                Manage college departments
              </p>

            </div>

            {/* ================= FORM CARD ================= */}
            <div className="card">

              <h3>

                {editing
                  ? "Edit Department"
                  : "Add Department"}

              </h3>

              <div className="form-grid">

                <input
                  type="text"
                  placeholder="Department Name"
                  value={name}
                  onChange={(e) =>
                    setName(
                      e.target.value
                    )
                  }
                />

                <button
                  className="btn-primary"
                  style={{
    padding: "6px 14px",
    fontSize: "13px",
    width: "150px",
    height: "38px",
    borderRadius: "6px",
    flex: "none"
  }}
                  onClick={
                    editing
                      ? handleUpdate
                      : handleAdd
                  }
                >

                  {editing
                    ? "Update"
                    : "Add"}

                </button>

                {editing && (

                  <button
                    className="btn-delete"
                    onClick={
                      handleCancel
                    }
                  >

                    Cancel

                  </button>

                )}

              </div>

            </div>

            {/* ================= TABLE CARD ================= */}
            <div className="card">

              <div className="table-container">

                <table>

                  <thead>

                    <tr>

                      <th>
                        Department
                      </th>

                      <th>
                        Actions
                      </th>

                    </tr>

                  </thead>

                  <tbody>

                    {departments.length > 0 ? (

                      departments.map(
                        (d) => (

                        <tr key={d.id}>

                          <td>
                            {d.name}
                          </td>

                          <td>

                            <div className="action-buttons">

                              <button
                                className="btn-edit"
                                onClick={() =>
                                  handleEdit(d)
                                }
                              >

                                Edit

                              </button>

                              <button
                                className="btn-delete"
                                onClick={() =>
                                  handleDelete(
                                    d.id
                                  )
                                }
                              >

                                Delete

                              </button>

                            </div>

                          </td>

                        </tr>

                      ))

                    ) : (

                      <tr>

                        <td colSpan="2">

                          No departments found

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

      {/* ================= TOAST ================= */}
      {toast && (

        <div className="toast">

          {toast}

        </div>

      )}

    </div>
  );
}