"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import "./result.css";

interface TestResult {
  testId: string;
  testName: string;
  score: number;
  totalQuestions: number;
}

export default function ResultPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("ResultPage: useEffect started");
    const storedResult = localStorage.getItem("testResult");
    if (!storedResult) {
      console.error("ResultPage: No testResult in localStorage");
      setLoading(false);
      router.push("/user/dashboard");
      return;
    }

    try {
      const parsedResult: TestResult = JSON.parse(storedResult);
      console.log("ResultPage: Parsed result", parsedResult);
      if (
        !parsedResult.testId ||
        !parsedResult.testName ||
        typeof parsedResult.score !== "number" ||
        typeof parsedResult.totalQuestions !== "number"
      ) {
        throw new Error("Invalid test result data");
      }
      setResult(parsedResult);

      // Simulate loading steps
      const steps = [
        { id: 1, duration: 1000, message: "Analyzing your answers..." },
        { id: 2, duration: 1000, message: "Processing your results..." },
        { id: 3, duration: 1000, message: "Calculating your score..." },
      ];

      let totalDuration = 0;
      steps.forEach((step, index) => {
        totalDuration += step.duration;
        setTimeout(() => {
          console.log(`ResultPage: Step ${step.id} - ${step.message}`);
          setStep(step.id);
          if (index === steps.length - 1) {
            console.log("ResultPage: Loading complete");
            setLoading(false);
          }
        }, totalDuration);
      });
    } catch (error) {
      console.error("ResultPage: Error parsing test result:", error);
      setLoading(false);
      router.push("/user/dashboard");
    }

    // Cleanup timeouts on unmount
    return () => {
      console.log("ResultPage: Cleaning up timeouts");
      // Clear any pending timeouts (optional, for robustness)
    };
  }, [router]);

  if (loading) {
    console.log("ResultPage: Rendering loader, step:", step);
    return (
      <div className="container">
        <div className="loader">
          <div className="cube-loader">
            <div className="cube-face front">0101</div>
            <div className="cube-face back">{`{score: ${result?.score || 0}}`}</div>
            <div className="cube-face right">if (pass) 🎉</div>
            <div className="cube-face left">else retry;</div>
            <div className="cube-face top">calc()</div>
            <div className="cube-face bottom">done!</div>
          </div>
          <p className="loader-message">
            {step === 0
              ? "Loading results..."
              : [
                  null,
                  "Analyzing your answers...",
                  "Processing your results...",
                  "Calculating your score...",
                ][step]}
          </p>
        </div>
      </div>
    );
  }

  if (!result) {
    console.log("ResultPage: No result, rendering error");
    return (
      <div className="container">
        <div className="error-container">
          <p className="error-message">
            No result data available. Please take a test first.
          </p>
          <button
            onClick={() => router.push("/user/dashboard")}
            className="btn btn-secondary"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const passThreshold = 60;
  const percentage = (result.score / result.totalQuestions) * 100;
  const isPass = percentage >= passThreshold;
  console.log("ResultPage: Rendering result", {
    testId: result.testId,
    testName: result.testName,
    score: result.score,
    totalQuestions: result.totalQuestions,
    percentage,
    isPass,
  });

  return (
    <div className="container">
      <div className="result-content">
        <h2>Test Result: {result.testName}</h2>
        <div className="result-card">
          <div className="result-details">
            <p>
              <strong>Test ID:</strong> {result.testId}
            </p>
            <p>
              <strong>Score:</strong> {result.score} / {result.totalQuestions}
            </p>
            <div className="progress-container">
              <p>
                <strong>Percentage:</strong> {percentage.toFixed(2)}%
              </p>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>
            </div>
            {isPass ? (
              <div className="party-popper">
                <span>Congratulations! You Passed! 🎉</span>
                <div className="confetti"></div>
              </div>
            ) : (
              <div className="motivation">
                <p>
                  Don't worry! Failure is just a step toward success. Keep
                  trying, and you'll improve!
                </p>
                <p>Consider reviewing the questions and trying again.</p>
              </div>
            )}
          </div>
        </div>
        <button
          onClick={() => router.push("/user/dashboard")}
          className="btn btn-primary"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}