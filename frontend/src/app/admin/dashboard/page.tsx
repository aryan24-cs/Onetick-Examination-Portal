'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';

interface Question {
  type: 'mcq' | 'coding' | 'typing' | 'text';
  question: string;
  options?: string[];
  correctAnswer?: number;
  codeTemplate?: string;
  expectedOutput?: string;
  maxLength?: number;
}

interface Test {
  testId: string;
  name: string;
  date: string;
  duration: number;
  questions: Question[];
}

interface Result {
  testId: { testId: string; name: string; date: string };
  studentId: { studentId: string; name: string };
  score: number;
  totalQuestions: number;
  submittedAt: string;
}

interface DecodedToken {
  id: string;
  role: string;
  exp: number;
}

export default function AdminDashboard() {
  const router = useRouter();
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
    type: 'mcq' as 'mcq' | 'coding' | 'typing' | 'text',
    question: '',
    options: ['', '', '', ''],
    correctAnswer: 0,
    codeTemplate: '',
    expectedOutput: '',
    maxLength: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const adminId = localStorage.getItem('adminId');

    if (!token || !adminId) {
      setError('Please log in to access the admin dashboard');
      setTimeout(() => {
        router.push('/admin/login');
        router.refresh();
      }, 2000);
      return;
    }

    try {
      const decoded: DecodedToken = jwtDecode(token);
      const currentTime = Math.floor(Date.now() / 1000);
      if (decoded.exp < currentTime || decoded.role !== 'admin') {
        setError(decoded.exp < currentTime ? 'Session expired. Please log in again.' : 'Access denied. Invalid role.');
        localStorage.removeItem('token');
        localStorage.removeItem('adminId');
        setTimeout(() => {
          router.push('/admin/login');
          router.refresh();
        }, 2000);
        return;
      }
      if (decoded.id !== adminId) {
        localStorage.setItem('adminId', decoded.id);
      }
    } catch (err) {
      setError('Invalid token. Please log in again.');
      localStorage.removeItem('token');
      localStorage.removeItem('adminId');
      setTimeout(() => {
        router.push('/admin/login');
        router.refresh();
      }, 2000);
      return;
    }

    fetchTests();
    fetchResults();
    setIsLoading(false);
  }, [router]);

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

  const handleQuestionChange = (field: keyof Question | 'option', value: string | number, index?: number) => {
    if (field === 'options' && index !== undefined) {
      const updatedOptions = [...(currentQuestion.options || ['', '', '', ''])];
      updatedOptions[index] = value as string;
      setCurrentQuestion({ ...currentQuestion, options: updatedOptions });
    } else if (field === 'correctAnswer' || field === 'maxLength') {
      setCurrentQuestion({ ...currentQuestion, [field]: Number(value) });
    } else {
      setCurrentQuestion({ ...currentQuestion, [field]: value });
    }
  };

  const handleAddQuestion = () => {
    if (!currentQuestion.question) {
      setError('Please fill in the question text.');
      return;
    }
    if (currentQuestion.type === 'mcq' && (!currentQuestion.options?.every(opt => opt) || currentQuestion.correctAnswer === undefined)) {
      setError('Please fill in all options and select a correct answer for MCQ.');
      return;
    }
    if (currentQuestion.type === 'coding' && (!currentQuestion.codeTemplate || !currentQuestion.expectedOutput)) {
      setError('Please provide a code template and expected output for coding question.');
      return;
    }
    if (currentQuestion.type === 'typing' && !currentQuestion.maxLength) {
      setError('Please specify a maximum length for the typing question.');
      return;
    }
    setNewTest({ ...newTest, questions: [...newTest.questions, { ...currentQuestion }] });
    setCurrentQuestion({
      type: 'mcq',
      question: '',
      options: ['', '', '', ''],
      correctAnswer: 0,
      codeTemplate: '',
      expectedOutput: '',
      maxLength: 0,
    });
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
        setCurrentQuestion({
          type: 'mcq',
          question: '',
          options: ['', '', '', ''],
          correctAnswer: 0,
          codeTemplate: '',
          expectedOutput: '',
          maxLength: 0,
        });
        setActiveSection('previous');
      } else {
        setError(data.message || 'Test creation failed.');
      }
    } catch (err) {
      setLoading(false);
      setError('Error creating test. Please try again.');
    }
  };

  const handleGenerateReport = async (testId: string) => {
    const token = localStorage.getItem('token');
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/admin/report/${testId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to generate report');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_${testId}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      setLoading(false);
    } catch (err) {
      setLoading(false);
      setError('Error generating report. Please try again.');
    }
  };

  const handleSendReport = async (testId: string) => {
    const token = localStorage.getItem('token');
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/admin/send-report/${testId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to send report');
      const data = await res.json();
      setLoading(false);
      alert(data.message || 'Reports sent successfully to students.');
    } catch (err) {
      setLoading(false);
      setError('Error sending report. Please try again.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('adminId');
    router.push('/admin/login');
    router.refresh();
  };

  if (isLoading) {
    return (
      <div className="dashboard-container">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="sidebar">
        <div className="profile-section">
          <div className="avatar"></div>
          <h1>Admin</h1>
        </div>
        <div className="nav-links">
          <div
            className={`nav-item ${activeSection === 'create' ? 'active' : ''}`}
            onClick={() => setActiveSection('create')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256">
              <path d="M128,24a104,104,0,1,0,104,104A104.13,104.13,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm-48-88a8,8,0,0,0-8,8v64a8,8,0,0,0,16,0V136A8,8,0,0,0,80,128Zm96,0a8,8,0,0,0-8,8v64a8,8,0,0,0,16,0V136A8,8,0,0,0,176,128Z"></path>
            </svg>
            <p>Create Test</p>
          </div>
          <div
            className={`nav-item ${activeSection === 'previous' ? 'active' : ''}`}
            onClick={() => setActiveSection('previous')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256">
              <path d="M216,40H40A16,16,0,0,0,24,56V216a8,8,0,0,0,11.58,7.16L64,208.94l28.42,14.22a8,8,0,0,0,7.16,0L128,208.94l28.42,14.22a8,8,0,0,0,7.16,0L192,208.94l28.42,14.22A8,8,0,0,0,232,216V56A16,16,0,0,0,216,40Z"></path>
            </svg>
            <p>Previous Tests</p>
          </div>
          <div
            className={`nav-item ${activeSection === 'results' ? 'active' : ''}`}
            onClick={() => setActiveSection('results')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256">
              <path d="M216,40H136V24a8,8,0,0,0-16,0V40H40A16,16,0,0,0,24,56V176a16,16,0,0,0,16,16H79.36L57.75,219a8,8,0,0,0,12.5,10l29.59-37h56.32l29.59,37a8,8,0,0,0,12.5-10l-21.61-27H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Z"></path>
            </svg>
            <p>Results</p>
          </div>
          <div className="nav-item logout" onClick={handleLogout}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256">
              <path d="M112,216a8,8,0,0,1-8,8H48a16,16,0,0,1-16-16V48a16,16,0,0,1,16-16h56a8,8,0,0,1,0,16H48V208h56A8,8,0,0,1,112,216Zm109.66-93.66-40-40a8,8,0,0,0-11.32,11.32L196.69,120H104a8,8,0,0,0,0,16h92.69l-26.35,26.34a8,8,0,0,0,11.32,11.32l40-40A8,8,0,0,0,221.66,122.34Z"></path>
            </svg>
            <p>Logout</p>
          </div>
        </div>
      </div>
      <div className="main-content">
        {error && <p className="error">{error}</p>}
        {activeSection === 'create' && (
          <div className="section create-test-section">
            <h2>Create New Test</h2>
            <div className="form-group">
              <label>Test Name <span className="tooltip" title="Enter a unique name for the test">?</span></label>
              <input
                type="text"
                value={newTest.name}
                onChange={(e) => handleTestChange('name', e.target.value)}
                placeholder="Enter test name"
              />
            </div>
            <div className="form-group">
              <label>Date & Time <span className="tooltip" title="Schedule the test start time">?</span></label>
              <input
                type="datetime-local"
                value={newTest.date}
                onChange={(e) => handleTestChange('date', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Duration (minutes) <span className="tooltip" title="Test will auto-end after this duration">?</span></label>
              <input
                type="number"
                value={newTest.duration}
                onChange={(e) => handleTestChange('duration', parseInt(e.target.value))}
                placeholder="Enter duration"
                min="1"
              />
            </div>
            <h3>Add Question</h3>
            <div className="question-form">
              <div className="form-group">
                <label>Question Type <span className="tooltip" title="Select the type of question to add">?</span></label>
                <select
                  value={currentQuestion.type}
                  onChange={(e) => handleQuestionChange('type', e.target.value)}
                >
                  <option value="mcq">Multiple Choice (MCQ)</option>
                  <option value="coding">Coding</option>
                  <option value="typing">Typing</option>
                  <option value="text">Text</option>
                </select>
              </div>
              <div className="form-group">
                <label>Question Text <span className="tooltip" title="Enter the question or prompt">?</span></label>
                <textarea
                  value={currentQuestion.question}
                  onChange={(e) => handleQuestionChange('question', e.target.value)}
                  placeholder="Enter question text"
                />
              </div>
              {currentQuestion.type === 'mcq' && (
                <>
                  <div className="form-group">
                    <label>Options <span className="tooltip" title="Provide four answer options">?</span></label>
                    {currentQuestion.options!.map((option, index) => (
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
                    <label>Correct Answer <span className="tooltip" title="Select the correct option">?</span></label>
                    <select
                      value={currentQuestion.correctAnswer}
                      onChange={(e) => handleQuestionChange('correctAnswer', e.target.value)}
                    >
                      {currentQuestion.options!.map((opt, i) => (
                        <option key={i} value={i} disabled={!opt}>
                          Option {i + 1} {opt ? `(${opt})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              {currentQuestion.type === 'coding' && (
                <>
                  <div className="form-group">
                    <label>Code Template <span className="tooltip" title="Starter code for the student">?</span></label>
                    <textarea
                      value={currentQuestion.codeTemplate}
                      onChange={(e) => handleQuestionChange('codeTemplate', e.target.value)}
                      placeholder="Enter code template"
                    />
                  </div>
                  <div className="form-group">
                    <label>Expected Output <span className="tooltip" title="Expected result of the code">?</span></label>
                    <textarea
                      value={currentQuestion.expectedOutput}
                      onChange={(e) => handleQuestionChange('expectedOutput', e.target.value)}
                      placeholder="Enter expected output"
                    />
                  </div>
                </>
              )}
              {currentQuestion.type === 'typing' && (
                <div className="form-group">
                  <label>Maximum Length (characters) <span className="tooltip" title="Maximum allowed characters">?</span></label>
                  <input
                    type="number"
                    value={currentQuestion.maxLength}
                    onChange={(e) => handleQuestionChange('maxLength', e.target.value)}
                    placeholder="Enter maximum length"
                    min="1"
                  />
                </div>
              )}
              <button onClick={handleAddQuestion} className="add-question-btn">
                Add Question
              </button>
            </div>
            {newTest.questions.length > 0 && (
              <div className="question-preview">
                <h3>Question Preview</h3>
                {newTest.questions.map((q, index) => (
                  <div key={index} className="question-card">
                    <p><strong>Q{index + 1} ({q.type.toUpperCase()}):</strong> {q.question}</p>
                    {q.type === 'mcq' && (
                      <ul>
                        {q.options!.map((opt, i) => (
                          <li key={i} className={i === q.correctAnswer ? 'correct-option' : ''}>
                            {opt} {i === q.correctAnswer ? '(Correct)' : ''}
                          </li>
                        ))}
                      </ul>
                    )}
                    {q.type === 'coding' && (
                      <>
                        <p><strong>Code Template:</strong></p>
                        <pre>{q.codeTemplate}</pre>
                        <p><strong>Expected Output:</strong></p>
                        <pre>{q.expectedOutput}</pre>
                      </>
                    )}
                    {q.type === 'typing' && (
                      <p><strong>Max Length:</strong> {q.maxLength} characters</p>
                    )}
                    {q.type === 'text' && <p><strong>Free Text Response</strong></p>}
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
            <h2>Previous Tests</h2>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Test Name</th>
                    <th>Date</th>
                    <th>Duration</th>
                    <th>Questions</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tests.map((test) => (
                    <tr key={test.testId}>
                      <td>{test.name}</td>
                      <td>{new Date(test.date).toLocaleString()}</td>
                      <td>{test.duration} min</td>
                      <td>{test.questions.length}</td>
                      <td>
                        <button
                          onClick={() => handleGenerateReport(test.testId)}
                          className="button-success"
                          disabled={loading}
                        >
                          Generate Report
                        </button>
                        <button
                          onClick={() => handleSendReport(test.testId)}
                          className="add-question-btn"
                          disabled={loading}
                        >
                          Send Report
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {activeSection === 'results' && (
          <div className="section">
            <h2>Results</h2>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Test Name</th>
                    <th>Student</th>
                    <th>Score</th>
                    <th>Submitted At</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result, index) => (
                    <tr key={index}>
                      <td>{result.testId.name}</td>
                      <td>{result.studentId.name}</td>
                      <td>{result.score}/{result.totalQuestions}</td>
                      <td>{new Date(result.submittedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      <style jsx>{`
        .dashboard-container {
          display: flex;
          min-height: 100vh;
          background-color: #f7f8fa;
          font-family: 'Public Sans', 'Noto Sans', sans-serif;
        }

        .sidebar {
          width: 240px;
          background-color: #ffffff;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          border-right: 1px solid #d4dbe2;
          position: sticky;
          top: 0;
          height: 100vh;
        }

        .profile-section {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background-color: #eaedf1;
          background-image: url('https://via.placeholder.com/40');
          background-size: cover;
          background-position: center;
        }

        .profile-section h1 {
          font-size: 16px;
          font-weight: 500;
          color: #101418;
        }

        .nav-links {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          cursor: pointer;
          color: #101418;
          font-size: 14px;
          font-weight: 500;
          border-radius: 12px;
          transition: background-color 0.3s ease;
        }

        .nav-item:hover {
          background-color: #eaedf1;
        }

        .nav-item.active {
          background-color: #007bff;
          color: white;
        }

        .nav-item svg {
          width: 24px;
          height: 24px;
        }

        .nav-item.logout {
          margin-top: auto;
          color: #d32f2f;
        }

        .main-content {
          flex: 1;
          padding: 24px;
        }

        h2 {
          font-size: 28px;
          font-weight: 700;
          color: #101418;
          margin-bottom: 20px;
        }

        h3 {
          font-size: 20px;
          font-weight: 600;
          color: #101418;
          margin-bottom: 16px;
        }

        .form-group {
          margin-bottom: 20px;
          position: relative;
        }

        .form-group label {
          display: flex;
          align-items: center;
          font-size: 14px;
          font-weight: 500;
          color: #101418;
          margin-bottom: 8px;
        }

        .tooltip {
          display: inline-block;
          width: 16px;
          height: 16px;
          line-height: 16px;
          text-align: center;
          background-color: #5c728a;
          color: white;
          border-radius: 50%;
          margin-left: 8px;
          cursor: help;
          font-size: 12px;
        }

        .tooltip:hover:after {
          content: attr(title);
          position: absolute;
          top: 100%;
          left: 0;
          background-color: #101418;
          color: white;
          padding: 8px;
          border-radius: 4px;
          font-size: 12px;
          z-index: 10;
          width: 200px;
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
          width: 100%;
          padding: 12px;
          border: 1px solid #d4dbe2;
          border-radius: 8px;
          font-size: 14px;
          color: #101418;
          background-color: #ffffff;
          transition: border-color 0.3s ease, box-shadow 0.3s ease;
        }

        .form-group textarea {
          min-height: 100px;
          resize: vertical;
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          border-color: #007bff;
          box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
          outline: none;
        }

        button {
          padding: 12px 24px;
          background-color: #007bff;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.3s ease;
        }

        button:hover:not(.button-disabled) {
          background-color: #0056b3;
        }

        .button-disabled {
          background-color: #d4dbe2;
          cursor: not-allowed;
        }

        .button-success {
          background-color: #28a745;
        }

        .button-success:hover {
          background-color: #218838;
        }

        .add-question-btn {
          background-color: #17a2b8;
        }

        .add-question-btn:hover {
          background-color: #138496;
        }

        .remove-question-btn {
          background-color: #dc3545;
          padding: 8px 16px;
          font-size: 12px;
        }

        .remove-question-btn:hover {
          background-color: #c82333;
        }

        .section {
          margin-bottom: 32px;
          background-color: #ffffff;
          padding: 24px;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }

        .create-test-section {
          background-color: #ffffff;
          padding: 24px;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }

        .question-form {
          padding: 16px;
          background-color: #f7f8fa;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .option-input {
          margin-bottom: 12px;
        }

        .question-preview {
          margin-top: 20px;
        }

        .question-card {
          background-color: #ffffff;
          padding: 16px;
          border-radius: 8px;
          margin-bottom: 16px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }

        .question-card p {
          font-size: 14px;
          margin-bottom: 8px;
        }

        .question-card pre {
          background-color: #f7f8fa;
          padding: 12px;
          border-radius: 8px;
          font-size: 14px;
          color: #101418;
          white-space: pre-wrap;
        }

        .question-card ul {
          list-style: none;
          margin-bottom: 12px;
        }

        .question-card li {
          font-size: 14px;
          color: #5c728a;
          margin-bottom: 4px;
        }

        .correct-option {
          color: #28a745;
          font-weight: 500;
        }

        .table-container {
          border: 1px solid #d4dbe2;
          border-radius: 12px;
          overflow: hidden;
          background-color: #ffffff;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th,
        td {
          padding: 12px 16px;
          text-align: left;
          font-size: 14px;
        }

        th {
          font-weight: 500;
          color: #101418;
          background-color: #f7f8fa;
        }

        td {
          color: #5c728a;
          border-top: 1px solid #d4dbe2;
        }

        tr td:first-child {
          color: #101418;
          font-weight: 400;
        }

        td button {
          margin-right: 8px;
        }

        .error {
          color: #dc3545;
          font-size: 14px;
          margin-bottom: 16px;
          text-align: center;
          background-color: #fff1f1;
          padding: 8px;
          border-radius: 8px;
        }

        @media (max-width: 768px) {
          .dashboard-container {
            flex-direction: column;
          }

          .sidebar {
            width: 100%;
            border-right: none;
            border-bottom: 1px solid #d4dbe2;
            position: static;
            height: auto;
          }

          .main-content {
            padding: 16px;
          }
        }

        @media (max-width: 480px) {
          table th:nth-child(4),
          table td:nth-child(4),
          table th:nth-child(5),
          table td:nth-child(5) {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}