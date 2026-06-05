import {
  BrowserRouter,
  Routes,
  Route,
  Navigate
} from "react-router-dom";

// ===== PUBLIC =====
import Login from "./pages/Login";

import Profile from "./pages/Profile";
import Notifications from "./pages/Notifications";

// ===== COMMON FEATURES =====
import Courses from "./features/courses/Courses";
import CourseDetails from "./features/courses/CourseDetails";
import Years from "./features/years/Years";
import Subjects from "./features/subjects/Subjects";
import TeachingAssignments from "./features/teaching/TeachingAssignments";
import FeedbackHistory from "./features/feedback/FeedbackHistory";
// ===== TIMETABLE =====
import TimetableBuilder from "./features/timetable/TimetableBuilder";
import TimetableView from "./features/timetable/TimetableView";  // (built next)

// ===== ADMIN =====
import Dashboard from "./pages/Admin/Dashboard";

import Students from "./pages/Admin/Students";
import Teachers from "./pages/Admin/Teachers";
import AdminUsers from "./pages/Admin/AdminUsers";

import Enrollments from "./pages/Admin/Enrollments";
import Departments from "./pages/Admin/Departments";

// ===== TEACHER =====
import TeacherHome from "./pages/Teacher/TeacherHome";
import SubjectDetails from "./pages/Teacher/SubjectDetails";

// ===== ASSIGNMENTS =====
import AssignmentSubmissions from "./features/assignments/AssignmentSubmissions";

// ===== STUDENT =====
import StudentHome from "./pages/Student/StudentHome";
import StudentCourses from "./pages/Student/StudentCourses";
import StudentSubjectDetails from "./pages/Student/StudentSubjectDetails";
import StudentGrades from "./pages/Student/StudentGrades";


// ================= USER HELPER =================
const getUser = () => {

  try {

    return JSON.parse(
      localStorage.getItem("user")
    );

  } catch {

    return null;
  }
};


// ================= PROTECTED ROUTE =================
function ProtectedRoute({
  children,
  role,
  adminOnly = false
}) {

  const user = getUser();

  if (!user)
    return (
      <Navigate
        to="/"
        replace
      />
    );

  if (
    adminOnly &&
    user.role?.toLowerCase() !==
      "admin"
  ) {

    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  if (
    role &&
    user.role?.toLowerCase() !==
      role.toLowerCase()
  ) {

    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  return children;
}


// ================= ROLE REDIRECT =================
function RoleRedirect() {

  const user = getUser();

  if (!user)
    return (
      <Navigate
        to="/"
        replace
      />
    );

  const role =
    user.role?.toLowerCase();

  if (role === "admin")
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );

  if (role === "teacher")
    return (
      <Navigate
        to="/teacher"
        replace
      />
    );

  if (role === "student")
    return (
      <Navigate
        to="/student"
        replace
      />
    );

  return (
    <Navigate
      to="/"
      replace
    />
  );
}


// ================= APP =================
function App() {

  return (

    <BrowserRouter>

      <Routes>

        {/* ===== PUBLIC ===== */}
        <Route
          path="/"
          element={<Login />}
        />

        {/* ===== AFTER LOGIN ===== */}
        <Route
          path="/home"
          element={<RoleRedirect />}
        />



        {/* ================= COMMON ================= */}

        <Route
          path="/courses"
          element={
            <ProtectedRoute>

              <Courses />

            </ProtectedRoute>
          }
        />

        <Route
          path="/courses/:id"
          element={
            <ProtectedRoute>

              <CourseDetails />

            </ProtectedRoute>
          }
        />



        {/* ================= ADMIN ================= */}

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute
              adminOnly={true}
            >

              <Dashboard />

            </ProtectedRoute>
          }
        />



        {/* ================= STUDENTS ================= */}
        <Route
          path="/students"
          element={
            <ProtectedRoute
              adminOnly={true}
            >

              <Students />

            </ProtectedRoute>
          }
        />



        {/* ================= TEACHERS ================= */}
        <Route
          path="/teachers"
          element={
            <ProtectedRoute
              adminOnly={true}
            >

              <Teachers />

            </ProtectedRoute>
          }
        />



        {/* ================= ADMINS ================= */}
        <Route
          path="/admins"
          element={
            <ProtectedRoute
              adminOnly={true}
            >

              <AdminUsers />

            </ProtectedRoute>
          }
        />



        {/* ================= ENROLLMENTS ================= */}
        <Route
          path="/enrollments"
          element={
            <ProtectedRoute
              adminOnly={true}
            >

              <Enrollments />

            </ProtectedRoute>
          }
        />



        {/* ================= YEARS ================= */}
        <Route
          path="/years"
          element={
            <ProtectedRoute
              adminOnly={true}
            >

              <Years />

            </ProtectedRoute>
          }
        />



        {/* ================= SUBJECTS ================= */}
        <Route
          path="/subjects"
          element={
            <ProtectedRoute
              adminOnly={true}
            >

              <Subjects />

            </ProtectedRoute>
          }
        />



        {/* ================= TEACHING ASSIGNMENTS ================= */}
        <Route
          path="/teaching-assignments"
          element={
            <ProtectedRoute
              adminOnly={true}
            >

              <TeachingAssignments />

            </ProtectedRoute>
          }
        />



        {/* ================= DEPARTMENTS ================= */}
        <Route
          path="/departments"
          element={
            <ProtectedRoute
              adminOnly={true}
            >

              <Departments />

            </ProtectedRoute>
          }
        />



        {/* ================= TEACHER ================= */}

        <Route
          path="/teacher"
          element={
            <ProtectedRoute
              role="teacher"
            >

              <TeacherHome />

            </ProtectedRoute>
          }
        />



        <Route
          path="/teacher/subject/:id"
          element={
            <ProtectedRoute
              role="teacher"
            >

              <SubjectDetails />

            </ProtectedRoute>
          }
        />



        {/* ================= ASSIGNMENT SUBMISSIONS ================= */}

        <Route
          path="/assignments/:id/submissions"
          element={
            <ProtectedRoute>

              <AssignmentSubmissions />

            </ProtectedRoute>
          }
        />



        {/* ================= STUDENT ================= */}

        <Route
          path="/student"
          element={
            <ProtectedRoute
              role="student"
            >

              <StudentHome />

            </ProtectedRoute>
          }
        />



         <Route
          path="/student/courses"
          element={
            <ProtectedRoute
              role="student"
            >

              <StudentCourses />

            </ProtectedRoute>
          }
        /> 



        <Route
          path="/student/subject/:id"
          element={
            <ProtectedRoute
              role="student"
            >

              <StudentSubjectDetails />

            </ProtectedRoute>
          }
        />



        <Route
          path="/student/grades"
          element={
            <ProtectedRoute
              role="student"
            >

              <StudentGrades />

            </ProtectedRoute>
          }
        />



        {/* ================= PROFILE ================= */}

        <Route
          path="/profile"
          element={
            <ProtectedRoute>

              <Profile />

            </ProtectedRoute>
          }
        />

        {/* ================= FEEDBACK ================= */}

        <Route
           path="/feedback"
           element={
             <ProtectedRoute>
               <FeedbackHistory />
             </ProtectedRoute>
            }
         />     

        {/* ================= NOTIFICATIONS ================= */}

        <Route
          path="/notifications"
          element={
            <ProtectedRoute>

              <Notifications />

            </ProtectedRoute>
          }
        />

        {/* ================= TIMETABLE ================= */}
        <Route
          path="/timetable-builder"
          element={
          <ProtectedRoute adminOnly={true}>
              <TimetableBuilder />
          </ProtectedRoute>
           }
        />

         <Route
          path="/timetable"
          element={
          <ProtectedRoute>
            <TimetableView />
          </ProtectedRoute>
          }
        /> 

        {/* ===== FALLBACK ===== */}
        <Route
          path="*"
          element={
            <Navigate
              to="/"
              replace
            />
          }
        />

      </Routes>

    </BrowserRouter>
  );
}

export default App;