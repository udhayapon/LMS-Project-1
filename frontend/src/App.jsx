import {BrowserRouter,Routes,Route,Navigate}
from "react-router-dom";

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
import TimetableView from "./features/timetable/TimetableView";  
import AttendanceTeacher from "./features/attendance/AttendanceTeacher";
import AttendanceStudent from "./features/attendance/AttendanceStudent";
import StudentProgress from "./features/progress/StudentProgress";
import TeacherProgress from "./features/progress/TeacherProgress";
import AdminFees from "./features/fees/AdminFees";
import Results from "./features/results/Results";
import Calendar from "./features/calendar/Calendar";
import Announcements from "./features/announcements/Announcements";
 
// ===== ADMIN =====
import Dashboard from "./pages/Admin/Dashboard";
import Students from "./pages/Admin/Students";
import Teachers from "./pages/Admin/Teachers";
import AdminUsers from "./pages/Admin/AdminUsers";
import Parents from "./pages/Admin/Parents";

import Enrollments from "./pages/Admin/Enrollments";
import Departments from "./pages/Admin/Departments";

// ===== TEACHER =====
import TeacherHome from "./pages/Teacher/TeacherHome";
import SubjectDetails from "./pages/Teacher/SubjectDetails";
import TeacherChat from "./pages/Teacher/TeacherChat";

// ===== ASSIGNMENTS =====
import AssignmentSubmissions from "./features/assignments/AssignmentSubmissions";

// ===== STUDENT =====
import StudentHome from "./pages/Student/StudentHome";
import StudentCourses from "./pages/Student/StudentCourses";
import StudentSubjectDetails from "./pages/Student/StudentSubjectDetails";
import StudentGrades from "./pages/Student/StudentGrades";

// ===== PARENT =====
import ParentDashboard from "./pages/Parent/ParentDashboard";
import ParentAttendance from "./features/Attendance/ParentAttendance";
import ParentAssignments from "./features/assignments/ParentAssignments";
import ParentFees from "./features/fees/ParentFees";
import ParentGrades from "./pages/Parent/ParentGrades";
import ParentChat from "./pages/Parent/ParentChat";
import ParentMessage from "./pages/Parent/ParentMessage";

import HODDepartment from "./features/hod/HODDepartment";
import MyClass from "./features/tutor/MyClass";

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
function ProtectedRoute({ children, role, roles, adminOnly = false }) {

  const user = getUser();

  if (!user)
    return (<Navigate to="/" replace />);

  const userRole = user.role?.toLowerCase();

  // admin-only routes
  if (adminOnly && userRole !== "admin") {
    return (<Navigate to="/" replace />);
  }

  // single allowed role
  if (role && userRole !== role.toLowerCase()) {
    return (<Navigate to="/" replace />);
  }

  // multiple allowed roles
  if (roles && !roles.map((r) => r.toLowerCase()).includes(userRole)) {
    return (<Navigate to="/" replace />);
  }

  return children;
}


// ================= ROLE REDIRECT =================
function RoleRedirect() {

  const user = getUser();

  if (!user) 
    return (<Navigate to="/" replace />);

  const role =
    user.role?.toLowerCase();

  if (role === "admin")
    return (<Navigate to="/dashboard" replace/>);

  if (role === "accounts_admin")
    return (<Navigate to="/admin/fees" replace/>);

  if (role === "exam_admin")
    return (<Navigate to="/results" replace/>);

  if (role === "academic_admin")
    return (<Navigate to="/courses" replace/>);

  if (role === "teacher")
    return (<Navigate to="/teacher" replace/>);

  if (role === "student")
    return (<Navigate to="/student" replace/>);

  if (role === "parent")
  return (<Navigate to="/parent" replace />);

  return (<Navigate to="/" replace /> );
}


// ================= APP =================
function App() {

  return (

    <BrowserRouter>

      <Routes>

        {/* ===== PUBLIC ===== */}
        <Route path="/" element={<Login />}/>

        {/* ===== AFTER LOGIN ===== */}
        <Route path="/home" element={<RoleRedirect />} />

        {/* ================= COMMON ================= */}

        <Route path="/courses" element={  <ProtectedRoute> <Courses /> </ProtectedRoute> }/>
        <Route path="/courses/:id" element={ <ProtectedRoute> <CourseDetails /> </ProtectedRoute> }/>

        {/* ================= ADMIN ================= */}

        <Route path="/dashboard" element={ <ProtectedRoute adminOnly={true}> <Dashboard /></ProtectedRoute> }/>

        {/* ================= STUDENTS ================= */}
        <Route path="/students" element={ <ProtectedRoute adminOnly={true}> <Students /> </ProtectedRoute>} />

        {/* ================= TEACHERS ================= */}
        <Route path="/teachers" element={  <ProtectedRoute adminOnly={true}> <Teachers />  </ProtectedRoute>  }/>

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

        <Route
  path="/parents-admin"
  element={
    <ProtectedRoute adminOnly={true}>
      <Parents />
    </ProtectedRoute>
  }
/>

        {/* ================= ENROLLMENTS ================= */}
        <Route path="/enrollments" element={ <ProtectedRoute roles={["admin", "academic_admin"]} > <Enrollments /></ProtectedRoute> }/>

        {/* ================= YEARS ================= */}
        <Route path="/years" element={ <ProtectedRoute adminOnly={true} > <Years /> </ProtectedRoute>} />

        {/* ================= SUBJECTS ================= */}
        <Route path="/subjects" element={ <ProtectedRoute adminOnly={true}> <Subjects /> </ProtectedRoute>}/>

        {/* ================= TEACHING ASSIGNMENTS ================= */}
        <Route path="/teaching-assignments" element={ <ProtectedRoute roles={["admin", "academic_admin"]}><TeachingAssignments /></ProtectedRoute> }/>
        <Route path="/teacher/attendance" element={<ProtectedRoute role="teacher"><AttendanceTeacher /></ProtectedRoute>} />
        <Route path="/student/attendance" element={<ProtectedRoute role="student"><AttendanceStudent /></ProtectedRoute>} />
        <Route path="/results" element={<ProtectedRoute><Results /></ProtectedRoute>} />

        {/* ================= DEPARTMENTS ================= */}
        <Route path="/departments" element={ <ProtectedRoute roles={["admin", "academic_admin"]} ><Departments /></ProtectedRoute> }/>

        {/* ================= TEACHER ================= */}

        <Route path="/teacher" element={ <ProtectedRoute role="teacher"> <TeacherHome /></ProtectedRoute> }/>
        <Route path="/teacher/subject/:id" element={ <ProtectedRoute role="teacher"><SubjectDetails /></ProtectedRoute>}/>
        <Route path="/teacher-progress" element={ <ProtectedRoute role="teacher"> <TeacherProgress /></ProtectedRoute>}/>
        <Route path="/teacher/messages" element={ <ProtectedRoute role="teacher"> <TeacherChat /> </ProtectedRoute> }/>


        {/* ================= ASSIGNMENT SUBMISSIONS ================= */}

        <Route path="/assignments/:id/submissions" element={ <ProtectedRoute> <AssignmentSubmissions /> </ProtectedRoute> }/>

        {/* ================= STUDENT ================= */}

        <Route path="/student" element={ <ProtectedRoute role="student" > <StudentHome /> </ProtectedRoute> } />
        <Route path="/student/courses" element={ <ProtectedRoute role="student"> <StudentCourses /> </ProtectedRoute>  }/> 

        <Route path="/student/subject/:id" element={<ProtectedRoute role="student"> <StudentSubjectDetails /> </ProtectedRoute>}/>

        <Route path="/student/grades" element={<ProtectedRoute role="student" > <StudentGrades /> </ProtectedRoute> }/>

        <Route path="/student-progress" element={ <ProtectedRoute role="student"> <StudentProgress /> </ProtectedRoute>}/>
        <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
       
        <Route path="/announcements" element={<ProtectedRoute><Announcements /></ProtectedRoute>} />
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
         {/* ================= PARENT ================= */}

        <Route path="/parent" element={<ProtectedRoute role="parent"> <ParentDashboard /> </ProtectedRoute>}/>
        <Route path="/parent/attendance" element={ <ProtectedRoute role="parent"> <ParentAttendance /> </ProtectedRoute>}/>
        <Route path="/parent/assignments" element={<ProtectedRoute role="parent"> <ParentAssignments /> </ProtectedRoute>}/>
        <Route path="/parent/fees" element={ <ProtectedRoute role="parent"> <ParentFees /> </ProtectedRoute>}/>
        <Route path="/parent/grades" element={  <ProtectedRoute role="parent"> <ParentGrades /> </ProtectedRoute>}/>
        <Route path="/parent/chat" element={ <ProtectedRoute role="parent"> <ParentChat /> </ProtectedRoute>}/>
        <Route path="/parent/messages" element={ <ProtectedRoute role="parent"> <ParentMessage /> </ProtectedRoute>}/>
        <Route path="/admin/fees" element={<ProtectedRoute roles={["admin", "accounts_admin"]}> <AdminFees /> </ProtectedRoute>} />
        <Route path="/my-department" element={<HODDepartment />} />
        <Route path="/my-class" element={<MyClass />} />

        {/* ===== FALLBACK ===== */}
        <Route path="*" element={ <Navigate to="/" replace/>}/>

      </Routes>

    </BrowserRouter>
  );
}

export default App;