import React, {
  useEffect,
  useState
} from "react";

import {
  useNavigate
} from "react-router-dom";

import API from "../api";

function Navbar({ setOpen }) {

  const user = JSON.parse(
    localStorage.getItem("user") || "{}"
  );

  const navigate = useNavigate();

  // ================= NOTIFICATIONS =================
  const [notifications, setNotifications] =
    useState([]);

  const [showNotifications, setShowNotifications] =
    useState(false);

  // ================= FETCH =================
  const fetchNotifications = async () => {

    try {

      const res = await API.get(
        "/notifications/?unread=true"
      );

      setNotifications(
        res.data?.results ||
        res.data ||
        []
      );

    } catch (err) {

      console.log(
        "Notification fetch error:",
        err
      );
    }
  };

  useEffect(() => {

    fetchNotifications();

    // AUTO REFRESH
    const interval =
      setInterval(() => {

        fetchNotifications();

      }, 10000);

    return () =>
      clearInterval(interval);

  }, []);

  // ================= MARK READ =================
  const markAsRead = async (
    id
  ) => {

    try {

      await API.post(
        `/notifications/${id}/mark_read/`
      );

      fetchNotifications();

    } catch (err) {

      console.log(err);
    }
  };

  // ================= USER =================
  const initials = user?.username
    ? user.username
        .slice(0, 2)
        .toUpperCase()
    : "??";

  const roleColors = {

    admin: {
      bg: "#dbeafe",
      color: "#1d4ed8"
    },

    teacher: {
      bg: "#ede9fe",
      color: "#5b21b6"
    },

    student: {
      bg: "#dcfce7",
      color: "#166534"
    },
  };

  const rc =
    roleColors[user?.role] || {

      bg: "#f1f5f9",
      color: "#475569"
    };

  // ================= LOGOUT =================
  const handleLogout = () => {

    localStorage.removeItem(
      "user"
    );

    navigate("/");
  };

  return (
    <div style={styles.navbar}>

      {/* ================= LEFT ================= */}
      <div style={styles.left}>

        {/* MENU */}
        <button style={styles.menuBtn} onClick={() => setOpen(true)}>
          ☰
        </button>

        {/* BRAND */}
        <div
          style={styles.brand} onClick={() => navigate("/dashboard")} >

          <div
            style={ styles.brandIcon } > 🎓 </div>

          <span style={styles.brandText}>
            Learning Management System
          </span>

        </div>

      </div>

      {/* ================= RIGHT ================= */}
      <div style={styles.right}>

        {/* ================= NOTIFICATION ================= */}
        <div style={{ position: "relative",}} >

          {/* BELL */}
          <button
            style={ styles.notificationBtn }
            onClick={() =>
              setShowNotifications(  !showNotifications )} >🔔

            {/* COUNT */}
            {notifications.length >
              0 && (
              <span
                style={ styles.notificationBadge}>
                { notifications.length }
              </span>)}
          </button>

          {/* ================= DROPDOWN ================= */}
          {showNotifications && (

            <div
              style={styles.notificationDropdown}>

              <h4 style={{ marginBottom:"10px",}}> Notifications </h4>

              {notifications.length ===
              0 ? (

                <p
                  style={{
                    fontSize:
                      "13px",
                  }}
                >
                  No new
                  notifications
                </p>

              ) : (

                notifications.map(
                  (n) => (

                    <div
                      key={n.id}
                      style={
                        styles.notificationItem
                      }
                    >

                      <div>

                        <strong>
                          {
                            n.title
                          }
                        </strong>

                        <p
                          style={{
                            margin:
                              0,
                            fontSize:
                              "12px",
                          }}
                        >
                          {
                            n.message
                          }
                        </p>

                      </div>

                      <button
                        style={
                          styles.readBtn
                        }
                        onClick={() =>
                          markAsRead(
                            n.id
                          )
                        }
                      >
                        ✓
                      </button>

                    </div>

                  )
                )

              )}

            </div>

          )}

        </div>

        {/* ================= USER ================= */}
        <div style={styles.userPill}>

          <div
            style={{
              ...styles.avatar,
              background:
                rc.bg,
              color:
                rc.color
            }}
          >
            {initials}
          </div>

          <div
            style={
              styles.userInfo
            }
          >

            <span
              style={
                styles.username
              }
            >
              {
                user?.username
              }
            </span>

            <span
              style={{
                ...styles.roleBadge,
                background:
                  rc.bg,
                color:
                  rc.color
              }}
            >
              {user?.role}
            </span>

          </div>

        </div>

        {/* DIVIDER */}
        <div style={styles.divider} />

        {/* LOGOUT */}
        <button
          style={
            styles.logoutBtn
          }
          onClick={
            handleLogout
          }
        >
          Log out
        </button>

      </div>

    </div>
  );
}

/* ================= CSS ================= */
const styles = {

  navbar: {
    width: "100%",
    height: 65,
    padding: "0 24px",
    background:   "linear-gradient(180deg, #faffff, #f8fafc)",
    borderBottom: "1px solid #e5e7eb",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    position: "sticky",
    top: 0,
    zIndex: 1000,
    boxShadow: "0 2px 10px rgba(0,0,0,0.05)"
  },

  left: {
    display: "flex",
    alignItems: "center",
    gap: 16
  },

  menuBtn: {
    fontSize: 20,
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 6,
    borderRadius: 6
  },

  brand: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    cursor: "pointer"
  },

  brandIcon: {
    width: "26",
    height: "26",
    borderRadius: "6",
    background: "#3b82f6",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "bold",
    fontSize: 14
  },

  brandText: {

    fontSize: 15,

    fontWeight: 600,

    color: "#0f172a"
  },

  right: {

    display: "flex",

    alignItems: "center",

    gap: 18
  },

  notificationBtn: {

    position: "relative",

    border: "none",

    background: "#fff",

    cursor: "pointer",

    fontSize: 20,

    padding: "6px 10px",

    borderRadius: 8
  },

  notificationBadge: {

    position: "absolute",

    top: -4,

    right: -4,

    background: "red",

    color: "white",

    borderRadius: "50%",

    width: 18,

    height: 18,

    fontSize: 11,

    display: "flex",

    alignItems: "center",

    justifyContent: "center"
  },

  notificationDropdown: {

    position: "absolute",

    right: 0,

    top: 45,

    width: 320,

    maxHeight: 400,

    overflowY: "auto",

    background: "#fff",

    border:
      "1px solid #e5e7eb",

    borderRadius: 10,

    padding: 15,

    boxShadow:
      "0 4px 14px rgba(0,0,0,0.1)",

    zIndex: 2000
  },

  notificationItem: {

    display: "flex",

    justifyContent:
      "space-between",

    gap: 10,

    padding: 10,

    borderBottom:
      "1px solid #f1f5f9"
  },

  readBtn: {

    border: "none",

    background: "#22c55e",

    color: "white",

    borderRadius: 6,

    padding: "4px 8px",

    cursor: "pointer"
  },

  userPill: {

    display: "flex",

    alignItems: "center",

    gap: 10,

    padding: "4px 8px",

    borderRadius: 10
  },

  avatar: {

    width: 34,

    height: 34,

    borderRadius: "50%",

    display: "flex",

    alignItems: "center",

    justifyContent: "center",

    fontSize: 12,

    fontWeight: 700
  },

  userInfo: {

    display: "flex",

    flexDirection: "column",

    lineHeight: 1.2
  },

  username: {

    fontSize: 13,

    fontWeight: 600,

    color: "#0f172a"
  },

  roleBadge: {

    fontSize: 10,

    padding: "2px 6px",

    borderRadius: 999,

    textTransform:
      "capitalize"
  },

  divider: {

    width: 1,

    height: 28,

    background: "#e5e7eb"
  },

  logoutBtn: {

    padding: "7px 14px",

    borderRadius: 8,

    border:
      "1px solid #e5e7eb",

    background: "#fff",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500
  }
};

export default Navbar;