import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";

export default function ChangePassword() {

  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  const handleSubmit = async () => {
    setError("");

    if (!newPassword || !confirm) {
      return setError("Please fill both fields");
    }
    if (newPassword.length < 6) {
      return setError("Password must be at least 6 characters");
    }
    if (newPassword !== confirm) {
      return setError("Passwords do not match");
    }

    setLoading(true);

    try {
      // NOTE: adjust this endpoint + field name to match your change_password view
      await API.post("users/change-password/", {
        new_password: newPassword,
      });

      // update the stored user so we don't loop back here
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      user.must_change_password = false;
      localStorage.setItem("user", JSON.stringify(user));

      alert("Password changed successfully. Please continue.");

      // send them to their real home
      const role = (user.role || "").toLowerCase();
      if (role === "parent") navigate("/parent");
      else if (role === "student") navigate("/student");
      else if (role === "teacher") navigate("/teacher");
      else navigate("/home");

    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.error || "Could not change password");
    }

    setLoading(false);
  };

  return (
    <div style={styles.page}>
      <div style={styles.box}>

        <h2 style={styles.title}>Set your new password</h2>
        <p style={styles.sub}>
          For your security, please change your first-time password before continuing.
        </p>

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.field}>
          <label style={styles.label}>New password</label>
          <input
            type={show ? "text" : "password"}
            placeholder="Enter new password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={styles.input}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Confirm password</label>
          <input
            type={show ? "text" : "password"}
            placeholder="Re-enter new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            style={styles.input}
          />
        </div>

        <label style={styles.showRow}>
          <input type="checkbox" checked={show} onChange={() => setShow(!show)} />
          <span style={{ fontSize: 13, color: "#475569" }}>Show password</span>
        </label>

        <button onClick={handleSubmit} disabled={loading} style={styles.btn}>
          {loading ? "Saving..." : "Change password"}
        </button>

      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#e8f0fe",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: '"Segoe UI", system-ui, sans-serif',
    padding: 24,
  },
  box: {
    background: "#fff",
    width: 400,
    maxWidth: "100%",
    borderRadius: 16,
    padding: "36px 32px",
    boxShadow: "0 20px 50px rgba(30,64,175,0.15)",
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: "#0f172a",
    margin: "0 0 6px",
  },
  sub: {
    fontSize: 13,
    color: "#64748b",
    margin: "0 0 24px",
    lineHeight: 1.6,
  },
  error: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#b91c1c",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    marginBottom: 18,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "#374151",
    marginBottom: 7,
  },
  input: {
    width: "100%",
    padding: "12px 14px",
    fontSize: 14,
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    background: "#f8fafc",
    outline: "none",
    boxSizing: "border-box",
  },
  showRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    margin: "4px 0 22px",
    cursor: "pointer",
  },
  btn: {
    width: "100%",
    padding: "13px 0",
    fontSize: 15,
    fontWeight: 700,
    background: "#1d4ed8",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
  },
};