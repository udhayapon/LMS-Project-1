import { useEffect, useState } from "react";

import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";

import API from "../../api";

import "../../App.css";
import "../../styles/FeedbackHistory.css";

export default function FeedbackHistory() {
  const [open, setOpen] = useState(false);
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const fetchFeedbacks = async () => {
    try {
      const res = await API.get("/feedback/");
      setFeedbacks(res.data?.results || res.data || []);
    } catch (err) {
      console.error("Feedback fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      {/* NAVBAR */}
      <Navbar setOpen={setOpen} />

      <div className="layout">
        {/* SIDEBAR */}
        <Sidebar open={open} setOpen={setOpen} />

        {/* MAIN */}
        <div className="main">
          <div className="feedback-history">
            <div className="fh-card">
              <h2 className="fh-title">Feedback History</h2>
              <p className="fh-subtitle">All feedback across your subjects</p>

              {loading ? (
                <p className="fh-state">Loading feedback...</p>
              ) : feedbacks.length === 0 ? (
                <p className="fh-state">No feedback available.</p>
              ) : (
                feedbacks.map((f) => (
                  <div key={f.id} className={`fh-item ${f.direction}`}>
                    {/* direction tag */}
                    <span className="fh-chip">
                      {f.direction === "t2s"
                        ? "Teacher → Student"
                        : "Student → Teacher"}
                    </span>

                    {/* subject */}
                    <h4 className="fh-subject">{f.subject}</h4>

                    {/* meta row: who + rating */}
                    <div className="fh-meta">
                      {f.direction === "t2s" && (
                        <span className="fh-meta-item">
                          <strong>Teacher:</strong> {f.teacher_name}
                        </span>
                      )}

                      {f.direction === "s2t" && (
                        <span className="fh-meta-item">
                          <strong>Student:</strong> {f.student_name}
                        </span>
                      )}

                      {f.rating && (
                        <span className="fh-rating">{f.rating}/5</span>
                      )}
                    </div>

                    {/* message */}
                    <p className="fh-message">{f.message}</p>

                    {/* date */}
                    <small className="fh-date">
                      {new Date(f.created_at).toLocaleString()}
                    </small>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}