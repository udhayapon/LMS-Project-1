import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";

import API from "../../api";

import "../../App.css";

export default function Courses() {

  const user = JSON.parse(
    localStorage.getItem("user") || "{}"
  );

  if (!user || !user.role) {

    return <p>Please login</p>;
  }

  // ================= ADMIN =================
  if (user.role === "admin") {

    return <AdminCourses />;
  }

  // ================= TEACHER =================
  if (user.role === "teacher") {

    return (
      <TeacherSubjects
        user={user}
      />
    );
  }

  // ================= STUDENT =================
  if (user.role === "student") {

    return <StudentCourses />;
  }

  return <p>Unauthorized</p>;
}

//////////////////// COMMON LAYOUT ////////////////////

const PageLayout = ({
  title,
  children
}) => {

  const [open, setOpen] =
    useState(false);

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

            <div className="header-box">

              <h2>
                {title}
              </h2>

            </div>

            {children}

          </div>

        </div>

      </div>

    </div>
  );
};

//////////////////// ADMIN ////////////////////

const AdminCourses = () => {

  const [courses, setCourses] =
    useState([]);

  const [form, setForm] =
    useState({
      name: ""
    });

  const [editingId, setEditingId] =
    useState(null);

  const navigate =
    useNavigate();

  // ================= LOAD =================
  useEffect(() => {

    fetchCourses();

  }, []);

  // ================= FETCH =================
  const fetchCourses =
    async () => {

      try {

        const res =
          await API.get(
            "/courses/"
          );

        setCourses(
          res.data?.results ||
          res.data ||
          []
        );

      } catch (err) {

        console.log(
          "Course fetch error:",
          err
        );
      }
    };

  // ================= ADD =================
  const handleAdd =
    async () => {

      if (!form.name) {

        return alert(
          "Enter course name"
        );
      }

      try {

        await API.post(
          "/courses/",
          form
        );

        reset();

        fetchCourses();

      } catch (err) {

        console.log(err);
      }
    };

  // ================= UPDATE =================
  const handleUpdate =
    async () => {

      try {

        await API.put(
          `/courses/${editingId}/`,
          form
        );

        reset();

        fetchCourses();

      } catch (err) {

        console.log(err);
      }
    };

  // ================= DELETE =================
  const handleDelete =
    async (id) => {

      if (
        !window.confirm(
          "Delete this course?"
        )
      ) {
        return;
      }

      try {

        await API.delete(
          `/courses/${id}/`
        );

        fetchCourses();

      } catch (err) {

        console.log(err);
      }
    };

  // ================= RESET =================
  const reset = () => {

    setForm({
      name: ""
    });

    setEditingId(null);
  };

  return (

    <PageLayout title="Course Management">

      {/* FORM */}
      <div className="card">

        <div className="form-grid">

          <input
            placeholder="Course Name"
            value={form.name}
            onChange={(e) =>
              setForm({
                name:
                  e.target.value
              })
            }
          />

          <button
            className="btn-primary"
            onClick={
              editingId
                ? handleUpdate
                : handleAdd
            }
          >

            {editingId
              ? "Update"
              : "Add"}

          </button>

          {editingId && (

            <button
              className="btn-delete"
              onClick={reset}
            >
              Cancel
            </button>

          )}

        </div>

      </div>

      {/* TABLE */}
      <div className="card">

        <table>

          <thead>

            <tr>

              <th>
                Course Name
              </th>

              <th>
                Actions
              </th>

            </tr>

          </thead>

          <tbody>

            {courses.length === 0 ? (

              <tr>

                <td colSpan="2">
                  No courses available
                </td>

              </tr>

            ) : (

              courses.map((c) => (

                <tr key={c.id}>

                  <td
                    onClick={() =>
                      navigate(
                        `/courses/${c.id}`
                      )
                    }
                    style={{
                      cursor:
                        "pointer"
                    }}
                  >
                    {c.name}
                  </td>

                  <td>

                    <div className="action-buttons">

                      {/* VIEW */}
                      <button
                        className="btn-edit"

                        onClick={() =>
                          navigate(
                            `/courses/${c.id}`
                          )
                        }
                      >
                        View
                      </button>

                      {/* EDIT */}
                      <button
                        className="btn-primary"
                        
                        onClick={() => {

                          setForm({
                            name:
                              c.name
                          });

                          setEditingId(
                            c.id
                          );
                        }}
                      >
                        Edit
                      </button>

                      {/* DELETE */}
                      <button
                        className="btn-delete"

                        onClick={() =>
                          handleDelete(
                            c.id
                          )
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

    </PageLayout>
  );
};

//////////////////// TEACHER ////////////////////

const TeacherSubjects = ({
  user
}) => {

  const [subjects, setSubjects] =
    useState([]);

  const navigate =
    useNavigate();

  useEffect(() => {

    fetchSubjects();

  }, []);

  const fetchSubjects =
    async () => {

      try {

        const res =
          await API.get(
            `/teaching-assignments/?teacher=${user.id}`
          );

        setSubjects(
          res.data?.results ||
          res.data ||
          []
        );

      } catch (err) {

        console.log(err);
      }
    };

  return (

    <PageLayout title="My Subjects">

      <div className="card">

        <table>

          <thead>

            <tr>

              <th>Course</th>
              <th>Year</th>
              <th>Semester</th>
              <th>Subject</th>
              <th>Action</th>

            </tr>

          </thead>

          <tbody>

            {subjects.length === 0 ? (

              <tr>

                <td colSpan="5">
                  No subjects assigned
                </td>

              </tr>

            ) : (

              subjects.map((s) => (

                <tr key={s.id}>

                  <td>
                    {s.course_name}
                  </td>

                  <td>
                    Year {s.year_number}
                  </td>

                  <td>
                    Semester {s.semester}
                  </td>

                  <td>
                    {s.subject_name}
                  </td>

                  <td>

                    <button
                      className="btn-primary"
                      onClick={() =>
                        navigate(
                          `/teacher/subject/${s.id}`
                        )
                      }
                    >
                      Manage
                    </button>

                  </td>

                </tr>

              ))
            )}

          </tbody>

        </table>

      </div>

    </PageLayout>
  );
};

//////////////////// STUDENT ////////////////////

const StudentCourses = () => {

  const [courses, setCourses] =
    useState([]);

  const navigate =
    useNavigate();

  useEffect(() => {

    fetchCourses();

  }, []);

  const fetchCourses =
    async () => {

      try {

        const res =
          await API.get(
            "/enrollments/"
          );

        setCourses(
          res.data?.results ||
          res.data ||
          []
        );

      } catch (err) {

        console.log(
          "Course fetch error:",
          err
        );
      }
    };

  return (

    <PageLayout title="My Subjects">

      <div className="card">

        <table>

          <thead>

            <tr>

              <th>Course</th>
              <th>Subject</th>
              <th>Year</th>
              <th>Semester</th>
              <th>Teacher</th>
              <th>Action</th>

            </tr>

          </thead>

          <tbody>

            {courses.length === 0 ? (

              <tr>

                <td colSpan="6">
                  No subjects assigned
                </td>

              </tr>

            ) : (

              courses.map((c) => (

                <tr key={c.id}>

                  <td>
                    {c.course_name}
                  </td>

                  <td>
                    {c.subject_name}
                  </td>

                  <td>
                    Year {c.year_number}
                  </td>

                  <td>
                    Semester {c.semester}
                  </td>

                  <td>
                    {c.teacher_name}
                  </td>

                  <td>

                    <button
                      className="btn-primary"
                      onClick={() =>
                        navigate(
                          `/student/subject/${c.teaching_assignment}`
                        )
                      }
                    >
                      Open
                    </button>

                  </td>

                </tr>

              ))
            )}

          </tbody>

        </table>

      </div>

    </PageLayout>
  );
};