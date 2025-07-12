"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { jwtDecode } from "jwt-decode";

interface Question {
  questionId: string;
  question: string;
  code?: string;
  options: string[];
}

interface Test {
  testId: string;
  name: string;
  date: string;
  duration: number;
  questions: Question[];
}

interface DecodedToken {
  id: string;
  role: string;
  exp: number;
}

export default function TestPage() {
  const router = useRouter();
  const params = useParams();
  const testId = Array.isArray(params.testId) ? params.testId[0] : params.testId; // Handle array or string
  const [test, setTest] = useState<Test | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    console.log("Test page loaded with params:", { params, testId });
    const token = localStorage.getItem("token");
    const studentId = localStorage.getItem("studentId");
    if (!token || !studentId) {
      setError("Please log in as a student");
      console.error("Authentication error: Missing token or studentId", { token, studentId });
      setTimeout(() => router.push("/"), 2000);
      return;
    }

    try {
      const decoded: DecodedToken = jwtDecode(token);
      if (decoded.exp < Math.floor(Date.now() / 1000)) {
        setError("Session expired. Please log in again.");
        console.error("Token expired", { decoded });
        localStorage.removeItem("token");
        localStorage.removeItem("studentId");
        setTimeout(() => router.push("/"), 2000);
        return;
      }
      if (decoded.role !== "student") {
        setError("Access denied. Student role required.");
        console.error("Invalid role", { role: decoded.role });
        localStorage.removeItem("token");
        localStorage.removeItem("studentId");
        setTimeout(() => router.push("/"), 2000);
        return;
      }

      const fetchTest = async () => {
        if (!testId) {
          console.error("Test ID is undefined or empty", { testId, params });
          setError("Invalid test ID. Please navigate from the dashboard.");
          setLoading(false);
          // setTimeout(() => router.push("/user/dashboard"), 2000);
          return;
        }
Invalid test ID. Please navigate from the dashboard."
        const cleanTestId = testId.trim();
        console.log("Fetching test", {
          testId: cleanTestId,
          studentId,
          timestamp: new Date().toISOString(),
        });

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);
          const res = await fetch(`http://localhost:5000/api/student/test/${cleanTestId}`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          const data = await res.json();
          console.log("Backend response:", {
            status: res.status,
            ok: res.ok,
            message: data.message,
            error: data.error,
            requestedTestId: cleanTestId,
            availableTestIds: data.availableTestIds,
            timestamp: new Date().toISOString(),
          });

          if (res.ok) {
            console.log("Test loaded successfully:", {
              testId: data.testId,
              name: data.name,
              date: data.date,
              duration: data.duration,
              activeUntil: new Date(new Date(data.date).getTime() + data.duration * 60 * 1000).toISOString(),
              questionsCount: data.questions?.length || 0,
            });
            setTest(data);
            setAnswers(new Array(data.questions?.length || 0).fill(-1));
            // Calculate time left based on test start and duration
            const start = new Date(data.date);
            const end = new Date(start.getTime() + data.duration * 60 * 1000);
            const now = new Date();
            const remainingSeconds = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000));
            if (remainingSeconds === 0) {
              setError("Test duration has expired.");
              setLoading(false);
              // setTimeout(() => router.push("/user/dashboard"), 2000);
              return;
            }
            setTimeLeft(remainingSeconds);
          } else {
            let errorMessage = data.message || "Failed to load test. Please try again.";
            if (data.message === "Test already taken") {
              errorMessage = "You have already completed this test.";
            } else if (data.message === "Test is not currently active") {
              errorMessage = "This test is not currently active. Check the test schedule.";
            } else if (data.message === "Test not found") {
              errorMessage = "This test does not exist. Please select a test from the dashboard.";
            }
            setError(errorMessage);
            console.error("Test fetch failed:", { status: res.status, message: data.message, error: data.error, availableTestIds: data.availableTestIds });
            setLoading(false);
            // setTimeout(() => router.push("/user/dashboard"), 2000);
          }
        } catch (error: any) {
          console.error("Fetch error:", error, { testId: cleanTestId });
          setError(error.name === "AbortError" ? "Request timed out. Please check if the backend server is running." : `An error occurred: ${error.message}`);
          setLoading(false);
          // setTimeout(() => router.push("/user/dashboard"), 2000);
        }
      };
      fetchTest();
    } catch (err) {
      console.error("Token decode error:", err);
      setError("Invalid token. Please log in again.");
      localStorage.removeItem("token");
      localStorage.removeItem("studentId");
      setTimeout(() => router.push("/"), 2000);
    }
  }, [router, testId]);

  useEffect(() => {
    if (timeLeft > 0 && test) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            console.log("Timer expired, auto-submitting test", { testId });
            handleSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [timeLeft, test]);

  const handleAnswer = useCallback((optionIndex: number) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = optionIndex;
    setAnswers(newAnswers);
  }, [answers, currentQuestion]);

  const handleNext = useCallback(() => {
    if (test && currentQuestion < test.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  }, [test, currentQuestion]);

  const handlePrevious = useCallback(() => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  }, [currentQuestion]);

  const handleSkip = useCallback(() => {
    if (test && currentQuestion < test.questions.length - 1) {
      const newAnswers = [...answers];
      newAnswers[currentQuestion] = -1; // Explicitly mark as skipped
      setAnswers(newAnswers);
      setCurrentQuestion(currentQuestion + 1);
    }
  }, [test, currentQuestion, answers]);

  const handleSubmit = useCallback(async () => {
    if (!test) {
      setError("No test data available for submission.");
      return;
    }
    if (!window.confirm("Are you sure you want to submit the test?")) return;
    try {
      const token = localStorage.getItem("token");
      const cleanTestId = testId?.trim();
      console.log("Submitting test", { testId: cleanTestId, answers });
      const res = await fetch("http://localhost:5000/api/student/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ testId: cleanTestId, answers }),
      });
      const data = await res.json();
      console.log("Submit response:", data);
      if (res.ok) {
        router.push("/user/dashboard");
      } else {
        setError(data.message || "Submission failed. Please try again.");
      }
    } catch (error: any) {
      console.error("Submit error:", error);
      setError(`An error occurred during submission: ${error.message}`);
    }
  }, [testId, answers, router, test]);

  if (loading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!test) return <div className="error">No test data available. Please navigate from the dashboard.</div>;

  return (
    <div className="test-container">
      <h2>{test.name}</h2>
      <div className="timer">
        Time Left: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
      </div>
      <div className="question-card">
        <p className="question-text">
          Question {currentQuestion + 1}: {test.questions[currentQuestion].question}
        </p>
        {test.questions[currentQuestion].code && (
          <pre className="code-snippet">{test.questions[currentQuestion].code}</pre>
        )}
        <div className="options">
          {test.questions[currentQuestion].options.map((opt: string, i: number) => (
            <label key={i} className="option">
              <input
                type="radio"
                name={`question-${currentQuestion}`}
                checked={answers[currentQuestion] === i}
                onChange={() => handleAnswer(i)}
              />
              {opt}
            </label>
          ))}
        </div>
      </div>
      <div className="navigation">
        <button onClick={handlePrevious} disabled={currentQuestion === 0} className="nav-button">
          Previous
        </button>
        <button onClick={handleSkip} disabled={currentQuestion === test.questions.length - 1} className="nav-button">
          Skip
        </button>
        <button onClick={handleNext} disabled={currentQuestion === test.questions.length - 1} className="nav-button">
          Next
        </button>
        <button onClick={handleSubmit} className="submit-button">
          Submit
        </button>
      </div>
    </div>
  );
}