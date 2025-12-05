import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";

import { FaUserCircle } from "react-icons/fa";
import { RiLockPasswordFill } from "react-icons/ri";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";

import AdminOtpModal from "../components/AdminOtpModal";
import "../styles/pages.css";
import "../styles/usermanagement.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export default function Login() {
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const [showAdminOtp, setShowAdminOtp] = useState(false);
  const [adminOtpUserId, setAdminOtpUserId] = useState(null);

  const navigate = useNavigate();

  /* ------------------------------------------------
     AUTO-REDIRECT IF ALREADY LOGGED IN
  ------------------------------------------------ */
  useEffect(() => {
    try {
      const token = localStorage.getItem("token");
      const storedUser = JSON.parse(localStorage.getItem("user") || "{}");

      const skip = sessionStorage.getItem("skipRedirectOnce");
      if (skip) return;

      if (token && storedUser.role) {
        if (!sessionStorage.getItem("loginToastShown")) {
          toast.info("You are already logged in.");
          sessionStorage.setItem("loginToastShown", "true");
        }

        if (storedUser.role === "admin" || storedUser.role === "superadmin") {
          navigate("/admin/dashboard", { replace: true });
        } else {
          navigate("/", { replace: true });
        }
      }
    } catch {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
  }, [navigate]);

  /* ------------------------------------------------
     INPUT HANDLER
  ------------------------------------------------ */
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
  };

  /* ------------------------------------------------
     SUBMIT LOGIN
  ------------------------------------------------ */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.identifier || !form.password) {
      return toast.warning("Both fields are required.");
    }

    try {
      const res = await axios.post(`${API_BASE}/api/user/login`, form);

      /* ────────────────  ADMIN 2FA REQUIRED  ──────────────── */
      if (res.data.requiresAdminOtp) {
        setAdminOtpUserId(res.data.userId);
        setShowAdminOtp(true);
        toast.info("Enter the OTP sent to your admin email.");
        return;
      }

      /* ────────────────  NORMAL USER LOGIN  ──────────────── */
      const user = res.data.user;

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(user));

      toast.success(`Welcome, ${user.firstname || user.username}!`);

      if (user.role === "admin" || user.role === "superadmin") {
        navigate("/admin/dashboard", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    } catch (err) {
      const message =
        err.response?.data?.message || "Login failed. Please try again.";

      setError(message);
      toast.error(message);
    }
  };

  return (
    <div className="login-form-container-unique">
      <h2 className="login-title-unique">Login</h2>

      <form onSubmit={handleSubmit}>
        {/* Email / Username */}
        <div className="login-input-wrapper-unique">
          <FaUserCircle className="login-input-icon-unique" />
          <input
            type="text"
            name="identifier"
            placeholder="Email or Username"
            value={form.identifier}
            onChange={handleChange}
            className="login-input-unique login-input-with-icon-unique"
          />
        </div>

        {/* Password */}
        <div className="login-input-wrapper-unique">
          <RiLockPasswordFill className="login-input-icon-unique" />
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            className="login-input-unique login-input-with-icon-unique"
          />

          {/* Eye Icon */}
          <span
            className="login-password-eye-unique"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? (
              <AiOutlineEyeInvisible size={20} />
            ) : (
              <AiOutlineEye size={20} />
            )}
          </span>
        </div>

        {/* Submit Button */}
        <button type="submit" className="login-submit-button-unique">
          Login
        </button>

        {/* Error Message */}
        {error && <div className="login-error-message-unique">{error}</div>}
      </form>

      {/* Register Link */}
      <div className="login-register-link-unique">
        Don’t have an account?{" "}
        <Link to="/register" className="login-register-anchor-unique">
          Register here
        </Link>
      </div>

      {/* ADMIN OTP MODAL */}
      {showAdminOtp && (
        <AdminOtpModal
          userId={adminOtpUserId}
          onClose={() => setShowAdminOtp(false)}
        />
      )}
    </div>
  );
}
