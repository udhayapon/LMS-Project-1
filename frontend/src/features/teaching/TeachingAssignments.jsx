import { useEffect, useState } from "react";

import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";

import API from "../../api";

import "../../App.css";

export default function TeachingAssignments() {

  const [open, setOpen] =
    useState(false);

  const [courses, setCourses] =
    useState([]);

  const [years, setYears] =
    useState([]);

  const [subjects, setSubjects] =
    useState([]);

  const [teachers, setTeachers] =
    useState([]);

  const [assignments, setAssignments] =
    useState([]);

  const [form, setForm] =
    useState({
      course: "",
      year: "",
      subject: "",
      teacher: "",
    });

  const [editId, setEditId] =
    useState(null);

  // ================= LOAD =================
  useEffect(() => {

    fetchData();

  }, []);

  // ================= FETCH =================
  const fetchData = async () => {

    try {

      const [c, y, s, u, a] =
        await Promise.all([

          API.get("/courses/"),

          API.get("/years/"),

          API.get("/subjects/"),

          API.get("/users/"),

          API.get(
            "/teaching-assignments/"
          ),

        ]);

      // ================= FILTER TEACHERS =================
      const teachersOnly =
        (
          u.data?.results ||
          u.data ||
          []
        ).filter(
          (user) =>
            user.role === "teacher"
        );

      setCourses(
        c.data?.results ||
        c.data ||
        []
      );

      setYears(
        y.data?.results ||
        y.data ||
        []
      );

      setSubjects(
        s.data?.results ||
        s.data ||
        []
      );

      setTeachers(
        teachersOnly
      );

      setAssignments(
        a.data?.results ||
        a.data ||
        []
      );

    } catch (err) {

      console.error(
        "Fetch error:",
        err.response?.data ||
        err
      );
    }
  };

  // ================= FILTER YEARS =================
  const filteredYears =
    years.filter(
      (y) =>
        Number(y.course) ===
        Number(form.course)
    );

  // ================= FILTER SUBJECTS =================
  const filteredSubjects =
    subjects.filter(
      (s) =>
        Number(s.year) ===
        Number(form.year)
    );

  // ================= EDIT =================
  const handleEdit = (a) => {

    setForm({

      course: a.course,

      year: a.year,

      subject: a.subject,

      teacher: a.teacher,

    });

    setEditId(a.id);
  };

  // ================= CREATE / UPDATE =================
  const handleAssign =
    async () => {

      if (
        !form.course ||
        !form.year ||
        !form.subject ||
        !form.teacher
      ) {

        alert(
          "Please fill all fields"
        );

        return;
      }

      try {

        // ================= UPDATE =================
        if (editId) {

          await API.put(
            `/teaching-assignments/${editId}/`,
            form
          );

          alert(
            "Updated successfully"
          );

        } else {

          // ================= CHECK DUPLICATE =================
          const exists =
            assignments.find(
              (a) =>

                Number(a.course)
                ===
                Number(form.course)

                &&

                Number(a.year)
                ===
                Number(form.year)

                &&

                Number(a.subject)
                ===
                Number(form.subject)

                &&

                Number(a.teacher)
                ===
                Number(form.teacher)
            );

          if (exists) {

            alert(
              "This assignment already exists"
            );

            return;
          }

          // ================= CREATE =================
          await API.post(
            "/teaching-assignments/",
            form
          );

          alert(
            "Assigned successfully"
          );
        }

        // ================= RESET =================
        setForm({

          course: "",

          year: "",

          subject: "",

          teacher: "",

        });

        setEditId(null);

        fetchData();

      } catch (err) {

        console.error(
          err.response?.data ||
          err
        );

        alert(
          "Operation failed"
        );
      }
    };

  // ================= DELETE =================
  const handleDelete =
    async (id) => {

      if (
        !window.confirm(
          "Delete this assignment?"
        )
      ) {
        return;
      }

      try {

        await API.delete(
          `/teaching-assignments/${id}/`
        );

        fetchData();

      } catch (err) {

        alert(
          "Delete failed"
        );
      }
    };

  // ================= UI =================
  return (
    <div className="app">

      {/* NAVBAR */}
      <Navbar setOpen={setOpen} />

      <div className="layout">

        {/* SIDEBAR */}
        <Sidebar
          open={open}
          setOpen={setOpen}
        />

        {/* MAIN */}
        <div className="main">

          <div className="content">

            {/* ================= HEADER ================= */}
            <div className="header-box">

              <h2>
                Faculty Allocation  
              </h2>

              <p>
                Assign teachers to subjects and semesters
              </p>

            </div>

            {/* ================= FORM ================= */}
            <div className="card">

              <div className="form-grid">

                {/* COURSE */}
                <select
                  value={form.course}
                  onChange={(e) =>
                    setForm({

                      ...form,

                      course: Number(
                        e.target.value
                      ),

                      year: "",

                      subject: "",
                    })
                  }
                >

                  <option value="">
                    Select Course
                  </option>

                  {courses.map((c) => (

                    <option
                      key={c.id}
                      value={c.id}
                    >
                      {c.name}
                    </option>

                  ))}

                </select>

                {/* YEAR */}
                <select
                  value={form.year}
                  onChange={(e) =>
                    setForm({

                      ...form,

                      year: Number(
                        e.target.value
                      ),

                      subject: "",
                    })
                  }
                >

                  <option value="">
                    Select Year
                  </option>

                  {filteredYears.map((y) => (

                    <option
                      key={y.id}
                      value={y.id}
                    >
                      Year {y.year_number}
                    </option>

                  ))}

                </select>

                {/* SUBJECT */}
                <select
                  value={form.subject}
                  onChange={(e) =>
                    setForm({

                      ...form,

                      subject: Number(
                        e.target.value
                      ),
                    })
                  }
                >

                  <option value="">
                    Select Subject
                  </option>

                  {filteredSubjects.map((s) => (

                    <option
                      key={s.id}
                      value={s.id}
                    >
                      {s.name}
                      {" "}
                      (
                      Semester {s.semester}
                      )
                    </option>

                  ))}

                </select>

                {/* TEACHER */}
                <select
                  value={form.teacher}
                  onChange={(e) =>
                    setForm({

                      ...form,

                      teacher: Number(
                        e.target.value
                      ),
                    })
                  }
                >

                  <option value="">
                    Select Teacher
                  </option>

                  {teachers.map((t) => (

                    <option
                      key={t.id}
                      value={t.id}
                    >
                      {t.username}
                      (
                      {t.department_name}
                      )
                    </option>

                  ))}

                </select>

                {/* BUTTON */}
                <button
                  className="btn-primary"
                  onClick={handleAssign}
                >

                  {editId
                    ? "Update"
                    : "Assign"}

                </button>

                {/* CANCEL */}
                {editId && (

                  <button
                    className="btn-delete"
                    onClick={() => {

                      setEditId(null);

                      setForm({

                        course: "",

                        year: "",

                        subject: "",

                        teacher: "",

                      });
                    }}
                  >
                    Cancel
                  </button>

                )}

              </div>

            </div>

            {/* ================= TABLE ================= */}
            <div className="card">

              <div className="table-container">

                <table>

                  <thead>

                    <tr>

                      <th> Course </th>

                      <th>
                        Year
                      </th>

                      <th>
                        Semester
                      </th>

                      <th>
                        Subject
                      </th>

                      <th>
                        Teacher
                      </th>

                      <th>
                        Action
                      </th>

                    </tr>

                  </thead>

                  <tbody>

                    {assignments.length === 0 ? (

                      <tr>

                        <td colSpan="6">
                          No assignments found
                        </td>

                      </tr>

                    ) : (

                      assignments.map((a) => (

                        <tr key={a.id}>

                          <td>
                            {a.course_name}
                          </td>

                          <td>
                            Year {a.year_number}
                          </td>

                          <td>
                            Semester {a.semester}
                          </td>

                          <td>
                            {a.subject_name}
                          </td>

                          <td>
                            {a.teacher_name}
                          </td>

                          <td>

                            <div className="action-buttons">

                              {/* EDIT */}
                              <button
                                className="btn-edit"
                                onClick={() =>
                                  handleEdit(a)
                                }
                              >
                                Edit
                              </button>

                              {/* DELETE */}
                              <button
                                className="btn-delete"
                                onClick={() =>
                                  handleDelete(a.id)
                                }
                              >
                                Delete
                              </button>

                            </div>

                          </td>

                        </tr>

                      ))
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