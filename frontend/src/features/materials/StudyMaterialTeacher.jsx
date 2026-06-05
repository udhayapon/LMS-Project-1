import { useEffect, useState } from "react";
import API from "../../api";

export default function StudyMaterialTeacher({
  teachingId,
}) {

  const [materials, setMaterials] =
    useState([]);

  const [showForm, setShowForm] =
    useState(false);

  const [editingId, setEditingId] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  const [form, setForm] =
    useState({
      title: "",
      description: "",
      file: null,
    });

  // ================= FETCH =================
  const fetchMaterials = async () => {

    try {

      const res = await API.get(
        `/study-materials/?teaching_assignment=${teachingId}`
      );

      setMaterials(
        res.data?.results ||
        res.data ||
        []
      );

    } catch (err) {

      console.log(
        "Material fetch error:",
        err
      );
    }
  };

  useEffect(() => {

    if (teachingId) {

      fetchMaterials();
    }

  }, [teachingId]);

  // ================= INPUT =================
  const handleChange = (e) => {

    setForm({

      ...form,

      [e.target.name]:
        e.target.value,
    });
  };

  // ================= FILE =================
  const handleFileChange = (e) => {

    setForm({

      ...form,

      file:
        e.target.files[0],
    });
  };

  // ================= RESET =================
  const resetForm = () => {

    setForm({
      title: "",
      description: "",
      file: null,
    });

    setEditingId(null);

    setShowForm(false);
  };

  // ================= SAVE =================
  const saveMaterial = async () => {

    if (!form.title.trim()) {

      return alert(
        "Title is required"
      );
    }

    if (!editingId && !form.file) {

      return alert(
        "Please upload a file"
      );
    }

    try {

      setLoading(true);

      const fd = new FormData();

      fd.append(
        "title",
        form.title
      );

      fd.append(
        "description",
        form.description
      );

      fd.append(
        "teaching_assignment",
        teachingId
      );

      if (form.file) {

        fd.append(
          "file",
          form.file
        );
      }

      // UPDATE
      if (editingId) {

        await API.patch(
          `/study-materials/${editingId}/`,
          fd,
          {
            headers: {
              "Content-Type":
                "multipart/form-data",
            },
          }
        );

        alert(
          "Material updated"
        );

      }

      // CREATE
      else {

        await API.post(
          "/study-materials/",
          fd,
          {
            headers: {
              "Content-Type":
                "multipart/form-data",
            },
          }
        );

        alert(
          "Material uploaded"
        );
      }

      resetForm();

      fetchMaterials();

    } catch (err) {

      console.log(err);

      alert(
        "Operation failed"
      );

    } finally {

      setLoading(false);
    }
  };

  // ================= EDIT =================
  const editMaterial = (material) => {

    setEditingId(material.id);

    setShowForm(true);

    setForm({

      title:
        material.title || "",

      description:
        material.description || "",

      file: null,
    });
  };

  // ================= DELETE =================
  const deleteMaterial = async (id) => {

    const confirmDelete =
      window.confirm(
        "Delete this material?"
      );

    if (!confirmDelete) return;

    try {

      await API.delete(
        `/study-materials/${id}/`
      );

      alert(
        "Material deleted"
      );

      fetchMaterials();

    } catch (err) {

      console.log(err);

      alert(
        "Delete failed"
      );
    }
  };

  return (
    <div className="card">

      {/* ================= HEADER ================= */}
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >

        <h3>
          Study Materials
        </h3>

        <button
          className="btn-primary"
          onClick={() =>
            setShowForm(!showForm)
          }
        >

          {showForm
            ? "Cancel"
            : "+ Add Material"}

        </button>

      </div>

      {/* ================= FORM ================= */}
      {showForm && (

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            marginBottom: "20px",
          }}
        >

          {/* TITLE */}
          <input
            type="text"
            name="title"
            placeholder="Material Title"
            value={form.title}
            onChange={handleChange}
          />

          {/* DESCRIPTION */}
          <textarea
            name="description"
            placeholder="Description"
            rows="4"
            value={form.description}
            onChange={handleChange}
          />

          {/* FILE */}
          <input
            type="file"
            accept=".pdf,.ppt,.pptx,.doc,.docx,.txt"
            onChange={handleFileChange}
          />

          {/* BUTTON */}
          <button
            className="btn-primary"
            onClick={saveMaterial}
            disabled={loading}
          >

            {loading
              ? "Saving..."
              : editingId
              ? "Update Material"
              : "Upload Material"}

          </button>

        </div>

      )}

      {/* ================= TABLE ================= */}
      {materials.length === 0 ? (

        <p>
          No study materials uploaded
        </p>

      ) : (

        <div
          style={{
            overflowX: "auto",
          }}
        >

          <table>

            <thead>

              <tr>

                <th>Title</th>

                <th>Description</th>

                <th>Uploaded By</th>

                <th>Created</th>

                <th>Actions</th>

              </tr>

            </thead>

            <tbody>

              {materials.map((m) => (

                <tr key={m.id}>

                  <td>
                    {m.title}
                  </td>

                  <td>
                    {m.description || "-"}
                  </td>

                  <td>
                    {m.uploaded_by_name}
                  </td>

                  <td>
                    {m.created_at
                      ? new Date(
                          m.created_at
                        ).toLocaleDateString()
                      : "-"}
                  </td>

                  <td>

                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        flexWrap: "wrap",
                      }}
                    >

                      {/* VIEW */}
                      {m.file && (

                        <a
                          href={m.file}
                          target="_blank"
                          rel="noreferrer"
                        >

                          <button>
                            View
                          </button>

                        </a>

                      )}

                      {/* EDIT */}
                      <button
                        className="btn-primary"
                        onClick={() =>
                          editMaterial(m)
                        }
                      >
                        Edit
                      </button>

                      {/* DELETE */}
                      <button
                        onClick={() =>
                          deleteMaterial(
                            m.id
                          )
                        }
                        style={{
                          background: "red",
                          color: "white",
                          border: "none",
                          padding:
                            "8px 12px",
                          borderRadius:
                            "6px",
                          cursor: "pointer",
                        }}
                      >
                        Delete
                      </button>

                    </div>

                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      )}

    </div>
  );
}