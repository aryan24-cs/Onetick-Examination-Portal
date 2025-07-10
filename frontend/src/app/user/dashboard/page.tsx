"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../../components/Layout';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

interface Test {
  testId: string;
  name: string;
  date: string;
  duration: number;
  questions: { question: string; options: string[]; correctAnswer: number }[];
}

interface Result {
  testId: { name: string };
  score: number;
  totalQuestions: number;
  answers: number[];
}

interface Profile {
  name: string;
  email: string;
  profile: { dob: string; phone: string; address: string };
}

export default function UserDashboard() {
  const [tests, setTests] = useState<Test[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentTest, setCurrentTest] = useState<Test | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [editProfile, setEditProfile] = useState(false);
  const [newProfile, setNewProfile] = useState({ name: '', dob: '', phone: '', address: '' });
  const router = useRouter();
  const studentId = localStorage.getItem('userId');

  useEffect(() => {
    if (!studentId) router.push('/');
    fetchTests();
    fetchResults();
    fetchProfile();
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
    const res = await fetch(`http://localhost:5000/api/student/results/${studentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setResults(data);
  };

  const fetchProfile = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch(`http://localhost:5000/api/student/profile/${studentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setProfile(data);
    setNewProfile({ name: data.name, dob: data.profile.dob, phone: data.profile.phone, address: data.profile.address });
  };

  const handleTestStart = (test: Test) => {
    setCurrentTest(test);
    setAnswers(new Array(test.questions.length).fill(-1));
  };

  const handleAnswer = (questionIndex: number, optionIndex: number) => {
    const newAnswers = [...answers];
    newAnswers[questionIndex] = optionIndex;
    setAnswers(newAnswers);
  };

  const handleSubmitTest = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    const res = await fetch('http://localhost:5000/api/student/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ testId: currentTest?.testId, answers }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.success) {
      alert(`Score: ${data.score}/${data.totalQuestions}`);
      setCurrentTest(null);
      fetchResults();
    } else {
      alert(data.message);
    }
  };

  const handleUpdateProfile = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    const res = await fetch(`http://localhost:5000/api/student/profile/${studentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(newProfile),
    });
    const data = await res.json();
    setLoading(false);
    if (data.success) {
      fetchProfile();
      setEditProfile(false);
    } else {
      alert(data.message);
    }
  };

  const pieData = {
    labels: results.map((r) => r.testId.name),
    datasets: [{
      data: results.map((r) => (r.score / r.totalQuestions) * 100),
      backgroundColor: ['#00c6ff', '#0072ff', '#ff6f61', '#6b48ff'],
    }],
  };

  return (
    <Layout>
      <div className="dashboard-container">
        <h2>User Dashboard</h2>
        {currentTest ? (
          <div className="section">
            <h3>{currentTest.name}</h3>
            {currentTest.questions.map((q, i) => (
              <div key={i} className="question">
                <p className="question-text">{i + 1}. {q.question}</p>
                {q.options.map((option, j) => (
                  <div key={j} className="option">
                    <input
                      type="radio"
                      name={`question-${i}`}
                      checked={answers[i] === j}
                      onChange={() => handleAnswer(i, j)}
                    />
                    <span>{option}</span>
                  </div>
                ))}
              </div>
            ))}
            <button onClick={handleSubmitTest} disabled={loading} className={loading ? 'button-disabled' : ''}>
              {loading ? 'Submitting...' : 'Submit Test'}
            </button>
          </div>
        ) : (
          <>
            <div className="section">
              <h3>Upcoming Tests</h3>
              {tests.filter((t) => new Date(t.date) > new Date()).map((test) => (
                <div key={test.testId} className="card">
                  <h4>{test.name}</h4>
                  <p>Date: {new Date(test.date).toLocaleString()}</p>
                  <button onClick={() => handleTestStart(test)}>Start Test</button>
                </div>
              ))}
            </div>

            <div className="section">
              <h3>Performance</h3>
              <div className="chart-container">
                <Pie data={pieData} />
              </div>
            </div>

            <div className="section">
              <h3>Previous Tests</h3>
              {results.map((result, index) => (
                <div key={index} className="card">
                  <p>Test: {result.testId.name}</p>
                  <p>Score: {result.score}/{result.totalQuestions}</p>
                  <p>Percentage: {((result.score / result.totalQuestions) * 100).toFixed(2)}%</p>
                  <details>
                    <summary className="summary">View Answers</summary>
                    {result.answers.map((a, i) => (
                      <p key={i}>Q{i + 1}: Selected {a + 1}</p>
                    ))}
                  </details>
                </div>
              ))}
            </div>

            <div className="section">
              <h3>Profile</h3>
              {profile && !editProfile ? (
                <div className="card">
                  <p>Name: {profile.name}</p>
                  <p>Email: {profile.email}</p>
                  <p>DOB: {profile.profile.dob}</p>
                  <p>Phone: {profile.profile.phone}</p>
                  <p>Address: {profile.profile.address}</p>
                  <button onClick={() => setEditProfile(true)}>Edit Profile</button>
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label>Name</label>
                    <input
                      type="text"
                      value={newProfile.name}
                      onChange={(e) => setNewProfile({ ...newProfile, name: e.target.value })}
                      placeholder="Enter name"
                    />
                  </div>
                  <div className="form-group">
                    <label>Date of Birth</label>
                    <input
                      type="date"
                      value={newProfile.dob}
                      onChange={(e) => setNewProfile({ ...newProfile, dob: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Phone</label>
                    <input
                      type="text"
                      value={newProfile.phone}
                      onChange={(e) => setNewProfile({ ...newProfile, phone: e.target.value })}
                      placeholder="Enter phone number"
                    />
                  </div>
                  <div className="form-group">
                    <label>Address</label>
                    <input
                      type="text"
                      value={newProfile.address}
                      onChange={(e) => setNewProfile({ ...newProfile, address: e.target.value })}
                      placeholder="Enter address"
                    />
                  </div>
                  <button onClick={handleUpdateProfile} disabled={loading} className={loading ? 'button-disabled' : ''}>
                    {loading ? 'Saving...' : 'Save Profile'}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
