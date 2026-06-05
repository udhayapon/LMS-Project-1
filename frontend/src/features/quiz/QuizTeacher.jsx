import { useEffect, useState } from "react";
import API from "../../api";

export default function QuizTeacher({
  teachingId,
}) {

  const [quizzes, setQuizzes] =
    useState([]);

  const [questions, setQuestions] =
    useState([]);

  const [showForm, setShowForm] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [showQuestionForm, setShowQuestionForm] =
    useState(null);

  const [editingQuestion, setEditingQuestion] =
    useState(null);

  // ================= QUIZ FORM =================
  const [form, setForm] = useState({
    title: "",
    description: "",
    duration: 10,
  });

  // ================= QUESTION FORM =================
  const [questionForm, setQuestionForm] =
    useState({
      text: "",
      option1: "",
      option2: "",
      option3: "",
      option4: "",
      correct_answer: 1,
      marks: 1,
    });

  // ================= FETCH QUIZZES =================
  const fetchQuizzes = async () => {

    try {

      const res = await API.get(
        `/quizzes/?teaching_assignment=${teachingId}`
      );

      setQuizzes(
        res.data?.results ||
        res.data ||
        []
      );

    } catch (err) {

      console.log(
        "Fetch quiz error:",
        err
      );
    }
  };

  useEffect(() => {

    if (teachingId) {

      fetchQuizzes();
    }

  }, [teachingId]);

  // ================= FETCH QUESTIONS =================
  const fetchQuestions = async (
    quizId
  ) => {

    try {

      const res = await API.get(
        `/questions/?quiz=${quizId}`
      );

      setQuestions(
        res.data?.results ||
        res.data ||
        []
      );

    } catch (err) {

      console.log(err);
    }
  };

  // ================= HANDLE QUIZ INPUT =================
  const handleQuizChange = (e) => {

    setForm({
      ...form,
      [e.target.name]:
        e.target.value,
    });
  };

  // ================= HANDLE QUESTION INPUT =================
  const handleQuestionChange = (
    e
  ) => {

    setQuestionForm({
      ...questionForm,
      [e.target.name]:
        e.target.value,
    });
  };

  // ================= CREATE QUIZ =================
  const addQuiz = async () => {

    if (!form.title.trim()) {

      return alert(
        "Enter quiz title"
      );
    }

    try {

      setLoading(true);

      await API.post(
        "/quizzes/",
        {
          title: form.title,
          description:
            form.description,
          duration:
            form.duration,
          teaching_assignment:
            teachingId,
        }
      );

      alert(
        "Quiz created successfully"
      );

      setForm({
        title: "",
        description: "",
        duration: 10,
      });

      setShowForm(false);

      fetchQuizzes();

    } catch (err) {

      console.log(
        err.response?.data
      );

      alert(
        JSON.stringify(
          err.response?.data ||
          "Failed to create quiz"
        )
      );

    } finally {

      setLoading(false);
    }
  };

  // ================= ADD QUESTION =================
  const addQuestion = async (
    quizId
  ) => {

    try {

      await API.post(
        "/questions/",
        {
          quiz: quizId,
          text:
            questionForm.text,
          option1:
            questionForm.option1,
          option2:
            questionForm.option2,
          option3:
            questionForm.option3,
          option4:
            questionForm.option4,
          correct_answer:
            questionForm.correct_answer,
          marks:
            questionForm.marks,
        }
      );

      alert(
        "Question added"
      );

      setQuestionForm({
        text: "",
        option1: "",
        option2: "",
        option3: "",
        option4: "",
        correct_answer: 1,
        marks: 1,
      });

      fetchQuizzes();

      fetchQuestions(quizId);

    } catch (err) {

      console.log(err);

      alert(
        "Failed to add question"
      );
    }
  };

  // ================= UPDATE QUESTION =================
  const updateQuestion = async (
    id
  ) => {

    try {

      await API.patch(
        `/questions/${id}/`,
        editingQuestion
      );

      alert(
        "Question updated"
      );

      fetchQuestions(
        editingQuestion.quiz
      );

      setEditingQuestion(null);

      fetchQuizzes();

    } catch (err) {

      console.log(err);

      alert(
        "Update failed"
      );
    }
  };

  // ================= DELETE QUIZ =================
  const deleteQuiz = async (
    id
  ) => {

    if (
      !window.confirm(
        "Delete this quiz?"
      )
    ) return;

    try {

      await API.delete(
        `/quizzes/${id}/`
      );

      fetchQuizzes();

      alert(
        "Quiz deleted"
      );

    } catch (err) {

      console.log(err);

      alert(
        "Delete failed"
      );
    }
  };

  // ================= DELETE QUESTION =================
  const deleteQuestion = async (
    id,
    quizId
  ) => {

    if (
      !window.confirm(
        "Delete question?"
      )
    ) return;

    try {

      await API.delete(
        `/questions/${id}/`
      );

      fetchQuestions(quizId);

      fetchQuizzes();

      alert(
        "Question deleted"
      );

    } catch (err) {

      console.log(err);

      alert(
        "Delete failed"
      );
    }
  };

  return (
    <div className="card">

      {/* ================= HEADER ================= */}
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >

        <h3>
          Quiz
        </h3>

        <button
          className="btn-primary"
          onClick={() =>
            setShowForm(!showForm)
          }
        >
          {showForm
            ? "Cancel"
            : "+ Add Quiz"}
        </button>

      </div>

      {/* ================= QUIZ FORM ================= */}
      {showForm && (

        <div
          style={{
            display: "flex",
            flexDirection:
              "column",
            gap: "12px",
            marginBottom: "20px",
          }}
        >

          <input
            type="text"
            name="title"
            placeholder="Quiz Title"
            value={form.title}
            onChange={
              handleQuizChange
            }
          />

          <textarea
            rows="3"
            name="description"
            placeholder="Description"
            value={
              form.description
            }
            onChange={
              handleQuizChange
            }
          />

          <input
            type="number"
            name="duration"
            placeholder="Duration"
            value={form.duration}
            onChange={
              handleQuizChange
            }
          />

          <button
            className="btn-primary"
            onClick={addQuiz}
            disabled={loading}
          >
            {loading
              ? "Creating..."
              : "Create Quiz"}
          </button>

        </div>
      )}

      {/* ================= QUIZ LIST ================= */}
      {quizzes.length === 0 ? (

        <p>
          No quizzes created
        </p>

      ) : (

        <div
          style={{
            overflowX: "auto",
          }}
        >

          <table>

            <thead>

              <tr>
                <th>Title</th>
                <th>Duration</th>
                <th>Marks</th>
                <th>Questions</th>
                <th>Actions</th>
              </tr>

            </thead>

            <tbody>

              {quizzes.map((q) => (

                <tr key={q.id}>

                  {/* TITLE */}
                  <td>
                    {q.title}
                  </td>

                  {/* DURATION */}
                  <td>
                    {q.duration} mins
                  </td>

                  {/* TOTAL MARKS */}
                  <td>
                    {q.questions?.reduce(
                      (
                        total,
                        question
                      ) =>
                        total +
                        (
                          question.marks ||
                          0
                        ),
                      0
                    ) || 0}
                  </td>

                  {/* QUESTIONS */}
                  <td>
                    {q.questions
                      ?.length || 0}
                  </td>

                  {/* ACTIONS */}
                  <td>

                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        flexWrap:
                          "wrap",
                      }}
                    >

                      {/* ADD QUESTION */}
                      <button
                        onClick={() =>
                          setShowQuestionForm(
                            showQuestionForm ===
                              q.id
                              ? null
                              : q.id
                          )
                        }
                      >
                        Add Question
                      </button>

                      {/* VIEW QUESTIONS */}
                      <button
                        onClick={() =>
                          fetchQuestions(
                            q.id
                          )
                        }
                      >
                        View Questions
                      </button>

                      {/* DELETE QUIZ */}
                      <button
                        onClick={() =>
                          deleteQuiz(
                            q.id
                          )
                        }
                        style={{
                          background:
                            "red",
                          color:
                            "white",
                          border:
                            "none",
                          padding:
                            "8px 12px",
                          borderRadius:
                            "5px",
                          cursor:
                            "pointer",
                        }}
                      >
                        Delete
                      </button>

                    </div>

                    {/* ================= ADD QUESTION FORM ================= */}
                    {showQuestionForm ===
                      q.id && (

                      <div
                        style={{
                          marginTop:
                            "15px",
                          display:
                            "flex",
                          flexDirection:
                            "column",
                          gap: "8px",
                        }}
                      >

                        <textarea
                          name="text"
                          placeholder="Question"
                          value={
                            questionForm.text
                          }
                          onChange={
                            handleQuestionChange
                          }
                        />

                        <input
                          type="text"
                          name="option1"
                          placeholder="Option 1"
                          value={
                            questionForm.option1
                          }
                          onChange={
                            handleQuestionChange
                          }
                        />

                        <input
                          type="text"
                          name="option2"
                          placeholder="Option 2"
                          value={
                            questionForm.option2
                          }
                          onChange={
                            handleQuestionChange
                          }
                        />

                        <input
                          type="text"
                          name="option3"
                          placeholder="Option 3"
                          value={
                            questionForm.option3
                          }
                          onChange={
                            handleQuestionChange
                          }
                        />

                        <input
                          type="text"
                          name="option4"
                          placeholder="Option 4"
                          value={
                            questionForm.option4
                          }
                          onChange={
                            handleQuestionChange
                          }
                        />

                        <input
                          type="number"
                          name="correct_answer"
                          placeholder="Correct Answer (1-4)"
                          value={
                            questionForm.correct_answer
                          }
                          onChange={
                            handleQuestionChange
                          }
                        />

                        <input
                          type="number"
                          name="marks"
                          placeholder="Marks"
                          value={
                            questionForm.marks
                          }
                          onChange={
                            handleQuestionChange
                          }
                        />

                        <button
                          className="btn-primary"
                          onClick={() =>
                            addQuestion(
                              q.id
                            )
                          }
                        >
                          Save Question
                        </button>

                      </div>
                    )}

                  </td>

                </tr>
              ))}

            </tbody>

          </table>

        </div>
      )}

      {/* ================= QUESTIONS TABLE ================= */}
      {questions.length > 0 && (

        <div
          className="card"
          style={{
            marginTop: "20px",
          }}
        >

          <h3>
            Quiz Questions
          </h3>

          <table>

            <thead>

              <tr>
                <th>Question</th>
                <th>Correct</th>
                <th>Marks</th>
                <th>Actions</th>
              </tr>

            </thead>

            <tbody>

              {questions.map((q) => (

                <tr key={q.id}>

                  <td>
                    {q.text}
                  </td>

                  <td>
                    Option{" "}
                    {
                      q.correct_answer
                    }
                  </td>

                  <td>
                    {q.marks}
                  </td>

                  <td>

                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                      }}
                    >

                      {/* EDIT */}
                      <button
                        onClick={() =>
                          setEditingQuestion(
                            q
                          )
                        }
                      >
                        Edit
                      </button>

                      {/* DELETE */}
                      <button
                        onClick={() =>
                          deleteQuestion(
                            q.id,
                            q.quiz
                          )
                        }
                        style={{
                          background:
                            "red",
                          color:
                            "white",
                        }}
                      >
                        Delete
                      </button>

                    </div>

                  </td>

                </tr>
              ))}

            </tbody>

          </table>

        </div>
      )}

      {/* ================= EDIT QUESTION ================= */}
      {editingQuestion && (

        <div
          className="card"
          style={{
            marginTop: "20px",
            display: "flex",
            flexDirection:
              "column",
            gap: "10px",
          }}
        >

          <h3>
            Edit Question
          </h3>

          <textarea
            value={
              editingQuestion.text
            }
            onChange={(e) =>
              setEditingQuestion({
                ...editingQuestion,
                text:
                  e.target.value,
              })
            }
          />

          <input
            value={
              editingQuestion.option1
            }
            onChange={(e) =>
              setEditingQuestion({
                ...editingQuestion,
                option1:
                  e.target.value,
              })
            }
          />

          <input
            value={
              editingQuestion.option2
            }
            onChange={(e) =>
              setEditingQuestion({
                ...editingQuestion,
                option2:
                  e.target.value,
              })
            }
          />

          <input
            value={
              editingQuestion.option3
            }
            onChange={(e) =>
              setEditingQuestion({
                ...editingQuestion,
                option3:
                  e.target.value,
              })
            }
          />

          <input
            value={
              editingQuestion.option4
            }
            onChange={(e) =>
              setEditingQuestion({
                ...editingQuestion,
                option4:
                  e.target.value,
              })
            }
          />

          <input
            type="number"
            placeholder="Correct Answer"
            value={
              editingQuestion.correct_answer
            }
            onChange={(e) =>
              setEditingQuestion({
                ...editingQuestion,
                correct_answer:
                  e.target.value,
              })
            }
          />

          <input
            type="number"
            placeholder="Marks"
            value={
              editingQuestion.marks
            }
            onChange={(e) =>
              setEditingQuestion({
                ...editingQuestion,
                marks:
                  e.target.value,
              })
            }
          />

          <button
            className="btn-primary"
            onClick={() =>
              updateQuestion(
                editingQuestion.id
              )
            }
          >
            Save Changes
          </button>

        </div>
      )}

    </div>
  );
}