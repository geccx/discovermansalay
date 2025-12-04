import { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";

import { FaUserCircle } from "react-icons/fa";
import { RiLockPasswordFill } from "react-icons/ri";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";

import "../styles/pages.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

// Password strength checker
function getPasswordStrength(pwd) {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[a-z]/.test(pwd)) score++;
  if (/\d/.test(pwd)) score++;
  if (/[\W_]/.test(pwd)) score++;
  return score;
}

export default function Login() {
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  // Forgot Password states
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState(1);
  const [forgotIdentifier, setForgotIdentifier] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  // Reset password field visibility
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [passwordStrength, setPasswordStrength] = useState(0);

  const navigate = useNavigate();

  const handleNewPasswordChange = (value) => {
    setForgotNewPassword(value);
    setPasswordStrength(getPasswordStrength(value));
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
  };

  // ---------------- LOGIN ----------------
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.identifier || !form.password) {
      toast.warning("Both fields are required.");
      return;
    }

    try {
      const res = await axios.post(`${API_BASE}/api/user/login`, form);

      const user = res.data.user;
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(user));

      toast.success(`Welcome, ${user.firstname || user.username}!`);

      if (user.role === "admin") navigate("/admin");
      else navigate("/");

      setTimeout(() => window.location.reload(), 300);
    } catch (err) {
      let message = "Login failed.";

      if (err.response?.status === 400) message = "Please complete all fields.";
      else if (err.response?.status === 401)
        message = err.response.data.message || "Invalid credentials.";
      else if (err.response?.status === 403)
        message = "Account not verified. Check your email.";
      else if (err.response?.status === 500)
        message = "Server error during login.";

      setError(message);
      toast.error(message);
    }
  };

  // ---------------- REQUEST OTP ----------------
  const handleForgotRequestOtp = async (e) => {
    e.preventDefault();

    if (!forgotIdentifier) {
      toast.warning("Enter your email or username.");
      return;
    }

    try {
      setForgotLoading(true);

      const res = await axios.post(`${API_BASE}/api/user/password/forgot`, {
        emailOrUsername: forgotIdentifier,
      });

      toast.success(res.data.message || "OTP sent to your email.");
      setForgotStep(2);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to send OTP.");
    } finally {
      setForgotLoading(false);
    }
  };

  // ---------------- VERIFY OTP ----------------
  const handleForgotVerifyOtp = async (e) => {
    e.preventDefault();

    if (!forgotOtp) {
      toast.warning("Enter your OTP.");
      return;
    }

    try {
      setForgotLoading(true);

      const res = await axios.post(
        `${API_BASE}/api/user/password/verify-otp`,
        {
          emailOrUsername: forgotIdentifier,
          otp: forgotOtp,
        }
      );

      toast.success(res.data.message || "OTP verified.");
      setForgotStep(3);
    } catch (err) {
      toast.error(err.response?.data?.message || "Invalid OTP.");
    } finally {
      setForgotLoading(false);
    }
  };

  // ---------------- RESET PASSWORD ----------------
  const handleForgotResetPassword = async (e) => {
    e.preventDefault();

    if (!forgotNewPassword || !forgotConfirmPassword) {
      toast.warning("Please enter both passwords.");
      return;
    }

    if (forgotNewPassword !== forgotConfirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    try {
      setForgotLoading(true);

      const res = await axios.post(`${API_BASE}/api/user/password/reset`, {
        emailOrUsername: forgotIdentifier,
        otp: forgotOtp,
        newPassword: forgotNewPassword,
      });

      toast.success("Password reset successfully.");
      closeForgotModal();
    } catch (err) {
      toast.error(err.response?.data?.message || "Reset failed.");
    } finally {
      setForgotLoading(false);
    }
  };

  // ---------------- CLOSE MODAL ----------------
  const closeForgotModal = () => {
    setShowForgotModal(false);
    setForgotStep(1);
    setForgotIdentifier("");
    setForgotOtp("");
    setForgotNewPassword("");
    setForgotConfirmPassword("");
  };

  return (
    <div className="login-form-container-unique">
      <h2 className="login-title-unique">Login</h2>

      <form onSubmit={handleSubmit}>
        {/* EMAIL/USERNAME */}
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

        {/* PASSWORD */}
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
          <span
            className="login-password-eye-unique"
            onClick={() => setShowPassword((p) => !p)}
          >
            {showPassword ? (
              <AiOutlineEyeInvisible size={20} />
            ) : (
              <AiOutlineEye size={20} />
            )}
          </span>
        </div>

        {/* FORGOT PASSWORD */}
        <div className="login-forgot-link-unique">
          <button
            type="button"
            onClick={() => setShowForgotModal(true)}
            className="login-forgot-btn-unique"
          >
            Forgot Password?
          </button>
        </div>

        <button type="submit" className="login-submit-button-unique">
          Login
        </button>

        {error && (
          <div className="login-error-message-unique">{error}</div>
        )}
      </form>

      <div className="login-register-link-unique">
        Don't have an account?{" "}
        <Link to="/register" className="login-register-anchor-unique">
          Register here
        </Link>
      </div>

      {/* ------------- FORGOT PASSWORD MODAL ------------- */}
      {showForgotModal && (
        <div className="login-modal-overlay-unique">
          <div className="login-forgot-modal-unique">
            <h3>Password Reset</h3>

            {/* STEP 1: Request OTP */}
            {forgotStep === 1 && (
              <form onSubmit={handleForgotRequestOtp}>
                <p>Enter your email or username.</p>
                <input
                  type="text"
                  className="login-input-unique"
                  placeholder="Email or Username"
                  value={forgotIdentifier}
                  onChange={(e) =>
                    setForgotIdentifier(e.target.value)
                  }
                />
                <button
                  type="submit"
                  className="login-modal-btn-unique"
                  disabled={forgotLoading}
                >
                  {forgotLoading ? "Sending..." : "Send OTP"}
                </button>
              </form>
            )}

            {/* STEP 2: OTP */}
            {forgotStep === 2 && (
              <form onSubmit={handleForgotVerifyOtp}>
                <p>Enter the OTP sent to your email.</p>
                <input
                  type="text"
                  placeholder="6-digit OTP"
                  className="login-input-unique"
                  value={forgotOtp}
                  onChange={(e) => setForgotOtp(e.target.value)}
                />
                <button
                  type="submit"
                  className="login-modal-btn-unique"
                  disabled={forgotLoading}
                >
                  {forgotLoading ? "Verifying..." : "Verify OTP"}
                </button>
              </form>
            )}

            {/* STEP 3: Reset Password */}
            {forgotStep === 3 && (
              <form onSubmit={handleForgotResetPassword}>
                <p>Create your new password.</p>

                {/* NEW PASSWORD */}
                <div className="login-input-wrapper-unique">
                  <RiLockPasswordFill className="login-input-icon-unique" />
                  <input
                    type={showNewPassword ? "text" : "password"}
                    placeholder="New Password"
                    value={forgotNewPassword}
                    onChange={(e) =>
                      handleNewPasswordChange(e.target.value)
                    }
                    className="login-input-unique login-input-with-icon-unique"
                    required
                  />
                  <span
                    className="login-password-eye-unique"
                    onClick={() =>
                      setShowNewPassword((prev) => !prev)
                    }
                  >
                    {showNewPassword ? (
                      <AiOutlineEyeInvisible size={20} />
                    ) : (
                      <AiOutlineEye size={20} />
                    )}
                  </span>
                </div>

                {/* PASSWORD CHECKLIST */}
                <div className="password-requirements-unique">
                  <div
                    className={
                      forgotNewPassword.length >= 8
                        ? "req ok"
                        : "req"
                    }
                  >
                    {forgotNewPassword.length >= 8 ? "✓" : "✗"} Minimum 8
                    characters
                  </div>

                  <div
                    className={
                      /[A-Z]/.test(forgotNewPassword)
                        ? "req ok"
                        : "req"
                    }
                  >
                    {/[A-Z]/.test(forgotNewPassword) ? "✓" : "✗"} 1
                    Uppercase letter
                  </div>

                  <div
                    className={
                      /[a-z]/.test(forgotNewPassword)
                        ? "req ok"
                        : "req"
                    }
                  >
                    {/[a-z]/.test(forgotNewPassword) ? "✓" : "✗"} 1
                    Lowercase letter
                  </div>

                  <div
                    className={
                      /\d/.test(forgotNewPassword) ? "req ok" : "req"
                    }
                  >
                    {/\d/.test(forgotNewPassword) ? "✓" : "✗"} 1 Number
                  </div>

                  <div
                    className={
                      /[\W_]/.test(forgotNewPassword)
                        ? "req ok"
                        : "req"
                    }
                  >
                    {/[\W_]/.test(forgotNewPassword) ? "✓" : "✗"} 1 Special
                    character
                  </div>
                </div>

                {/* STRENGTH METER */}
                <div className="strength-meter-unique">
                  <div
                    className={`strength-bar strength-${passwordStrength}`}
                    style={{ width: `${passwordStrength * 20}%` }}
                  ></div>
                </div>

                <div className="strength-label-unique">
                  {passwordStrength === 0 && "Too weak"}
                  {passwordStrength === 1 && "Weak"}
                  {passwordStrength === 2 && "Fair"}
                  {passwordStrength === 3 && "Good"}
                  {passwordStrength === 4 && "Strong"}
                  {passwordStrength === 5 && "Very Strong"}
                </div>

                {/* CONFIRM PASSWORD */}
                <div className="login-input-wrapper-unique">
                  <RiLockPasswordFill className="login-input-icon-unique" />
                  <input
                    type={
                      showConfirmPassword ? "text" : "password"
                    }
                    placeholder="Confirm New Password"
                    value={forgotConfirmPassword}
                    onChange={(e) =>
                      setForgotConfirmPassword(e.target.value)
                    }
                    className="login-input-unique login-input-with-icon-unique"
                    required
                  />
                  <span
                    className="login-password-eye-unique"
                    onClick={() =>
                      setShowConfirmPassword((p) => !p)
                    }
                  >
                    {showConfirmPassword ? (
                      <AiOutlineEyeInvisible size={20} />
                    ) : (
                      <AiOutlineEye size={20} />
                    )}
                  </span>
                </div>

                <button
                  type="submit"
                  className="login-modal-btn-unique"
                  disabled={forgotLoading}
                >
                  {forgotLoading ? "Saving..." : "Reset Password"}
                </button>
              </form>
            )}

            <button
              className="login-modal-close-btn-unique"
              onClick={closeForgotModal}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
