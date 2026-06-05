import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";
import API from "../../api";
import "../../App.css";

export default function Dashboard() {
  const navigate = useNavigate();

  // 🔥 Sidebar state (for mobile)
  const [open, setOpen] = useState(false);

  const [stats, setStats] = useState({
    total_users: 0,
    total_students: 0,
    total_teachers: 0,
    total_courses: 0,
    total_enrollments: 0,
  });

  const [loading, setLoading] = useState(true);

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  // Greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // Fetch dashboard stats
  const fetchStats = async () => {
    try {
      const token = localStorage.getItem("token");

      const res = await API.get("admin-dashboard/", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setStats(res.data);
    } catch (err) {
      console.error("Dashboard error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">

      {/* 🔥 FULL WIDTH NAVBAR */}
      <Navbar setOpen={setOpen} />

      {/* 🔥 BELOW NAVBAR */}
      <div className="layout">

        {/* SIDEBAR */}
        <Sidebar open={open} setOpen={setOpen} />

        {/* MAIN CONTENT */}
        <div className="main">
          <div className="content">

            {/* HEADER */}
            <div className="header-box">
              <h2>
                {getGreeting()}, {user?.username || "Admin"} 👋
              </h2>
              <p>Welcome to your LMS Admin Dashboard</p>
            </div>

            {/* CARDS */}
            <div className="cards">

              <div
                className="dashboard-card blue"
                onClick={() => navigate("/users")}
              >
                <h4>Total Users</h4>
                <h2>{loading ? "..." : stats.total_users}</h2>
              </div>

              <div
                className="dashboard-card green"
                onClick={() => navigate("/students")}
              >
                <h4>Students</h4>
                <h2>{loading ? "..." : stats.total_students}</h2>
              </div>

              <div
                className="dashboard-card purple"
                onClick={() => navigate("/teachers")}
              >
                <h4>Teachers</h4>
                <h2>{loading ? "..." : stats.total_teachers}</h2>
              </div>

              <div
                className="dashboard-card orange"
                onClick={() => navigate("/courses")}
              >
                <h4>Courses</h4>
                <h2>{loading ? "..." : stats.total_courses}</h2>
              </div>

              <div
                className="dashboard-card red"
                onClick={() => navigate("/enrollments")}
              >
                <h4>Enrollments</h4>
                <h2>{loading ? "..." : stats.total_enrollments}</h2>
              </div>

            </div>

          </div>
        </div>

      </div>
    </div>
  );
}