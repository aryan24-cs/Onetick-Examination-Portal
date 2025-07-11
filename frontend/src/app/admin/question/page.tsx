"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../../components/Layout';

// Define the Question interface to match the backend Question model
interface Question {
  questionId: string;
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
  const [questions, setQuestions] = useState<Question[]>([]); // Fix: Use Question[] type
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('http://localhost:5000/api/admin/questions', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok) {
          setQuestions(data); // TypeScript now accepts this due to correct typing
        } else {
          setError(data.message || 'Failed to fetch questions');
        }
      } catch (error) {
        setError('An error occurred while fetching questions');
      }
    };
    fetchQuestions();
  }, []);

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/admin/question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question, code, options, correctAnswer }),
      });
      const data = await res.json();
      setLoading(false);
      if (res.ok) {
        setQuestions([...questions, { questionId: data.questionId, question, code, options, correctAnswer }]);
        setQuestion('');
        setCode('');
        setOptions(['', '', '', '']);
        setCorrectAnswer(0);
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
      <div className="questions-container">
        <h2>Manage Questions</h2>
        {error && <p className="error">{error}</p>}
        <div className="form-group">
          <label>Question</label>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Enter question"
          />
        </div>
        <div className="form-group">
          <label>Code (Optional)</label>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter code snippet (e.g., Python, JavaScript)"
            rows={5}
          />
        </div>
        {options.map((opt, index) => (
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
          <select value={correctAnswer} onChange={(e) => setCorrectAnswer(Number(e.target.value))}>
            {options.map((_, index) => (
              <option key={index} value={index}>Option {index + 1}</option>
            ))}
          </select>
        </div>
        <button onClick={handleSubmit} disabled={loading}>
          {loading ? 'Creating...' : 'Create Question'}
        </button>
        <h3>Existing Questions</h3>
        <div className="question-list">
          {questions.map((q) => (
            <div key={q.questionId} className="question-card">
              <p><strong>{q.question}</strong></p>
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
