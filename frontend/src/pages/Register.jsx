import { useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

// icons
import { FaUser, FaUserTag, FaUserCircle, FaInfoCircle } from "react-icons/fa";
import { MdEmail } from "react-icons/md";
import { RiLockPasswordFill } from "react-icons/ri";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";

import "../styles/pages.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

export default function Register() {
  const [form, setForm] = useState({
    firstname: "",
    lastname: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [showTermsModal, setShowTermsModal] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const navigate = useNavigate();

  // password rules
  const checks = {
    length: form.password.length >= 8,
    upper: /[A-Z]/.test(form.password),
    lower: /[a-z]/.test(form.password),
    number: /\d/.test(form.password),
    special: /[\W_]/.test(form.password),
  };

  const passwordValid =
    checks.length &&
    checks.upper &&
    checks.lower &&
    checks.number &&
    checks.special;

  // password strength meter
  const strengthLevel = Object.values(checks).filter(Boolean).length;
  const strengthText =
    strengthLevel <= 2
      ? "Weak"
      : strengthLevel === 3
      ? "Medium"
      : strengthLevel === 4
      ? "Strong"
      : "Very Strong";

  const strengthColor =
    strengthLevel <= 2
      ? "red"
      : strengthLevel === 3
      ? "orange"
      : strengthLevel === 4
      ? "#2ecc71"
      : "#00c853";

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!passwordValid) {
      toast.error("Your password does not meet the minimum requirements.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    if (!acceptedTerms) {
      toast.error("Please accept the Terms & Conditions.");
      return;
    }

    try {
      const res = await axios.post(`${API_BASE}/api/user/register`, form);
      toast.success(res.data.message);

      navigate("/verify-otp", {
        state: { emailOrUsername: form.email || form.username },
      });
    } catch (err) {
      toast.error(err.response?.data?.message || "Registration failed.");
    }
  };

  return (
    <div className="reg-container">
      <h2 className="reg-title" style={{ marginTop: "20px" }}>
        Create Your Account
      </h2>

      <form onSubmit={handleSubmit}>
        {/* First Name */}
        <div className="input-icon-wrapper">
          <FaUser className="input-icon" />
          <input
            type="text"
            name="firstname"
            placeholder="First Name"
            value={form.firstname}
            onChange={handleChange}
            className="reg-input with-icon"
            required
          />
        </div>

        {/* Last Name */}
        <div className="input-icon-wrapper">
          <FaUserTag className="input-icon" />
          <input
            type="text"
            name="lastname"
            placeholder="Last Name"
            value={form.lastname}
            onChange={handleChange}
            className="reg-input with-icon"
            required
          />
        </div>

        {/* Username */}
        <div className="input-icon-wrapper">
          <FaUserCircle className="input-icon" />
          <input
            type="text"
            name="username"
            placeholder="Username"
            value={form.username}
            onChange={handleChange}
            className="reg-input with-icon"
            required
          />
        </div>

        {/* Email */}
        <div className="input-icon-wrapper">
          <MdEmail className="input-icon" />
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
            className="reg-input with-icon"
            required
          />
        </div>

        {/* Password */}
        <div className="input-icon-wrapper">
          <RiLockPasswordFill className="input-icon" />

          <input
            type={showPassword ? "text" : "password"}
            name="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            className="reg-input with-icon"
            required
          />

          {/* Eye Icon */}
          <span
            onClick={() => setShowPassword(!showPassword)}
            className="reg-password-eye"
          >
            {showPassword ? <AiOutlineEyeInvisible size={22} /> : <AiOutlineEye size={22} />}
          </span>

          {/* Tooltip */}
          <FaInfoCircle
            className="reg-tooltip-icon"
            title="Your password must include uppercase, lowercase, number, and special character."
          />
        </div>

        {/* Password Strength */}
        {form.password.length > 0 && (
          <div
            style={{
              color: strengthColor,
              fontWeight: "bold",
              marginTop: "5px",
              transition: "0.3s ease",
            }}
          >
            Strength: {strengthText}
          </div>
        )}

        {/* Password Rules */}
        {form.password.length > 0 && !passwordValid && (
          <div className="password-rules">
            <div className={checks.length ? "rule-valid" : "rule-invalid"}>• At least 8 characters</div>
            <div className={checks.upper ? "rule-valid" : "rule-invalid"}>• One uppercase letter</div>
            <div className={checks.lower ? "rule-valid" : "rule-invalid"}>• One lowercase letter</div>
            <div className={checks.number ? "rule-valid" : "rule-invalid"}>• One number</div>
            <div className={checks.special ? "rule-valid" : "rule-invalid"}>• One special character</div>
          </div>
        )}

        {/* Confirm Password */}
        <div className="input-icon-wrapper">
          <RiLockPasswordFill className="input-icon" />
          <input
            type={showConfirmPassword ? "text" : "password"}
            name="confirmPassword"
            placeholder="Confirm Password"
            value={form.confirmPassword}
            onChange={handleChange}
            className="reg-input with-icon"
            required
          />
          <span
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="reg-password-eye"
          >
            {showConfirmPassword ? <AiOutlineEyeInvisible size={22} /> : <AiOutlineEye size={22} />}
          </span>
        </div>

        {/* Terms Checkbox */}
        <div style={{ marginTop: "15px", marginBottom: "5px" }}>
          <label style={{ fontSize: "14px" }}>
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
            />
            I agree to the{" "}
            <span
              onClick={() => setShowTermsModal(true)}
              style={{ color: "#3498db", cursor: "pointer" }}
            >
              Terms & Conditions
            </span>
          </label>
        </div>

        <button
          type="submit"
          className="reg-submit-btn"
          disabled={!acceptedTerms}
        >
          Register
        </button>
      </form>

      {/* Terms Modal */}
      {showTermsModal && (
        <div className="reg-modal-overlay">
          <div className="reg-terms-modal">
            <h2>Terms & Conditions</h2>

            <p>
              Welcome to Discover Mansalay. By creating an account or using this platform,
              you agree to the Terms & Conditions below.
            </p>

            <h3>1. Accuracy of Information</h3>
            <p>
              You agree to provide complete, accurate, and up-to-date information.
              False information may result in account termination.
            </p>

            <h3>2. Use of Personal Information</h3>
            <p>
              Your data will be used only for account management, verification, system
              improvement, and security purposes.
            </p>

            <p>
              Your information will <strong>not</strong> be sold or shared unless required by law.
            </p>

            <h3>3. User Responsibilities</h3>
            <ul>
              <li>Keep your login credentials secure.</li>
              <li>You are responsible for everything done under your account.</li>
              <li>No creating multiple or fraudulent accounts.</li>
              <li>No misuse, harmful actions, or unauthorized activities.</li>
            </ul>

            <h3>4. Platform Usage</h3>
            <p>
              Discover Mansalay exists to serve tourism, information, and community needs.
              Any form of manipulation or misuse is prohibited.
            </p>

            <h3>5. Privacy & Security</h3>
            <p>
              We protect your data but acknowledge no system is 100% secure. By using the
              platform, you accept these inherent risks.
            </p>

            <h3>6. Account Suspension</h3>
            <p>We may suspend accounts that violate platform rules.</p>

            <h3>7. Ownership</h3>
            <p>
              All platform content is owned by Discover Mansalay. Unauthorized copying is prohibited.
            </p>

            <h3>8. Updates</h3>
            <p>
              Terms may change anytime. Continued use means acceptance of updated terms.
            </p>

            <div style={{ marginTop: "20px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                />
                <span>I have read and accept the Terms & Conditions.</span>
              </label>
            </div>

            <button
              className="reg-close-modal-btn"
              onClick={() => setShowTermsModal(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      <div className="register-link">
        Already have an account? <a href="/login">Login here</a>
      </div>
    </div>
  );
}
