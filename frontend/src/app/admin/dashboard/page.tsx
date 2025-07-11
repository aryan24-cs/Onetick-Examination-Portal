"use client";
import { useState, useEffect } from 'react';
import Layout from '../../../components/Layout';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

interface Question {
  question: string;
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
  const [newTest, setNewTest] = useState({
    name: '',
    date: '',
    duration: 0,
    questions: [] as Question[],
  });
  const [currentQuestion, setCurrentQuestion] = useState({
    question: '',
    options: ['', '', '', ''],
    correctAnswer: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTests();
    fetchResults();
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

  const handleTestChange = (field: keyof typeof newTest, value: string | number) => {
    setNewTest({ ...newTest, [field]: value });
  };

  const handleQuestionChange = (field: keyof Question | 'option', value: string, index?: number) => {
    if (field === 'options' && index !== undefined) {
      const updatedOptions = [...currentQuestion.options];
      updatedOptions[index] = value;
      setCurrentQuestion({ ...currentQuestion, options: updatedOptions });
    } else if (field === 'correctAnswer') {
      setCurrentQuestion({ ...currentQuestion, correctAnswer: Number(value) });
    } else {
      setCurrentQuestion({ ...currentQuestion, question: value });
    }
  };

  const handleAddQuestion = () => {
    if (!currentQuestion.question || currentQuestion.options.some(opt => !opt)) {
      setError('Please fill in the question and all options.');
      return;
    }
    setNewTest({ ...newTest, questions: [...newTest.questions, currentQuestion] });
    setCurrentQuestion({ question: '', options: ['', '', '', ''], correctAnswer: 0 });
    setError('');
  };

  const handleRemoveQuestion = (index: number) => {
    setNewTest({
      ...newTest,
      questions: newTest.questions.filter((_, i) => i !== index),
    });
  };

  const handleCreateTest = async () => {
    if (!newTest.name || !newTest.date || !newTest.duration || newTest.questions.length === 0) {
      setError('Please fill in all test details and add at least one question.');
      return;
    }
    setLoading(true);
    setError('');
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('http://localhost:5000/api/admin/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newTest),
      });
      const data = await res.json();
      setLoading(false);
      if (data.success) {
        fetchTests();
        setNewTest({ name: '', date: '', duration: 0, questions: [] });
        setCurrentQuestion({ question: '', options: ['', '', '', ''], correctAnswer: 0 });
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
            <h4>Add Question</h4>
            <div className="question-form">
              <div className="form-group">
                <label>Question</label>
                <input
                  type="text"
                  value={currentQuestion.question}
                  onChange={(e) => handleQuestionChange('question', e.target.value)}
                  placeholder="Enter question"
                />
              </div>
              <div className="form-group">
                <label>Options</label>
                {currentQuestion.options.map((option, index) => (
                  <input
                    key={index}
                    type="text"
                    value={option}
                    onChange={(e) => handleQuestionChange('options', e.target.value, index)}
                    placeholder={`Option ${index + 1}`}
                    className="option-input"
                  />
                ))}
              </div>
              <div className="form-group">
                <label>Correct Answer</label>
                <select
                  value={currentQuestion.correctAnswer}
                  onChange={(e) => handleQuestionChange('correctAnswer', e.target.value)}
                >
                  {currentQuestion.options.map((opt, i) => (
                    <option key={i} value={i} disabled={!opt}>
                      Option {i + 1} {opt ? `(${opt})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <button onClick={handleAddQuestion} className="add-question-btn">
                Add Question
              </button>
            </div>
            {newTest.questions.length > 0 && (
              <div className="question-preview">
                <h4>Question Preview</h4>
                {newTest.questions.map((q, index) => (
                  <div key={index} className="question-card">
                    <p><strong>Q{index + 1}:</strong> {q.question}</p>
                    <ul>
                      {q.options.map((opt, i) => (
                        <li key={i} className={i === q.correctAnswer ? 'correct-option' : ''}>
                          {opt} {i === q.correctAnswer ? '(Correct)' : ''}
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => handleRemoveQuestion(index)}
                      className="remove-question-btn"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
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