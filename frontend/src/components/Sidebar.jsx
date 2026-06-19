import { useNavigate, useLocation } from "react-router-dom";

import { useState, useEffect } from "react";
import API from "../api";

export default function Sidebar({ open, setOpen }) {

  const navigate = useNavigate();
  const location = useLocation();

  const user = JSON.parse(
    localStorage.getItem("user") || "{}"
  );

  // ================= USERS DROPDOWN =================
  const [usersOpen, setUsersOpen] = useState(true);

  // ================= IS HOD? (for teachers only) =================
  const [isHod, setIsHod] = useState(false);

  useEffect(() => {
    if (user.role === "teacher") {
      API.get("users/my-department/")
        .then((res) => setIsHod(res.data?.is_hod || false))
        .catch(() => setIsHod(false));
    }
  }, [user.role]);

  let menu = [];

  // ================= ADMIN =================
  if (user.role === "admin") {

    menu = [

      { name: "Dashboard", path: "/dashboard" },

      { name: "Departments", path: "/departments" },

      // ================= USERS GROUP =================
      {
        name: "Users",
        children: [

          { name: "Students", path: "/students" },
          { name: "Teachers", path: "/teachers" },
          { name: "Admins", path: "/admins" },
          { name: "Parents", path: "/parents-admin" },

        ]
      },

      { name: "Courses", path: "/courses" },
      { name: "Faculty Allocation", path: "/teaching-assignments" },
      { name: "Enrollments", path: "/enrollments" },
      { name: "Timetable Builder", path: "/timetable-builder" },
      { name: "Results", path: "/results" },
      { name: "Fee Management", path: "/admin/fees" },
      { name: "Calendar", path: "/calendar" },
      { name: "Announcements", path: "/announcements" },
      { name: "Profile", path: "/profile" },
    ];
  }

  // ================= TEACHER =================
  else if (
    user.role === "teacher"
  ) {

    menu = [

      {name: "Dashboard",path: "/teacher"},

      // ================= HOD-ONLY LINK =================
      ...(isHod ? [{ name: "My Department", path: "/my-department" }] : []),

      {
        name: "My Subjects",
        path: "/courses"
      },
      {
        name: "Timetable",
        path: "/timetable"
      },

      {
        name: "Attendance",
        path: "/teacher/attendance"
      },
      { name: "Calendar", path: "/calendar" },

      {
        name: "Results",
        path: "/results"
      },
      {
        name: "Student Progress",
        path: "/teacher-progress"
      },
      { name: "Announcements", path: "/announcements" },

      {
        name: "Messages",
        path: "/teacher/messages"
      },

      {
        name: "Feedback History",
        path: "/feedback"
      },

      {
        name: "Notifications",
        path: "/notifications"
      },

      {
        name: "Profile",
        path: "/profile"
      },
    ];
  }

  // ================= STUDENT =================
  else if (
    user.role === "student"
  ) {

    menu = [

      {
        name: "Dashboard",
        path: "/student"
      },

      {
        name: "My Subjects",
        path:
          "/student/courses"
      },
      {
        name: "Timetable",
        path: "/timetable"
      },

      {
        name: "Attendance",
        path: "/student/attendance"
      },

      {
        name: "Grades",
        path: "/student/grades"
      },

      {
        name: "Results",
        path: "/results"
      },
      {
        name: "My Progress",
        path: "/student-progress"
      },
      { name: "Calendar", path: "/calendar" },
      { name: "Announcements", path: "/announcements" },
      {
        name: "Feedback History",
        path: "/feedback"
      },
      {
        name: "Notifications",
        path: "/notifications"
      },

      { name: "Profile", path: "/profile" },
    ];
  }

  // ================= PARENT =================
  else if (user.role === "parent") {
    menu = [
      { name: "Dashboard", path: "/parent" },
      { name: "Grades", path: "/parent/grades" },
      { name: "Attendance", path: "/parent/attendance" },
      { name: "Assignments", path: "/parent/assignments" },
      { name: "Results", path: "/results" },
      { name: "Fees", path: "/parent/fees" },
      { name: "Messages", path: "/parent/chat" },
      { name: "Notifications", path: "/notifications" },
      { name: "Profile", path: "/profile" },

    ];
  }

  // ================= ACTIVE =================
  const isActive = (path) => {

    // EXACT MATCH
    if (
      location.pathname === path
    ) {

      return true;
    }

    // ================= STUDENT DASHBOARD =================
    if (
      path === "/student"
    ) {

      return (
        location.pathname ===
        "/student"
      );
    }

    // ================= TEACHER DASHBOARD =================
    if (
      path === "/teacher"
    ) {

      return (
        location.pathname ===
        "/teacher"
      );
    }

    // ================= ADMIN DASHBOARD =================
    if (
      path === "/dashboard"
    ) {

      return (
        location.pathname === "/dashboard"
      );
    }

    // ================= PARENT DASHBOARD =================
    if (path === "/parent") {
      return location.pathname === "/parent";
    }


    // ================= NORMAL MATCH =================
    return (
      location.pathname.startsWith(
        path
      )
    );
  };

  return (
    <>

      {/* ================= OVERLAY ================= */}
      {open && (

        <div
          className="sidebar-overlay"
          onClick={() =>
            setOpen(false)
          }
        />

      )}

      {/* ================= SIDEBAR ================= */}
      <div
        className={`sidebar ${
          open ? "open" : ""
        }`}
      >

        {/* ================= LOGO ================= */}
        <h2 className="logo">
          LMS
        </h2>

        {/* ================= USER INFO ================= */}
        <div className="user-info">

          <div className="avatar">

            {user?.username
              ?.slice(0, 2)
              .toUpperCase() || "US"}

          </div>

          <div>

            <p>
              {user?.username}
            </p>

            <span>
              {user?.role}
            </span>

          </div>

        </div>

        {/* ================= MENU ================= */}
        <div className="menu">

          {menu.map((item) => (

            <div key={item.name}>

              {/* ================= NORMAL MENU ================= */}
              {!item.children && (

                <p
                  onClick={() => {

                    navigate(
                      item.path
                    );

                    setOpen(false);
                  }}

                  className={
                    isActive(item.path)
                      ? "active"
                      : ""
                  }
                >

                  {item.name}

                </p>
              )}

              {/* ================= USERS DROPDOWN ================= */}
              {item.children && (

                <div>

                  <p
                    onClick={() =>
                      setUsersOpen(
                        !usersOpen
                      )
                    }
                  >

                    {item.name}

                  </p>

                  {usersOpen && (

                    <div
                      style={{
                        marginLeft: "20px"
                      }}
                    >

                      {item.children.map(
                        (sub) => (

                          <p
                            key={sub.name}

                            onClick={() => {

                              navigate(
                                sub.path
                              );

                              setOpen(false);
                            }}

                            className={
                              isActive(
                                sub.path
                              )
                                ? "active"
                                : ""
                            }
                          >

                            {sub.name}

                          </p>
                        )
                      )}

                    </div>
                  )}

                </div>
              )}

            </div>
          ))}

        </div>

      </div>

    </>
  );
}