import { useEffect, useState } from "react";

import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";
import API from "../../api";

import "../../App.css";

export default function AdminUsers() {

  const [open, setOpen] =
    useState(false);

  const [users, setUsers] =
    useState([]);

  const [newUser, setNewUser] =
    useState({

      username: "",

      password: "",

      email: "",

      role: "admin"
    });

  useEffect(() => {

    fetchUsers();

  }, []);

  const fetchUsers = async () => {

    const res =
      await API.get("users/");

    setUsers(
      res.data?.results ||
      res.data
    );
  };

  const handleAddUser =
    async () => {

      await API.post(
        "users/",
        newUser
      );

      fetchUsers();

      setNewUser({

        username: "",

        password: "",

        email: "",

        role: "admin"
      });
    };

  const admins =
    users.filter(
      (u) =>
        u.role === "admin"
    );

  return (
    <div className="app">

      <Navbar
        setOpen={setOpen}
      />

      <div className="layout">

        <Sidebar
          open={open}
          setOpen={setOpen}
        />

        <div className="main">

          <div className="content">

            <div className="header-box">

              <h2>
                Admin Management
              </h2>

            </div>

            <div className="card">

              <div className="form-grid">

                <input
                  placeholder="Username"
                  value={newUser.username}
                  onChange={(e) =>
                    setNewUser({
                      ...newUser,
                      username:
                        e.target.value
                    })
                  }
                />

                <input
                  type="email"
                  placeholder="Email"
                  value={newUser.email}
                  onChange={(e) =>
                    setNewUser({
                      ...newUser,
                      email:
                        e.target.value
                    })
                  }
                />

                <input
                  type="password"
                  placeholder="Password"
                  value={newUser.password}
                  onChange={(e) =>
                    setNewUser({
                      ...newUser,
                      password:
                        e.target.value
                    })
                  }
                />

                <button
                  className="btn-primary"
                  onClick={
                    handleAddUser
                  }
                >
                  Create Admin
                </button>

              </div>

            </div>

            <div className="card">

              <table>

                <thead>

                  <tr>

                    <th>User</th>

                    <th>Email</th>

                  </tr>

                </thead>

                <tbody>

                  {admins.map(
                    (u) => (

                    <tr key={u.id}>

                      <td>
                        {u.username}
                      </td>

                      <td>
                        {u.email}
                      </td>

                    </tr>
                  ))}

                </tbody>

              </table>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}