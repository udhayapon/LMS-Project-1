import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../api";
import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";
import "../../styles/Courses.css";

export default function StudentCourses() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [open, setOpen] = useState(false);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchCourses(); }, []);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const res = await API.get("/enrollments/");
      const enrollments = res.data?.results || res.data || [];
      setCourses(enrollments.filter((e) => (e.student?.id || e.student) === user.id));
    } catch (err) {
      console.log("Error fetching courses:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <Navbar setOpen={setOpen} />
      <div className="layout">
        <Sidebar open={open} setOpen={setOpen} />
        <div className="main">
          <div className="content">
            <div className="courses-page">

              {/* ── Header ── */}
              <div className="courses-header">
                <div>
                  <h1 className="courses-title">My Subjects</h1>
                  <p className="courses-subtitle">View your enrolled subjects</p>
                </div>
                {!loading && (
                  <span className="courses-count">
                    {courses.length} subject{courses.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {/* ── Loading ── */}
              {loading ? (
                <div className="courses-loading">
                  <div className="courses-spinner" />
                  <p>Loading subjects…</p>
                </div>

              ) : courses.length === 0 ? (
                <div className="courses-empty">
                  <p>No enrolled subjects found.</p>
                </div>

              ) : (
                <div className="courses-table-wrap">
                  <table className="courses-table">
                    <thead>
                      <tr>
                        <th>Course</th>
                        <th>Subject</th>
                        <th>Year</th>
                        <th>Teacher</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {courses.map((c) => (
                        <tr key={c.id}>
                          <td>{c.course_name}</td>
                          <td className="courses-td-subject">{c.subject_name}</td>
                          <td>Year {c.year_number}</td>
                          <td>{c.teacher_name}</td>
                          <td>
                            <button
                              className="courses-open-btn"
                              onClick={() => navigate(`/student/subject/${c.teaching_assignment}`)}
                            >
                              Open
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}