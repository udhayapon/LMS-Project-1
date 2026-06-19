import { useEffect, useState } from "react";
import Navbar from "../../components/Navbar";
import Sidebar from "../../components/Sidebar";
import API from "../../api";

const TYPE_COLOR = {
  holiday: { bg: "#fef2f2", text: "#dc2626", dot: "#dc2626", border: "#fecaca" },
  exam:    { bg: "#fffbeb", text: "#b45309", dot: "#f59e0b", border: "#fde68a" },
  event:   { bg: "#f0fdf4", text: "#16a34a", dot: "#16a34a", border: "#bbf7d0" },
};

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export default function Calendar() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = (user.role || "").toLowerCase() === "admin";

  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const [title, setTitle] = useState("");
  const [type, setType] = useState("event");
  const [audience, setAudience] = useState("everyone");
  const [yearNum, setYearNum] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const showYear = audience === "students" || audience === "parents";

  const fetchEvents = () => {
    setLoading(true);
    API.get(`/calendar-feed/?month=${viewMonth + 1}&year=${viewYear}`)
      .then((res) => setEvents(res.data?.results || res.data || []))
      .catch((err) => console.log("calendar error:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line
  }, [viewMonth, viewYear]);

  const addEvent = async () => {
    if (!title.trim() || !startDate) {
      alert("Please enter a title and start date.");
      return;
    }
    const payload = {
      title: title.trim(),
      event_type: type,
      audience: audience,
      year_number: showYear && yearNum ? parseInt(yearNum, 10) : null,
      start_date: startDate,
      end_date: endDate || null,
    };
    try {
      await API.post("/events/", payload);
      setTitle("");
      setStartDate("");
      setEndDate("");
      fetchEvents();
    } catch (err) {
      console.log("add error:", err);
      alert("Could not add the entry.");
    }
  };

  const deleteEvent = async (id) => {
    if (typeof id !== "string" || !id.startsWith("event-")) return;
    if (!window.confirm("Delete this entry?")) return;
    const realId = id.replace("event-", "");
    try {
      await API.delete(`/events/${realId}/`);
      fetchEvents();
    } catch (err) {
      console.log("delete error:", err);
    }
  };

  const inRange = (dayStr, ev) => {
    const end = ev.end_date || ev.start_date;
    return dayStr >= ev.start_date && dayStr <= end;
  };

  const prevMonth = () => {
    const d = new Date(viewYear, viewMonth - 1, 1);
    setViewMonth(d.getMonth());
    setViewYear(d.getFullYear());
  };
  const nextMonth = () => {
    const d = new Date(viewYear, viewMonth + 1, 1);
    setViewMonth(d.getMonth());
    setViewYear(d.getFullYear());
  };
  const goToday = () => {
    const d = new Date();
    setViewMonth(d.getMonth()); setViewYear(d.getFullYear());
  };

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let n = 1; n <= daysInMonth; n++) cells.push(n);

  const pad = (x) => String(x).padStart(2, "0");
  const monthEvents = events;

  const audienceText = (a) => {
    const k = (a || "").toLowerCase();
    if (k === "everyone") return "Everyone";
    if (k === "teachers") return "Teachers";
    if (k === "students") return "Students";
    if (k === "parents") return "Parents";
    return a;
  };

  return (
    <div className="app">
      <Navbar setOpen={setOpen} />
      <div className="layout">
        <Sidebar open={open} setOpen={setOpen} />
        <div className="main">
          <div className="content">
            <div style={{ width: "100%", padding: "8px 4px" }}>

              <div style={{ marginBottom: 18 }}>
                <h1 style={{ fontSize: 30, fontWeight: 800, margin: 0, color: "#0f172a" }}>Academic Calendar</h1>
                <p style={{ color: "#64748b", fontSize: 15, marginTop: 4 }}>
                  {isAdmin ? "Add holidays, exams and events. Choose who each entry is for." : "Holidays, events and exam dates"}
                </p>
              </div>

              {/* Legend */}
              <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 13, marginBottom: 18 }}>
                <Legend color="#dc2626" label="Holiday / Leave" />
                <Legend color="#f59e0b" label="Exam" />
                <Legend color="#16a34a" label="Event" />
              </div>

              <div style={{
                display: "grid",
                gridTemplateColumns: isAdmin ? "minmax(0,300px) minmax(0,1fr)" : "minmax(0,1fr) minmax(0,260px)",
                gap: 20, alignItems: "start",
              }}>

                {/* LEFT: admin form (always visible) */}
                {isAdmin && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    <div style={cardStyle}>
                      <h3 style={h3Style}>Add Entry</h3>

                      <Label>Title</Label>
                      <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Final year farewell" />

                      <Label>Type</Label>
                      <select style={inputStyle} value={type} onChange={(e) => setType(e.target.value)}>
                        <option value="event">Event</option>
                        <option value="holiday">Holiday / Leave</option>
                      </select>

                      <Label>Who is this for?</Label>
                      <select style={inputStyle} value={audience} onChange={(e) => setAudience(e.target.value)}>
                        <option value="everyone">Everyone</option>
                        <option value="teachers">Teachers</option>
                        <option value="students">Students</option>
                        <option value="parents">Parents</option>
                      </select>

                      {showYear && (
                        <>
                          <Label>Which year? (blank = all)</Label>
                          <select style={inputStyle} value={yearNum} onChange={(e) => setYearNum(e.target.value)}>
                            <option value="">All years</option>
                            <option value="1">First Year</option>
                            <option value="2">Second Year</option>
                            <option value="3">Third Year</option>
                            <option value="4">Final Year</option>
                          </select>
                        </>
                      )}

                      <Label>Start Date</Label>
                      <input type="date" style={inputStyle} value={startDate} onChange={(e) => setStartDate(e.target.value)} />

                      <Label>End Date (optional)</Label>
                      <input type="date" style={inputStyle} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 6, lineHeight: 1.5 }}>
                        Leave the end date blank for a single-day entry.
                      </div>

                      <button onClick={addEvent} style={btnStyle}>Add &amp; Notify</button>
                    </div>

                    <div style={cardStyle}>
                      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "#0f172a" }}>This Month's Entries</div>
                      {monthEvents.length === 0 ? (
                        <div style={{ color: "#94a3b8", fontSize: 13 }}>No entries this month.</div>
                      ) : monthEvents.map((ev) => (
                        <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #f1f5f9", fontSize: 14 }}>
                          <span style={{ width: 9, height: 9, borderRadius: "50%", background: (TYPE_COLOR[ev.type] || {}).dot, flexShrink: 0 }} />
                          <span style={{ flex: 1 }}>
                            {ev.title}
                            {ev.audience && (
                              <span style={{ fontSize: 11, color: "#94a3b8" }}>
                                {" · "}{audienceText(ev.audience)}
                              </span>
                            )}
                          </span>
                          {typeof ev.id === "string" && ev.id.startsWith("event-") && (
                            <button onClick={() => deleteEvent(ev.id)} style={{ background: "none", border: "none", color: "#cbd5e1", cursor: "pointer", fontSize: 13 }}>Delete</button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* CALENDAR */}
                <div style={cardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                    <button onClick={prevMonth} style={navIcon} aria-label="Previous month">‹</button>
                    <h3 style={{ fontSize: 19, fontWeight: 700, margin: 0, color: "#0f172a" }}>{MONTHS[viewMonth]} {viewYear}</h3>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={goToday} style={{ ...navBtn, background: "#2563eb", color: "#fff", borderColor: "#2563eb", fontWeight: 600 }}>Today</button>
                      <button onClick={nextMonth} style={navIcon} aria-label="Next month">›</button>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 8, marginBottom: 8 }}>
                    {DAYS.map((d) => (
                      <div key={d} style={{ textAlign: "center", fontSize: 11, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>{d}</div>
                    ))}
                  </div>

                  {loading ? (
                    <div style={{ padding: 48, textAlign: "center", color: "#94a3b8" }}>Loading…</div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 8 }}>
                      {cells.map((n, idx) => {
                        if (n === null) return <div key={"e" + idx} />;
                        const dayStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(n)}`;
                        const dayEvents = events.filter((ev) => inRange(dayStr, ev));
                        const isToday = dayStr === todayStr;
                        const isSunday = new Date(viewYear, viewMonth, n).getDay() === 0;
                        return (
                          <div key={dayStr} style={{
                            minHeight: 88,
                            border: isToday ? "1.5px solid #2563eb" : "1px solid #eef2f7",
                            borderRadius: 10,
                            padding: 7,
                            background: isToday ? "#eff6ff" : (isSunday ? "#fef2f2" : "#fff"),
                          }}>
                            <div style={{
                              fontWeight: 700, fontSize: 13,
                              color: isToday ? "#2563eb" : (isSunday ? "#dc2626" : "#334155"),
                              display: "inline-flex", justifyContent: "center", alignItems: "center",
                              minWidth: isToday ? 22 : "auto", height: isToday ? 22 : "auto",
                              borderRadius: isToday ? "50%" : 0,
                              background: isToday ? "#dbeafe" : "transparent",
                            }}>{n}</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 4 }}>
                              {isSunday && (
                                <div style={{
                                  fontSize: 10.5, padding: "2px 6px", borderRadius: 5,
                                  background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca",
                                  fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                }}>
                                  Holiday
                                </div>
                              )}
                              {dayEvents.map((ev) => {
                                const c = TYPE_COLOR[ev.type] || TYPE_COLOR.event;
                                return (
                                  <div key={ev.id} title={ev.title} style={{
                                    fontSize: 10.5, padding: "2px 6px", borderRadius: 5,
                                    background: c.bg, color: c.text, border: `1px solid ${c.border}`,
                                    fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                  }}>
                                    {ev.title}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* RIGHT: upcoming (non-admin only) */}
                {!isAdmin && (
                  <div style={cardStyle}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "#0f172a" }}>Upcoming</div>
                    {events.length === 0 ? (
                      <div style={{ color: "#94a3b8", fontSize: 13 }}>Nothing scheduled.</div>
                    ) : events.slice(0, 8).map((ev) => (
                      <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 0", borderBottom: "1px solid #f1f5f9", fontSize: 13 }}>
                        <span style={{ width: 9, height: 9, borderRadius: "50%", background: (TYPE_COLOR[ev.type] || {}).dot, flexShrink: 0 }} />
                        <span style={{ flex: 1 }}>{ev.title}</span>
                        <span style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600 }}>{ev.start_date.slice(8, 10)}/{ev.start_date.slice(5, 7)}</span>
                      </div>
                    ))}
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

function Legend({ color, label }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "#475569", fontWeight: 500 }}>
      <span style={{ width: 11, height: 11, borderRadius: "50%", background: color, display: "inline-block" }} />
      {label}
    </span>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 13, color: "#64748b", marginBottom: 5, marginTop: 12, fontWeight: 500 }}>{children}</div>;
}

const cardStyle = { background: "#fff", border: "1px solid #eef2f7", borderRadius: 16, padding: 22, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" };
const h3Style = { fontSize: 17, fontWeight: 700, marginBottom: 16, color: "#0f172a" };
const inputStyle = { width: "100%", border: "1px solid #e2e8f0", borderRadius: 10, padding: "11px 12px", fontSize: 14, background: "#f8fafc", outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
const btnStyle = { width: "100%", background: "#2563eb", color: "#fff", border: "none", borderRadius: 10, padding: 13, fontSize: 15, fontWeight: 600, cursor: "pointer", marginTop: 16 };
const navBtn = { border: "1px solid #e2e8f0", background: "#fff", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13, color: "#334155" };
const navIcon = { border: "1px solid #e2e8f0", background: "#fff", borderRadius: 8, padding: "5px 15px", cursor: "pointer", fontSize: 18, fontWeight: 700, color: "#334155", lineHeight: 1 };