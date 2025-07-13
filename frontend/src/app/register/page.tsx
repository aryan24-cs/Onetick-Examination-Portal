"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Loader from "../../components/loader";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [otp, setOtp] = useState("");
  const [showOtp, setShowOtp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const validateForm = () => {
    if (!name || name.length < 3) {
      setError("Name must be at least 3 characters");
      return false;
    }
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setError("Please enter a valid email address");
      return false;
    }
    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters");
      return false;
    }
    if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      setError("Please enter a valid date of birth (YYYY-MM-DD)");
      return false;
    }
    if (!phone || phone.length < 10) {
      setError("Phone number must be at least 10 digits");
      return false;
    }
    if (!address) {
      setError("Address is required");
      return false;
    }
    return true;
  };

  const validateOtp = () => {
    if (!otp || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      setError("OTP must be a 6-digit number");
      return false;
    }
    return true;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;
    setLoading(true);
    setError("");

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
    const url = `${baseUrl}/api/auth/register`;

    console.log("Attempting registration with:", { name, email, phone, url });

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, dob, phone, address }),
      });

      console.log("Register response status:", { status: res.status, statusText: res.statusText });

      // Check Content-Type to avoid parsing HTML as JSON
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        console.error("Non-JSON response received:", { status: res.status, text: text.slice(0, 100) });
        throw new Error("Server returned a non-JSON response. Please check the API URL and server status.");
      }

      const data = await res.json();
      console.log("Register response data:", data);

      if (res.ok) {
        setShowOtp(true);
        setError("");
        console.log("Registration successful, OTP sent to:", email);
      } else {
        setError(data.message || "Registration failed. Please try again.");
        console.log("Registration failed with message:", data.message);
      }
    } catch (error: any) {
      console.error("Register error:", error.message);
      setError(error.message || "An error occurred during registration. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!validateOtp()) return;
    setLoading(true);
    setError("");

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
    const url = `${baseUrl}/api/auth/verify-otp`;

    console.log("Attempting OTP verification with:", { email, otp, url });

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });

      console.log("OTP verification response status:", { status: res.status, statusText: res.statusText });

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        console.error("Non-JSON response received:", { status: res.status, text: text.slice(0, 100) });
        throw new Error("Server returned a non-JSON response. Please check the API URL and server status.");
      }

      const data = await res.json();
      console.log("OTP verification response data:", data);

      if (res.ok && data.token) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("role", data.role);
        localStorage.setItem("studentId", data.studentId);
        localStorage.setItem("studentName", data.name || email);
        console.log("Stored in localStorage:", {
          token: data.token,
          studentId: data.studentId,
          role: data.role,
          studentName: data.name || email,
        });
        router.push("/user/dashboard?section=tests");
      } else {
        setError(data.message || "OTP verification failed. Please try again.");
        console.log("OTP verification failed with message:", data.message);
      }
    } catch (error: any) {
      console.error("OTP verification error:", error.message);
      setError(error.message || "An error occurred during OTP verification. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      {loading && <Loader />}
      <div className="register-container animate-slide-in">
        <h2>{showOtp ? "Verify OTP" : "Register Your Account"}</h2>
        {error && <p className="error animate-error">{error}</p>}
        {!showOtp ? (
          <>
            <div className="form-group">
              <label htmlFor="name">Name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                aria-label="Name"
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                aria-label="Email address"
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                aria-label="Password"
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="dob">Date of Birth</label>
              <input
                id="dob"
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                aria-label="Date of birth"
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="phone">Phone</label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter your phone number"
                aria-label="Phone number"
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="address">Address</label>
              <textarea
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter your address"
                aria-label="Address"
                disabled={loading}
              />
            </div>
            <button onClick={handleRegister} disabled={loading} className="gradient-button">
              {loading ? "Registering..." : "Register"}
            </button>
          </>
        ) : (
          <>
            <div className="form-group">
              <label htmlFor="otp">OTP</label>
              <input
                id="otp"
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter the 6-digit OTP"
                aria-label="OTP"
                disabled={loading}
              />
            </div>
            <button onClick={handleVerifyOtp} disabled={loading} className="gradient-button">
              {loading ? "Verifying..." : "Verify OTP"}
            </button>
          </>
        )}
        <p className="link-text">
          Already have an account? <Link href="/">Login</Link>
        </p>
      </div>
    </div>
  );
}