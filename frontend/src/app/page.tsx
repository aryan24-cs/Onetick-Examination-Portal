"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../components/Layout';
import Link from 'next/link';

export default function Home() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    setLoading(true);
    const endpoint = role === 'admin' ? '/api/auth/admin/login' : '/api/auth/login';
    try {
      const res = await fetch(`http://localhost:5000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      setLoading(false);
      if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('userId', data.studentId || 'admin');
        router.push(role === 'admin' ? '/admin/dashboard' : '/user/dashboard');
      } else {
        alert(data.message);
      }
    } catch (error) {
      setLoading(false);
      alert('An error occurred. Please try again.');
    }
  };

  return (
    <Layout>
      <div className="login-container">
        <h2>Login</h2>
        <div className="form-group">
          <label>Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="student">Student</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
          />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
          />
        </div>
        <button onClick={handleLogin} disabled={loading} className={loading ? 'button-disabled' : ''}>
          {loading ? 'Loading...' : 'Login'}
        </button>
        <p className="link-text">
          Don’t have an account? <Link href="/register">Register</Link>
        </p>
      </div>
    </Layout>
  );
}
