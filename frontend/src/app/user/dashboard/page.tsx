'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';
import Link from 'next/link';

interface Test {
  testId: string;
  name: string;
  date: Date;
  duration: number;
}

interface Result {
  testId: { name: string; date: Date };
  score: number;
  totalQuestions: number;
}

interface Profile {
  name: string;
  email: string;
  profile: { dob: string; phone: string; address: string };
}

interface DecodedToken {
  id: string;
  role: string;
  exp: number;
}

export default function UserDashboard() {
  const router = useRouter();
  const [tests, setTests] = useState<Test[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const studentId = localStorage.getItem('studentId');

    console.log('Checking authentication:');
    console.log('Token:', token ? 'Present' : 'Missing');
    console.log('StudentId:', studentId ? 'Present' : 'Missing');

    // Check if token and studentId exist
    if (!token || !studentId) {
      console.log('Missing token or studentId, redirecting to login');
      setError('Please log in to access the dashboard');
      setTimeout(() => {
        console.log('Redirecting to /');
        router.push('/');
        router.refresh(); // Ensure navigation completes
      }, 2000);
      return;
    }

    try {
      const decoded: DecodedToken = jwtDecode(token);
      const currentTime = Math.floor(Date.now() / 1000);
      console.log('Decoded token:', { id: decoded.id, role: decoded.role, exp: decoded.exp });
      console.log('Current time:', currentTime);
      console.log('Token expired:', decoded.exp < currentTime);

      if (decoded.exp < currentTime) {
        console.log('Token expired, redirecting to login');
        setError('Session expired. Please log in again.');
        localStorage.removeItem('token');
        localStorage.removeItem('studentId');
        setTimeout(() => {
          console.log('Redirecting to /');
          router.push('/');
          router.refresh();
        }, 2000);
        return;
      }

      if (decoded.role !== 'student') {
        console.log('Invalid role, redirecting to login');
        setError('Access denied. Invalid role.');
        localStorage.removeItem('token');
        localStorage.removeItem('studentId');
        setTimeout(() => {
          console.log('Redirecting to /');
          router.push('/');
          router.refresh();
        }, 2000);
        return;
      }

      // Store studentId from token for consistency
      if (decoded.id !== studentId) {
        console.warn('StudentId mismatch, updating localStorage');
        localStorage.setItem('studentId', decoded.id);
      }
    } catch (err) {
      console.error('Token decoding error:', err);
      setError('Invalid token. Please log in again.');
      localStorage.removeItem('token');
      localStorage.removeItem('studentId');
      setTimeout(() => {
        console.log('Redirecting to /');
        router.push('/');
        router.refresh();
      }, 2000);
      return;
    }

    const fetchProfile = async () => {
      try {
        console.log('Fetching profile for studentId:', studentId);
        const res = await fetch(`http://localhost:5000/api/student/profile/${studentId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log('Profile fetch status:', res.status, res.statusText);
        if (res.ok) {
          const data = await res.json();
          console.log('Profile data:', data);
          setProfile(data);
        } else {
          throw new Error(`Failed to fetch profile: ${res.statusText}`);
        }
      } catch (err: any) {
        console.error('Profile fetch error:', err.message);
        setError('Error fetching profile. Please try again.');
      }
    };

    const fetchTests = async () => {
      try {
        console.log('Fetching tests');
        const res = await fetch('http://localhost:5000/api/tests', {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log('Tests fetch status:', res.status, res.statusText);
        if (res.ok) {
          const data = await res.json();
          console.log('Tests data:', data);
          setTests(data);
        } else {
          throw new Error(`Failed to fetch tests: ${res.statusText}`);
        }
      } catch (err: any) {
        console.error('Tests fetch error:', err.message);
        setError('Error fetching tests. Please try again.');
      }
    };

    const fetchResults = async () => {
      try {
        console.log('Fetching results for studentId:', studentId);
        const res = await fetch(`http://localhost:5000/api/student/results/${studentId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log('Results fetch status:', res.status, res.statusText);
        if (res.ok) {
          const data = await res.json();
          console.log('Results data:', data);
          setResults(data);
        } else {
          throw new Error(`Failed to fetch results: ${res.statusText}`);
        }
      } catch (err: any) {
        console.error('Results fetch error:', err.message);
        setError('Error fetching results. Please try again.');
      }
    };

    const fetchData = async () => {
      console.log('Starting data fetch');
      setIsLoading(true);
      await Promise.all([fetchProfile(), fetchTests(), fetchResults()]);
      setIsLoading(false);
      console.log('Data fetch completed');
    };

    fetchData();
  }, [router]);

  const calculateMetrics = () => {
    const totalTests = results.length;
    const averageScore = totalTests
      ? (results.reduce((sum, r) => sum + (r.score / r.totalQuestions) * 100, 0) / totalTests).toFixed(0) + '%'
      : 'N/A';
    const overallGrade = totalTests
      ? results.every((r) => (r.score / r.totalQuestions) * 100 >= 90)
        ? 'A'
        : results.every((r) => (r.score / r.totalQuestions) * 100 >= 80)
        ? 'B'
        : results.every((r) => (r.score / r.totalQuestions) * 100 >= 70)
        ? 'C'
        : 'D'
      : 'N/A';

    return { totalTests, averageScore, overallGrade };
  };

  const getGrade = (score: number, total: number) => {
    const percentage = (score / total) * 100;
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
  };

  const isTestActive = (test: Test) => {
    const now = new Date();
    const testStart = new Date(test.date);
    const testEnd = new Date(testStart.getTime() + test.duration * 60 * 1000);
    return now >= testStart && now <= testEnd;
  };

  const handleLogout = () => {
    console.log('Logging out');
    localStorage.removeItem('token');
    localStorage.removeItem('studentId');
    router.push('/');
    router.refresh();
  };

  const { totalTests, averageScore, overallGrade } = calculateMetrics();

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
          <h1>{profile?.name || 'Student'}</h1>
        </div>
        <div className="nav-links">
          <div
            className={`nav-item ${activeSection === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveSection('dashboard')}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              fill="currentColor"
              viewBox="0 0 256 256"
            >
              <path
                d="M224,115.55V208a16,16,0,0,1-16,16H168a16,16,0,0,1-16-16V168a8,8,0,0,0-8-8H112a8,8,0,0,0-8,8v40a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V115.55a16,16,0,0,1,5.17-11.78l80-75.48.11-.11a16,16,0,0,1,21.53,0,1.14,1.14,0,0,0,.11.11l80,75.48A16,16,0,0,1,224,115.55Z"
              ></path>
            </svg>
            <p>Dashboard</p>
          </div>
          <div
            className={`nav-item ${activeSection === 'tests' ? 'active' : ''}`}
            onClick={() => setActiveSection('tests')}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              fill="currentColor"
              viewBox="0 0 256 256"
            >
              <path
                d="M216,40H40A16,16,0,0,0,24,56V216a8,8,0,0,0,11.58,7.16L64,208.94l28.42,14.22a8,8,0,0,0,7.16,0L128,208.94l28.42,14.22a8,8,0,0,0,7.16,0L192,208.94l28.42,14.22A8,8,0,0,0,232,216V56A16,16,0,0,0,216,40Zm0,163.06-20.42-10.22a8,8,0,0,0-7.16,0L160,207.06l-28.42-14.22a8,8,0,0,0-7.16,0L96,207.06,67.58,192.84a8,8,0,0,0-7.16,0L40,203.06V56H216ZM60.42,167.16a8,8,0,0,0,10.74-3.58L76.94,152h38.12l5.78,11.58a8,8,0,0,0,14.32-7.16l-32-64a8,8,0,0,0-14.32,0l-32,64A8,8,0,0,0,60.42,167.16ZM96,113.89,107.06,136H84.94ZM136,128a8,8,0,0,1,8-8h16V104a8,8,0,0,1,16,0v16h16a8,8,0,0,1,0,16H176v16a8,8,0,0,1-16,0V136H144A8,8,0,0,1,136,128Z"
              ></path>
            </svg>
            <p>Tests</p>
          </div>
          <div
            className={`nav-item ${activeSection === 'results' ? 'active' : ''}`}
            onClick={() => setActiveSection('results')}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              fill="currentColor"
              viewBox="0 0 256 256"
            >
              <path
                d="M216,40H136V24a8,8,0,0,0-16,0V40H40A16,16,0,0,0,24,56V176a16,16,0,0,0,16,16H79.36L57.75,219a8,8,0,0,0,12.5,10l29.59-37h56.32l29.59,37a8,8,0,0,0,12.5-10l-21.61-27H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Zm0,136H40V56H216V176ZM104,120v24a8,8,0,0,1-16,0V120a8,8,0,0,1,16,0Zm32-16v40a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm32-16v56a8,8,0,0,1-16,0V88a8,8,0,0,1,16,0Z"
              ></path>
            </svg>
            <p>Results</p>
          </div>
          <div
            className={`nav-item ${activeSection === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveSection('profile')}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              fill="currentColor"
              viewBox="0 0 256 256"
            >
              <path
                d="M230.92,212c-15.23-26.33-38.7-45.21-66.09-54.16a72,72,0,1,0-73.66,0C63.78,166.78,40.31,185.66,25.08,212a8,8,0,0,0,13.85,8c18.84-32.56,52.14-52,89.07-52s70.23,19.44,89.07,52a8,8,0,0,0,13.85-8ZM72,96a56,56,0,1,1,56,56A56.06,56.06,0,0,1,72,96Z"
              ></path>
            </svg>
            <p>Profile</p>
          </div>
          <div className="nav-item logout" onClick={handleLogout}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              fill="currentColor"
              viewBox="0 0 256 256"
            >
              <path
                d="M112,216a8,8,0,0,1-8,8H48a16,16,0,0,1-16-16V48a16,16,0,0,1,16-16h56a8,8,0,0,1,0,16H48V208h56A8,8,0,0,1,112,216Zm109.66-93.66-40-40a8,8,0,0,0-11.32,11.32L196.69,120H104a8,8,0,0,0,0,16h92.69l-26.35,26.34a8,8,0,0,0,11.32,11.32l40-40A8,8,0,0,0,221.66,122.34Z"
              ></path>
            </svg>
            <p>Logout</p>
          </div>
        </div>
      </div>
      <div className="main-content">
        {error && <p className="error">{error}</p>}
        {activeSection === 'dashboard' && (
          <>
            <h2>Dashboard</h2>
            <div className="section">
              <h3>Performance Overview</h3>
              <div className="metrics">
                <div className="metric-card">
                  <p className="metric-label">Overall Grade</p>
                  <p className="metric-value">{overallGrade}</p>
                </div>
                <div className="metric-card">
                  <p className="metric-label">Average Score</p>
                  <p className="metric-value">{averageScore}</p>
                </div>
                <div className="metric-card">
                  <p className="metric-label">Tests Taken</p>
                  <p className="metric-value">{totalTests}</p>
                </div>
              </div>
            </div>
            <div className="section">
              <h3>Upcoming Tests</h3>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tests
                      .filter((test) => new Date(test.date) >= new Date())
                      .map((test) => (
                        <tr key={test.testId}>
                          <td>{test.name}</td>
                          <td>{new Date(test.date).toLocaleDateString()}</td>
                          <td>{new Date(test.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                          <td>
                            <Link href={`/user/test/${test.testId}`}>
                              <button
                                className={isTestActive(test) ? 'take-test-btn' : 'take-test-btn disabled'}
                                disabled={!isTestActive(test)}
                              >
                                {isTestActive(test) ? 'Take Test' : 'Not Available'}
                              </button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="section">
              <h3>Previous Test Results</h3>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Date</th>
                      <th>Score</th>
                      <th>Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((result, index) => (
                      <tr key={index}>
                        <td>{result.testId.name}</td>
                        <td>{new Date(result.testId.date).toLocaleDateString()}</td>
                        <td>{((result.score / result.totalQuestions) * 100).toFixed(0)}%</td>
                        <td>{getGrade(result.score, result.totalQuestions)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
        {activeSection === 'tests' && (
          <div className="section">
            <h3>Upcoming Tests</h3>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Duration</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {tests
                    .filter((test) => new Date(test.date) >= new Date())
                    .map((test) => (
                      <tr key={test.testId}>
                        <td>{test.name}</td>
                        <td>{new Date(test.date).toLocaleDateString()}</td>
                        <td>{new Date(test.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                        <td>{test.duration} min</td>
                        <td>
                          <Link href={`/user/test/${test.testId}`}>
                            <button
                              className={isTestActive(test) ? 'take-test-btn' : 'take-test-btn disabled'}
                              disabled={!isTestActive(test)}
                            >
                              {isTestActive(test) ? 'Take Test' : 'Not Available'}
                            </button>
                          </Link>
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
            <h3>Previous Test Results</h3>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Date</th>
                    <th>Score</th>
                    <th>Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result, index) => (
                    <tr key={index}>
                      <td>{result.testId.name}</td>
                      <td>{new Date(result.testId.date).toLocaleDateString()}</td>
                      <td>{((result.score / result.totalQuestions) * 100).toFixed(0)}%</td>
                      <td>{getGrade(result.score, result.totalQuestions)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {activeSection === 'profile' && (
          <div className="section">
            <h3>Profile</h3>
            {profile && (
              <div className="profile-details">
                <p><strong>Name:</strong> {profile.name}</p>
                <p><strong>Email:</strong> {profile.email}</p>
                <p><strong>Date of Birth:</strong> {profile.profile.dob}</p>
                <p><strong>Phone:</strong> {profile.profile.phone}</p>
                <p><strong>Address:</strong> {profile.profile.address}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}