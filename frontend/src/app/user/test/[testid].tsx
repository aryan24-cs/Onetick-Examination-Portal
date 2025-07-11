"use client";
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function TestPage() {
  const router = useRouter();
  const { testId } = useParams();
  const [test, setTest] = useState<any>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchTest = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`http://localhost:5000/api/student/test/${testId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok) {
          setTest(data);
          setAnswers(new Array(data.questions.length).fill(-1));
          setTimeLeft(data.duration * 60);
        } else {
          setError(data.message || 'Failed to load test');
        }
        setLoading(false);
      } catch (error) {
        setError('An error occurred');
        setLoading(false);
      }
    };
    fetchTest();
  }, [testId]);

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [timeLeft]);

  const handleAnswer = (optionIndex: number) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = optionIndex;
    setAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentQuestion < test.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const handleSkip = () => {
    if (currentQuestion < test.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const handleSubmit = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/student/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ testId, answers }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push('/user/dashboard');
      } else {
        setError(data.message || 'Submission failed');
      }
    } catch (error) {
      setError('An error occurred during submission');
    }
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="test-container">
      <h2>{test.name}</h2>
      <div className="timer">Time Left: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</div>
      <div className="question-card">
        <p className="question-text">Question {currentQuestion + 1}: {test.questions[currentQuestion].question}</p>
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
