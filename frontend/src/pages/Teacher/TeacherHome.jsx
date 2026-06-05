import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";

import API from "../../api";

import "../../App.css";

function TeacherHome() {

  const navigate = useNavigate();

  const [open, setOpen] = useState(false);

  const [stats, setStats] = useState({
    subjects: 0,
    students: 0,
    assignments: 0,
  });

  const user = JSON.parse(
    localStorage.getItem("user") || "{}"
  );

  // ================= GREETING =================
  const getGreeting = () => {

    const hour = new Date().getHours();

    if (hour < 12)
      return "Good Morning";

    if (hour < 18)
      return "Good Afternoon";

    return "Good Evening";
  };

  // ================= FETCH DASHBOARD =================
  const fetchStats = async () => {

    try {

      const res =
        await API.get(
          "/teacher-dashboard/"
        );

      setStats(res.data);

    } catch (err) {

      console.log(
        "Error fetching dashboard:",
        err
      );
    }
  };

  // ================= LOAD =================
  useEffect(() => {

    fetchStats();

  }, []);

  return (

    <div className="app">

      {/* ================= NAVBAR ================= */}
      <Navbar setOpen={setOpen} />

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
                {getGreeting()},
                {" "}
                {user?.username || "Teacher"} 👋
              </h2>

              <p>
                Manage your subjects,
                students and activities
              </p>

            </div>

            {/* ================= DASHBOARD CARDS ================= */}
            <div className="cards">

              {/* SUBJECTS */}
              <div
                className="dashboard-card blue"

                onClick={() =>
                  navigate(
                    "/teacher/subjects"
                  )
                }
              >

                <h4>
                  My Subjects
                </h4>

                <h2>
                  {stats.subjects}
                </h2>

              </div>

              {/* STUDENTS */}
              <div
                className="dashboard-card green"

                onClick={() =>
                  navigate(
                    "/teacher/students"
                  )
                }
              >

                <h4>
                  My Students
                </h4>

                <h2>
                  {stats.students}
                </h2>

              </div>

              {/* ASSIGNMENTS */}
              <div
                className="dashboard-card orange"

                onClick={() =>
                  navigate(
                    "/teacher/assignments"
                  )
                }
              >

                <h4>
                  Assignments
                </h4>

                <h2>
                  {stats.assignments}
                </h2>

              </div>

            </div>

            {/* ================= RECENT ACTIVITY ================= */}
            <div
              className="card"

              style={{
                marginTop: "25px"
              }}
            >

              <h3>
                Recent Activity
              </h3>

              <ul
                style={{
                  marginTop: "15px",
                  paddingLeft: "20px",
                  lineHeight: "2"
                }}
              >

                <li>

                  You are handling
                  {" "}
                  <strong>
                    {stats.subjects}
                  </strong>
                  {" "}
                  subject(s).

                </li>

                <li>

                  You are managing
                  {" "}
                  <strong>
                    {stats.students}
                  </strong>
                  {" "}
                  student(s).

                </li>

                <li>

                  You created
                  {" "}
                  <strong>
                    {stats.assignments}
                  </strong>
                  {" "}
                  assignment(s).

                </li>

                <li>

                  Students receive
                  notifications for
                  lectures, quizzes,
                  assignments and
                  study materials.

                </li>

              </ul>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}

export default TeacherHome;