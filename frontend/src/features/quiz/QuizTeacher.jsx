import { useEffect, useState } from "react";
import API from "../../api";
import "../../styles/Quiz.css";

const OPTION_NUMS = [1, 2, 3, 4];

export default function QuizTeacher({ teachingId }) {
  const [quizzes, setQuizzes] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);

  const [aiOpen, setAiOpen] = useState(false);
  const [aiNotes, setAiNotes] = useState("");
  const [aiCount, setAiCount] = useState(10);
  const [aiBusy, setAiBusy] = useState(false);
  const [draft, setDraft] = useState([]);
  const [draftErrors, setDraftErrors] = useState([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ title: "", description: "", duration: 10 });

  const blankQuestion = { text: "", option1: "", option2: "", option3: "", option4: "", correct_answer: 1, marks: 1 };
  const [questionForm, setQuestionForm] = useState(blankQuestion);

  const fetchQuizzes = async () => {
    try {
      const res = await API.get(`/quizzes/?teaching_assignment=${teachingId}`);
      setQuizzes(res.data?.results || res.data || []);
    } catch (err) { console.log("Fetch quiz error:", err); }
  };

  useEffect(() => { if (teachingId) fetchQuizzes(); }, [teachingId]);

  const fetchQuestions = async (quizId) => {
    try {
      const res = await API.get(`/questions/?quiz=${quizId}`);
      setQuestions(res.data?.results || res.data || []);
    } catch (err) { console.log(err); }
  };

  const handleQuizChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const handleQuestionChange = (e) => setQuestionForm({ ...questionForm, [e.target.name]: e.target.value });

  const questionProblem = (q) => {
    if (!String(q.text || "").trim()) return "Enter the question text.";
    for (let i = 1; i <= 4; i++) {
      if (!String(q[`option${i}`] || "").trim()) return `Option ${i} is empty.`;
    }
    if (!OPTION_NUMS.includes(Number(q.correct_answer))) return "Pick which option is correct.";
    if (Number(q.marks) < 1) return "Marks must be at least 1.";
    return null;
  };

  const openEditor = (quiz) => {
    setActiveQuiz(quiz); setQuestions([]); setShowQuestionForm(false);
    setAiOpen(false); setDraft([]); setDraftErrors([]); setAiNotes("");
    setEditingQuestion(null); fetchQuestions(quiz.id);
  };

  const closeEditor = () => {
    setActiveQuiz(null); setQuestions([]); setShowQuestionForm(false);
    setAiOpen(false); setDraft([]); setEditingQuestion(null);
  };

  const addQuiz = async () => {
    if (!form.title.trim()) return alert("Enter a quiz title.");
    try {
      setLoading(true);
      await API.post("/quizzes/", { title: form.title, description: form.description, duration: form.duration, teaching_assignment: teachingId });
      setForm({ title: "", description: "", duration: 10 });
      setShowForm(false); fetchQuizzes();
    } catch (err) {
      console.log(err.response?.data);
      alert(JSON.stringify(err.response?.data || "Couldn't create the quiz."));
    } finally { setLoading(false); }
  };

  const addQuestion = async () => {
    const problem = questionProblem(questionForm);
    if (problem) return alert(problem);
    try {
      await API.post("/questions/", {
        quiz: activeQuiz.id, text: questionForm.text,
        option1: questionForm.option1, option2: questionForm.option2,
        option3: questionForm.option3, option4: questionForm.option4,
        correct_answer: Number(questionForm.correct_answer), marks: Number(questionForm.marks),
      });
      setQuestionForm(blankQuestion); setShowQuestionForm(false);
      fetchQuizzes(); fetchQuestions(activeQuiz.id);
    } catch (err) { console.log(err); alert("Couldn't add the question."); }
  };

  const updateQuestion = async (id) => {
    const problem = questionProblem(editingQuestion);
    if (problem) return alert(problem);
    try {
      await API.patch(`/questions/${id}/`, { ...editingQuestion, correct_answer: Number(editingQuestion.correct_answer), marks: Number(editingQuestion.marks) });
      fetchQuestions(editingQuestion.quiz); setEditingQuestion(null); fetchQuizzes();
    } catch (err) { console.log(err); alert("Update failed."); }
  };

  const deleteQuiz = async (id) => {
    if (!window.confirm("Delete this quiz?")) return;
    try {
      await API.delete(`/quizzes/${id}/`);
      if (activeQuiz?.id === id) closeEditor();
      fetchQuizzes();
    } catch (err) { console.log(err); alert("Delete failed."); }
  };

  const deleteQuestion = async (id, quizId) => {
    if (!window.confirm("Delete this question?")) return;
    try {
      await API.delete(`/questions/${id}/`);
      fetchQuestions(quizId); fetchQuizzes();
    } catch (err) { console.log(err); alert("Delete failed."); }
  };

  const toggleAi = () => {
    if (aiOpen) { setAiOpen(false); setDraft([]); setDraftErrors([]); setAiNotes(""); }
    else { setAiOpen(true); setShowQuestionForm(false); setDraft([]); setDraftErrors([]); setAiNotes(""); setAiCount(10); }
  };

  const generateDraft = async () => {
    if (!aiNotes.trim()) return alert("Paste the notes to generate from.");
    setAiBusy(true); setDraftErrors([]);
    try {
      const res = await API.post(`/quizzes/${activeQuiz.id}/generate-questions/`, { notes: aiNotes, count: Number(aiCount) || 10 });
      const rows = (res.data?.draft || []).map((q) => ({
        text: q.text || "", option1: q.option1 || "", option2: q.option2 || "",
        option3: q.option3 || "", option4: q.option4 || "",
        correct_answer: Number(q.correct_answer) || 1, marks: Number(q.marks) || 1,
      }));
      setDraft(rows);
      if (res.data?.note) alert(res.data.note);
      if (rows.length === 0) alert("The AI didn't return any usable questions. Try different notes.");
    } catch (err) {
      console.log(err.response?.data || err);
      alert(err.response?.data?.detail || "Couldn't generate questions.");
    } finally { setAiBusy(false); }
  };

  const editDraftRow = (index, field, value) =>
    setDraft((rows) => rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)));

  const removeDraftRow = (index) =>
    setDraft((rows) => rows.filter((_, i) => i !== index));

  const saveDraft = async () => {
    if (draft.length === 0) return alert("Nothing to save.");
    const localErrors = [];
    draft.forEach((q, i) => { const p = questionProblem(q); if (p) localErrors.push(`Question ${i + 1}: ${p}`); });
    if (localErrors.length) { setDraftErrors(localErrors); return; }
    setSaving(true); setDraftErrors([]);
    try {
      const payload = { questions: draft.map((q) => ({
        text: q.text, option1: q.option1, option2: q.option2, option3: q.option3, option4: q.option4,
        correct_answer: Number(q.correct_answer), marks: Number(q.marks),
      })) };
      const res = await API.post(`/quizzes/${activeQuiz.id}/save-questions/`, payload);
      alert(res.data?.message || "Questions saved.");
      setDraft([]); setAiOpen(false); setAiNotes("");
      fetchQuizzes(); fetchQuestions(activeQuiz.id);
    } catch (err) {
      const data = err.response?.data;
      if (data?.errors?.length) setDraftErrors(data.errors);
      else alert(data?.detail || "Couldn't save questions.");
    } finally { setSaving(false); }
  };

  const quizStats = (q) => {
    const count = q.questions?.length || 0;
    const marks = q.questions?.reduce((t, x) => t + (x.marks || 0), 0) || q.total_marks || 0;
    return { count, marks, duration: q.duration };
  };

  return (
    <div>
      <div className="qz-header">
        <h2 className="qz-title">Quizzes</h2>
        <button className="qz-btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ New quiz"}
        </button>
      </div>

      {showForm && (
        <div className="qz-newform">
          <input className="qz-input" type="text" name="title" placeholder="Quiz title" value={form.title} onChange={handleQuizChange} />
          <textarea className="qz-textarea" name="description" placeholder="Description (optional)" value={form.description} onChange={handleQuizChange} />
          <div className="qz-row">
            <span className="qz-field-label">Duration (minutes)</span>
            <input className="qz-input qz-w90" type="number" name="duration" value={form.duration} onChange={handleQuizChange} />
          </div>
          <button className="qz-btn-primary qz-self-start" onClick={addQuiz} disabled={loading}>
            {loading ? "Creating…" : "Create quiz"}
          </button>
        </div>
      )}

      {quizzes.length === 0 ? (
        <div className="qz-empty">No quizzes yet. Create your first one to get started.</div>
      ) : (
        <div className="qz-grid">
          {quizzes.map((q) => {
            const st = quizStats(q);
            const active = activeQuiz?.id === q.id;
            return (
              <div key={q.id} className={`qz-card${active ? " qz-active" : ""}`} onClick={() => (active ? closeEditor() : openEditor(q))}>
                <div className="qz-card-top">
                  <div className="qz-card-title">{q.title}</div>
                  {active && <span className="qz-badge-editing">Editing</span>}
                </div>
                <div className="qz-stats">
                  <Stat value={st.count} label="questions" />
                  <Stat value={st.marks} label="marks" />
                  <Stat value={st.duration} label="minutes" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeQuiz && (
        <div className="qz-editor">
          <div className="qz-editor-head">
            <div className="qz-editor-title">Editing: {activeQuiz.title}</div>
            <div className="qz-actions">
              <button className="qz-btn-ghost" onClick={() => { setShowQuestionForm(!showQuestionForm); setAiOpen(false); }}>
                {showQuestionForm ? "Cancel" : "Add question"}
              </button>
              <button className="qz-btn-primary qz-sm" onClick={toggleAi}>
                {aiOpen ? "Close AI" : "✨ Generate with AI"}
              </button>
              <button className="qz-btn-danger" onClick={() => deleteQuiz(activeQuiz.id)}>Delete quiz</button>
              <button className="qz-btn-ghost" onClick={closeEditor}>Close</button>
            </div>
          </div>

          {showQuestionForm && (
            <div className="qz-panel">
              <textarea className="qz-textarea" name="text" placeholder="Question" value={questionForm.text} onChange={handleQuestionChange} />
              {OPTION_NUMS.map((n) => (
                <input key={n} className="qz-input" type="text" name={`option${n}`} placeholder={`Option ${n}`} value={questionForm[`option${n}`]} onChange={handleQuestionChange} />
              ))}
              <div className="qz-row">
                <span className="qz-field-label">Correct answer</span>
                <select className="qz-select qz-auto" name="correct_answer" value={questionForm.correct_answer} onChange={handleQuestionChange}>
                  {OPTION_NUMS.map((n) => (
                    <option key={n} value={n}>Option {n}{questionForm[`option${n}`] ? `: ${questionForm[`option${n}`]}` : ""}</option>
                  ))}
                </select>
                <span className="qz-field-label">Marks</span>
                <input className="qz-input qz-w70" type="number" name="marks" min="1" value={questionForm.marks} onChange={handleQuestionChange} />
              </div>
              <button className="qz-btn-primary qz-self-start" onClick={addQuestion}>Save question</button>
            </div>
          )}

          {aiOpen && (
            <div className="qz-ai">
              <div className="qz-ai-head">
                <span className="qz-ai-title">✨ Generate from notes</span>
                <span className="qz-badge-unsaved">Not saved yet</span>
              </div>
              <p className="qz-ai-hint">Paste your notes. The AI drafts questions for you to review and edit — nothing saves until you click save.</p>
              <textarea className="qz-textarea" placeholder="Paste the lesson notes or syllabus here…" value={aiNotes} onChange={(e) => setAiNotes(e.target.value)} style={{ minHeight: "80px" }} />
              <div className="qz-ai-controls">
                <span className="qz-field-label">How many</span>
                <input className="qz-input qz-w70" type="number" min="1" max="30" value={aiCount} onChange={(e) => setAiCount(e.target.value)} />
                <button className="qz-btn-primary" onClick={generateDraft} disabled={aiBusy}>{aiBusy ? "Generating…" : "Generate"}</button>
              </div>

              {draftErrors.length > 0 && (
                <div className="qz-errors">
                  <b>Nothing was saved. Fix these first:</b>
                  <ul>{draftErrors.map((e, i) => (<li key={i}>{e}</li>))}</ul>
                </div>
              )}

              {draft.length > 0 && (
                <div className="qz-draft-wrap">
                  <div className="qz-draft-note">Draft — review and edit before saving. {draft.length} question(s).</div>
                  {draft.map((row, idx) => (<DraftCard key={idx} row={row} idx={idx} onEdit={editDraftRow} onRemove={removeDraftRow} />))}
                  <button className="qz-btn-primary" onClick={saveDraft} disabled={saving}>
                    {saving ? "Saving…" : `Save all ${draft.length} question(s)`}
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="qz-section">
            <div className="qz-section-title">Questions ({questions.length})</div>
            {questions.length === 0 ? (
              <div className="qz-muted">No questions yet. Add one manually or generate with AI.</div>
            ) : (
              <div className="qz-list">
                {questions.map((q) => (<SavedCard key={q.id} q={q} onEdit={() => setEditingQuestion(q)} onDelete={() => deleteQuestion(q.id, q.quiz)} />))}
              </div>
            )}
          </div>

          {editingQuestion && (
            <div className="qz-panel">
              <div className="qz-section-title">Edit question</div>
              <textarea className="qz-textarea" value={editingQuestion.text} onChange={(e) => setEditingQuestion({ ...editingQuestion, text: e.target.value })} />
              {OPTION_NUMS.map((n) => (
                <input key={n} className="qz-input" type="text" placeholder={`Option ${n}`} value={editingQuestion[`option${n}`]} onChange={(e) => setEditingQuestion({ ...editingQuestion, [`option${n}`]: e.target.value })} />
              ))}
              <div className="qz-row">
                <span className="qz-field-label">Correct answer</span>
                <select className="qz-select qz-auto" value={editingQuestion.correct_answer} onChange={(e) => setEditingQuestion({ ...editingQuestion, correct_answer: Number(e.target.value) })}>
                  {OPTION_NUMS.map((n) => (<option key={n} value={n}>Option {n}{editingQuestion[`option${n}`] ? `: ${editingQuestion[`option${n}`]}` : ""}</option>))}
                </select>
                <span className="qz-field-label">Marks</span>
                <input className="qz-input qz-w70" type="number" min="1" value={editingQuestion.marks} onChange={(e) => setEditingQuestion({ ...editingQuestion, marks: e.target.value })} />
              </div>
              <div className="qz-row">
                <button className="qz-btn-primary" onClick={() => updateQuestion(editingQuestion.id)}>Save changes</button>
                <button className="qz-btn-ghost" onClick={() => setEditingQuestion(null)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div>
      <div className="qz-stat-value">{value}</div>
      <div className="qz-stat-label">{label}</div>
    </div>
  );
}

function OptionPill({ text, num, correct }) {
  const isCorrect = num === Number(correct);
  return (
    <div className={`qz-opt${isCorrect ? " qz-correct" : ""}`}>
      {isCorrect && <span>✓</span>}
      {text || <span className="qz-opt-empty">Option {num}</span>}
    </div>
  );
}

function SavedCard({ q, onEdit, onDelete }) {
  const correctText = q[`option${q.correct_answer}`] || `Option ${q.correct_answer}`;
  return (
    <div className="qz-saved">
      <div className="qz-saved-top">
        <div className="qz-saved-q">{q.text}</div>
        <div className="qz-saved-actions">
          <button className="qz-btn-ghost qz-sm" onClick={onEdit}>Edit</button>
          <button className="qz-btn-danger qz-sm" onClick={onDelete}>Delete</button>
        </div>
      </div>
      <div className="qz-options">
        {OPTION_NUMS.map((n) => (<OptionPill key={n} num={n} text={q[`option${n}`]} correct={q.correct_answer} />))}
      </div>
      <div className="qz-correct-line">
        Correct: {correctText} · {q.marks} mark{q.marks === 1 ? "" : "s"}
      </div>
    </div>
  );
}

function DraftCard({ row, idx, onEdit, onRemove }) {
  return (
    <div className="qz-panel">
      <div className="qz-card-head">
        <span className="qz-qnum">Question {idx + 1}</span>
        <button className="qz-remove" onClick={() => onRemove(idx)}>Remove</button>
      </div>
      <textarea className="qz-textarea" value={row.text} onChange={(e) => onEdit(idx, "text", e.target.value)} />
      {OPTION_NUMS.map((n) => (
        <input key={n} className="qz-input" type="text" placeholder={`Option ${n}`} value={row[`option${n}`]} onChange={(e) => onEdit(idx, `option${n}`, e.target.value)} />
      ))}
      <div className="qz-row">
        <span className="qz-field-label">Correct</span>
        <select className="qz-select qz-auto" value={row.correct_answer} onChange={(e) => onEdit(idx, "correct_answer", Number(e.target.value))}>
          {OPTION_NUMS.map((n) => (<option key={n} value={n}>Option {n}{row[`option${n}`] ? `: ${row[`option${n}`]}` : ""}</option>))}
        </select>
        <span className="qz-field-label">Marks</span>
        <input className="qz-input qz-w70" type="number" min="1" value={row.marks} onChange={(e) => onEdit(idx, "marks", Number(e.target.value))} />
      </div>
    </div>
  );
}