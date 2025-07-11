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
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    const endpoint = role === 'admin' ? '/api/auth/admin/login' : '/api/auth/login';
    try {
      console.log('Attempting login with:', { email, role, password: '****' });
      const res = await fetch(`http://localhost:5000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      console.log('Login response:', { status: res.status, data });
      setLoading(false);
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
          console.log('Stored in localStorage:', { token: data.token, studentId: data.studentId, role: data.role });
          router.push('/user/dashboard');
        } else {
          if (!data.adminId) {
            setError('No admin ID returned. Please try again.');
            console.error('Missing adminId in response:', data);
            return;
          }
          localStorage.setItem('adminId', data.adminId);
          console.log('Stored in localStorage:', { token: data.token, adminId: data.adminId, role: data.role });
          router.push('/admin/dashboard');
        }
        setTimeout(() => {
          router.refresh();
        }, 100);
      } else {
        setError(data.message || 'Login failed. Invalid credentials.');
        console.log('Login failed with message:', data.message);
      }
    } catch (error) {
      console.error('Login error:', error);
      setLoading(false);
      setError('An error occurred during login. Please try again.');
    }
  };

  return (
    <Layout>
      <div className="login-container">
        <h2>Login</h2>
        {error && <p className="error">{error}</p>}
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