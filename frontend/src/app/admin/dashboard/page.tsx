"use client";
import { useState, useEffect } from 'react';
import Layout from '../../../components/Layout';
// import { Pie } from 'react-chartjs-2';
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
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState({ question: '', options: ['', '', '', ''], correctAnswer: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTests();
    fetchResults();
  }, []);

  const fetchTests = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('http://localhost:5000/api/tests', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setTests(data);
  };

  const fetchResults = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('http://localhost:5000/api/admin/results', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setResults(data);
  };

  const handleQuestionChange = (field: keyof Question, value: string | number) => {
    if (field === 'options') {
      const options = (value as string).split(',').map((opt) => opt.trim());
      setCurrentQuestion({ ...currentQuestion, options });
    } else if (field === 'correctAnswer') {
      setCurrentQuestion({ ...currentQuestion, correctAnswer: Number(value) });
    } else {
      setCurrentQuestion({ ...currentQuestion, question: value as string });
    }
  };

  const handleAddQuestion = () => {
    const updatedQuestions = [...newTest.questions];
    updatedQuestions[currentQuestionIndex] = currentQuestion;
    setNewTest({ ...newTest, questions: updatedQuestions });
    setCurrentQuestion({ question: '', options: ['', '', '', ''], correctAnswer: 0 });
    setCurrentQuestionIndex(currentQuestionIndex + 1);
  };

  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestion(newTest.questions[currentQuestionIndex - 1]);
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < newTest.questions.length) {
      setCurrentQuestion(newTest.questions[currentQuestionIndex]);
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      setCurrentQuestion({ question: '', options: ['', '', '', ''], correctAnswer: 0 });
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handleCreateTest = async () => {
    const updatedQuestions = [...newTest.questions, currentQuestion];
    const testData = { ...newTest, questions: updatedQuestions };
    setLoading(true);
    const token = localStorage.getItem('token');
    const res = await fetch('http://localhost:5000/api/admin/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(testData),
    });
    const data = await res.json();
    setLoading(false);
    if (data.success) {
      fetchTests();
      setNewTest({ name: '', date: '', duration: 0, questions: [] });
      setCurrentQuestion({ question: '', options: ['', '', '', ''], correctAnswer: 0 });
      setCurrentQuestionIndex(0);
      setActiveSection('previous');
    } else {
      alert(data.message);
    }
  };

  return (
    <Layout>
      <div className="dashboard-container">
        <h2>Admin Dashboard</h2>
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
          <div className="section">
            <h3>Create New Test</h3>
            <div className="form-group">
              <label>Test Name</label>
              <input
                type="text"
                value={newTest.name}
                onChange={(e) => setNewTest({ ...newTest, name: e.target.value })}
                placeholder="Enter test name"
              />
            </div>
            <div className="form-group">
              <label>Date & Time</label>
              <input
                type="datetime-local"
                value={newTest.date}
                onChange={(e) => setNewTest({ ...newTest, date: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Duration (minutes)</label>
              <input
                type="number"
                value={newTest.duration}
                onChange={(e) => setNewTest({ ...newTest, duration: parseInt(e.target.value) })}
                placeholder="Enter duration"
              />
            </div>
            <h4>Question {currentQuestionIndex + 1}</h4>
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
              <label>Options (comma-separated)</label>
              <input
                type="text"
                value={currentQuestion.options.join(',')}
                onChange={(e) => handleQuestionChange('options', e.target.value)}
                placeholder="Option 1, Option 2, Option 3, Option 4"
              />
            </div>
            <div className="form-group">
              <label>Correct Answer</label>
              <select
                value={currentQuestion.correctAnswer}
                onChange={(e) => handleQuestionChange('correctAnswer', parseInt(e.target.value))}
              >
                {currentQuestion.options.map((_, i) => (
                  <option key={i} value={i}>
                    Option {i + 1}
                  </option>
                ))}
              </select>
            </div>
            <div className="button-group">
              <button onClick={handlePrevQuestion} disabled={currentQuestionIndex === 0}>
                Previous
              </button>
              <button onClick={handleAddQuestion}>Add Question</button>
              <button onClick={handleNextQuestion} disabled={currentQuestionIndex >= newTest.questions.length}>
                Next
              </button>
            </div>
            <button
              onClick={handleCreateTest}
              disabled={loading || newTest.questions.length === 0}
              className={loading || newTest.questions.length === 0 ? 'button-disabled' : 'button-success'}
            >
              {loading ? 'Creating...' : 'Create Test'}
            </button>
          </div>
        )}

        {activeSection === 'previous' && (
          <div className="section">
            <h3>Previous Tests</h3>
            {tests.map((test) => (
              <div key={test.testId} className="card">
                <h4>{test.name}</h4>
                <p>Date: {new Date(test.date).toLocaleString()}</p>
                <p>Duration: {test.duration} minutes</p>
              </div>
            ))}
          </div>
        )}

        {activeSection === 'results' && (
          <div className="section">
            <h3>Results</h3>
            {results.map((result, index) => (
              <div key={index} className="card">
                <p>Test: {result.testId.name}</p>
                <p>Student: {result.studentId.name}</p>
                <p>Score: {result.score}/{result.totalQuestions}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}