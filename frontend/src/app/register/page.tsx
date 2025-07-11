"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import Link from 'next/link';

export default function Register() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    dob: '',
    phone: '',
    address: '',
  });
  const [otp, setOtp] = useState('');
  const [showOtp, setShowOtp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async () => {
    setLoading(true);
    setError('');
    try {
      console.log('Registering with data:', formData);
      const res = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      console.log('Register response:', data);
      setLoading(false);
      if (data.message === 'OTP sent to email') {
        setShowOtp(true);
      } else {
        setError(data.message || 'Registration failed. Please try again.');
      }
    } catch (error) {
      console.error('Register error:', error);
      setLoading(false);
      setError('An error occurred during registration. Please try again.');
    }
  };

  const handleVerifyOtp = async () => {
    setLoading(true);
    setError('');
    try {
      console.log('Verifying OTP for email:', formData.email, 'OTP:', otp);
      const res = await fetch('http://localhost:5000/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, otp }),
      });
      const data = await res.json();
      console.log('OTP verification response:', data);
      setLoading(false);
      if (data.token && data.studentId) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('studentId', data.studentId);
        localStorage.setItem('role', 'student');
        console.log('Stored in localStorage:', { token: data.token, studentId: data.studentId, role: 'student' });
        router.push('/user/dashboard');
        setTimeout(() => {
          router.refresh();
        }, 100);
      } else {
        setError(data.message || 'OTP verification failed. Please try again.');
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      setLoading(false);
      setError('An error occurred during OTP verification. Please try again.');
    }
  };

  return (
    <Layout>
      <div className="register-container">
        <h2>Register</h2>
        {error && <p className="error">{error}</p>}
        {!showOtp ? (
          <>
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter your name"
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter your email"
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
              />
            </div>
            <div className="form-group">
              <label>Date of Birth</label>
              <input
                type="date"
                name="dob"
                value={formData.dob}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="Enter your phone number"
              />
            </div>
            <div className="form-group">
              <label>Address</label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Enter your address"
              />
            </div>
            <button onClick={handleRegister} disabled={loading} className={loading ? 'button-disabled' : ''}>
              {loading ? 'Loading...' : 'Register'}
            </button>
          </>
        ) : (
          <>
            <div className="form-group">
              <label>OTP</label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter OTP"
              />
            </div>
            <button onClick={handleVerifyOtp} disabled={loading} className={loading ? 'button-disabled' : ''}>
              {loading ? 'Loading...' : 'Verify OTP'}
            </button>
          </>
        )}
        <p className="link-text">
          Already have an account? <Link href="/">Login</Link>
        </p>
      </div>
    </Layout>
  );
}