import { useEffect, useState } from "react";

import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";

import API from "../../api";

import "../../App.css";

export default function Enrollments() {

  const [open, setOpen] =
    useState(false);

  const [enrollments, setEnrollments] =
    useState([]);

  // ================= LOAD =================
  useEffect(() => {

    fetchEnrollments();

  }, []);

  // ================= FETCH ENROLLMENTS =================
  const fetchEnrollments =
    async () => {

      try {

        const res =
          await API.get(
            "/enrollments/"
          );

        setEnrollments(
          res.data?.results ||
          res.data ||
          []
        );

      } catch (err) {

        console.log(err);
      }
    };

  // ================= GENERATE ENROLLMENTS =================
  const handleGenerate =
    async () => {

      try {

        const res =
          await API.post(
            "/generate-enrollments/"
          );

        alert(
          `${res.data.created} enrollments generated`
        );

        fetchEnrollments();

      } catch (err) {

        console.log(err);

        alert(
          "Enrollment generation failed"
        );
      }
    };

  // ================= DELETE =================
  const handleDelete =
    async (id) => {

      if (
        !window.confirm(
          "Delete enrollment?"
        )
      ) {
        return;
      }

      try {

        await API.delete(
          `/enrollments/${id}/`
        );

        fetchEnrollments();

      } catch (err) {

        console.log(err);
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
                Enrollment Management
              </h2>

              <p>
                Generate and manage
                student enrollments
              </p>

              {/* GENERATE BUTTON */}
              <button
                className="btn-primary"
                onClick={handleGenerate}
              >
                Generate Enrollments
              </button>

            </div>

            {/* ================= TABLE ================= */}
            <div className="card">

              <table>

                <thead>

                  <tr>

                    <th>
                      Student
                    </th>

                    <th>
                      Course
                    </th>

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

                  {enrollments.length ===
                  0 ? (

                    <tr>

                      <td colSpan="7">
                        No enrollments
                      </td>

                    </tr>

                  ) : (

                    enrollments.map((e) => (

                      <tr key={e.id}>

                        {/* STUDENT */}
                        <td>
                          {
                            e.student_name
                          }
                        </td>

                        {/* COURSE */}
                        <td>
                          {
                            e.course_name
                          }
                        </td>

                        {/* YEAR */}
                        <td>
                          Year{" "}
                          {
                            e.year_number
                          }
                        </td>

                        {/* SEMESTER */}
                        <td>
                          Semester{" "}
                          {
                            e.semester
                          }
                        </td>

                        {/* SUBJECT */}
                        <td>
                          {
                            e.subject_name
                          }
                        </td>

                        {/* TEACHER */}
                        <td>
                          {
                            e.teacher_name
                          }
                        </td>

                        {/* ACTION */}
                        <td>

                          <button
                            className="btn-delete"
                            onClick={() =>
                              handleDelete(
                                e.id
                              )
                            }
                          >
                            Delete
                          </button>

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
  );
}