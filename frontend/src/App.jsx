import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";
import Courses from "./pages/Courses";
import Enrollments from "./pages/Enrollments";
import Lectures from "./pages/Lectures";
import WatchLecture from "./pages/WatchLecture";
import Assignments from "./pages/Assignments";
import TeacherHome from "./pages/TeacherHome";
import StudentSubmission from "./pages/StudentSubmission";


// ===================== SAFE USER PARSER =====================
const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    return null;
  }
};

// ===================== PROTECTED ROUTE =====================
function ProtectedRoute({ children, adminOnly = false }) {
  const user = getUser();

  // Not logged in
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Not admin (for admin routes)
  if (adminOnly && user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return children;
}


// ===================== APP =====================
function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* PUBLIC */}
        <Route path="/" element={<Login />} />

        {/* DEFAULT REDIRECT AFTER LOGIN */}
        <Route path="/home" element={<Navigate to="/dashboard" replace />} />

        {/* ADMIN ROUTES */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute adminOnly={true}>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* TEACHER ROUTE */}
        <Route
        path="/teacher-home"
        element={
          <ProtectedRoute>
            <TeacherHome />
          </ProtectedRoute>
        }
      />
        
        <Route
        path="/submissions"
        element={
          <ProtectedRoute>
            <StudentSubmission />
          </ProtectedRoute>
        }
      />

        <Route
          path="/users"
          element={
            <ProtectedRoute adminOnly={true}>
              <Users />
            </ProtectedRoute>
          }
        />

        <Route
          path="/courses"
          element={
            <ProtectedRoute adminOnly={true}>
              <Courses />
            </ProtectedRoute>
          }
        />

        <Route
          path="/enrollments"
          element={
            <ProtectedRoute adminOnly={true}>
              <Enrollments />
            </ProtectedRoute>
          }
        />

        {/* COMMON ROUTES (Teacher / Student) */}
        <Route
          path="/lectures"
          element={
            <ProtectedRoute>
              <Lectures />
            </ProtectedRoute>
          }
        />

        <Route path="/watch/:id" element={<WatchLecture />} />

        <Route
          path="/assignments"
          element={
            <ProtectedRoute>
              <Assignments />
            </ProtectedRoute>
          }
        />

        {/* FALLBACK */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;