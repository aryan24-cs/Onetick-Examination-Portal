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
  const testId = Array.isArray(params.testid)
    ? params.testid[0]
    : params.testid;
  const [test, setTest] = useState<Test | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    console.log("Test page loaded with params:", {
      params,
      testId,
      rawParams: JSON.stringify(params),
    });
    const token = localStorage.getItem("token");
    const studentId = localStorage.getItem("studentId");
    if (!token || !studentId) {
      setError("Please log in as a student");
      console.error("Authentication error: Missing token or studentId", {
        token,
        studentId,
      });
      setLoading(false);
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
        setLoading(false);
        setTimeout(() => router.push("/"), 2000);
        return;
      }
      if (decoded.role !== "student") {
        setError("Access denied. Student role required.");
        console.error("Invalid role", { role: decoded.role });
        localStorage.removeItem("token");
        localStorage.removeItem("studentId");
        setLoading(false);
        setTimeout(() => router.push("/"), 2000);
        return;
      }

      const fetchTest = async () => {
        if (!testId || typeof testId !== "string" || testId.trim() === "") {
          console.error("Test ID is invalid or missing", {
            testId,
            params: JSON.stringify(params),
          });
          setError(
            "No valid test ID provided. Please select a test from the dashboard."
          );
          setLoading(false);
          setTimeout(() => router.push("/user/dashboard"), 3000);
          return;
        }

        const cleanTestId = testId.trim();
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(cleanTestId)) {
          console.error("Invalid test ID format:", {
            testId: cleanTestId,
            params: JSON.stringify(params),
          });
          setError(
            `Invalid test ID format: ${cleanTestId}. Please select a test from the dashboard.`
          );
          setLoading(false);
          setTimeout(() => router.push("/user/dashboard"), 3000);
          return;
        }

        console.log("Fetching test", {
          testId: cleanTestId,
          studentId,
          timestamp: new Date().toISOString(),
        });

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);
          const res = await fetch(
            `${
              process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
            }/api/student/test/${cleanTestId}`,
            {
              headers: { Authorization: `Bearer ${token}` },
              signal: controller.signal,
            }
          );
          clearTimeout(timeoutId);
          const contentType = res.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
            const text = await res.text();
            console.error("Non-JSON response received:", {
              status: res.status,
              text: text.slice(0, 100),
            });
            throw new Error("Server returned a non-JSON response");
          }
          const data = await res.json();
          console.log("Backend response:", {
            status: res.status,
            ok: res.ok,
            message: data.message,
            error: data.error,
            requestedTestId: cleanTestId,
            timestamp: new Date().toISOString(),
          });

          if (res.ok) {
            console.log("Test loaded successfully:", {
              testId: data.testId,
              name: data.name,
              date: data.date,
              duration: data.duration,
              activeUntil: new Date(
                new Date(data.date).getTime() + data.duration * 60 * 1000
              ).toISOString(),
              questionsCount: data.questions?.length || 0,
            });
            setTest(data);
            setAnswers(new Array(data.questions?.length || 0).fill(null));
            setError("");
            const start = new Date(data.date);
            const end = new Date(start.getTime() + data.duration * 60 * 1000);
            const now = new Date();
            console.log("Test time check:", {
              start: start.toISOString(),
              end: end.toISOString(),
              now: now.toISOString(),
              startIST: start.toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
              }),
              endIST: end.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
              nowIST: now.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
            });
            const remainingSeconds = Math.max(
              0,
              Math.floor((end.getTime() - now.getTime()) / 1000)
            );
            if (remainingSeconds === 0) {
              setError(
                `Test duration has expired. Available from ${start.toLocaleString(
                  "en-IN",
                  { timeZone: "Asia/Kolkata" }
                )} to ${end.toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                })}`
              );
              setLoading(false);
              setTimeout(() => router.push("/user/dashboard"), 3000);
              return;
            }
            setTimeLeft(remainingSeconds);
            setLoading(false);
          } else {
            let errorMessage =
              data.message || "Failed to load test. Please try again.";
            if (data.message === "Test already taken") {
              errorMessage = "You have already completed this test.";
            } else if (data.message === "Test is not currently active") {
              errorMessage = `This test is not currently active. It is available from ${new Date(
                data.startTime
              ).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
              })} to ${new Date(data.endTime).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
              })}`;
            } else if (data.message === "Test not found") {
              errorMessage = `Test with ID ${cleanTestId} does not exist. Please select a valid test from the dashboard.`;
            } else if (data.message === "Invalid test ID format") {
              errorMessage = `Invalid test ID format: ${cleanTestId}. Please select a test from the dashboard.`;
            }
            setError(errorMessage);
            console.error("Test fetch failed:", {
              status: res.status,
              message: data.message,
              error: data.error,
            });
            setLoading(false);
            setTimeout(() => router.push("/user/dashboard"), 3000);
          }
        } catch (error: any) {
          console.error("Fetch error:", error, { testId: cleanTestId });
          setError(
            error.name === "AbortError"
              ? "Request timed out. Please check if the backend server is running."
              : `An error occurred: ${error.message}`
          );
          setLoading(false);
          setTimeout(() => router.push("/user/dashboard"), 3000);
        }
      };
      fetchTest();
    } catch (err) {
      console.error("Token decode error:", err);
      setError("Invalid token. Please log in again.");
      localStorage.removeItem("token");
      localStorage.removeItem("studentId");
      setLoading(false);
      setTimeout(() => router.push("/"), 2000);
    }
  }, [router, testId]);

  useEffect(() => {
    if (timeLeft > 0 && test && !submitting) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            console.log("Timer expired, auto-submitting test", { testId });
            handleSubmit(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [timeLeft, test, submitting]);

  const handleAnswer = useCallback(
    (optionIndex: number) => {
      const newAnswers = [...answers];
      newAnswers[currentQuestion] = optionIndex;
      setAnswers(newAnswers);
    },
    [answers, currentQuestion]
  );

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
      newAnswers[currentQuestion] = null;
      setAnswers(newAnswers);
      setCurrentQuestion(currentQuestion + 1);
    }
  }, [test, currentQuestion, answers]);

  const handleSubmit = useCallback(
    async (isAutoSubmit: boolean = false) => {
      if (submitting || !test) {
        if (!isAutoSubmit) {
          setError("No test data available for submission.");
        }
        return;
      }
      setSubmitting(true);
      const token = localStorage.getItem("token");
      if (!token) {
        if (!isAutoSubmit) {
          setError("Session expired. Please log in again.");
        }
        localStorage.removeItem("token");
        localStorage.removeItem("studentId");
        setSubmitting(false);
        setTimeout(() => router.push("/"), 2000);
        return;
      }
      try {
        const decoded: DecodedToken = jwtDecode(token);
        if (decoded.exp < Math.floor(Date.now() / 1000)) {
          if (!isAutoSubmit) {
            setError("Session expired. Please log in again.");
          }
          localStorage.removeItem("token");
          localStorage.removeItem("studentId");
          setSubmitting(false);
          setTimeout(() => router.push("/"), 2000);
          return;
        }
        if (answers.length !== test.questions.length) {
          if (!isAutoSubmit) {
            setError(
              "Please answer all questions or skip them before submitting."
            );
          }
          setSubmitting(false);
          return;
        }
        if (
          !isAutoSubmit &&
          !window.confirm("Are you sure you want to submit the test?")
        ) {
          setSubmitting(false);
          return;
        }
        const cleanTestId = testId?.trim();
        console.log("Submitting test", {
          testId: cleanTestId,
          answers,
          isAutoSubmit,
          timestamp: new Date().toISOString(),
        });
        const res = await fetch(
          `${
            process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
          }/api/student/submit`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ testId: cleanTestId, answers }),
          }
        );
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          const text = await res.text();
          console.error("Non-JSON response received:", {
            status: res.status,
            text: text.slice(0, 100),
          });
          throw new Error("Server returned a non-JSON response");
        }
        const data = await res.json();
        console.log("Submit response:", {
          status: res.status,
          data,
          timestamp: new Date().toISOString(),
        });
        if (res.ok) {
          console.log("Test submitted successfully, storing result:", {
            testId: cleanTestId,
            testName: data.testName,
            score: data.score,
            totalQuestions: data.totalQuestions,
          });
          localStorage.setItem(
            "testResult",
            JSON.stringify({
              testId: cleanTestId,
              testName: data.testName,
              score: data.score,
              totalQuestions: data.totalQuestions,
            })
          );
          setTimeout(() => {
            console.log("Navigating to result page");
            router.push("/user/test/result");
          }, 500); // Slight delay to ensure state updates
        } else if (res.status === 401) {
          if (!isAutoSubmit) {
            setError("Session expired or invalid token. Please log in again.");
          }
          localStorage.removeItem("token");
          localStorage.removeItem("studentId");
          setTimeout(() => router.push("/"), 2000);
        } else {
          if (!isAutoSubmit) {
            setError(data.message || "Submission failed. Please try again.");
          }
          console.error("Submission failed:", {
            status: res.status,
            message: data.message,
            error: data.error,
          });
        }
      } catch (error: any) {
        console.error("Submit error:", error);
        if (!isAutoSubmit) {
          setError(`An error occurred during submission: ${error.message}`);
        }
      } finally {
        setSubmitting(false);
      }
    },
    [testId, answers, router, test, submitting]
  );

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading test data...</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="error-container">
        <p className="error-message">{error}</p>
        {error.includes("Request timed out") && (
          <button
            onClick={() => window.location.reload()}
            className="retry-button"
          >
            Retry
          </button>
        )}
      </div>
    );
  }
  if (!test) {
    return (
      <div className="error-container">
        <p className="error-message">
          No test data available. Please select a test from the dashboard.
        </p>
      </div>
    );
  }

  return (
    <div className="test-container">
      <h2>{test.name}</h2>
      <div className="timer">
        Time Left: {Math.floor(timeLeft / 60)} nhi
        {(timeLeft % 60).toString().padStart(2, "0")}
      </div>
      <div className="question-card">
        <p className="question-text">
          Question {currentQuestion + 1}:{" "}
          {test.questions[currentQuestion].question}
        </p>
        {test.questions[currentQuestion].code && (
          <pre className="code-snippet">
            {test.questions[currentQuestion].code}
          </pre>
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
        <button
          onClick={handlePrevious}
          disabled={currentQuestion === 0}
          className="nav-button"
        >
          Previous
        </button>
        <button
          onClick={handleSkip}
          disabled={currentQuestion === test.questions.length - 1}
          className="nav-button"
        >
          Skip
        </button>
        <button
          onClick={handleNext}
          disabled={currentQuestion === test.questions.length - 1}
          className="nav-button"
        >
          Next
        </button>
        <button
          onClick={() => handleSubmit(false)}
          disabled={submitting}
          className="submit-button"
        >
          {submitting ? "Submitting..." : "Submit"}
        </button>
      </div>
    </div>
  );
}