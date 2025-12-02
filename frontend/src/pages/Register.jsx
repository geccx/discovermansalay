import { useState } from 'react';
import axios from 'axios';
import '../styles/pages.css';

export default function Register() {
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    role: 'user',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
    setSuccess('');
  };

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      const res = await axios.post('http://localhost:3001/api/auth/register', form);
      setSuccess(res.data.message);
      setForm({ username: '', email: '', password: '', role: 'user' });
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    }
  };

  return (
    <div className="register-form-container">
  <h2 className="register-title">Register</h2>
  <form onSubmit={handleSubmit}>
    <input
      type="text"
      name="username"
      placeholder="Username"
      value={form.username}
      onChange={handleChange}
      className="register-input"
    />
    <input
      type="email"
      name="email"
      placeholder="Email"
      value={form.email}
      onChange={handleChange}
      className="register-input"
    />
    <input
      type="password"
      name="password"
      placeholder="Password"
      value={form.password}
      onChange={handleChange}
      className="register-input"
    />
    <button type="submit" className="register-submit-button">Register</button>

    {error && <div className="register-error-message">{error}</div>}
    {success && <div className="register-success-message">{success}</div>}
  </form>
  <div className="register-link">
    Already have an account? <a href="/login">Login here</a>
  </div>
</div>

  );
}
