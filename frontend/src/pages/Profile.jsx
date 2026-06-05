import { useEffect, useState } from "react";

import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import API from "../api";

export default function Profile() {

  // ================= USER =================
  const user = JSON.parse(
    localStorage.getItem("user") || "{}"
  );

  // ================= STATES =================
  const [open, setOpen] =
    useState(false);

  const [courseName, setCourseName] =
    useState("-");

  const [profileData, setProfileData] =
    useState(null);

  // ================= FETCH PROFILE =================
  const fetchProfile = async () => {

    try {

      const res = await API.get(
        "/users/"
      );

      const users =
        res.data?.results ||
        res.data ||
        [];

      const currentUser =
        users.find(
          (u) => u.id === user.id
        );

      setProfileData(
        currentUser
      );

    } catch (err) {

      console.log(err);
    }
  };

  // ================= FETCH COURSE =================
  const fetchCourse = async () => {

    try {

      // ================= STUDENT =================
      if (user.role === "student") {

        const res = await API.get(
          "/enrollments/"
        );

        const enrollments =
          res.data?.results ||
          res.data ||
          [];

        const myEnrollment =
          enrollments.find(
            (e) =>
              (e.student?.id ||
                e.student) ===
              user.id
          );

        if (myEnrollment) {

          setCourseName(
            myEnrollment.course_name
          );
        }
      }

    } catch (err) {

      console.log(err);
    }
  };

  // ================= LOAD =================
  useEffect(() => {

    fetchProfile();

    fetchCourse();

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

        <div className="main">

          <div className="content">

            {/* ================= PAGE HEADER ================= */}
            <div
              style={{
                marginBottom: "25px",
              }}
            >

              <h1>
                My Profile
              </h1>

              <p>
                View your account details
              </p>

            </div>

            {/* ================= PROFILE CARD ================= */}
            <div className="card">

              <div
                style={{
                  display: "flex",
                  gap: "25px",
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >

                {/* ================= AVATAR ================= */}
                <div
                  style={{
                    width: "100px",
                    height: "100px",
                    borderRadius: "50%",
                    background:
                      "linear-gradient(135deg, #3b82f6, #2563eb)",

                    color: "white",

                    display: "flex",

                    alignItems: "center",

                    justifyContent:
                      "center",

                    fontSize: "34px",

                    fontWeight: "bold",

                    boxShadow:
                      "0 6px 18px rgba(59,130,246,0.3)",
                  }}
                >

                  {user?.username
                    ?.slice(0, 2)
                    .toUpperCase()}

                </div>

                {/* ================= USER DETAILS ================= */}
                <div
                  style={{
                    flex: 1,
                  }}
                >

                  <h2
                    style={{
                      marginBottom: "8px",
                    }}
                  >

                    {user?.username}

                  </h2>

                  <p
                    style={{
                      color: "#64748b",
                      marginBottom: "10px",
                    }}
                  >

                    {user?.email}

                  </p>

                  {/* ROLE */}
                  <span
                    style={{
                      background:"#dbeafe",
                      color: "#1d4ed8",
                      padding:"6px 14px",
                      borderRadius: "999px",
                      fontSize: "13px",
                      fontWeight: "600",
                      textTransform: "capitalize",
                    }}
                  >

                    {user?.role}

                  </span>

                </div>

              </div>

            </div>

            {/* ================= ACCOUNT INFO ================= */}
            <div
              className="card"
              style={{
                marginTop: "25px",
              }}
            >

              <h2
                style={{
                  marginBottom: "20px",
                }}
              >
                Account Information
              </h2>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(250px, 1fr))",

                  gap: "20px",
                }}
              >

                {/* USERNAME */}
                <div>

                  <h4>
                    Username
                  </h4>

                  <p>
                    {user?.username}
                  </p>

                </div>

                {/* EMAIL */}
                <div>

                  <h4>
                    Email
                  </h4>

                  <p>
                    {user?.email}
                  </p>

                </div>

                {/* ROLE */}
                <div>

                  <h4>
                    Role
                  </h4>

                  <p
                    style={{
                      textTransform:
                        "capitalize",
                    }}
                  >

                    {user?.role}

                  </p>

                </div>

                {/* ROLL NUMBER / EMPLOYEE ID */}
                <div>

                  <h4>

                    {user?.role === "student"

                      ? "Roll Number"

                      : "Employee ID"}

                  </h4>

                  <p>

                    {profileData?.roll_number ||

                      profileData?.employee_id ||

                      "-"}

                  </p>

                </div>

                {/* DEPARTMENT */}
                <div>

                  <h4>
                    Department
                  </h4>

                  <p>

                    {profileData?.department_name ||
                      "-"}

                  </p>

                </div>

                {/* COURSE ONLY FOR STUDENTS */}
                {user?.role === "student" && (

                  <div>

                    <h4>
                      Course
                    </h4>

                    <p>
                      {courseName}
                    </p>

                  </div>

                )}

              </div>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}