import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/adminInvite.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

const UserInviteRegister = () => {
  const query = useQuery();
  const navigate = useNavigate();
  const token = query.get("token");

  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    username: "",
    firstname: "",
    lastname: "",
    password: "",
    confirmPassword: "",
    contact_number: "",
    address: "",
  });

  useEffect(() => {
    const validateInvite = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/invite/validate`, {
          params: { token },
        });

        setInviteEmail(res.data.email);
      } catch (err) {
        setError(
          err.response?.data?.message || "Invalid or expired invitation."
        );
      } finally {
        setLoading(false);
      }
    };

    validateInvite();
  }, [token]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      await axios.post(`${API_BASE}/api/invite/register`, {
        token,
        ...form,
      });

      alert("Your account is now active!");
      navigate("/login");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to create your account. Please try again."
      );
    }
  };

  return (
    <div className="invite-modal-overlay">
      <div className="invite-modal">
        <h2 className="invite-title">Complete Your Registration</h2>

        {loading && <p>Validating invitation...</p>}
        {error && <p className="invite-error">{error}</p>}

        {!loading && !error && (
          <form onSubmit={handleSubmit} className="invite-form">
            <p className="invite-label">
              Invitation for: <strong>{inviteEmail}</strong>
            </p>

            <div className="invite-group">
              <label>Username</label>
              <input
                name="username"
                value={form.username}
                onChange={handleChange}
                required
              />
            </div>

            <div className="invite-group">
              <label>First Name</label>
              <input
                name="firstname"
                value={form.firstname}
                onChange={handleChange}
                required
              />
            </div>

            <div className="invite-group">
              <label>Last Name</label>
              <input
                name="lastname"
                value={form.lastname}
                onChange={handleChange}
                required
              />
            </div>

            <div className="invite-group">
              <label>Contact Number</label>
              <input
                name="contact_number"
                value={form.contact_number}
                onChange={handleChange}
              />
            </div>

            <div className="invite-group">
              <label>Address</label>
              <input
                name="address"
                value={form.address}
                onChange={handleChange}
              />
            </div>

            <div className="invite-group">
              <label>Password</label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                required
              />
            </div>

            <div className="invite-group">
              <label>Confirm Password</label>
              <input
                type="password"
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
                required
              />
            </div>

            <button className="invite-btn">Create Account</button>
          </form>
        )}
      </div>
    </div>
  );
};

export default UserInviteRegister;
