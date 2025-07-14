"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Layout from "../../../../components/Layout";

interface TestResult {
  testId: string;
  testName: string;
  score: number;
  totalQuestions: number;
}

export default function TestResultPage() {
  const router = useRouter();
  const [result, setResult] = useState<TestResult | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const resultData = localStorage.getItem("testResult");
    if (!resultData) {
      setError("No test result found. Please take a test first.");
      setTimeout(() => router.push("/user/dashboard"), 3000);
      return;
    }
    try {
      const parsedResult: TestResult = JSON.parse(resultData);
      if (
        !parsedResult.testId ||
        !parsedResult.testName ||
        typeof parsedResult.score !== "number" ||
        typeof parsedResult.totalQuestions !== "number"
      ) {
        throw new Error("Invalid test result data");
      }
      setResult(parsedResult);
      setIsLoading(false);
      // Clear the result from localStorage to prevent reuse
      localStorage.removeItem("testResult");
    } catch (err) {
      console.error("Error parsing test result:", err);
      setError("Invalid test result data. Please try again.");
      setTimeout(() => router.push("/user/dashboard"), 3000);
    }
  }, [router]);

  const getGrade = (score: number, total: number) => {
    const percentage = (score / total) * 100;
    if (percentage >= 90) return "A";
    if (percentage >= 80) return "B";
    if (percentage >= 70) return "C";
    if (percentage >= 60) return "D";
    return "F";
  };

  const getMessage = (score: number, total: number) => {
    const percentage = (score / total) * 100;
    if (percentage >= 70) {
      return {
        title: "Congratulations!",
        message: "You passed the test! Great job, keep up the excellent work!",
        className: "success-message",
      };
    } else {
      return {
        title: "Keep Going!",
        message:
          "You didn't pass this time, but every attempt is a step toward success. Review your answers and try again!",
        className: "motivational-message",
      };
    }
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading result...</p>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="error-container">
        <p className="error-message">{error || "No result available."}</p>
        <button
          onClick={() => router.push("/user/dashboard")}
          className="dashboard-button"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const { title, message, className } = getMessage(
    result.score,
    result.totalQuestions
  );
  const percentage = ((result.score / result.totalQuestions) * 100).toFixed(0);
  const grade = getGrade(result.score, result.totalQuestions);

  return (
    <Layout role="user">
      <div className="result-container">
        <h2 className="result-title">{title}</h2>
        <p className={className}>{message}</p>
        <div className="result-details">
          <h3>Test Result: {result.testName}</h3>
          <div className="result-stats">
            <p>
              <strong>Score:</strong> {result.score}/{result.totalQuestions}
            </p>
            <p>
              <strong>Percentage:</strong> {percentage}%
            </p>
            <p>
              <strong>Grade:</strong> {grade}
            </p>
          </div>
        </div>
        <button
          onClick={() => router.push("/user/dashboard?section=results")}
          className="dashboard-button"
        >
          View All Results
        </button>
      </div>
    </Layout>
  );
}