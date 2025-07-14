"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { jwtDecode } from "jwt-decode";
import Loader from "../../../components/loader";
import Layout from "../../../components/Layout";

interface Question {
  questionId?: string; // Made questionId optional
  question: string;
  code?: string;
  options: string[];
  correctAnswer: number;
}

interface Test {
  testId: string;
  name: string;
  date: string;
  duration: number;
  questionIds: string[];
}

interface Result {
  testId: { testId: string; name: string; date: string };
  studentId: { studentId: string; name: string; email: string };
  score: number;
  totalQuestions: number;
}

interface Metrics {
  totalStudents: number;
  totalTests: number;
  totalResults: number;
}

interface DecodedToken {
  id: string;
  role: string;
  exp: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeSection = searchParams.get("section") || "dashboard";
  const [tests, setTests] = useState<Test[]>([]);
  const [ongoingTests, setOngoingTests] = useState<Test[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    totalStudents: 0,
    totalTests: 0,
    totalResults: 0,
  });
  const [testName, setTestName] = useState("");
  const [testDate, setTestDate] = useState("");
  const [testTime, setTestTime] = useState("");
  const [testDuration, setTestDuration] = useState("");
  const [questionIds, setQuestionIds] = useState<string[]>([]);
  const [availableQuestions, setAvailableQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question>({
    question: "",
    code: "",
    options: ["", "", "", ""],
    correctAnswer: 0,
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  const isTestOngoing = (test: Test) => {
    const now = new Date();
    const testStart = new Date(test.date);
    const testEnd = new Date(testStart.getTime() + test.duration * 60 * 1000);
    return now >= testStart && now <= testEnd;
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    const adminId = localStorage.getItem("adminId");

    if (!token || !adminId) {
      setError("Please log in as admin");
      console.log("No token or adminId, redirecting to login");
      setTimeout(() => router.push("/"), 2000);
      return;
    }

    try {
      const decoded: DecodedToken = jwtDecode(token);
      if (decoded.exp < Math.floor(Date.now() / 1000)) {
        setError("Session expired. Please log in again.");
        console.log("Token expired:", decoded.exp);
        localStorage.removeItem("token");
        localStorage.removeItem("adminId");
        setTimeout(() => router.push("/"), 2000);
        return;
      }
      if (decoded.role !== "admin") {
        setError("Access denied. Admin role required.");
        console.log("Invalid role:", decoded.role);
        localStorage.removeItem("token");
        localStorage.removeItem("adminId");
        setTimeout(() => router.push("/"), 2000);
        return;
      }
    } catch (err) {
      setError("Invalid token. Please log in again.");
      console.error("Token decode error:", err);
      localStorage.removeItem("token");
      localStorage.removeItem("adminId");
      setTimeout(() => router.push("/"), 2000);
      return;
    }

    const fetchTests = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/api/tests`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const contentType = res.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
            const text = await res.text();
            console.error("Non-JSON response for tests:", {
              status: res.status,
              text: text.slice(0, 100),
            });
            throw new Error("Server returned a non-JSON response");
          }
          const data = await res.json();
          throw new Error(data.message || "Failed to fetch tests");
        }
        const data = await res.json();
        console.log("Fetched tests:", data);
        const validTests = data.filter(
          (test: Test) =>
            test.testId &&
            test.name &&
            test.date &&
            test.duration &&
            test.questionIds
        );
        setOngoingTests(validTests.filter((test: Test) => isTestOngoing(test)));
        setTests(validTests.filter((test: Test) => !isTestOngoing(test)));
      } catch (err: any) {
        console.error("Fetch tests error:", err.message);
        setError("Error fetching tests");
      }
    };

    const fetchResults = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/api/admin/results`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const contentType = res.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
            const text = await res.text();
            console.error("Non-JSON response for results:", {
              status: res.status,
              text: text.slice(0, 100),
            });
            throw new Error("Server returned a non-JSON response");
          }
          const data = await res.json();
          throw new Error(data.message || "Failed to fetch results");
        }
        const data = await res.json();
        console.log("Fetched results:", data);
        setResults(data);
      } catch (err: any) {
        console.error("Fetch results error:", err.message);
        setError("Error fetching results");
      }
    };

    const fetchMetrics = async () => {
      try {
        const [studentsRes, testsRes, resultsRes] = await Promise.all([
          fetch(`${apiBaseUrl}/api/admin/students`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${apiBaseUrl}/api/tests`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${apiBaseUrl}/api/admin/results`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        const students = studentsRes.ok ? await studentsRes.json() : [];
        const tests = testsRes.ok ? await testsRes.json() : [];
        const results = resultsRes.ok ? await resultsRes.json() : [];
        console.log("Fetched metrics:", {
          students: students.length,
          tests: tests.length,
          results: results.length,
        });
        setMetrics({
          totalStudents: students.length,
          totalTests: tests.length,
          totalResults: results.length,
        });
      } catch (err: any) {
        console.error("Fetch metrics error:", err.message);
        setError("Error fetching metrics");
      }
    };

    const fetchQuestions = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/api/admin/questions`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const contentType = res.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
            const text = await res.text();
            console.error("Non-JSON response for questions:", {
              status: res.status,
              text: text.slice(0, 100),
            });
            throw new Error("Server returned a non-JSON response");
          }
          const data = await res.json();
          throw new Error(data.message || "Failed to fetch questions");
        }
        const data = await res.json();
        console.log("Fetched questions:", data);
        setAvailableQuestions(data);
      } catch (err: any) {
        console.error("Fetch questions error:", err.message);
        setError("Error fetching questions");
      }
    };

    const fetchData = async () => {
      setIsLoading(true);
      await Promise.all([
        fetchTests(),
        fetchResults(),
        fetchMetrics(),
        fetchQuestions(),
      ]);
      setIsLoading(false);
    };

    fetchData();
  }, [router, apiBaseUrl]);

  const validateQuestion = () => {
    if (
      !currentQuestion.question ||
      currentQuestion.options.some((opt) => !opt) ||
      currentQuestion.correctAnswer < 0 ||
      currentQuestion.correctAnswer >= currentQuestion.options.length
    ) {
      setError(
        "Please fill in all question fields and select a valid correct answer"
      );
      return false;
    }
    return true;
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...currentQuestion.options];
    newOptions[index] = value;
    setCurrentQuestion({ ...currentQuestion, options: newOptions });
  };

  const handleAddQuestion = async () => {
    if (!validateQuestion()) return;
    try {
      setIsLoading(true);
      const token = localStorage.getItem("token");
      const res = await fetch(`${apiBaseUrl}/api/admin/question`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(currentQuestion),
      });
      if (!res.ok) {
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          const text = await res.text();
          console.error("Non-JSON response for question creation:", {
            status: res.status,
            text: text.slice(0, 100),
          });
          throw new Error("Server returned a non-JSON response");
        }
        const data = await res.json();
        throw new Error(data.message || "Failed to create question");
      }
      const data = await res.json();
      console.log("Question created:", data);
      setQuestionIds([...questionIds, data.questionId]);
      setAvailableQuestions([
        ...availableQuestions,
        { ...currentQuestion, questionId: data.questionId },
      ]);
      setCurrentQuestion({
        question: "",
        code: "",
        options: ["", "", "", ""],
        correctAnswer: 0,
      });
      setError("");
    } catch (err: any) {
      console.error("Question creation error:", err.message);
      setError(err.message || "An error occurred during question creation");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTest = async () => {
    if (
      !testName ||
      !testDate ||
      !testTime ||
      !testDuration ||
      questionIds.length === 0
    ) {
      setError(
        "All fields are required, and at least one question ID must be selected"
      );
      return;
    }

    const [year, month, day] = testDate.split("-").map(Number);
    const [hours, minutes] = testTime.split(":").map(Number);
    const localDate = new Date(year, month - 1, day, hours, minutes);
    const isoDate = localDate.toISOString();

    try {
      setIsLoading(true);
      const token = localStorage.getItem("token");
      const res = await fetch(`${apiBaseUrl}/api/admin/test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: testName,
          date: isoDate,
          duration: Number(testDuration),
          questionIds,
        }),
      });
      if (!res.ok) {
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          const text = await res.text();
          console.error("Non-JSON response for test creation:", {
            status: res.status,
            text: text.slice(0, 100),
          });
          throw new Error("Server returned a non-JSON response");
        }
        const data = await res.json();
        throw new Error(data.message || "Failed to create test");
      }
      const data = await res.json();
      console.log("Test created:", data);
      const newTest = {
        testId: data.testId,
        name: testName,
        date: isoDate,
        duration: Number(testDuration),
        questionIds,
      };
      if (isTestOngoing(newTest)) {
        setOngoingTests([...ongoingTests, newTest]);
      } else {
        setTests([...tests, newTest]);
      }
      setTestName("");
      setTestDate("");
      setTestTime("");
      setTestDuration("");
      setQuestionIds([]);
      setError("");
    } catch (err: any) {
      console.error("Test creation error:", err.message);
      setError(err.message || "An error occurred during test creation");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <Loader />;
  }

  return (
    <Layout role="admin">
      <div className="dashboard-container animate-slide-in">
        <h2>Admin Dashboard</h2>
        {error && <p className="error animate-error">{error}</p>}
        <div className="tabs">
          <button
            className={activeSection === "dashboard" ? "tab-active" : "tab"}
            onClick={() => router.push("/admin/dashboard?section=dashboard")}
          >
            Dashboard
          </button>
          <button
            className={activeSection === "createTest" ? "tab-active" : "tab"}
            onClick={() => router.push("/admin/dashboard?section=createTest")}
          >
            Create Test
          </button>
          <button
            className={activeSection === "ongoingTests" ? "tab-active" : "tab"}
            onClick={() => router.push("/admin/dashboard?section=ongoingTests")}
          >
            Ongoing Tests
          </button>
          <button
            className={activeSection === "tests" ? "tab-active" : "tab"}
            onClick={() => router.push("/admin/dashboard?section=tests")}
          >
            Previous Tests
          </button>
          <button
            className={activeSection === "results" ? "tab-active" : "tab"}
            onClick={() => router.push("/admin/dashboard?section=results")}
          >
            Results
          </button>
        </div>
        {activeSection === "dashboard" && (
          <div className="section">
            <h3>Overview</h3>
            <div className="metrics">
              <div className="metric-card">
                <p className="metric-label">Total Students</p>
                <p className="metric-value">{metrics.totalStudents}</p>
              </div>
              <div className="metric-card">
                <p className="metric-label">Total Tests</p>
                <p className="metric-value">{metrics.totalTests}</p>
              </div>
              <div className="metric-card">
                <p className="metric-label">Total Results</p>
                <p className="metric-value">{metrics.totalResults}</p>
              </div>
            </div>
          </div>
        )}
        {activeSection === "createTest" && (
          <div className="section create-test-section">
            <h3>Create Test</h3>
            <div className="form-group">
              <label htmlFor="testName">Test Name</label>
              <input
                id="testName"
                type="text"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                placeholder="Enter test name"
                aria-label="Test name"
                disabled={isLoading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="testDate">Date</label>
              <input
                id="testDate"
                type="date"
                value={testDate}
                onChange={(e) => setTestDate(e.target.value)}
                aria-label="Test date"
                disabled={isLoading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="testTime">Time (IST)</label>
              <input
                id="testTime"
                type="time"
                value={testTime}
                onChange={(e) => setTestTime(e.target.value)}
                aria-label="Test time"
                disabled={isLoading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="testDuration">Duration (minutes)</label>
              <input
                id="testDuration"
                type="number"
                value={testDuration}
                onChange={(e) => setTestDuration(e.target.value)}
                placeholder="Enter duration"
                aria-label="Test duration"
                disabled={isLoading}
              />
            </div>
            <h3>Add Question</h3>
            <div className="form-group">
              <label htmlFor="questionText">Question</label>
              <input
                id="questionText"
                type="text"
                value={currentQuestion.question}
                onChange={(e) =>
                  setCurrentQuestion({
                    ...currentQuestion,
                    question: e.target.value,
                  })
                }
                placeholder="Enter question"
                aria-label="Question text"
                disabled={isLoading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="questionCode">Code (Optional)</label>
              <textarea
                id="questionCode"
                value={currentQuestion.code}
                onChange={(e) =>
                  setCurrentQuestion({
                    ...currentQuestion,
                    code: e.target.value,
                  })
                }
                placeholder="Enter code snippet"
                rows={5}
                aria-label="Code snippet"
                disabled={isLoading}
              />
            </div>
            {currentQuestion.options.map((opt, index) => (
              <div className="form-group" key={index}>
                <label htmlFor={`option${index + 1}`}>Option {index + 1}</label>
                <input
                  id={`option${index + 1}`}
                  type="text"
                  value={opt}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  placeholder={`Enter option ${index + 1}`}
                  aria-label={`Option ${index + 1}`}
                  disabled={isLoading}
                />
              </div>
            ))}
            <div className="form-group">
              <label htmlFor="correctAnswer">Correct Answer</label>
              <select
                id="correctAnswer"
                value={currentQuestion.correctAnswer}
                onChange={(e) =>
                  setCurrentQuestion({
                    ...currentQuestion,
                    correctAnswer: Number(e.target.value),
                  })
                }
                aria-label="Correct answer"
                disabled={isLoading}
              >
                {currentQuestion.options.map((_, index) => (
                  <option key={index} value={index}>
                    Option {index + 1}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleAddQuestion}
              className="button-success"
              disabled={isLoading}
            >
              Add Question
            </button>
            <h3>Select Questions for Test</h3>
            <div className="question-list">
              {availableQuestions.map((q) => (
                <div
                  key={q.questionId}
                  className="question-card animate-slide-in"
                >
                  <input
                    type="checkbox"
                    checked={questionIds.includes(q.questionId!)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setQuestionIds([...questionIds, q.questionId!]);
                      } else {
                        setQuestionIds(
                          questionIds.filter((id) => id !== q.questionId)
                        );
                      }
                    }}
                    disabled={isLoading}
                  />
                  <p>
                    <strong>{q.question}</strong>
                  </p>
                  {q.code && <pre className="code-snippet">{q.code}</pre>}
                  <ul>
                    {q.options.map((opt, i) => (
                      <li
                        key={i}
                        className={
                          i === q.correctAnswer ? "correct-option" : ""
                        }
                      >
                        {opt}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <button
              onClick={handleCreateTest}
              className="gradient-button"
              disabled={isLoading || questionIds.length === 0}
            >
              Publish Test
            </button>
          </div>
        )}
        {activeSection === "ongoingTests" && (
          <div className="section">
            <h3>Ongoing Tests</h3>
            <div className="test-list">
              {ongoingTests.length === 0 ? (
                <p>No ongoing tests available.</p>
              ) : (
                ongoingTests.map((test) => (
                  <div key={test.testId} className="test-card animate-slide-in">
                    <h4>{test.name}</h4>
                    <p>
                      Date:{" "}
                      {new Date(test.date).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                      })}
                    </p>
                    <p>Duration: {test.duration} minutes</p>
                    <p>Questions: {test.questionIds.length}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        {activeSection === "tests" && (
          <div className="section">
            <h3>Previous Tests</h3>
            <div className="test-list">
              {tests.length === 0 ? (
                <p>No previous tests available.</p>
              ) : (
                tests.map((test) => (
                  <div key={test.testId} className="test-card animate-slide-in">
                    <h4>{test.name}</h4>
                    <p>
                      Date:{" "}
                      {new Date(test.date).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                      })}
                    </p>
                    <p>Duration: {test.duration} minutes</p>
                    <p>Questions: {test.questionIds.length}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        {activeSection === "results" && (
          <div className="section">
            <h3>Results</h3>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Test</th>
                    <th>Student</th>
                    <th>Score</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result, index) => (
                    <tr key={index} className="animate-slide-in">
                      <td>{result.testId.name}</td>
                      <td>{result.studentId.name}</td>
                      <td>
                        {result.score}/{result.totalQuestions}
                      </td>
                      <td>
                        {new Date(result.testId.date).toLocaleDateString(
                          "en-IN",
                          { timeZone: "Asia/Kolkata" }
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
