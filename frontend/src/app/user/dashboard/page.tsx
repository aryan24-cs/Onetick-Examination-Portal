"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { jwtDecode } from "jwt-decode";
import Loader from "../../../components/loader";
import Layout from "../../../components/Layout";
import '../../../styles/userdashboard.css'
// import '../../../styles/global.css'

interface Test {
  testId: string;
  name: string;
  date: Date | string;
  duration: number;
  // questions: any[];
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
  const searchParams = useSearchParams();
  const [tests, setTests] = useState<Test[]>([]);
  const [ongoingTests, setOngoingTests] = useState<Test[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [activeSection, setActiveSection] = useState(
    searchParams.get("section") || "dashboard"
  );
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string>("");

  // Load profile picture from localStorage on mount
  useEffect(() => {
    const savedPic = localStorage.getItem("profilePic");
    if (savedPic) {
      setProfilePic(savedPic);
    }
  }, []);

  // Handle profile picture upload with validation
  const handleProfilePicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setUploadError("Please upload a valid image file (e.g., JPG, PNG).");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Image size must be less than 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setProfilePic(result);
      localStorage.setItem("profilePic", result);
      setUploadError("");
    };
    reader.onerror = () => {
      setUploadError("Failed to read the image file.");
    };
    reader.readAsDataURL(file);
  };

  // Handle remove profile picture
  const handleRemovePhoto = () => {
    setProfilePic(null);
    localStorage.removeItem("profilePic");
    setUploadError("");
  };

  // Update activeSection when searchParams change
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

          console.log("Profile response status:", {
            status: res.status,
            statusText: res.statusText,
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
          console.log("Profile response data:", data);

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

          console.log("Tests response status:", {
            status: res.status,
            statusText: res.statusText,
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
          console.log("Raw tests data:", data);

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

          console.log(
            "Parsed tests:",
            parsedTests.map((t: Test) => ({
              testId: t.testId,
              name: t.name,
              date: t.date.toString(),
            }))
          );
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

          console.log("Results response status:", {
            status: res.status,
            statusText: res.statusText,
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
          console.log("Results response data:", data);

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

      const fetchData = async () => {
        setIsLoading(true);
        await Promise.all([fetchProfile(), fetchTests(), fetchResults()]);
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

  const handleBackToDashboard = () => {
    router.push("/user/dashboard?section=dashboard");
  };

  const { totalTests, averageScore, overallGrade } = calculateMetrics();

  if (isLoading) {
    return <Loader />;
  }

  return (
    <Layout role="user" profilePic={profilePic}>
      <div className="dashboard-container animate-slide-in">
        <h2 className="dashboard-title">Student Dashboard</h2>
        {error && <p className="error-message animate-error">{error}</p>}
        {activeSection === "dashboard" && (
          <>
            <div className="section animate-slide-in" style={{ animationDelay: "0.1s" }}>
              <h3 className="section-title">Performance Overview</h3>
              <div className="metrics-grid">
                <div className="metric-card animate-slide-in" style={{ animationDelay: "0.2s" }}>
                  <p className="metric-label">Overall Grade</p>
                  <p className="metric-value">{overallGrade}</p>
                </div>
                <div className="metric-card animate-slide-in" style={{ animationDelay: "0.3s" }}>
                  <p className="metric-label">Average Score</p>
                  <p className="metric-value">{averageScore}</p>
                </div>
                <div className="metric-card animate-slide-in" style={{ animationDelay: "0.4s" }}>
                  <p className="metric-label">Tests Taken</p>
                  <p className="metric-value">{totalTests}</p>
                </div>
              </div>
            </div>
            <div className="section animate-slide-in" style={{ animationDelay: "0.2s" }}>
              <h3 className="section-title">Ongoing Tests</h3>
              <div className="table-container">
                {ongoingTests.length === 0 ? (
                  <p className="empty-state">No ongoing tests available.</p>
                ) : (
                  <table className="dashboard-table">
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
                        <tr key={test.testId} className="animate-slide-in">
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
                              className={`action-button take-test-btn ${
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
            <div className="section animate-slide-in" style={{ animationDelay: "0.3s" }}>
              <h3 className="section-title">Upcoming Tests</h3>
              <div className="table-container">
                {tests.filter((test) => new Date(test.date) > new Date()).length === 0 ? (
                  <p className="empty-state">No upcoming tests available.</p>
                ) : (
                  <table className="dashboard-table">
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
                      {tests
                        .filter((test) => new Date(test.date) > new Date())
                        .map((test) => (
                          <tr key={test.testId} className="animate-slide-in">
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
                                className={`action-button take-test-btn ${
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
          </>
        )}
        {activeSection === "tests" && (
          <div className="section animate-slide-in" style={{ animationDelay: "0.1s" }}>
            <h3 className="section-title">All Tests</h3>
            <div className="table-container">
              {tests.length === 0 ? (
                <p className="empty-state">No tests available.</p>
              ) : (
                <table className="dashboard-table">
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
                      <tr key={test.testId} className="animate-slide-in">
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
                            className={`action-button take-test-btn ${
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
        )}
        {activeSection === "results" && (
          <div className="section animate-slide-in" style={{ animationDelay: "0.1s" }}>
            <h3 className="section-title">Previous Test Results</h3>
            <div className="table-container">
              {results.length === 0 ? (
                <p className="empty-state">No previous test results available.</p>
              ) : (
                <table className="dashboard-table">
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
                      <tr key={index} className="animate-slide-in">
                        <td>{result.testId.name}</td>
                        <td>
                          {new Date(result.testId.date).toLocaleDateString(
                            "en-IN",
                            { timeZone: "Asia/Kolkata" }
                          )}
                        </td>
                        <td>
                          {((result.score / result.totalQuestions) * 100).toFixed(0)}%
                        </td>
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
          <div className="section animate-slide-in" style={{ animationDelay: "0.1s" }}>
            <h3 className="section-title">Profile</h3>
            {profile && (
              <div className="profile-details">
                <div className="profile-edit-section">
                  <div className="avatar" style={{ backgroundImage: profilePic ? `url(${profilePic})` : undefined }}></div>
                  <div className="profile-upload-container">
                    <input
                      type="file"
                      accept="image/*"
                      className="profile-upload"
                      id="profile-upload"
                      onChange={handleProfilePicChange}
                    />
                    <label htmlFor="profile-upload" className="edit-profile-btn">
                      Upload Photo
                    </label>
                    {profilePic && (
                      <button
                        onClick={handleRemovePhoto}
                        className="remove-photo-btn"
                      >
                        Remove Photo
                      </button>
                    )}
                    {uploadError && <p className="error-message animate-error">{uploadError}</p>}
                  </div>
                </div>
                <div className="profile-item animate-slide-in" style={{ animationDelay: "0.2s" }}>
                  <span className="profile-label">Name:</span>
                  <span className="profile-value">{profile.name}</span>
                </div>
                <div className="profile-item animate-slide-in" style={{ animationDelay: "0.3s" }}>
                  <span className="profile-label">Email:</span>
                  <span className="profile-value">{profile.email}</span>
                </div>
                <div className="profile-item animate-slide-in" style={{ animationDelay: "0.4s" }}>
                  <span className="profile-label">Date of Birth:</span>
                  <span className="profile-value">{profile.profile.dob}</span>
                </div>
                <div className="profile-item animate-slide-in" style={{ animationDelay: "0.5s" }}>
                  <span className="profile-label">Phone:</span>
                  <span className="profile-value">{profile.profile.phone}</span>
                </div>
                <div className="profile-item animate-slide-in" style={{ animationDelay: "0.6s" }}>
                  <span className="profile-label">Address:</span>
                  <span className="profile-value">{profile.profile.address}</span>
                </div>
                <button
                  onClick={handleBackToDashboard}
                  className="nav-button"
                  style={{ marginTop: "16px" }}
                >
                  Back to Dashboard
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}