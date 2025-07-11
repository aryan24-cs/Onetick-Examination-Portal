"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { jwtDecode } from "jwt-decode";

interface Test {
  testId: string;
  name: string;
  date: Date | string;
  duration: number;
  questions: any[];
}

interface Result {
  testId: { testId: string; name: string; date: Date };
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
  const [ongoingTests, setOngoingTests] = useState<Test[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState("dashboard");
  const [isLoading, setIsLoading] = useState(true);

  // UUID validation regex
  const isValidUUID = (str: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  const isTestOngoing = (test: Test) => {
    const now = new Date();
    const testStart = new Date(test.date);
    const testEnd = new Date(testStart.getTime() + test.duration * 60 * 1000);
    const isOngoing = now >= testStart && now <= testEnd;
    console.log("Checking test ongoing status:", {
      testId: test.testId,
      name: test.name,
      now: now.toISOString(),
      testStart: testStart.toISOString(),
      testEnd: testEnd.toISOString(),
      isOngoing,
    });
    return isOngoing;
  };

  const isTestActive = (test: Test) => {
    const now = new Date();
    const testStart = new Date(test.date);
    const testEnd = new Date(testStart.getTime() + test.duration * 60 * 1000);
    // Allow tests that started up to 5 minutes ago for testing
    const isActive = now >= new Date(testStart.getTime() - 5 * 60 * 1000) && now <= testEnd;
    console.log("Checking test activity:", {
      testId: test.testId,
      name: test.name,
      now: now.toISOString(),
      testStart: testStart.toISOString(),
      testEnd: testEnd.toISOString(),
      isActive,
    });
    return isActive;
  };

  const getTestStatus = (test: Test) => {
    const now = new Date();
    const testStart = new Date(test.date);
    const testEnd = new Date(testStart.getTime() + test.duration * 60 * 1000);
    if (now < testStart) {
      return `Starts at ${testStart.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`;
    } else if (now > testEnd) {
      return `Ended at ${testEnd.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`;
    } else {
      return "Ongoing";
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    const studentId = localStorage.getItem("studentId");

    if (!token || !studentId) {
      setError("Please log in to access the dashboard");
      console.error("Missing token or studentId", { token, studentId });
      setTimeout(() => router.push("/"), 2000);
      return;
    }

    try {
      const decoded: DecodedToken = jwtDecode(token);
      if (decoded.exp < Math.floor(Date.now() / 1000)) {
        setError("Session expired. Please log in again.");
        console.error("Token expired", { decoded });
        localStorage.removeItem("token");
        localStorage.removeItem("studentId");
        setTimeout(() => router.push("/"), 2000);
        return;
      }
      if (decoded.role !== "student") {
        setError("Access denied. Invalid role.");
        console.error("Invalid role", { role: decoded.role });
        localStorage.removeItem("token");
        localStorage.removeItem("studentId");
        setTimeout(() => router.push("/"), 2000);
        return;
      }

      const fetchProfile = async () => {
        try {
          const res = await fetch(`http://localhost:5000/api/student/profile/${studentId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            console.log("Profile fetched:", data);
            setProfile(data);
          } else {
            setError("Failed to fetch profile");
            console.error("Fetch profile failed:", await res.json());
          }
        } catch (err) {
          console.error("Fetch profile error:", err);
          setError("Error fetching profile");
        }
      };

      const fetchTests = async () => {
        try {
          console.log("Fetching tests for dashboard");
          const res = await fetch("http://localhost:5000/api/tests", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            console.log("Raw tests data:", data);
            const validTests = data.filter((test: Test) => {
              if (!test.testId || !isValidUUID(test.testId) || !test.name || !test.date || !test.duration) {
                console.error("Invalid test data filtered out:", test);
                return false;
              }
              return true;
            });
            if (validTests.length === 0) {
              console.warn("No valid tests found after filtering");
              setError("No valid tests available");
            }
            const parsedTests = validTests.map((test: Test) => ({ ...test, date: new Date(test.date) }));
            setOngoingTests(parsedTests.filter((test: Test) => isTestOngoing(test)));
            setTests(parsedTests.filter((test: Test) => !isTestOngoing(test)));
          } else {
            const data = await res.json();
            setError(data.message || "Failed to fetch tests");
            console.error("Fetch tests failed:", data);
          }
        } catch (err) {
          console.error("Fetch tests error:", err);
          setError("Error fetching tests");
        }
      };

      const fetchResults = async () => {
        try {
          console.log("Fetching results for student:", studentId);
          const res = await fetch(`http://localhost:5000/api/student/results/${studentId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            console.log("Results fetched:", data);
            setResults(data);
          } else {
            const data = await res.json();
            setError(data.message || "Failed to fetch results");
            console.error("Fetch results failed:", data);
          }
        } catch (err) {
          console.error("Fetch results error:", err);
          setError("Error fetching results");
        }
      };

      const fetchData = async () => {
        setIsLoading(true);
        await Promise.all([fetchProfile(), fetchTests(), fetchResults()]);
        setIsLoading(false);
      };

      fetchData();
    } catch (err) {
      console.error("Token decode error:", err);
      setError("Invalid token. Please log in again.");
      localStorage.removeItem("token");
      localStorage.removeItem("studentId");
      setTimeout(() => router.push("/"), 2000);
    }
  }, [router]);

  const calculateMetrics = () => {
    const totalTests = results.length;
    const averageScore = totalTests
      ? (results.reduce((sum, r) => sum + (r.score / r.totalQuestions) * 100, 0) / totalTests).toFixed(0) + "%"
      : "N/A";
    const overallGrade = totalTests
      ? results.every((r) => (r.score / r.totalQuestions) * 100 >= 90)
        ? "A"
        : results.every((r) => (r.score / r.totalQuestions) * 100 >= 80)
        ? "B"
        : results.every((r) => (r.score / r.totalQuestions) * 100 >= 70)
        ? "C"
        : "D"
      : "N/A";

    return { totalTests, averageScore, overallGrade };
  };

  const getGrade = (score: number, total: number) => {
    const percentage = (score / total) * 100;
    if (percentage >= 90) return "A";
    if (percentage >= 80) return "B";
    if (percentage >= 70) return "C";
    if (percentage >= 60) return "D";
    return "F";
  };

  const handleTakeTestClick = (testId: string, testName: string) => {
    if (!testId || !isValidUUID(testId)) {
      console.error("Take Test button clicked with invalid testId:", testId);
      setError("Cannot navigate to test: Invalid test ID");
      return;
    }
    console.log("Take Test button clicked for test:", { testId, testName });
    router.push(`/user/test/${testId}`);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("studentId");
    router.push("/");
  };

  const { totalTests, averageScore, overallGrade } = calculateMetrics();

  if (isLoading) {
    return <div className="dashboard-container"><p>Loading...</p></div>;
  }

  return (
    <div className="dashboard-container">
      <div className="sidebar">
        <div className="profile-section">
          <div className="avatar"></div>
          <h1>{profile?.name || "Student"}</h1>
        </div>
        <div className="nav-links">
          <div className={`nav-item ${activeSection === "dashboard" ? "active" : ""}`} onClick={() => setActiveSection("dashboard")}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256">
              <path d="M224,115.55V208a16,16,0,0,1-16,16H168a16,16,0,0,1-16-16V168a8,8,0,0,0-8-8H112a8,8,0,0,0-8,8v40a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V115.55a16,16,0,0,1,5.17-11.78l80-75.48.11-.11a16,16,0,0,1,21.53,0,1.14,1.14,0,0,0,.11.11l80,75.48A16,16,0,0,1,224,115.55Z"></path>
            </svg>
            <p>Dashboard</p>
          </div>
          <div className={`nav-item ${activeSection === "tests" ? "active" : ""}`} onClick={() => setActiveSection("tests")}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256">
              <path d="M216,40H40A16,16,0,0,0,24,56V216a8,8,0,0,0,11.58,7.16L64,208.94l28.42,14.22a8,8,0,0,0,7.16,0L128,208.94l28.42,14.22a8,8,0,0,0,7.16,0L192,208.94l28.42,14.22A8,8,0,0,0,232,216V56A16,16,0,0,0,216,40Zm0,163.06-20.42-10.22a8,8,0,0,0-7.16,0L160,207.06l-28.42-14.22a8,8,0,0,0-7.16,0L96,207.06,67.58,192.84a8,8,0,0,0-7.16,0L40,203.06V56H216ZM60.42,167.16a8,8,0,0,0,10.74-3.58L76.94,152h38.12l5.78,11.58a8,8,0,0,0,14.32-7.16l-32-64a8,8,0,0,0-14.32,0l-32,64A8,8,0,0,0,60.42,167.16ZM96,113.89,107.06,136H84.94ZM136,128a8,8,0,0,1,8-8h16V104a8,8,0,0,1,16,0v16h16a8,8,0,0,1,0,16H176v16a8,8,0,0,1-16,0V136H144A8,8,0,0,1,136,128Z"></path>
            </svg>
            <p>Tests</p>
          </div>
          <div className={`nav-item ${activeSection === "results" ? "active" : ""}`} onClick={() => setActiveSection("results")}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256">
              <path d="M216,40H136V24a8,8,0,0,0-16,0V40H40A16,16,0,0,0,24,56V176a16,16,0,0,0,16,16H79.36L57.75,219a8,8,0,0,0,12.5,10l29.59-37h56.32l29.59,37a8,8,0,0,0,12.5-10l-21.61-27H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Zm0,136H40V56H216V176ZM104,120v24a8,8,0,0,1-16,0V120a8,8,0,0,1,16,0Zm32-16v40a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm32-16v56a8,8,0,0,1-16,0V88a8,8,0,0,1,16,0Z"></path>
            </svg>
            <p>Results</p>
          </div>
          <div className={`nav-item ${activeSection === "profile" ? "active" : ""}`} onClick={() => setActiveSection("profile")}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256">
              <path d="M230.92,212c-15.23-26.33-38.7-45.21-66.09-54.16a72,72,0,1,0-73.66,0C63.78,166.78,40.31,185.66,25.08,212a8,8,0,0,0,13.85,8c18.84-32.56,52.14-52,89.07-52s70.23,19.44,89.07,52a8,8,0,0,0,13.85-8ZM72,96a56,56,0,1,1,56,56A56.06,56.06,0,0,1,72,96Z"></path>
            </svg>
            <p>Profile</p>
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
        {activeSection === "dashboard" && (
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
              <h3>Ongoing Tests</h3>
              <div className="table-container">
                {ongoingTests.length === 0 ? (
                  <p>No ongoing tests available.</p>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Subject</th>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ongoingTests.map((test) => {
                        console.log("Rendering ongoing test:", {
                          testId: test.testId,
                          name: test.name,
                          date: test.date.toString(),
                        });
                        return (
                          <tr key={test.testId || Math.random()}>
                            <td>{test.name}</td>
                            <td>{new Date(test.date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
                            <td>{new Date(test.date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}</td>
                            <td>{getTestStatus(test)}</td>
                            <td>
                              <button
                                onClick={() => handleTakeTestClick(test.testId, test.name)}
                                className={isTestActive(test) ? "take-test-btn" : "take-test-btn disabled"}
                                disabled={!isTestActive(test)}
                                title={getTestStatus(test)}
                              >
                                {isTestActive(test) ? "Take Test" : "Not Available"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
            <div className="section">
              <h3>Upcoming Tests</h3>
              <div className="table-container">
                {tests.filter((test) => new Date(test.date) > new Date()).length === 0 ? (
                  <p>No upcoming tests available.</p>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Subject</th>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tests.filter((test) => new Date(test.date) > new Date()).map((test) => {
                        console.log("Rendering upcoming test:", {
                          testId: test.testId,
                          name: test.name,
                          date: test.date.toString(),
                        });
                        return (
                          <tr key={test.testId || Math.random()}>
                            <td>{test.name}</td>
                            <td>{new Date(test.date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
                            <td>{new Date(test.date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}</td>
                            <td>{getTestStatus(test)}</td>
                            <td>
                              <button
                                onClick={() => handleTakeTestClick(test.testId, test.name)}
                                className={isTestActive(test) ? "take-test-btn" : "take-test-btn disabled"}
                                disabled={!isTestActive(test)}
                                title={getTestStatus(test)}
                              >
                                {isTestActive(test) ? "Take Test" : "Not Available"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
            <div className="section">
              <h3>Previous Test Results</h3>
              <div className="table-container">
                {results.length === 0 ? (
                  <p>No previous test results available.</p>
                ) : (
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
                          <td>{new Date(result.testId.date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
                          <td>{((result.score / result.totalQuestions) * 100).toFixed(0)}%</td>
                          <td>{getGrade(result.score, result.totalQuestions)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}
        {activeSection === "tests" && (
          <div className="section">
            <h3>Ongoing Tests</h3>
            <div className="table-container">
              {ongoingTests.length === 0 ? (
                <p>No ongoing tests available.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Duration</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ongoingTests.map((test) => {
                      console.log("Rendering ongoing test:", {
                        testId: test.testId,
                        name: test.name,
                        date: test.date.toString(),
                      });
                      return (
                        <tr key={test.testId || Math.random()}>
                          <td>{test.name}</td>
                          <td>{new Date(test.date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
                          <td>{new Date(test.date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}</td>
                          <td>{test.duration} min</td>
                          <td>{getTestStatus(test)}</td>
                          <td>
                            <button
                              onClick={() => handleTakeTestClick(test.testId, test.name)}
                              className={isTestActive(test) ? "take-test-btn" : "take-test-btn disabled"}
                              disabled={!isTestActive(test)}
                              title={getTestStatus(test)}
                            >
                              {isTestActive(test) ? "Take Test" : "Not Available"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <h3>Upcoming Tests</h3>
            <div className="table-container">
              {tests.filter((test) => new Date(test.date) > new Date()).length === 0 ? (
                <p>No upcoming tests available.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Duration</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tests.filter((test) => new Date(test.date) > new Date()).map((test) => {
                      console.log("Rendering upcoming test:", {
                        testId: test.testId,
                        name: test.name,
                        date: test.date.toString(),
                      });
                      return (
                        <tr key={test.testId || Math.random()}>
                          <td>{test.name}</td>
                          <td>{new Date(test.date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
                          <td>{new Date(test.date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}</td>
                          <td>{test.duration} min</td>
                          <td>{getTestStatus(test)}</td>
                          <td>
                            <button
                              onClick={() => handleTakeTestClick(test.testId, test.name)}
                              className={isTestActive(test) ? "take-test-btn" : "take-test-btn disabled"}
                              disabled={!isTestActive(test)}
                              title={getTestStatus(test)}
                            >
                              {isTestActive(test) ? "Take Test" : "Not Available"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
        {activeSection === "results" && (
          <div className="section">
            <h3>Previous Test Results</h3>
            <div className="table-container">
              {results.length === 0 ? (
                <p>No previous test results available.</p>
              ) : (
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
                        <td>{new Date(result.testId.date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
                        <td>{((result.score / result.totalQuestions) * 100).toFixed(0)}%</td>
                        <td>{getGrade(result.score, result.totalQuestions)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
        {activeSection === "profile" && (
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