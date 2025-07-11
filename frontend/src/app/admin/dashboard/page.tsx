"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Layout from '../../../components/Layout';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

interface Question {
  questionId: string;
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
  testId: { name: string };
  studentId: { name: string };
  score: number;
  totalQuestions: number;
}

export default function AdminDashboard() {
  const [activeSection, setActiveSection] = useState('create');
  const [tests, setTests] = useState<Test[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [newTest, setNewTest] = useState({
    name: '',
    date: '',
    duration: 0,
    questionIds: [] as string[],
  });
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetchTests();
    fetchResults();
    fetchQuestions();
  }, []);

  const fetchTests = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('http://localhost:5000/api/tests', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch tests');
      const data = await res.json();
      setTests(data);
    } catch (err) {
      setError('Error fetching tests. Please try again.');
    }
  };

  const fetchResults = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('http://localhost:5000/api/admin/results', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch results');
      const data = await res.json();
      setResults(data);
    } catch (err) {
      setError('Error fetching results. Please try again.');
    }
  };

  const fetchQuestions = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('http://localhost:5000/api/admin/questions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch questions');
      const data = await res.json();
      setQuestions(data);
    } catch (err) {
      setError('Error fetching questions. Please try again.');
    }
  };

  const handleTestChange = (field: keyof typeof newTest, value: string | number) => {
    setNewTest({ ...newTest, [field]: value });
  };

  const handleQuestionSelect = (questionId: string) => {
    setSelectedQuestionIds((prev) =>
      prev.includes(questionId)
        ? prev.filter((id) => id !== questionId)
        : [...prev, questionId]
    );
  };

  const handleCreateTest = async () => {
    if (!newTest.name || !newTest.date || !newTest.duration || selectedQuestionIds.length === 0) {
      setError('Please fill in all test details and select at least one question.');
      return;
    }
    setLoading(true);
    setError('');
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('http://localhost:5000/api/admin/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...newTest, questionIds: selectedQuestionIds }),
      });
      const data = await res.json();
      setLoading(false);
      if (data.success) {
        fetchTests();
        setNewTest({ name: '', date: '', duration: 0, questionIds: [] });
        setSelectedQuestionIds([]);
        setActiveSection('previous');
      } else {
        setError(data.message || 'Test creation failed.');
      }
    } catch (err) {
      setLoading(false);
      setError('Error creating test. Please try again.');
    }
  };

  return (
    <Layout>
      <div className="dashboard-container">
        <h2>Admin Dashboard</h2>
        {error && <p className="error">{error}</p>}
        <div className="tab-group">
          <button
            className={activeSection === 'create' ? 'tab-active' : 'tab'}
            onClick={() => setActiveSection('create')}
          >
            Create Test
          </button>
          <button
            className={activeSection === 'previous' ? 'tab-active' : 'tab'}
            onClick={() => setActiveSection('previous')}
          >
            Previous Tests
          </button>
          <button
            className={activeSection === 'results' ? 'tab-active' : 'tab'}
            onClick={() => setActiveSection('results')}
          >
            Results
          </button>
          <Link href="/admin/questions">
            <button className={activeSection === 'questions' ? 'tab-active' : 'tab'}>
              Questions
            </button>
          </Link>
          <button onClick={() => {
            localStorage.clear();
            router.push('/');
          }}>
            Logout
          </button>
        </div>

        {activeSection === 'create' && (
          <div className="section create-test-section">
            <h3>Create New Test</h3>
            <div className="form-group">
              <label>Test Name</label>
              <input
                type="text"
                value={newTest.name}
                onChange={(e) => handleTestChange('name', e.target.value)}
                placeholder="Enter test name"
              />
            </div>
            <div className="form-group">
              <label>Date & Time</label>
              <input
                type="datetime-local"
                value={newTest.date}
                onChange={(e) => handleTestChange('date', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Duration (minutes)</label>
              <input
                type="number"
                value={newTest.duration}
                onChange={(e) => handleTestChange('duration', parseInt(e.target.value))}
                placeholder="Enter duration"
                min="1"
              />
            </div>
            <h4>Select Questions</h4>
            <div className="question-list">
              {questions.length === 0 ? (
                <p>No questions available. <Link href="/admin/questions">Create some questions first.</Link></p>
              ) : (
                questions.map((q) => (
                  <div key={q.questionId} className="question-card">
                    <label className="question-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedQuestionIds.includes(q.questionId)}
                        onChange={() => handleQuestionSelect(q.questionId)}
                      />
                      <span>
                        <strong>{q.question}</strong>
                        {q.code && <pre className="code-snippet">{q.code}</pre>}
                        <ul>
                          {q.options.map((opt, i) => (
                            <li key={i} className={i === q.correctAnswer ? 'correct-option' : ''}>
                              {opt}
                            </li>
                          ))}
                        </ul>
                      </span>
                    </label>
                  </div>
                ))
              )}
            </div>
            <button
              onClick={handleCreateTest}
              disabled={loading}
              className={loading ? 'button-disabled' : 'button-success'}
            >
              {loading ? 'Creating...' : 'Create Test'}
            </button>
          </div>
        )}

        {activeSection === 'previous' && (
          <div className="section">
            <h3>Previous Tests</h3>
            <div className="test-list">
              {tests.map((test) => (
                <div key={test.testId} className="test-card">
                  <h4>{test.name}</h4>
                  <p>Date: {new Date(test.date).toLocaleString()}</p>
                  <p>Duration: {test.duration} minutes</p>
                  <p>Questions: {test.questions.length}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSection === 'results' && (
          <div className="section">
            <h3>Results</h3>
            <div className="result-list">
              {results.map((result, index) => (
                <div key={index} className="result-card">
                  <p><strong>Test:</strong> {result.testId.name}</p>
                  <p><strong>Student:</strong> {result.studentId.name}</p>
                  <p><strong>Score:</strong> {result.score}/{result.totalQuestions}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}