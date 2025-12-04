import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import "../styles/pages.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

export default function VerifyOtp() {
  const location = useLocation();
  const navigate = useNavigate();

  const [emailOrUsername, setEmailOrUsername] = useState(
    location.state?.emailOrUsername || ""
  );
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!emailOrUsername || !otp) {
      setError("Email/Username and OTP are required.");
      return;
    }

    try {
      const res = await axios.post(`${API_BASE}/api/user/verify-otp`, {
        emailOrUsername,
        otp,
      });
      toast.success(res.data.message);
      navigate("/login");
    } catch (err) {
      const msg = err.response?.data?.message || "OTP verification failed.";
      setError(msg);
      toast.error(msg);
    }
  };

  const handleResend = async () => {
    try {
      const res = await axios.post(`${API_BASE}/api/user/resend-otp`, {
        emailOrUsername,
      });
      toast.success(res.data.message);
      setError("");
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to resend OTP.";
      setError(msg);
      toast.error(msg);
    }
  };

  return (
    <div className="verify-container">
      <div className="verify-card">
        <h2 className="verify-title">Verify Your Account</h2>

        <p className="verify-subtext">Enter the verification code sent to:</p>

        <div className="verify-email-box">{emailOrUsername}</div>

        <form onSubmit={handleVerify}>
          <input
            type="text"
            name="otp"
            placeholder="Enter OTP"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            className="verify-input"
            required
          />

          <button type="submit" className="verify-submit-btn">
            Verify
          </button>

          {error && <div className="verify-error">{error}</div>}
        </form>

        <p className="verify-resend" onClick={handleResend}>
          Resend OTP
        </p>
      </div>
    </div>
  );
}
