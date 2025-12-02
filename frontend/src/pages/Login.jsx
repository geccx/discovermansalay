import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import '../styles/pages.css';

export default function Login() {
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Frontend validation
    if (!form.identifier || !form.password) {
      const message = 'Both email/username and password are required.';
      setError(message);
      toast.warning(message);
      return;
    }

    try {
      const res = await axios.post('http://localhost:3001/api/auth/login', form);

      const user = res.data.user;
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(user));

      toast.success(`Welcome back, ${user.firstname || user.username}!`);

      if (user.role === 'admin' || user.username === 'admin') {
        navigate('/admin');
      } else {
        navigate('/');
      }

      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (err) {
      let message = 'Login failed. Please try again.';

      if (err.response?.status === 400) {
        message = 'Please provide both email/username and password.';
      } else if (err.response?.status === 401) {
        message = err.response.data.message || 'Invalid credentials.';
      } else if (err.response?.status === 500) {
        message = 'Server error during login. Please try again later.';
      }

      setError(message);
      toast.error(message);
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <div className="login-form-container">
      <button className="login-back-button" onClick={handleBack}>
        ← Back
      </button>
      <h2 className="login-title">Login</h2>

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          name="identifier"
          placeholder="Email or Username"
          value={form.identifier}
          onChange={handleChange}
          className="login-input"
          required
        />

        <div className="password-wrapper">
          <input
            type={showPassword ? 'text' : 'password'}
            name="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            className="login-input"
            required
          />
          <button
            type="button"
            onClick={togglePasswordVisibility}
            className="show-password-toggle"
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>

        <button type="submit" className="login-submit-button">
          Login
        </button>

        {error && <div className="login-error-message">{error}</div>}
      </form>

      <div className="login-register-link">
        Don’t have an account? <a href="/register">Register here</a>
      </div>
    </div>
  );
}
