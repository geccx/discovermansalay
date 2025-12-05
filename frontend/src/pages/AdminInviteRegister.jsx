// src/pages/AdminInviteRegister.jsx
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/adminInvite.css"; // NEW CSS

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

const AdminInviteRegister = () => {
  const query = useQuery();
  const navigate = useNavigate();
  const token = query.get("token");

  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState("validate");
  const [error, setError] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");

  const [form, setForm] = useState({
    username: "",
    firstname: "",
    lastname: "",
    password: "",
    confirmPassword: "",
    contact_number: "",
    address: "",
  });

  const [otp, setOtp] = useState("");

  // Validate token on mount
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError("Missing invitation token.");
        setLoading(false);
        return;
      }

      try {
        const res = await axios.get(`${API_BASE}/api/admin/invite/validate`, {
          params: { token },
        });

        setInviteEmail(res.data.email);
        setStep("register");
      } catch (err) {
        setError(
          err.response?.data?.message ||
            "Invalid or expired invitation link."
        );
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, [token]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      await axios.post(`${API_BASE}/api/admin/register-from-invite`, {
        token,
        ...form,
      });

      setStep("otp");
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to complete registration."
      );
    }
  };

  const handleOtpSubmit = async (e) => {
  e.preventDefault();
  setError("");

  try {
    await axios.post(`${API_BASE}/api/admin/verify-otp`, {
      email: inviteEmail,
      otp,
    });

    setStep("done");

    setTimeout(() => {
      navigate("/login"); // FIXED: redirect to login page
    }, 2000);
  } catch (err) {
    setError(err.response?.data?.message || "Failed to verify OTP.");
  }
};


  return (
    <div className="invite-modal-overlay">
      <div className="invite-modal">
        <h2 className="invite-title">Admin Invitation</h2>

        {loading && <p>Validating invitation...</p>}

        {error && <p className="invite-error">{error}</p>}

        {/* REGISTER FORM */}
        {!loading && step === "register" && (
          <form onSubmit={handleRegisterSubmit} className="invite-form">
            <p className="invite-label">
              Invitation for: <strong>{inviteEmail}</strong>
            </p>

            <div className="invite-group">
              <label>Username</label>
              <input name="username" value={form.username} onChange={handleChange} required />
            </div>

            <div className="invite-group">
              <label>First Name</label>
              <input name="firstname" value={form.firstname} onChange={handleChange} required />
            </div>

            <div className="invite-group">
              <label>Last Name</label>
              <input name="lastname" value={form.lastname} onChange={handleChange} required />
            </div>

            <div className="invite-group">
              <label>Contact Number</label>
              <input name="contact_number" value={form.contact_number} onChange={handleChange} />
            </div>

            <div className="invite-group">
              <label>Address</label>
              <input name="address" value={form.address} onChange={handleChange} />
            </div>

            <div className="invite-group">
              <label>Password</label>
              <input type="password" name="password" value={form.password} onChange={handleChange} required />
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

            <button className="invite-btn">Continue (Send OTP)</button>
          </form>
        )}

        {/* OTP FORM */}
        {step === "otp" && (
          <form onSubmit={handleOtpSubmit} className="invite-form">
            <p className="invite-label">
              An OTP has been sent to <strong>{inviteEmail}</strong>.
            </p>

            <div className="invite-group">
              <label>OTP Code</label>
              <input value={otp} onChange={(e) => setOtp(e.target.value)} required />
            </div>

            <button className="invite-btn">Verify & Activate</button>
          </form>
        )}

        {/* DONE */}
        {step === "done" && (
          <p className="invite-success">Your admin account is active! Redirecting...</p>
        )}
      </div>
    </div>
  );
};

export default AdminInviteRegister;
