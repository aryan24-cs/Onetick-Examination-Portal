"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { jwtDecode } from "jwt-decode";
import Loader from "../../../components/loader";
import Layout from "../../../components/Layout";
import Chart from "chart.js/auto";
import "../../../styles/userdashboard.css";

interface Test {
  testId: string;
  name: string;
  date: Date | string;
  duration: number;
  questions: any[];
}

interface Result {
  testId?: { testId: string; name: string; date: Date };
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
  const searchParams = useSearchParams();
  const [tests, setTests] = useState<Test[]>([]);
  const [ongoingTests, setOngoingTests] = useState<Test[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [rank, setRank] = useState<string>("N/A");
  const [activeSection, setActiveSection] = useState(
    searchParams.get("section") || "dashboard"
  );
  const pieChartRef = useRef<HTMLCanvasElement | null>(null);
  const lineChartRef = useRef<HTMLCanvasElement | null>(null);
  const pieChartInstance = useRef<Chart | null>(null);
  const lineChartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    const section = searchParams.get("section") || "dashboard";
    console.log("Search params changed:", { section });
    setActiveSection(section);
  }, [searchParams]);

  const isValidUUID = (str: string) => {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  const isTestOngoing = (test: Test) => {
    const now = new Date();
    const testStart = new Date(test.date);
    const testEnd = new Date(testStart.getTime() + test.duration * 60 * 1000);
    return now >= testStart && now <= testEnd;
  };

  const isTestActive = (test: Test) => {
    const now = new Date();
    const testStart = new Date(test.date);
    const testEnd = new Date(testStart.getTime() + test.duration * 60 * 1000);
    return now >= testStart && now <= testEnd;
  };

  const getTestStatus = (test: Test) => {
    const now = new Date();
    const testStart = new Date(test.date);
    const testEnd = new Date(testStart.getTime() + test.duration * 60 * 1000);
    if (now < testStart) {
      return `Starts at ${testStart.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
      })}`;
    } else if (now > testEnd) {
      return `Ended at ${testEnd.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
      })}`;
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
        const baseUrl =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
        const url = `${baseUrl}/api/student/profile/${studentId}`;
        console.log("Fetching profile with:", { url, studentId });

        try {
          const res = await fetch(url, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          });

          const contentType = res.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
            const text = await res.text();
            console.error("Non-JSON response received for profile:", {
              status: res.status,
              text: text.slice(0, 100),
            });
            throw new Error(
              "Server returned a non-JSON response. Please check the API URL and server status."
            );
          }

          const data = await res.json();
          if (res.ok) {
            setProfile(data);
            localStorage.setItem("studentName", data.name);
          } else {
            setError(data.message || "Failed to fetch profile");
            console.error("Fetch profile failed:", data);
          }
        } catch (err: any) {
          console.error("Fetch profile error:", err.message);
          setError(err.message || "Error fetching profile");
        }
      };

      const fetchTests = async () => {
        const baseUrl =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
        const url = `${baseUrl}/api/tests`;
        console.log("Fetching tests with:", { url });

        try {
          const res = await fetch(url, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          });

          const contentType = res.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
            const text = await res.text();
            console.error("Non-JSON response received for tests:", {
              status: res.status,
              text: text.slice(0, 100),
            });
            throw new Error(
              "Server returned a non-JSON response. Please check the API URL and server status."
            );
          }

          const data = await res.json();
          const validTests = data.filter((test: Test) => {
            if (
              !test.testId ||
              !isValidUUID(test.testId) ||
              !test.name ||
              !test.date ||
              !test.duration
            ) {
              console.error("Invalid test data filtered out:", test);
              return false;
            }
            return true;
          });

          if (validTests.length === 0) {
            console.warn("No valid tests found after filtering");
            setError(
              "No valid tests available. Please contact the administrator."
            );
          }

          const parsedTests = validTests.map((test: Test) => ({
            ...test,
            date: new Date(test.date),
          }));

          setOngoingTests(
            parsedTests.filter((test: Test) => isTestOngoing(test))
          );
          setTests(parsedTests);
        } catch (err: any) {
          console.error("Fetch tests error:", err.message);
          setError(
            err.message ||
              "Error fetching tests. Please check if the backend server is running."
          );
        }
      };

      const fetchResults = async () => {
        const baseUrl =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
        const url = `${baseUrl}/api/student/results/${studentId}`;
        console.log("Fetching results with:", { url, studentId });

        try {
          const res = await fetch(url, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          });

          const contentType = res.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
            const text = await res.text();
            console.error("Non-JSON response received for results:", {
              status: res.status,
              text: text.slice(0, 100),
            });
            throw new Error(
              "Server returned a non-JSON response. Please check the API URL and server status."
            );
          }

          const data = await res.json();
          if (res.ok) {
            setResults(data);
          } else {
            setError(data.message || "Failed to fetch results");
            console.error("Fetch results failed:", data);
          }
        } catch (err: any) {
          console.error("Fetch results error:", err.message);
          setError(err.message || "Error fetching results");
        }
      };

      const fetchRank = async () => {
        const baseUrl =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
        const url = `${baseUrl}/api/student/rank/${studentId}`;
        console.log("Fetching rank with:", { url, studentId });

        try {
          const res = await fetch(url, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          });

          const contentType = res.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
            const text = await res.text();
            console.error("Non-JSON response received for rank:", {
              status: res.status,
              text: text.slice(0, 100),
            });
            throw new Error(
              "Server returned a non-JSON response for rank."
            );
          }

          const data = await res.json();
          if (res.ok) {
            setRank(data.rank.toString());
          } else {
            setError(data.message || "Failed to fetch rank");
            console.error("Fetch rank failed:", data);
          }
        } catch (err: any) {
          console.error("Fetch rank error:", err.message);
          setError(err.message || "Error fetching rank");
        }
      };

      const fetchData = async () => {
        setIsLoading(true);
        await Promise.all([fetchProfile(), fetchTests(), fetchResults(), fetchRank()]);
        setIsLoading(false);
      };

      fetchData();
    } catch (err: any) {
      console.error("Token decode error:", err.message);
      setError("Invalid token. Please log in again.");
      localStorage.removeItem("token");
      localStorage.removeItem("studentId");
      setTimeout(() => router.push("/"), 2000);
    }
  }, [router]);

  useEffect(() => {
    if (results.length > 0 && pieChartRef.current && lineChartRef.current) {
      try {
        // Destroy existing charts to prevent memory leaks
        if (pieChartInstance.current) {
          pieChartInstance.current.destroy();
        }
        if (lineChartInstance.current) {
          lineChartInstance.current.destroy();
        }

        // Pie Chart: Grade Distribution
        const grades = { A: 0, B: 0, C: 0, D: 0, F: 0 };
        results.forEach((result) => {
          const percentage = result.totalQuestions > 0 ? (result.score / result.totalQuestions) * 100 : 0;
          if (percentage >= 90) grades.A++;
          else if (percentage >= 80) grades.B++;
          else if (percentage >= 70) grades.C++;
          else if (percentage >= 60) grades.D++;
          else grades.F++;
        });

        pieChartInstance.current = new Chart(pieChartRef.current, {
          type: "pie",
          data: {
            labels: ["A (90%+)", "B (80-89%)", "C (70-79%)", "D (60-69%)", "F (<60%)"],
            datasets: [{
              data: [grades.A, grades.B, grades.C, grades.D, grades.F],
              backgroundColor: ["#10b981", "#34d399", "#60a5fa", "#f87171", "#ef4444"],
              borderColor: "#ffffff",
              borderWidth: 2,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: "bottom" },
              title: { display: true, text: "Grade Distribution", font: { size: 16 } },
            },
          },
        });

        // Line Chart: Score Trends
        const sortedResults = [...results].sort((a, b) =>
          new Date(a.testId?.date || 0).getTime() - new Date(b.testId?.date || 0).getTime()
        );
        const labels = sortedResults.map((r, i) => r.testId?.name || `Test ${i + 1}`);
        const scores = sortedResults.map((r) =>
          r.totalQuestions > 0 ? (r.score / r.totalQuestions) * 100 : 0
        );

        lineChartInstance.current = new Chart(lineChartRef.current, {
          type: "line",
          data: {
            labels,
            datasets: [{
              label: "Score (%)",
              data: scores,
              borderColor: "#1e3a8a",
              backgroundColor: "rgba(30, 58, 138, 0.1)",
              fill: true,
              tension: 0.4,
              pointBackgroundColor: "#1e3a8a",
              pointRadius: 5,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: { beginAtZero: true, max: 100, title: { display: true, text: "Score (%)" } },
              x: { title: { display: true, text: "Tests" } },
            },
            plugins: {
              legend: { display: false },
              title: { display: true, text: "Score Trends Over Time", font: { size: 16 } },
            },
          },
        });

        // Force chart resize to ensure proper rendering
        setTimeout(() => {
          pieChartInstance.current?.resize();
          lineChartInstance.current?.resize();
        }, 0);
      } catch (err: any) {
        console.error("Chart rendering error:", err.message);
        setError("Failed to render charts. Please try again.");
      }
    }

    return () => {
      if (pieChartInstance.current) {
        pieChartInstance.current.destroy();
      }
      if (lineChartInstance.current) {
        lineChartInstance.current.destroy();
      }
    };
  }, [results]);

  const calculateMetrics = () => {
    const totalTests = results.length;
    const averageScore = totalTests
      ? (
          results.reduce(
            (sum, r) => sum + (r.score / r.totalQuestions) * 100,
            0
          ) / totalTests
        ).toFixed(0) + "%"
      : "N/A";

    const averagePercentage = totalTests
      ? results.reduce(
          (sum, r) => sum + (r.score / r.totalQuestions) * 100,
          0
        ) / totalTests
      : 0;
    const overallGrade = totalTests
      ? averagePercentage >= 90
        ? "A"
        : averagePercentage >= 80
        ? "B"
        : averagePercentage >= 70
        ? "C"
        : averagePercentage >= 60
        ? "D"
        : "F"
      : "N/A";

    return { totalTests, averageScore, overallGrade, rank };
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
      console.error("Take Test button clicked with invalid testId:", {
        testId,
        testName,
      });
      setError(`Cannot navigate to test: Invalid test ID ${testId}`);
      return;
    }
    const cleanTestId = testId.trim();
    console.log("Navigating to test:", {
      testId: cleanTestId,
      testName,
      timestamp: new Date().toISOString(),
    });
    router.push(`/user/test/${encodeURIComponent(cleanTestId)}`);
  };

  if (isLoading) {
    return <Loader />;
  }

  const { totalTests, averageScore, overallGrade } = calculateMetrics();

  return (
    <Layout role="user">
      <div className="dashboard-container">
        <main className="main-content">
          <header className="dashboard-header">
            <h1 className="dashboard-title">Student Dashboard</h1>
            <div className="welcome-card">
              <p>Welcome, {profile?.name || "Student"}!</p>
            </div>
          </header>
          {error && <p className="error-message">{error}</p>}
          {activeSection === "dashboard" && (
            <div className="content-grid">
              <div className="content-left">
                <div className="card">
                  <h3 className="card-title">Performance Metrics</h3>
                  <div className="metrics-grid">
                    <div className="metric-card grade">
                      <p className="metric-label">Overall Grade</p>
                      <p className="metric-value">{overallGrade}</p>
                    </div>
                    <div className="metric-card score">
                      <p className="metric-label">Average Score</p>
                      <p className="metric-value">{averageScore}</p>
                    </div>
                    <div className="metric-card tests">
                      <p className="metric-label">Tests Taken</p>
                      <p className="metric-value">{totalTests}</p>
                    </div>
                    <div className="metric-card rank">
                      <p className="metric-label">Rank</p>
                      <p className="metric-value">{rank}</p>
                    </div>
                  </div>
                </div>
                <div className="card">
                  <h3 className="card-title">Ongoing Tests</h3>
                  {ongoingTests.length === 0 ? (
                    <div className="empty-state">
                      <span className="material-icons">inbox</span>
                      <p>No ongoing tests available.</p>
                    </div>
                  ) : (
                    <table className="test-table">
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
                        {ongoingTests.map((test) => (
                          <tr key={test.testId}>
                            <td>{test.name}</td>
                            <td>
                              {new Date(test.date).toLocaleDateString("en-IN", {
                                timeZone: "Asia/Kolkata",
                              })}
                            </td>
                            <td>
                              {new Date(test.date).toLocaleTimeString("en-IN", {
                                hour: "2-digit",
                                minute: "2-digit",
                                timeZone: "Asia/Kolkata",
                              })}
                            </td>
                            <td>{getTestStatus(test)}</td>
                            <td>
                              <button
                                onClick={() =>
                                  handleTakeTestClick(test.testId, test.name)
                                }
                                className={`action-button ${
                                  isTestActive(test) ? "" : "disabled"
                                }`}
                                disabled={!isTestActive(test)}
                                title={getTestStatus(test)}
                              >
                                {isTestActive(test) ? "Take Test" : "Not Available"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
              <div className="content-right">
                <div className="card">
                  <h3 className="card-title">Grade Distribution</h3>
                  <div className="chart-container">
                    <canvas ref={pieChartRef} className="chart-canvas"></canvas>
                  </div>
                </div>
                <div className="card">
                  <h3 className="card-title">Score Trends</h3>
                  <div className="chart-container">
                    <canvas ref={lineChartRef} className="chart-canvas"></canvas>
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeSection === "tests" && (
            <div className="card full-width">
              <h3 className="card-title">All Tests</h3>
              {tests.length === 0 ? (
                <div className="empty-state">
                  <span className="material-icons">inbox</span>
                  <p>No tests available.</p>
                </div>
              ) : (
                <table className="test-table">
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
                    {tests.map((test) => (
                      <tr key={test.testId}>
                        <td>{test.name}</td>
                        <td>
                          {new Date(test.date).toLocaleDateString("en-IN", {
                            timeZone: "Asia/Kolkata",
                          })}
                        </td>
                        <td>
                          {new Date(test.date).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: "Asia/Kolkata",
                          })}
                        </td>
                        <td>{test.duration} min</td>
                        <td>{getTestStatus(test)}</td>
                        <td>
                          <button
                            onClick={() =>
                              handleTakeTestClick(test.testId, test.name)
                            }
                            className={`action-button ${
                              isTestActive(test) ? "" : "disabled"
                            }`}
                            disabled={!isTestActive(test)}
                            title={getTestStatus(test)}
                          >
                            {isTestActive(test) ? "Take Test" : "Not Available"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
          {activeSection === "results" && (
            <div className="card full-width">
              <h3 className="card-title">Previous Test Results</h3>
              {results.length === 0 ? (
                <div className="empty-state">
                  <span className="material-icons">inbox</span>
                  <p>No previous test results available.</p>
                </div>
              ) : (
                <table className="test-table">
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
                        <td>{result.testId ? result.testId.name : "Unknown Test"}</td>
                        <td>
                          {result.testId
                            ? new Date(result.testId.date).toLocaleDateString(
                                "en-IN",
                                { timeZone: "Asia/Kolkata" }
                              )
                            : "N/A"}
                        </td>
                        <td>
                          {result.totalQuestions > 0
                            ? ((result.score / result.totalQuestions) * 100).toFixed(0) + "%"
                            : "N/A"}
                        </td>
                        <td>
                          {result.totalQuestions > 0
                            ? getGrade(result.score, result.totalQuestions)
                            : "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
          {activeSection === "profile" && (
            <div className="card full-width">
              <h3 className="card-title">Student Profile</h3>
              {profile && (
                <div className="profile-container">
                  <div className="profile-header">
                    <div className="profile-picture">
                      <span className="profile-initials">
                        {profile.name.charAt(0)}
                      </span>
                    </div>
                    <div className="profile-info">
                      <p className="profile-name">{profile.name}</p>
                      <p className="profile-meta">Student ID: {localStorage.getItem("studentId")}</p>
                      <p className="profile-meta">
                        Joined: {new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}
                      </p>
                    </div>
                  </div>
                  <h4 className="profile-subheading">Personal Details</h4>
                  <div className="personal-details">
                    <div className="detail-item">
                      <p className="detail-label">Name</p>
                      <p className="detail-value">{profile.name}</p>
                    </div>
                    <div className="detail-item">
                      <p className="detail-label">Email</p>
                      <p className="detail-value">{profile.email}</p>
                    </div>
                    <div className="detail-item">
                      <p className="detail-label">Contact Number</p>
                      <p className="detail-value">{profile.profile.phone}</p>
                    </div>
                    <div className="detail-item">
                      <p className="detail-label">Address</p>
                      <p className="detail-value">{profile.profile.address}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </Layout>
  );
}