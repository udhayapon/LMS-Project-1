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

  const [code, setCode] =
    useState("");

  const [semester, setSemester] =
    useState("");

  const [credits, setCredits] =
    useState("");

  // ================= EDIT SUBJECT =================
  const [
    editingSubjectId,
    setEditingSubjectId
  ] = useState(null);

  const [activeTab, setActiveTab] =
    useState("structure");

  // full-page loader: first load only
  const [loading, setLoading] =
    useState(true);

  // button-level busy flag (no page-wide spinner)
  const [saving, setSaving] =
    useState(false);

  // lazy enrollments for the Students tab
  const [
    studentsLoaded,
    setStudentsLoaded
  ] = useState(false);

  const [
    loadingStudents,
    setLoadingStudents
  ] = useState(false);

  // ================= INIT (course + years only) =================
  useEffect(() => {

    if (id) {

      loadCourseAndYears();
    }

  }, [id]);

  // ================= LAZY: load students only when tab opened =================
  useEffect(() => {

    if (
      activeTab === "students" &&
      !studentsLoaded &&
      course
    ) {

      loadStudents();
    }

  }, [activeTab, studentsLoaded, course]);

  // ================= LOAD COURSE + YEARS =================
  const loadCourseAndYears = async () => {

    try {

      setLoading(true);

      const c = await API.get(
        `/courses/${id}/`
      );

      setCourse(c.data);

      const y = await API.get(
        `/years/?course=${id}`
      );

      setYears(
        y.data?.results ||
        y.data ||
        []
      );

    } catch (err) {

      console.error(
        "Course details error:",
        err
      );

    } finally {

      setLoading(false);
    }
  };

  // ================= LOAD STUDENTS (enrollments) =================
  const loadStudents = async () => {

    try {

      setLoadingStudents(true);

      const s = await API.get(
        "/enrollments/"
      );

      const allStudents =
        s.data?.results ||
        s.data ||
        [];

      const filteredStudents =
        allStudents.filter(
          (e) =>
            e.course_name ===
            course?.name
        );

      setStudents(filteredStudents);

      setStudentsLoaded(true);

    } catch (err) {

      console.error(
        "Enrollments error:",
        err
      );

    } finally {

      setLoadingStudents(false);
    }
  };

  // ================= LOCAL: upsert a subject into years =================
  const upsertSubjectInYears = (subj) => {

    setYears((prev) => {

      // remove any existing copy (edit / moved year)
      let next = prev.map((y) => ({
        ...y,
        subjects: (y.subjects || []).filter(
          (s) => s.id !== subj.id
        ),
      }));

      // insert into its target year, keep name order (matches backend)
      next = next.map((y) => {

        if (y.id === subj.year) {

          const list = [
            ...(y.subjects || []),
            subj,
          ].sort((a, b) =>
            (a.name || "").localeCompare(
              b.name || ""
            )
          );

          return { ...y, subjects: list };
        }

        return y;
      });

      return next;
    });
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

        setSaving(true);

        const res = await API.post(
          "/years/",
          {
            course: Number(id),
            year_number:
              yearNum,
          }
        );

        // instant: append new year locally, keep order
        setYears((prev) =>
          [
            ...prev,
            {
              ...res.data,
              subjects:
                res.data.subjects || [],
            },
          ].sort(
            (a, b) =>
              a.year_number -
              b.year_number
          )
        );

        setYear("");

      } catch (err) {

        console.error(
          err.response?.data
        );

        alert(
          "Failed to add year"
        );

      } finally {

        setSaving(false);
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

      const payload = {
        name: subject,
        code: code,
        year: Number(yearId),
        semester: Number(semester),
        credits: Number(credits) || 0,
      };

      try {

        setSaving(true);

        let res;

        if (editingSubjectId) {

          res = await API.put(
            `/subjects/${editingSubjectId}/`,
            payload
          );

        } else {

          res = await API.post(
            "/subjects/",
            payload
          );
        }

        // instant: update the list from server response
        upsertSubjectInYears(res.data);

        // ================= RESET =================
        setSubject("");
        setCode("");
        setYearId("");
        setSemester("");
        setCredits("");

        setEditingSubjectId(null);

      } catch (err) {

        console.error(
          err.response?.data
        );

        alert(
          "Failed to save subject"
        );

      } finally {

        setSaving(false);
      }
    };

  // ================= DELETE SUBJECT =================
  const handleDeleteSubject =
    async (subjectId) => {

      if (
        !window.confirm(
          "Delete this subject?"
        )
      ) {
        return;
      }

      try {

        setSaving(true);

        await API.delete(
          `/subjects/${subjectId}/`
        );

        // instant: drop it from local state
        setYears((prev) =>
          prev.map((y) => ({
            ...y,
            subjects: (y.subjects || []).filter(
              (s) => s.id !== subjectId
            ),
          }))
        );

        // if we were editing this one, clear the form
        if (
          editingSubjectId ===
          subjectId
        ) {

          setSubject("");
          setCode("");
          setYearId("");
          setSemester("");
          setCredits("");
          setEditingSubjectId(null);
        }

      } catch (err) {

        console.error(err);

        alert(
          "Delete failed"
        );

      } finally {

        setSaving(false);
      }
    };

  // ================= LOADING (first load only) =================
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

              <button
                className="btn-primary"
                style={{ marginLeft: "10px" }}
                onClick={() =>
                  navigate(
                    `/courses/${id}/structure`
                  )
                }
              >
                View Structure
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
                      disabled={saving}
                    >
                      {saving
                        ? "Saving..."
                        : "Add Year"}
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

                  <div className="form-grid form-grid--row">

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

                    {/* CODE */}
                    <input
                      placeholder="Subject Code (e.g. HS3152)"
                      value={code}
                      onChange={(e) =>
                        setCode(
                          e.target.value
                        )
                      }
                    />

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

                    {/* CREDITS */}
                    <input
                      type="number"
                      min="0"
                      placeholder="Credits"
                      value={credits}
                      onChange={(e) =>
                        setCredits(
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
                      disabled={saving}
                    >

                      {saving
                        ? "Saving..."
                        : editingSubjectId
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
                                Code
                              </th>

                              <th>
                                Subject
                              </th>

                              <th>
                                Semester
                              </th>

                              <th>
                                Credits
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

                                    {/* CODE */}
                                    <td>
                                      {s.code || "—"}
                                    </td>

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

                                    {/* CREDITS */}
                                    <td>
                                      {s.credits ?? 0}
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

                                            setCode(
                                              s.code || ""
                                            );

                                            setSemester(
                                              s.semester
                                            );

                                            setYearId(
                                              s.year
                                            );

                                            setCredits(
                                              s.credits ?? ""
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

                                <td colSpan="5">
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

                {loadingStudents ? (

                  <p>
                    Loading students...
                  </p>

                ) : students.length === 0 ? (

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