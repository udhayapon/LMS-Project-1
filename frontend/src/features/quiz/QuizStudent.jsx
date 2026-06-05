import { useEffect, useState } from "react";
import API from "../../api";

export default function QuizStudent({
  teachingId,
}) {

  // ================= STATES =================
  const [quizzes, setQuizzes] =
    useState([]);

  const [attempts, setAttempts] =
    useState([]);

  const [selectedQuiz, setSelectedQuiz] =
    useState(null);

  const [answers, setAnswers] =
    useState({});

  const [score, setScore] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  // ================= SEARCH =================
  const [search, setSearch] =
    useState("");

  // ================= FILTER =================
  const [statusFilter, setStatusFilter] =
    useState("all");

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
        "Quiz fetch error:",
        err
      );
    }
  };

  // ================= FETCH ATTEMPTS =================
  const fetchAttempts = async () => {

    try {

      const res = await API.get(
        "/quiz-attempts/"
      );

      setAttempts(
        res.data?.results ||
        res.data ||
        []
      );

    } catch (err) {

      console.log(
        "Attempt fetch error:",
        err
      );
    }
  };

  // ================= LOAD =================
  useEffect(() => {

    if (teachingId) {

      fetchQuizzes();

      fetchAttempts();
    }

  }, [teachingId]);

  // ================= ANSWER CHANGE =================
  const handleAnswerChange = (
    questionId,
    option
  ) => {

    setAnswers({

      ...answers,

      [questionId]: option,
    });
  };

  // ================= START QUIZ =================
  const startQuiz = (quiz) => {

    const alreadyAttempted =
      attempts.find(
        (a) =>
          (a.quiz?.id || a.quiz) ===
          quiz.id
      );

    if (alreadyAttempted) {

      alert(
        "You already attended this quiz"
      );

      return;
    }

    setSelectedQuiz(quiz);

    setAnswers({});

    setScore(null);
  };

  // ================= SUBMIT QUIZ =================
  const submitQuiz = async () => {

    if (!selectedQuiz) return;

    try {

      setLoading(true);

      const res = await API.post(
        "/quizzes/submit/",
        {
          quiz: selectedQuiz.id,
          answers: answers,
        }
      );

      setScore(res.data);

      fetchAttempts();

    } catch (err) {

      console.log(
        "Quiz submit error:",
        err
      );

      if (
        err.response?.data?.error
      ) {

        alert(
          err.response.data.error
        );

      } else {

        alert(
          "Failed to submit quiz"
        );
      }

    } finally {

      setLoading(false);
    }
  };

  // ================= FILTERED QUIZZES =================
  const filteredQuizzes =
    quizzes.filter((q) => {

      const attempted =
        attempts.find(
          (a) =>
            (a.quiz?.id || a.quiz) ===
            q.id
        );

      // SEARCH
      const matchesSearch =

        q.title
          ?.toLowerCase()
          .includes(
            search.toLowerCase()
          )

        ||

        q.description
          ?.toLowerCase()
          .includes(
            search.toLowerCase()
          );

      // FILTER
      const matchesStatus =

        statusFilter === "all"

        ||

        (
          statusFilter === "attempted"
          &&
          attempted
        )

        ||

        (
          statusFilter === "pending"
          &&
          !attempted
        );

      return (
        matchesSearch
        &&
        matchesStatus
      );
    });

  return (
    <div className="card">

      {/* ================= QUIZ LIST ================= */}
      {!selectedQuiz ? (
        <>

          <h3>
            Available Quizzes
          </h3>

          {/* ================= SEARCH + FILTER ================= */}
          <div
            style={{
              display: "flex",
              gap: "12px",
              margin:
                "20px 0",
              flexWrap: "wrap",
            }}
          >

            {/* SEARCH */}
            <input
              type="text"
              placeholder="Search quiz..."
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
              style={{
                flex: 1,
                minWidth: "220px",
              }}
            />

            {/* FILTER */}
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value
                )
              }
            >

              <option value="all">
                All
              </option>

              <option value="attempted">
                Attempted
              </option>

              <option value="pending">
                Pending
              </option>

            </select>

          </div>

          {filteredQuizzes.length === 0 ? (

            <p>
              No quizzes found
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

                    <th>
                      Title
                    </th>

                    <th>
                      Description
                    </th>

                    <th>
                      Duration
                    </th>

                    <th>
                      Total Marks
                    </th>

                    <th>
                      Questions
                    </th>

                    <th>
                      Status
                    </th>

                    <th>
                      Action
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {filteredQuizzes.map(
                    (q) => {

                      const alreadyAttempted =
                        attempts.find(
                          (a) =>
                            (a.quiz?.id || a.quiz) ===
                            q.id
                        );

                      // ================= TOTAL MARKS =================
                      const totalMarks =
                        q.questions?.reduce(
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
                        ) || 0;

                      return (

                        <tr
                          key={q.id}
                        >

                          {/* TITLE */}
                          <td>
                            {q.title}
                          </td>

                          {/* DESCRIPTION */}
                          <td>
                            {q.description}
                          </td>

                          {/* DURATION */}
                          <td>
                            {q.duration} mins
                          </td>

                          {/* TOTAL MARKS */}
                          <td>
                            {totalMarks}
                          </td>

                          {/* QUESTIONS */}
                          <td>
                            {q.questions?.length || 0}
                          </td>

                          {/* STATUS */}
                          <td>

                            {alreadyAttempted ? (

                              <span
                                style={{
                                  color:
                                    "green",
                                  fontWeight:
                                    "bold",
                                }}
                              >
                                Attempted
                              </span>

                            ) : (

                              <span
                                style={{
                                  color:
                                    "orange",
                                  fontWeight:
                                    "bold",
                                }}
                              >
                                Pending
                              </span>

                            )}

                          </td>

                          {/* ACTION */}
                          <td>

                            {alreadyAttempted ? (

                              <button disabled>
                                Already Attempted
                              </button>

                            ) : (

                              <button
                                className="btn-primary"
                                onClick={() =>
                                  startQuiz(q)
                                }
                              >
                                Start Quiz
                              </button>

                            )}

                          </td>

                        </tr>

                      );
                    }
                  )}

                </tbody>

              </table>

            </div>

          )}

        </>
      ) : (
        <>

          {/* ================= QUIZ HEADER ================= */}
          <div
            style={{
              marginBottom: "20px",
            }}
          >

            <h2>
              {selectedQuiz.title}
            </h2>

            <p>
              {selectedQuiz.description}
            </p>

            <p>
              Duration:{" "}
              {selectedQuiz.duration} mins
            </p>

            <p>

              Total Marks:{" "}

              {selectedQuiz.questions?.reduce(
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

            </p>

          </div>

          {/* ================= QUESTIONS ================= */}
          {selectedQuiz.questions?.map(
            (
              question,
              index
            ) => (

              <div
                key={question.id}
                className="card"
                style={{
                  marginBottom: "20px",
                }}
              >

                <h4>
                  Q{index + 1}.{" "}
                  {question.text}
                </h4>

                <p>
                  Marks:{" "}
                  <strong>
                    {question.marks}
                  </strong>
                </p>

                <div
                  style={{
                    display: "flex",
                    flexDirection:
                      "column",
                    gap: "10px",
                    marginTop: "10px",
                  }}
                >

                  {[1, 2, 3, 4].map(
                    (opt) => (

                      <label key={opt}>

                        <input
                          type="radio"
                          name={`question-${question.id}`}
                          checked={
                            answers[
                              question.id
                            ] === opt
                          }
                          onChange={() =>
                            handleAnswerChange(
                              question.id,
                              opt
                            )
                          }
                        />

                        {" "}

                        {
                          question[
                            `option${opt}`
                          ]
                        }

                      </label>

                    )
                  )}

                </div>

              </div>
            )
          )}

          {/* ================= SUBMIT ================= */}
          {!score && (

            <button
              className="btn-primary"
              onClick={submitQuiz}
              disabled={loading}
            >

              {loading
                ? "Submitting..."
                : "Submit Quiz"}

            </button>

          )}

          {/* ================= RESULT ================= */}
          {score && (

            <div
              className="card"
              style={{
                marginTop: "20px",
              }}
            >

              <h3>
                Quiz Result
              </h3>

              <p>

                Your Score:{" "}

                <strong>

                  {score.score} /{" "}

                  {selectedQuiz.questions?.reduce(
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

                </strong>

              </p>

              <button
                className="btn-primary"
                onClick={() => {

                  setSelectedQuiz(null);

                  setAnswers({});

                  setScore(null);
                }}
              >
                Back to Quizzes
              </button>

            </div>

          )}

        </>
      )}

    </div>
  );
}