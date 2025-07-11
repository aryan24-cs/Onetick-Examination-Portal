"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { jwtDecode } from "jwt-decode";

interface Question {
  questionId?: string;
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
  questions: Question[];
}

interface Result {
  testId: { name: string; date: string };
  studentId: { name: string; email: string };
  score: number;
  totalQuestions: number;
}

interface DecodedToken {
  id: string;
  role: string;
  exp: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [tests, setTests] = useState<Test[]>([]);
  const [ongoingTests, setOngoingTests] = useState<Test[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [activeSection, setActiveSection] = useState("createTest");
  const [testName, setTestName] = useState("");
  const [testDate, setTestDate] = useState("");
  const [testTime, setTestTime] = useState("");
  const [testDuration, setTestDuration] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question>({
    question: "",
    code: "",
    options: ["", "", "", ""],
    correctAnswer: 0,
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const isTestOngoing = (test: Test) => {
    const now = new Date();
    const testStart = new Date(test.date);
    const testEnd = new Date(testStart.getTime() + test.duration * 60 * 1000);
    const isOngoing = now >= testStart && now <= testEnd;
    console.log("Checking test ongoing status:", {
      testId: test.testId,
      name: test.name,
      now: now.toISOString(),
      testStart: testStart.toISOString(),
      testEnd: testEnd.toISOString(),
      isOngoing,
    });
    return isOngoing;
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    const adminId = localStorage.getItem("adminId");

    if (!token || !adminId) {
      setError("Please log in as admin");
      setTimeout(() => router.push("/"), 2000);
      return;
    }

    try {
      const decoded: DecodedToken = jwtDecode(token);
      if (decoded.exp < Math.floor(Date.now() / 1000)) {
        setError("Session expired. Please log in again.");
        localStorage.removeItem("token");
        localStorage.removeItem("adminId");
        setTimeout(() => router.push("/"), 2000);
        return;
      }
      if (decoded.role !== "admin") {
        setError("Access denied. Admin role required.");
        localStorage.removeItem("token");
        localStorage.removeItem("adminId");
        setTimeout(() => router.push("/"), 2000);
        return;
      }
    } catch (err) {
      setError("Invalid token. Please log in again.");
      localStorage.removeItem("token");
      localStorage.removeItem("adminId");
      setTimeout(() => router.push("/"), 2000);
      return;
    }

    const fetchTests = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/tests", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          console.log("Fetched tests:", data);
          const validTests = data.filter(
            (test: Test) =>
              test.testId &&
              test.name &&
              test.date &&
              test.duration &&
              test.questions
          );
          setOngoingTests(
            validTests.filter((test: Test) => isTestOngoing(test))
          );
          setTests(
            validTests.filter((test: Test) => !isTestOngoing(test))
          );
        } else {
          setError("Failed to fetch tests");
        }
      } catch (err) {
        setError("Error fetching tests");
      }
    };

    const fetchResults = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/admin/results", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        } else {
          setError("Failed to fetch results");
        }
      } catch (err) {
        setError("Error fetching results");
      }
    };

    const fetchData = async () => {
      setIsLoading(true);
      await Promise.all([fetchTests(), fetchResults()]);
      setIsLoading(false);
    };

    fetchData();
  }, [router]);

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...currentQuestion.options];
    newOptions[index] = value;
    setCurrentQuestion({ ...currentQuestion, options: newOptions });
  };

  const handleAddQuestion = () => {
    if (
      !currentQuestion.question ||
      currentQuestion.options.some((opt) => !opt) ||
      currentQuestion.correctAnswer < 0
    ) {
      setError("Please fill in all question fields");
      return;
    }
    setQuestions([...questions, currentQuestion]);
    setCurrentQuestion({
      question: "",
      code: "",
      options: ["", "", "", ""],
      correctAnswer: 0,
    });
    setError("");
  };

  const handleCreateTest = async () => {
    setError("");
    if (!testName || !testDate || !testTime || !testDuration || questions.length === 0) {
      setError("All fields are required, and at least one question must be added");
      return;
    }

    const [year, month, day] = testDate.split("-").map(Number);
    const [hours, minutes] = testTime.split(":").map(Number);
    const localDate = new Date(year, month - 1, day, hours, minutes);
    const isoDate = localDate.toISOString();

    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:5000/api/admin/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: testName,
          date: isoDate,
          duration: Number(testDuration),
          questions,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const newTest = { testId: data.testId, name: testName, date: isoDate, duration: Number(testDuration), questions };
        if (isTestOngoing(newTest)) {
          setOngoingTests([...ongoingTests, newTest]);
        } else {
          setTests([...tests, newTest]);
        }
        setTestName("");
        setTestDate("");
        setTestTime("");
        setTestDuration("");
        setQuestions([]);
        setCurrentQuestion({ question: "", code: "", options: ["", "", "", ""], correctAnswer: 0 });
      } else {
        setError(data.message || "Failed to create test");
      }
    } catch (err) {
      console.error("Test creation error:", err);
      setError("An error occurred during test creation");
    }
  };

  if (isLoading) {
    return <div className="dashboard-container"><p>Loading...</p></div>;
  }

  return (
    <div className="dashboard-container">
      <div className="nav">
        <button
          className={activeSection === "createTest" ? "tab-active" : "tab"}
          onClick={() => setActiveSection("createTest")}
        >
          Create Test
        </button>
        <button
          className={activeSection === "ongoingTests" ? "tab-active" : "tab"}
          onClick={() => setActiveSection("ongoingTests")}
        >
          Ongoing Tests
        </button>
        <button
          className={activeSection === "tests" ? "tab-active" : "tab"}
          onClick={() => setActiveSection("tests")}
        >
          Previous Tests
        </button>
        <button
          className={activeSection === "results" ? "tab-active" : "tab"}
          onClick={() => setActiveSection("results")}
        >
          Results
        </button>
        <button
          className="nav-item logout"
          onClick={() => {
            localStorage.removeItem("token");
            localStorage.removeItem("adminId");
            router.push("/");
          }}
        >
          Logout
        </button>
      </div>
      <div className="main-content">
        {error && <p className="error">{error}</p>}
        {activeSection === "createTest" && (
          <div className="section create-test-section">
            <h2>Create Test</h2>
            <div className="form-group">
              <label>Test Name</label>
              <input
                type="text"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                placeholder="Enter test name"
              />
            </div>
            <div className="form-group">
              <label>Date</label>
              <input
                type="date"
                value={testDate}
                onChange={(e) => setTestDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Time (IST)</label>
              <input
                type="time"
                value={testTime}
                onChange={(e) => setTestTime(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Duration (minutes)</label>
              <input
                type="number"
                value={testDuration}
                onChange={(e) => setTestDuration(e.target.value)}
                placeholder="Enter duration"
              />
            </div>
            <h3>Add Question</h3>
            <div className="form-group">
              <label>Question</label>
              <input
                type="text"
                value={currentQuestion.question}
                onChange={(e) => setCurrentQuestion({ ...currentQuestion, question: e.target.value })}
                placeholder="Enter question"
              />
            </div>
            <div className="form-group">
              <label>Code (Optional)</label>
              <textarea
                value={currentQuestion.code}
                onChange={(e) => setCurrentQuestion({ ...currentQuestion, code: e.target.value })}
                placeholder="Enter code snippet"
                rows={5}
              />
            </div>
            {currentQuestion.options.map((opt, index) => (
              <div className="form-group" key={index}>
                <label>Option {index + 1}</label>
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  placeholder={`Enter option ${index + 1}`}
                />
              </div>
            ))}
            <div className="form-group">
              <label>Correct Answer</label>
              <select
                value={currentQuestion.correctAnswer}
                onChange={(e) => setCurrentQuestion({ ...currentQuestion, correctAnswer: Number(e.target.value) })}
              >
                {currentQuestion.options.map((_, index) => (
                  <option key={index} value={index}>Option {index + 1}</option>
                ))}
              </select>
            </div>
            <button onClick={handleAddQuestion} className="button-success">
              Add Question
            </button>
            <h3>Questions Added ({questions.length})</h3>
            <div className="question-list">
              {questions.map((q, index) => (
                <div key={index} className="question-card">
                  <p><strong>Question {index + 1}: {q.question}</strong></p>
                  {q.code && <pre className="code-snippet">{q.code}</pre>}
                  <ul>
                    {q.options.map((opt, i) => (
                      <li key={i} className={i === q.correctAnswer ? "correct-option" : ""}>{opt}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <button onClick={handleCreateTest} className="button-success" disabled={questions.length === 0}>
              Publish Test
            </button>
          </div>
        )}
        {activeSection === "ongoingTests" && (
          <div className="section">
            <h2>Ongoing Tests</h2>
            <div className="test-list">
              {ongoingTests.length === 0 ? (
                <p>No ongoing tests available.</p>
              ) : (
                ongoingTests.map((test) => (
                  <div key={test.testId} className="test-card">
                    <h4>{test.name}</h4>
                    <p>Date: {new Date(test.date).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
                    <p>Duration: {test.duration} minutes</p>
                    <p>Questions: {test.questions.length}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        {activeSection === "tests" && (
          <div className="section">
            <h2>Previous Tests</h2>
            <div className="test-list">
              {tests.length === 0 ? (
                <p>No previous tests available.</p>
              ) : (
                tests.map((test) => (
                  <div key={test.testId} className="test-card">
                    <h4>{test.name}</h4>
                    <p>Date: {new Date(test.date).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
                    <p>Duration: {test.duration} minutes</p>
                    <p>Questions: {test.questions.length}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        {activeSection === "results" && (
          <div className="section">
            <h2>Results</h2>
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
                    <tr key={index}>
                      <td>{result.testId.name}</td>
                      <td>{result.studentId.name}</td>
                      <td>{result.score}/{result.totalQuestions}</td>
                      <td>{new Date(result.testId.date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}