import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import "../styles/pages.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

export default function AdminOtpModal({ userId, onClose }) {
  const [otp, setOtp] = useState("");
  const [timeLeft, setTimeLeft] = useState(60);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    const input = document.getElementById("admin-otp-input");
    if (input) input.focus();
  }, []);

  useEffect(() => {
    if (timeLeft <= 0) return setCanResend(true);
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft]);

  const verifyOtp = async (e) => {
    e.preventDefault();

    if (otp.length !== 6) return toast.error("Enter your 6-digit OTP");

    try {
      const res = await axios.post(`${API_BASE}/api/user/admin/verify-otp`, {
        userId,
        otp,
      });

      // --------------------------------------------------------
      // ⭐ ADMIN SHOULD HAVE SEPARATE STORAGE KEYS
      // --------------------------------------------------------
      if (res.data.token) {
        localStorage.setItem("admin_token", res.data.token);
      }

      if (res.data.user) {
        localStorage.setItem("admin_user", JSON.stringify(res.data.user));
      }

      // ❌ CLEAR USER SESSION SO ADMIN DOES NOT LOGIN AS USER
      localStorage.removeItem("token");
      localStorage.removeItem("user");

      toast.success("Admin verification successful!");

      // Prevent redirect loop
      sessionStorage.setItem("skipRedirectOnce", "true");

      // Force admin redirect ONLY into admin dashboard
      window.location.href = "/admin";

    } catch (err) {
      toast.error(err.response?.data?.message || "Invalid OTP.");
    }
  };

  const resend = async () => {
    if (!canResend) return;

    try {
      await axios.post(`${API_BASE}/api/user/admin/resend-otp`, { userId });
      toast.success("OTP resent!");
      setCanResend(false);
      setTimeLeft(60);
    } catch {
      toast.error("Failed to resend OTP");
    }
  };

  return (
    <div className="admin-otp-overlay">
      <div className="admin-otp-modal">
        <h2>Admin Verification</h2>
        <p>Enter the OTP sent to your email</p>

        <form onSubmit={verifyOtp}>
          <input
            id="admin-otp-input"
            type="text"
            maxLength="6"
            className="admin-otp-input"
            value={otp}
            onChange={(e) =>
              setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            placeholder="6-digit OTP"
          />

          <button className="admin-otp-button" type="submit">
            Verify OTP
          </button>
        </form>

        <div style={{ marginTop: 10, textAlign: "center" }}>
          {!canResend ? (
            <span style={{ color: "#666" }}>
              Resend OTP in <b>{timeLeft}s</b>
            </span>
          ) : (
            <button
              onClick={resend}
              style={{
                background: "none",
                border: "none",
                color: "#0066cc",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Resend OTP
            </button>
          )}
        </div>

        <button className="admin-otp-close" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
