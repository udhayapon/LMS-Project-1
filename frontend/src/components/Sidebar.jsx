import { useNavigate, useLocation } from "react-router-dom";

import { useState, useEffect } from "react";
import API from "../api";

export default function Sidebar({ open, setOpen }) {

  const navigate = useNavigate();
  const location = useLocation();

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const [usersOpen, setUsersOpen] = useState(true);
  const [isHod, setIsHod] = useState(false);
  const [isTutor, setIsTutor] = useState(false);

  useEffect(() => {
    if (user.role === "teacher") {
      API.get("users/my-department/")
        .then((res) => setIsHod(res.data?.is_hod || false))
        .catch(() => setIsHod(false));

      API.get("users/my-class/")
        .then((res) => setIsTutor(res.data?.is_tutor || false))
        .catch(() => setIsTutor(false));
    }
  }, [user.role]);

  let menu = [];

  // ================= FULL ADMIN (SUPER ADMIN) =================
  if (user.role === "admin") {
    menu = [
      { name: "Dashboard", path: "/dashboard" },
      { name: "Departments", path: "/departments" },
      {
        name: "Users",
        children: [
          { name: "Students", path: "/students" },
          { name: "Teachers", path: "/teachers" },
          { name: "Admins", path: "/admins" },
          { name: "Parents", path: "/parents-admin" },
        ],
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

  // ================= ACCOUNTS ADMIN =================
  else if (user.role === "accounts_admin") {
    menu = [
      { name: "Fee Management", path: "/admin/fees" },
      { name: "Announcements", path: "/announcements" },
      { name: "Profile", path: "/profile" },
    ];
  }

  // ================= EXAMINATION ADMIN =================
  else if (user.role === "exam_admin") {
    menu = [
      { name: "Results", path: "/results" },
       { name: "Announcements", path: "/announcements" },
      { name: "Profile", path: "/profile" },
    ];
  }

  // ================= ACADEMIC ADMIN =================
  else if (user.role === "academic_admin") {
    menu = [
      { name: "Departments", path: "/departments" },
      { name: "Courses", path: "/courses" },
      { name: "Faculty Allocation", path: "/teaching-assignments" },
      { name: "Enrollments", path: "/enrollments" },
      { name: "Profile", path: "/profile" },
    ];
  }

  // ================= TEACHER =================
  else if (user.role === "teacher") {
    menu = [
      { name: "Dashboard", path: "/teacher" },
      ...(isHod ? [{ name: "My Department", path: "/my-department" }] : []),
      ...(isTutor ? [{ name: "My Class", path: "/my-class" }] : []),
      { name: "My Subjects", path: "/courses" },
      { name: "Timetable", path: "/timetable" },
      { name: "Attendance", path: "/teacher/attendance" },
      { name: "Calendar", path: "/calendar" },
      { name: "Results", path: "/results" },
      { name: "Student Progress", path: "/teacher-progress" },
      { name: "Announcements", path: "/announcements" },
      { name: "Messages", path: "/teacher/messages" },
      { name: "Feedback History", path: "/feedback" },
      { name: "Notifications", path: "/notifications" },
      { name: "Profile", path: "/profile" },
    ];
  } else if (user.role === "student") {
    menu = [
      { name: "Dashboard", path: "/student" },
      { name: "My Subjects", path: "/student/courses" },
      { name: "Timetable", path: "/timetable" },
      { name: "Attendance", path: "/student/attendance" },
      { name: "Grades", path: "/student/grades" },
      { name: "Results", path: "/results" },
      { name: "My Progress", path: "/student-progress" },
      { name: "Calendar", path: "/calendar" },
      { name: "Announcements", path: "/announcements" },
      { name: "Feedback History", path: "/feedback" },
      { name: "Notifications", path: "/notifications" },
      { name: "Profile", path: "/profile" },
    ];
  } else if (user.role === "parent") {
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

  // exact-match active check
  const isActive = (path) => location.pathname === path;

  return (
    <>
      {open && (
        <div className="sidebar-overlay" onClick={() => setOpen(false)} />
      )}

      <div className={`sidebar ${open ? "open" : ""}`}>
        <h2 className="logo">LMS</h2>

        <div className="user-info">
          <div className="avatar">
            {user?.username?.slice(0, 2).toUpperCase() || "US"}
          </div>
          <div>
            <p>{user?.username}</p>
            <span>{user?.role}</span>
          </div>
        </div>

        <div className="menu">
          {menu.map((item) => (
            <div key={item.name}>
              {!item.children && (
                <p
                  onClick={() => {
                    navigate(item.path);
                    setOpen(false);
                  }}
                  className={isActive(item.path) ? "active" : ""}
                >
                  {item.name}
                </p>
              )}

              {item.children && (
                <div>
                  <p onClick={() => setUsersOpen(!usersOpen)}>{item.name}</p>
                  {usersOpen && (
                    <div style={{ marginLeft: "20px" }}>
                      {item.children.map((sub) => (
                        <p
                          key={sub.name}
                          onClick={() => {
                            navigate(sub.path);
                            setOpen(false);
                          }}
                          className={isActive(sub.path) ? "active" : ""}
                        >
                          {sub.name}
                        </p>
                      ))}
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