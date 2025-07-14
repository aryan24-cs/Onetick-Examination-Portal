"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Loader from '../components/loader';
import '../styles/auth.css'

export default function Home() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const validateForm = () => {
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address');
      return false;
    }
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }
    return true;
  };

  const handleLogin = async () => {
    if (!validateForm()) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    const endpoint = role === 'admin' ? '/api/auth/admin/login' : '/api/auth/login';
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const url = `${baseUrl}${endpoint}`;

    console.log('Attempting login with:', { email, role, url });

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      console.log('Login response status:', { status: res.status, statusText: res.statusText });

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text();
        console.error('Non-JSON response received:', { status: res.status, text: text.slice(0, 100) });
        throw new Error('Server returned a non-JSON response. Please check the API URL and server status.');
      }

      const data = await res.json();
      console.log('Login response data:', data);

      if (res.ok && data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('role', data.role);
        if (role === 'student') {
          if (!data.studentId) {
            setError('No student ID returned. Please try again.');
            console.error('Missing studentId in response:', data);
            return;
          }
          localStorage.setItem('studentId', data.studentId);
          localStorage.setItem('studentName', data.name || email);
          console.log('Stored in localStorage:', {
            token: data.token,
            studentId: data.studentId,
            role: data.role,
            studentName: data.name || email,
          });
          router.push('/user/dashboard?section=tests');
        } else {
          if (!data.adminId) {
            setError('No admin ID returned. Please try again.');
            console.error('Missing adminId in response:', data);
            return;
          }
          localStorage.setItem('adminId', data.adminId);
          localStorage.setItem('adminEmail', data.email || email);
          console.log('Stored in localStorage:', {
            token: data.token,
            adminId: data.adminId,
            role: data.role,
            adminEmail: data.email || email,
          });
          router.push('/admin/dashboard?section=metrics');
        }
      } else {
        setError(data.message || 'Login failed. Invalid credentials.');
        console.log('Login failed with message:', data.message);
      }
    } catch (error: any) {
      console.error('Login error:', error.message);
      setError(error.message || 'An error occurred during login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {loading && <Loader />}
      <div className="login-container animate-slide-in">
        <h2>Login to Your Account</h2>
        {error && <p className="error animate-error">{error}</p>}
        <div className="form-group">
          <label htmlFor="role">Role</label>
          <select
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            aria-label="Select role"
            disabled={loading}
          >
            <option value="student">Student</option>
            <option value="admin">Admin</option>
          </select>
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
        <button onClick={handleLogin} disabled={loading} className="gradient-button">
          {loading ? 'Logging in...' : 'Login'}
        </button>
        <p className="link-text">
          Don’t have an account? <Link href="/register">Register</Link>
        </p>
      </div>
    </div>
  );
}