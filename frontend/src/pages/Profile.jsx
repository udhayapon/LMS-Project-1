import { useEffect, useState } from "react";

import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import API from "../api";
import "../App.css";

export default function Profile() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const [open, setOpen] = useState(false);
  const [courseName, setCourseName] = useState("-");
  const [profileData, setProfileData] = useState(null);

  // change-password
  const [showPw, setShowPw] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changing, setChanging] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);

  const fetchProfile = async () => {
    try {
      const res = await API.get("/users/");
      const users = res.data?.results || res.data || [];
      setProfileData(users.find((u) => u.id === user.id));
    } catch (err) {
      console.log(err);
    }
  };

  const fetchCourse = async () => {
    try {
      if (user.role === "student") {
        const res = await API.get("/enrollments/");
        const enrollments = res.data?.results || res.data || [];
        const myEnrollment = enrollments.find(
          (e) => (e.student?.id || e.student) === user.id
        );
        if (myEnrollment) setCourseName(myEnrollment.course_name);
      }
    } catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchCourse();
  }, []);

  const handleChangePassword = async () => {
    setPwMsg(null);
    if (!oldPassword || !newPassword || !confirmPassword) {
      return setPwMsg({ type: "err", text: "Please fill all password fields." });
    }
    if (newPassword.length < 6) {
      return setPwMsg({ type: "err", text: "New password must be at least 6 characters." });
    }
    if (newPassword !== confirmPassword) {
      return setPwMsg({ type: "err", text: "New password and confirmation do not match." });
    }
    setChanging(true);
    try {
      await API.post("/users/change-password/", {
        old_password: oldPassword,
        new_password: newPassword,
      });
      setPwMsg({ type: "ok", text: "Password changed successfully." });
      setOldPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err) {
      setPwMsg({ type: "err", text: err.response?.data?.detail || "Could not change password." });
    } finally {
      setChanging(false);
    }
  };

  const initials = user?.username?.slice(0, 2).toUpperCase();

  return (
    <div className="app">
      <Navbar setOpen={setOpen} />
      <div className="layout">
        <Sidebar open={open} setOpen={setOpen} />
        <div className="main">
          <div className="content">
            <div className="sd-root">

              {/* ===== HERO ===== */}
              <div className="prof-hero">
                <div className="prof-avatar">{initials}</div>
                <div>
                  <h1 className="prof-hname">{user?.username}</h1>
                  <p className="prof-hmail">{user?.email}</p>
                  <span className="prof-hrole">{user?.role}</span>
                </div>
              </div>

              {/* ===== ACCOUNT INFO ===== */}
              <div className="sd-panel" style={{ marginTop: 18 }}>
                <div className="sd-pt">Account Information</div>
                <div className="prof-info-grid">
                  <div>
                    <div className="prof-field-label">Username</div>
                    <div className="prof-field-value">{user?.username}</div>
                  </div>
                  <div>
                    <div className="prof-field-label">Email</div>
                    <div className="prof-field-value">{user?.email}</div>
                  </div>
                  <div>
                    <div className="prof-field-label">Role</div>
                    <div className="prof-field-value" style={{ textTransform: "capitalize" }}>{user?.role}</div>
                  </div>
                  <div>
                    <div className="prof-field-label">
                      {user?.role === "student" ? "Roll Number" : "Employee ID"}
                    </div>
                    <div className="prof-field-value">
                      {profileData?.roll_number || profileData?.employee_id || "-"}
                    </div>
                  </div>
                  <div>
                    <div className="prof-field-label">Department</div>
                    <div className="prof-field-value">{profileData?.department_name || "-"}</div>
                  </div>
                  {user?.role === "student" && (
                    <div>
                      <div className="prof-field-label">Course</div>
                      <div className="prof-field-value">{courseName}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* ===== SECURITY / CHANGE PASSWORD ===== */}
              <div className="sd-panel" style={{ marginTop: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                  <div>
                    <div className="sd-pt" style={{ marginBottom: 2 }}>Security</div>
                    <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>
                      Manage the password you use to log in.
                    </p>
                  </div>
                  {!showPw && (
                    <button className="prof-pw-toggle" onClick={() => { setShowPw(true); setPwMsg(null); }}>
                      Change Password
                    </button>
                  )}
                </div>

                {showPw && (
                  <div style={{ marginTop: 18, maxWidth: 420 }}>
                    <div className="prof-pw-field">
                      <label>Current Password</label>
                      <input type="password" className="prof-pw-input"
                        placeholder="Enter current password"
                        value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} />
                    </div>
                    <div className="prof-pw-field">
                      <label>New Password</label>
                      <input type="password" className="prof-pw-input"
                        placeholder="At least 6 characters"
                        value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                    </div>
                    <div className="prof-pw-field">
                      <label>Confirm New Password</label>
                      <input type="password" className="prof-pw-input"
                        placeholder="Re-enter new password"
                        value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                    </div>

                    {pwMsg && (
                      <div className="prof-pw-msg" style={{ color: pwMsg.type === "ok" ? "#16a34a" : "#dc2626" }}>
                        {pwMsg.text}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                      <button className="prof-pw-btn" onClick={handleChangePassword} disabled={changing}>
                        {changing ? "Updating…" : "Update Password"}
                      </button>
                      <button
                        className="prof-pw-toggle"
                        onClick={() => {
                          setShowPw(false); setPwMsg(null);
                          setOldPassword(""); setNewPassword(""); setConfirmPassword("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
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