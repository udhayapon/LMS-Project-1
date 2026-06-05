import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";

import API from "../../api";

import "../../App.css";

export default function CourseDetails() {

  const { id } = useParams();

  const navigate = useNavigate();

  const user = JSON.parse(
    localStorage.getItem("user") || "{}"
  );

  const [open, setOpen] =
    useState(false);

  const [course, setCourse] =
    useState(null);

  const [years, setYears] =
    useState([]);

  const [students, setStudents] =
    useState([]);

  const [year, setYear] =
    useState("");

  const [yearId, setYearId] =
    useState("");

  const [subject, setSubject] =
    useState("");

  const [semester, setSemester] =
    useState("");

  // ================= EDIT SUBJECT =================
  const [
    editingSubjectId,
    setEditingSubjectId
  ] = useState(null);

  const [activeTab, setActiveTab] =
    useState("structure");

  const [loading, setLoading] =
    useState(true);

  // ================= INIT =================
  useEffect(() => {

    if (id) {

      init();
    }

  }, [id]);

  // ================= LOAD DATA =================
  const init = async () => {

    try {

      setLoading(true);

      // ================= COURSE =================
      const c = await API.get(
        `/courses/${id}/`
      );

      setCourse(c.data);

      // ================= YEARS =================
      const y = await API.get(
        `/years/?course=${id}`
      );

      setYears(
        y.data?.results ||
        y.data ||
        []
      );

      // ================= ENROLLMENTS =================
      const s = await API.get(
        "/enrollments/"
      );

      const allStudents =
        s.data?.results ||
        s.data ||
        [];

      // ================= FILTER STUDENTS =================
      const filteredStudents =
        allStudents.filter(
          (e) =>
            e.course_name ===
            c.data.name
        );

      setStudents(filteredStudents);

    } catch (err) {

      console.error(
        "Course details error:",
        err
      );

    } finally {

      setLoading(false);
    }
  };

  // ================= ADD YEAR =================
  const handleAddYear =
    async () => {

      if (!year) {

        return alert(
          "Select year"
        );
      }

      const yearNum =
        Number(year);

      // ================= DUPLICATE CHECK =================
      const exists =
        years.find(
          (y) =>
            Number(
              y.year_number
            ) === yearNum
        );

      if (exists) {

        return alert(
          "Year already exists"
        );
      }

      try {

        await API.post(
          "/years/",
          {
            course: Number(id),
            year_number:
              yearNum,
          }
        );

        setYear("");

        init();

      } catch (err) {

        console.error(
          err.response?.data
        );

        alert(
          "Failed to add year"
        );
      }
    };

  // ================= ADD / UPDATE SUBJECT =================
  const handleAddSubject =
    async () => {

      if (
        !yearId ||
        !subject ||
        !semester
      ) {

        return alert(
          "Select year, semester and enter subject"
        );
      }

      try {

        // ================= UPDATE =================
        if (editingSubjectId) {

          await API.put(
            `/subjects/${editingSubjectId}/`,
            {
              name: subject,
              year: Number(yearId),
              semester: Number(semester),
            }
          );

          alert(
            "Subject updated successfully"
          );

        } else {

          // ================= CREATE =================
          await API.post(
            "/subjects/",
            {
              name: subject,
              year: Number(yearId),
              semester: Number(semester),
            }
          );

          alert(
            "Subject added successfully"
          );
        }

        // ================= RESET =================
        setSubject("");
        setYearId("");
        setSemester("");

        setEditingSubjectId(null);

        init();

      } catch (err) {

        console.error(
          err.response?.data
        );

        alert(
          "Failed to save subject"
        );
      }
    };

  // ================= DELETE SUBJECT =================
  const handleDeleteSubject =
    async (id) => {

      if (
        !window.confirm(
          "Delete this subject?"
        )
      ) {
        return;
      }

      try {

        await API.delete(
          `/subjects/${id}/`
        );

        init();

      } catch (err) {

        console.error(err);

        alert(
          "Delete failed"
        );
      }
    };

  // ================= LOADING =================
  if (loading) {

    return (
      <p style={{ padding: "20px" }}>
        Loading...
      </p>
    );
  }

  // ================= NO DATA =================
  if (!course) {

    return (
      <p style={{ padding: "20px" }}>
        Course not found
      </p>
    );
  }

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

              <button
                className="btn-primary"
                onClick={() =>
                  navigate("/courses")
                }
              >
                ← Back
              </button>

              <h2>
                {course.name}
              </h2>

              <p>
                Manage course structure
              </p>

            </div>

            {/* ================= TABS ================= */}
            <div className="tabs">

              <button
                className={
                  activeTab ===
                  "structure"
                    ? "btn-primary"
                    : ""
                }
                onClick={() =>
                  setActiveTab(
                    "structure"
                  )
                }
              >
                Structure
              </button>

              <button
                className={
                  activeTab ===
                  "students"
                    ? "btn-primary"
                    : ""
                }
                onClick={() =>
                  setActiveTab(
                    "students"
                  )
                }
              >
                Students
              </button>

            </div>

            {/* ================= STRUCTURE TAB ================= */}
            {activeTab ===
              "structure" &&
              user.role ===
                "admin" && (

              <>

                {/* ================= ADD YEAR ================= */}
                <div className="card">

                  <h3>
                    Add Year
                  </h3>

                  <div className="form-grid">

                    <select
                      value={year}
                      onChange={(e) =>
                        setYear(
                          e.target.value
                        )
                      }
                    >

                      <option value="">
                        Select Year
                      </option>

                      {[1, 2, 3, 4].map(
                        (y) => (
                          <option
                            key={y}
                            value={y}
                            disabled={years.some(
                              (
                                yr
                              ) =>
                                yr.year_number ===
                                y
                            )}
                          >
                            Year {y}
                          </option>
                        )
                      )}

                    </select>

                    <button
                      className="btn-primary"
                      onClick={
                        handleAddYear
                      }
                    >
                      Add Year
                    </button>

                  </div>

                </div>

                {/* ================= ADD SUBJECT ================= */}
                <div className="card">

                  <h3>

                    {editingSubjectId
                      ? "Edit Subject"
                      : "Add Subject"}

                  </h3>

                  <div className="form-grid">

                    {/* YEAR */}
                    <select
                      value={yearId}
                      onChange={(e) =>
                        setYearId(
                          e.target.value
                        )
                      }
                    >

                      <option value="">
                        Select Year
                      </option>

                      {years.map(
                        (y) => (
                          <option
                            key={y.id}
                            value={y.id}
                          >
                            Year{" "}
                            {
                              y.year_number
                            }
                          </option>
                        )
                      )}

                    </select>

                    {/* SEMESTER */}
                    <select
                      value={semester}
                      onChange={(e) =>
                        setSemester(
                          e.target.value
                        )
                      }
                    >

                      <option value="">
                        Select Semester
                      </option>

                      {[1,2,3,4,5,6,7,8].map((s) => (
                        <option
                          key={s}
                          value={s}
                        >
                          Semester {s}
                        </option>
                      ))}

                    </select>

                    {/* SUBJECT */}
                    <input
                      placeholder="Subject Name"
                      value={subject}
                      onChange={(e) =>
                        setSubject(
                          e.target.value
                        )
                      }
                    />

                    {/* BUTTON */}
                    <button
                      className="btn-primary"
                      onClick={
                        handleAddSubject
                      }
                    >

                      {editingSubjectId
                        ? "Update Subject"
                        : "Add Subject"}

                    </button>

                  </div>

                </div>

                {/* ================= COURSE STRUCTURE ================= */}
                <div className="card">

                  <h3>
                    Course Structure
                  </h3>

                  {years.length === 0 ? (

                    <p>
                      No years added
                    </p>

                  ) : (

                    years.map((y) => (

                      <div
                        key={y.id}
                        style={{
                          marginBottom:
                            "25px",
                        }}
                      >

                        {/* YEAR */}
                        <h4>
                          Year{" "}
                          {
                            y.year_number
                          }
                        </h4>

                        {/* SUBJECT TABLE */}
                        <table>

                          <thead>

                            <tr>

                              <th>
                                Subject
                              </th>

                              <th>
                                Semester
                              </th>

                              <th>
                                Action
                              </th>

                            </tr>

                          </thead>

                          <tbody>

                            {y.subjects
                              ?.length > 0 ? (

                              y.subjects.map(
                                (s) => (

                                  <tr
                                    key={s.id}
                                  >

                                    {/* SUBJECT */}
                                    <td>
                                      {s.name}
                                    </td>

                                    {/* SEMESTER */}
                                    <td>
                                      Semester{" "}
                                      {
                                        s.semester
                                      }
                                    </td>

                                    {/* ACTIONS */}
                                    <td>

                                      <div className="action-buttons">

                                        {/* EDIT */}
                                        <button
                                          className="btn-edit"
                                          onClick={() => {

                                            setSubject(
                                              s.name
                                            );

                                            setSemester(
                                              s.semester
                                            );

                                            setYearId(
                                              s.year
                                            );

                                            setEditingSubjectId(
                                              s.id
                                            );
                                          }}
                                        >
                                          Edit
                                        </button>

                                        {/* DELETE */}
                                        <button
                                          className="btn-delete"
                                          onClick={() =>
                                            handleDeleteSubject(
                                              s.id
                                            )
                                          }
                                        >
                                          Delete
                                        </button>

                                      </div>

                                    </td>

                                  </tr>

                                )
                              )

                            ) : (

                              <tr>

                                <td colSpan="3">
                                  No subjects
                                </td>

                              </tr>

                            )}

                          </tbody>

                        </table>

                      </div>

                    ))

                  )}

                </div>

              </>
            )}

            {/* ================= STUDENTS TAB ================= */}
            {activeTab ===
              "students" && (

              <div className="card">

                <h3>
                  Students
                </h3>

                {students.length === 0 ? (

                  <p>
                    No students enrolled
                  </p>

                ) : (

                  <table>

                    <thead>

                      <tr>

                        <th>
                          Student
                        </th>

                        <th>
                          Subject
                        </th>

                        <th>
                          Year
                        </th>

                        <th>
                          Semester
                        </th>

                      </tr>

                    </thead>

                    <tbody>

                      {students.map(
                        (s) => (

                          <tr
                            key={s.id}
                          >

                            <td>
                              {
                                s.student_name
                              }
                            </td>

                            <td>
                              {
                                s.subject_name
                              }
                            </td>

                            <td>
                              Year{" "}
                              {
                                s.year_number
                              }
                            </td>

                            <td>
                              Semester{" "}
                              {
                                s.semester
                              }
                            </td>

                          </tr>

                        )
                      )}

                    </tbody>

                  </table>

                )}

              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
} 