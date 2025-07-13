"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Loader from '../../../components/loader';
import Layout from '../../../components/Layout';

interface Question {
  questionId?: string;
  question: string;
  code?: string;
  options: string[];
  correctAnswer: number;
}

export default function Questions() {
  const [question, setQuestion] = useState('');
  const [code, setCode] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [correctAnswer, setCorrectAnswer] = useState(0);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Please log in as admin');
      setTimeout(() => router.push('/'), 2000);
      return;
    }

    const fetchQuestions = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/questions`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok) {
          setQuestions(data);
        } else {
          setError(data.message || 'Failed to fetch questions');
        }
      } catch (error) {
        setError('An error occurred while fetching questions');
      }
    };
    fetchQuestions();
  }, [router]);

  const validateForm = () => {
    if (!question) {
      setError('Question text is required');
      return false;
    }
    if (options.some((opt) => !opt)) {
      setError('All options must be filled');
      return false;
    }
    if (correctAnswer < 0 || correctAnswer >= options.length) {
      setError('Please select a valid correct answer');
      return false;
    }
    return true;
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question, code, options, correctAnswer }),
      });
      const data = await res.json();
      setLoading(false);
      if (res.ok) {
        const newQuestion = { questionId: data.questionId, question, code, options, correctAnswer };
        setQuestions([...questions, newQuestion]);
        setQuestion('');
        setCode('');
        setOptions(['', '', '', '']);
        setCorrectAnswer(0);
        setCurrentQuestionIndex(currentQuestionIndex + 1);
      } else {
        setError(data.message || 'Failed to create question');
      }
    } catch (error) {
      setLoading(false);
      setError('An error occurred');
    }
  };

  return (
    <Layout>
      <div className="questions-container animate-slide-in">
        {loading && <Loader />}
        <h2>Manage Questions</h2>
        {error && <p className="error animate-error">{error}</p>}
        <div className="question-form animate-slide-in-right">
          <h3>Question {currentQuestionIndex + 1}</h3>
          <div className="form-group">
            <label htmlFor="question">Question</label>
            <input
              id="question"
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Enter question"
              aria-label="Question text"
            />
          </div>
          <div className="form-group">
            <label htmlFor="code">Code (Optional)</label>
            <textarea
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter code snippet (e.g., Python, JavaScript)"
              rows={5}
              aria-label="Code snippet"
            />
          </div>
          {options.map((opt, index) => (
            <div className="form-group" key={index}>
              <label htmlFor={`option${index + 1}`}>Option {index + 1}</label>
              <input
                id={`option${index + 1}`}
                type="text"
                value={opt}
                onChange={(e) => handleOptionChange(index, e.target.value)}
                placeholder={`Enter option ${index + 1}`}
                aria-label={`Option ${index + 1}`}
              />
            </div>
          ))}
          <div className="form-group">
            <label htmlFor="correctAnswer">Correct Answer</label>
            <select
              id="correctAnswer"
              value={correctAnswer}
              onChange={(e) => setCorrectAnswer(Number(e.target.value))}
              aria-label="Correct answer"
            >
              {options.map((_, index) => (
                <option key={index} value={index}>Option {index + 1}</option>
              ))}
            </select>
          </div>
          <button onClick={handleSubmit} disabled={loading} className="gradient-button">
            {loading ? 'Creating...' : 'Add Question'}
          </button>
        </div>
        <h3>Existing Questions ({questions.length})</h3>
        <div className="question-list">
          {questions.map((q, index) => (
            <div key={q.questionId || index} className="question-card animate-slide-in">
              <p><strong>Question {index + 1}: {q.question}</strong></p>
              {q.code && <pre className="code-snippet">{q.code}</pre>}
              <ul>
                {q.options.map((opt: string, i: number) => (
                  <li key={i} className={i === q.correctAnswer ? 'correct-option' : ''}>{opt}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}