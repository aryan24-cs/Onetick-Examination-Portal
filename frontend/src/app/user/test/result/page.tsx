"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import './result.css';

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
    const storedResult = localStorage.getItem("testResult");
    if (!storedResult) {
      setLoading(false);
      router.push("/user/dashboard");
      return;
    }

    const parsedResult: TestResult = JSON.parse(storedResult);
    setResult(parsedResult);

    // Simulate processing steps
    const steps = [
      { id: 1, duration: 1000, message: "Analyzing your answers..." },
      { id: 2, duration: 1500, message: "Processing your results..." },
      { id: 3, duration: 2000, message: "Calculating your score..." },
    ];

    steps.forEach((step, index) => {
      setTimeout(() => {
        setStep(index + 1);
        if (index === steps.length - 1) {
          setLoading(false);
        }
      }, step.duration * (index + 1));
    });
  }, [router]);

  if (loading) {
    return (
      <div className="container">
        <div className="loader">
          <div className="spinner"></div>
          <p>{step === 0 ? "Loading results..." : [null, "Analyzing your answers...", "Processing your results...", "Calculating your score..."][step]}</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="container">
        <div className="error-container">
          <p className="error-message">No result data available. Please take a test first.</p>
          <button onClick={() => router.push("/user/dashboard")} className="btn btn-secondary">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const passThreshold = 60; // Assuming 60% is passing
  const percentage = (result.score / result.totalQuestions) * 100;
  const isPass = percentage >= passThreshold;

  return (
    <div className="container">
      <div className="result-content">
        <h2>Test Result: {result.testName}</h2>
        <div className="result-details">
          <p><strong>Test ID:</strong> {result.testId}</p>
          <p><strong>Score:</strong> {result.score} / {result.totalQuestions}</p>
          <p><strong>Percentage:</strong> {percentage.toFixed(2)}%</p>
          {isPass ? (
            <div className="party-popper">
              <span>Congratulations! You Passed! 🎉</span>
              <div className="confetti"></div>
            </div>
          ) : (
            <div className="motivation">
              <p>Don't worry! Failure is just a step toward success. Keep trying, and you'll improve!</p>
              <p>Consider reviewing the questions and trying again.</p>
            </div>
          )}
        </div>
        <button onClick={() => router.push("/user/dashboard")} className="btn btn-primary">
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}