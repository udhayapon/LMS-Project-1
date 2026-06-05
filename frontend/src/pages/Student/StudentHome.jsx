import React, {
  useEffect,
  useState,
} from "react";

import API from "../../api";

import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";

function StudentHome() {

  // ================= USER =================
  const user = JSON.parse(
    localStorage.getItem("user") || "{}"
  );

  // ================= STATES =================
  const [open, setOpen] =
    useState(false);

  const [courses, setCourses] =
    useState([]);

  const [assignments, setAssignments] =
    useState([]);

  const [lectures, setLectures] =
    useState([]);

  const [quizzes, setQuizzes] =
    useState([]);

  const [submissions, setSubmissions] =
    useState([]);

  const [quizAttempts, setQuizAttempts] =
    useState([]);

  const [notifications,
    setNotifications] =
    useState([]);

  // ================= LOAD =================
  useEffect(() => {

    loadData();

  }, []);

  // ================= LOAD DATA =================
  const loadData = async () => {

    try {

      const [
        enrollRes,
        assignRes,
        lectureRes,
        quizRes,
        submissionRes,
        attemptRes,
        notificationRes,
      ] = await Promise.all([

        API.get("/enrollments/"),

        API.get("/assignments/"),

        API.get("/lectures/"),

        API.get("/quizzes/"),

        API.get("/submissions/"),

        API.get("/quiz-attempts/"),

        API.get(
          "/notifications/?unread=true"
        ),
      ]);

      const enrollments =
        enrollRes.data?.results ||
        enrollRes.data ||
        [];

      const allAssignments =
        assignRes.data?.results ||
        assignRes.data ||
        [];

      const allLectures =
        lectureRes.data?.results ||
        lectureRes.data ||
        [];

      const allQuizzes =
        quizRes.data?.results ||
        quizRes.data ||
        [];

      const allSubmissions =
        submissionRes.data?.results ||
        submissionRes.data ||
        [];

      const allAttempts =
        attemptRes.data?.results ||
        attemptRes.data ||
        [];

      const unreadNotifications =
        notificationRes.data?.results ||
        notificationRes.data ||
        [];

      // ================= MY ENROLLMENTS =================
      const myEnrollments =
        enrollments.filter(
          (e) =>
            (e.student?.id ||
              e.student) ===
            user.id
        );

      setCourses(myEnrollments);

      // ================= TEACHING IDS =================
      const teachingIds =
        myEnrollments.map(
          (e) =>
            e.teaching_assignment
              ?.id ||
            e.teaching_assignment
        );

      // ================= FILTERED DATA =================
      setAssignments(
        allAssignments.filter(
          (a) =>
            teachingIds.includes(
              a.teaching_assignment
                ?.id ||
                a.teaching_assignment
            )
        )
      );

      setLectures(
        allLectures.filter(
          (l) =>
            teachingIds.includes(
              l.teaching_assignment
                ?.id ||
                l.teaching_assignment
            )
        )
      );

      setQuizzes(
        allQuizzes.filter(
          (q) =>
            teachingIds.includes(
              q.teaching_assignment
                ?.id ||
                q.teaching_assignment
            )
        )
      );

      // ================= MY SUBMISSIONS =================
      const mySubmissions =
        allSubmissions.filter(
          (s) =>
            (s.student?.id ||
              s.student) ===
            user.id
        );

      setSubmissions(
        mySubmissions
      );

      // ================= MY QUIZ ATTEMPTS =================
      const myAttempts =
        allAttempts.filter(
          (a) =>
            (a.student?.id ||
              a.student) ===
            user.id
        );

      setQuizAttempts(
        myAttempts
      );

      // ================= NOTIFICATIONS =================
      setNotifications(
        unreadNotifications
      );

    } catch (err) {

      console.log(
        "Student dashboard error:",
        err
      );
    }
  };

  // ================= PENDING ASSIGNMENTS =================
  const pendingAssignments =
    assignments.length -
    submissions.length;

  // ================= PENDING QUIZZES =================
  const pendingQuizzes =
    quizzes.length -
    quizAttempts.length;

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
                Welcome,
                {" "}
                {user?.username}
              </h2>

              <p>
                Student Dashboard
              </p>

            </div>

            {/* ================= DASHBOARD CARDS ================= */}
            <div className="cards">

              {/* COURSES */}
              <div className="dashboard-card blue">

                <h4>
                  My Courses
                </h4>

                <h2>
                  {courses.length}
                </h2>

              </div>

              {/* ASSIGNMENTS */}
              <div className="dashboard-card green">

                <h4>
                  Assignments
                </h4>

                <h2>
                  {assignments.length}
                </h2>

              </div>

              {/* PENDING ASSIGNMENTS */}
              <div className="dashboard-card red">

                <h4>
                  Pending Assignments
                </h4>

                <h2>
                  {pendingAssignments}
                </h2>

              </div>

              {/* LECTURES */}
              <div className="dashboard-card purple">

                <h4>
                  Lectures
                </h4>

                <h2>
                  {lectures.length}
                </h2>

              </div>

              {/* QUIZZES */}
              <div className="dashboard-card orange">

                <h4>
                  Quizzes
                </h4>

                <h2>
                  {quizzes.length}
                </h2>

              </div>

              {/* PENDING QUIZZES */}
              <div className="dashboard-card purple">

                <h4>
                  Pending Quizzes
                </h4>

                <h2>
                  {pendingQuizzes}
                </h2>

              </div>

              {/* NOTIFICATIONS */}
              <div className="dashboard-card blue">

                <h4>
                  Unread Notifications
                </h4>

                <h2>
                  {notifications.length}
                </h2>

              </div>

            </div>

            {/* ================= RECENT ACTIVITY ================= */}
            <div
              className="card"
              style={{
                marginTop: "25px",
              }}
            >

              <h3>
                Recent Activity
              </h3>

              <ul
                style={{
                  marginTop: "15px",
                  paddingLeft: "20px",
                }}
              >

                <li>
                  You are enrolled in
                  {" "}
                  <strong>
                    {courses.length}
                  </strong>
                  {" "}
                  course(s).
                </li>

                <li>
                  You completed
                  {" "}
                  <strong>
                    {quizAttempts.length}
                  </strong>
                  {" "}
                  quiz attempt(s).
                </li>

                <li>
                  You submitted
                  {" "}
                  <strong>
                    {submissions.length}
                  </strong>
                  {" "}
                  assignment(s).
                </li>

                <li>
                  You have
                  {" "}
                  <strong>
                    {notifications.length}
                  </strong>
                  {" "}
                  unread notification(s).
                </li>

              </ul>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}

export default StudentHome;