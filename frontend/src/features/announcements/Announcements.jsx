import { useEffect, useState } from "react";
import Navbar from "../../components/Navbar";
import Sidebar from "../../components/Sidebar";
import API from "../../api";
import "../../App.css";

const AUD_COLOR = {
  everyone: "#2563eb",
  students: "#16a34a",
  teachers: "#b45309",
  parents:  "#9333ea",
};
const AUD_LABEL = {
  everyone: "Everyone",
  students: "Students",
  teachers: "Teachers",
  parents:  "Parents",
};

export default function Announcements() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = (user.role || "").toLowerCase() === "admin";

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState("everyone");
  const [posting, setPosting] = useState(false);

  const load = () => {
    setLoading(true);
    API.get("/announcements/")
      .then((res) => setItems(res.data?.results || res.data || []))
      .catch((err) => console.log("announcements error:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const post = async () => {
    if (!title.trim() || !message.trim()) {
      alert("Please enter a title and message.");
      return;
    }
    setPosting(true);
    try {
      await API.post("/announcements/", {
        title: title.trim(),
        message: message.trim(),
        audience: audience,
      });
      setTitle(""); setMessage(""); setAudience("everyone");
      load();
    } catch (err) {
      alert(err.response?.data?.detail || "Could not post announcement.");
    } finally {
      setPosting(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this announcement?")) return;
    try {
      await API.delete(`/announcements/${id}/`);
      load();
    } catch (err) {
      alert(err.response?.data?.detail || "Could not delete.");
    }
  };

  const fmtDate = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) +
      " · " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  };

  const board = (
    <>
      {loading ? (
        <div style={S.card}><div style={{ textAlign: "center", color: "#94a3b8" }}>Loading…</div></div>
      ) : items.length === 0 ? (
        <div style={S.card}><div style={{ textAlign: "center", color: "#94a3b8" }}>No announcements yet.</div></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {items.map((a) => {
            const accent = AUD_COLOR[a.audience] || AUD_COLOR.everyone;
            return (
              <div key={a.id} style={{ ...S.card, borderLeft: `4px solid ${accent}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ ...S.badge, background: accent + "1a", color: accent }}>
                    {AUD_LABEL[a.audience] || "Everyone"}
                  </span>
                  <span style={{ fontSize: 17, fontWeight: 700, color: "#0f172a", flex: 1 }}>{a.title}</span>
                  {isAdmin && (
                    <button style={S.del} onClick={() => remove(a.id)}>Delete</button>
                  )}
                </div>
                <div style={{ fontSize: 14, color: "#334155", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{a.message}</div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 12 }}>
                  {a.posted_by_name ? `Posted by ${a.posted_by_name}` : "Posted"} · {fmtDate(a.created_at)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  return (
    <div className="app">
      <Navbar setOpen={setOpen} />
      <div className="layout">
        <Sidebar open={open} setOpen={setOpen} />
        <div className="main">
          <div className="content">
            <div style={{ width: "100%", padding: "8px 4px" }}>

              <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 30, fontWeight: 800, margin: 0, color: "#0f172a" }}>Announcements</h1>
                <p style={{ color: "#64748b", fontSize: 15, marginTop: 4 }}>
                  {isAdmin ? "Post updates and choose who each one is for." : "Latest updates from the college."}
                </p>
              </div>

              {/* side-by-side for admin: form left, board right */}
              <div style={{
                display: "grid",
                gridTemplateColumns: isAdmin ? "minmax(0,340px) minmax(0,1fr)" : "1fr",
                gap: 20, alignItems: "start",
              }}>

                {isAdmin && (
                  <div style={S.card}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 14px", color: "#0f172a" }}>New Announcement</h3>

                    <label style={S.label}>Title</label>
                    <input style={S.input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Exam timetable released" />

                    <label style={S.label}>Message</label>
                    <textarea style={{ ...S.input, minHeight: 100, resize: "vertical" }} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Write the announcement…" />

                    <label style={S.label}>Who is this for?</label>
                    <select style={S.input} value={audience} onChange={(e) => setAudience(e.target.value)}>
                      <option value="everyone">Everyone</option>
                      <option value="students">Students</option>
                      <option value="teachers">Teachers</option>
                      <option value="parents">Parents</option>
                    </select>

                    <button style={S.btn} onClick={post} disabled={posting}>
                      {posting ? "Posting…" : "Post & Notify"}
                    </button>
                  </div>
                )}

                <div>{board}</div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const S = {
  card:  { background: "#fff", border: "1px solid #eef2f7", borderRadius: 14, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" },
  label: { display: "block", fontSize: 13, color: "#64748b", marginBottom: 5, marginTop: 12, fontWeight: 500 },
  input: { width: "100%", border: "1px solid #e2e8f0", borderRadius: 10, padding: "11px 12px", fontSize: 14, background: "#f8fafc", outline: "none", fontFamily: "inherit", boxSizing: "border-box" },
  btn:   { width: "100%", background: "#2563eb", color: "#fff", border: "none", borderRadius: 10, padding: 13, fontSize: 15, fontWeight: 600, cursor: "pointer", marginTop: 16 },
  badge: { fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20 },
  del:   { background: "none", border: "none", color: "#cbd5e1", cursor: "pointer", fontSize: 13 },
};