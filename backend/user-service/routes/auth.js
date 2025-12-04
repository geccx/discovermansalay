const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const nodemailer = require("nodemailer");
const { getPool } = require("../../config/db");
const { authRequired } = require("../middleware/authMiddleware");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_key";

// --------------------------
// RATE LIMITER
// --------------------------
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

router.use("/login", authLimiter);
router.use("/register", authLimiter);
router.use("/verify-otp", authLimiter);
router.use("/resend-otp", authLimiter);
router.use("/password", authLimiter);

// --------------------------
// NODEMAILER — FIXED FOR INBOX DELIVERY
// --------------------------
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Unified Sender Name — Helps Gmail Trust the Email
const FROM_EMAIL = `"Discover Mansalay" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`;

// --------------------------
// HELPERS
// --------------------------
const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

function isStrongPassword(pwd) {
  return PASSWORD_REGEX.test(pwd);
}

function generateOtp(len = 6) {
  return [...Array(len)].map(() => Math.floor(Math.random() * 10)).join("");
}

// --------------------------
//  INBOX-SAFE EMAIL TEMPLATES
// --------------------------
async function sendWelcomeOtpEmail(to, firstname, otp) {
  const mailOptions = {
    from: FROM_EMAIL,
    to,
    subject: `Your Discover Mansalay verification code`,
    html: `
      <p>Hello ${firstname || ""},</p>

      <p>Your verification code for your Discover Mansalay account is:</p>

      <h2>${otp}</h2>

      <p>This code expires in 10 minutes.</p>

      <p>If you did not request this code, please ignore this email.</p>

      <br/>
      <p>Discover Mansalay Verification System</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("📩 Registration OTP sent:", to);
  } catch (err) {
    console.error("❌ Registration email failed:", err.message);
  }
}

async function sendPasswordResetEmail(to, firstname, otp) {
  const mailOptions = {
    from: FROM_EMAIL,
    to,
    subject: `Your Discover Mansalay password reset code`,
    html: `
      <p>Hello ${firstname || ""},</p>

      <p>Your password reset code is:</p>

      <h2>${otp}</h2>

      <p>This code expires in 10 minutes.</p>

      <p>If you did not request this, you can safely ignore this email.</p>

      <br/>
      <p>Discover Mansalay Verification System</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("📩 Reset-password OTP sent:", to);
  } catch (err) {
    console.error("❌ Reset email failed:", err.message);
  }
}

// --------------------------
// REGISTER
// --------------------------
router.post("/register", async (req, res) => {
  const { username, email, password, firstname, lastname } = req.body;

  if (!username || !email || !password || !firstname) {
    return res.status(400).json({
      message:
        "All fields (username, email, password, firstname) are required.",
    });
  }

  if (!isStrongPassword(password)) {
    return res.status(400).json({
      message:
        "Password must be at least 8 characters with uppercase, lowercase, number, and special character.",
    });
  }

  try {
    const pool = await getPool();

    // Check if exists
    const [existing] = await pool.query(
      "SELECT * FROM users WHERE email = ? OR username = ?",
      [email, username]
    );

    if (existing.length > 0) {
      const u = existing[0];
      if (u.email === email && u.username === username) {
        return res.status(409).json({
          message: "Email and Username both already exist.",
        });
      }
      if (u.email === email) {
        return res.status(409).json({ message: "Email already in use." });
      }
      return res.status(409).json({ message: "Username already taken." });
    }

    const hashed = await bcrypt.hash(password, 10);
    const otp = generateOtp();
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      `
      INSERT INTO users (username, email, password, firstname, lastname, role, is_verified, otp_code, otp_expires_at)
      VALUES (?, ?, ?, ?, ?, 'user', 0, ?, ?)
    `,
      [username, email, hashed, firstname, lastname || null, otp, expires]
    );

    await sendWelcomeOtpEmail(email, firstname, otp);

    res.status(201).json({
      message:
        "Registration successful! Check your email for your verification code.",
    });
  } catch (err) {
    console.error("Registration Error:", err);
    res.status(500).json({
      message: "Internal server error during registration.",
      error: err.message,
    });
  }
});

// --------------------------
// VERIFY OTP
// --------------------------
router.post("/verify-otp", async (req, res) => {
  const { emailOrUsername, otp } = req.body;

  if (!emailOrUsername || !otp)
    return res
      .status(400)
      .json({ message: "Email/Username and OTP are required." });

  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      "SELECT * FROM users WHERE email = ? OR username = ?",
      [emailOrUsername, emailOrUsername]
    );

    if (rows.length === 0)
      return res.status(404).json({ message: "User not found." });

    const user = rows[0];

    if (user.is_verified)
      return res.status(400).json({ message: "Account already verified." });

    if (!user.otp_code || !user.otp_expires_at)
      return res.status(400).json({ message: "No OTP active." });

    if (Date.now() > new Date(user.otp_expires_at))
      return res.status(400).json({ message: "OTP expired." });

    if (user.otp_code !== otp)
      return res.status(400).json({ message: "Invalid OTP." });

    await pool.query(
      `UPDATE users SET is_verified = 1, otp_code = NULL, otp_expires_at = NULL WHERE id = ?`,
      [user.id]
    );

    res.json({ message: "Account verified successfully!" });
  } catch (err) {
    console.error("Verify OTP Error:", err.message);
    res.status(500).json({ message: "Error verifying OTP." });
  }
});

// --------------------------
// RESEND OTP
// --------------------------
router.post("/resend-otp", async (req, res) => {
  const { emailOrUsername } = req.body;

  if (!emailOrUsername)
    return res.status(400).json({ message: "Email/Username is required." });

  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      "SELECT * FROM users WHERE email = ? OR username = ?",
      [emailOrUsername, emailOrUsername]
    );

    if (rows.length === 0)
      return res.status(404).json({ message: "User not found." });

    const user = rows[0];

    if (user.is_verified)
      return res.status(400).json({ message: "Account already verified." });

    const otp = generateOtp();
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      `UPDATE users SET otp_code = ?, otp_expires_at = ? WHERE id = ?`,
      [otp, expires, user.id]
    );

    await sendWelcomeOtpEmail(user.email, user.firstname, otp);

    res.json({ message: "New verification code sent." });
  } catch (err) {
    console.error("Resend OTP Error:", err.message);
    res.status(500).json({ message: "Error resending OTP." });
  }
});

// --------------------------
// LOGIN
// --------------------------
router.post("/login", async (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password)
    return res
      .status(400)
      .json({ message: "Email/Username and password required." });

  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      "SELECT * FROM users WHERE email = ? OR username = ?",
      [identifier, identifier]
    );

    if (rows.length === 0)
      return res.status(401).json({ message: "User not found." });

    const user = rows[0];

    if (!user.is_verified)
      return res.status(403).json({
        message: "Account not verified. Please check your email for the code.",
      });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ message: "Incorrect password." });

    const token = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        firstname: user.firstname,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Login Error:", err.message);
    res.status(500).json({ message: "Login failed." });
  }
});

// --------------------------
// PASSWORD RESET — REQUEST OTP
// --------------------------
router.post("/password/forgot", async (req, res) => {
  const { emailOrUsername } = req.body;

  if (!emailOrUsername)
    return res.status(400).json({ message: "Email/Username required." });

  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      "SELECT * FROM users WHERE email = ? OR username = ?",
      [emailOrUsername, emailOrUsername]
    );

    if (rows.length === 0)
      return res.status(404).json({ message: "User not found." });

    const user = rows[0];

    if (!user.is_verified)
      return res.status(403).json({
        message:
          "Account not verified. Please verify before resetting password.",
      });

    const otp = generateOtp();
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      `UPDATE users SET reset_otp_code = ?, reset_otp_expires_at = ? WHERE id = ?`,
      [otp, expires, user.id]
    );

    await sendPasswordResetEmail(user.email, user.firstname, otp);

    res.json({
      message: "Password reset code sent to your email.",
    });
  } catch (err) {
    console.error("Forgot Password Error:", err.message);
    res.status(500).json({ message: "Error requesting reset." });
  }
});

// --------------------------
// PASSWORD RESET — VERIFY OTP
// --------------------------
router.post("/password/verify-otp", async (req, res) => {
  const { emailOrUsername, otp } = req.body;

  if (!emailOrUsername || !otp)
    return res
      .status(400)
      .json({ message: "Email/Username and OTP required." });

  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      "SELECT * FROM users WHERE email = ? OR username = ?",
      [emailOrUsername, emailOrUsername]
    );

    if (rows.length === 0)
      return res.status(404).json({ message: "User not found." });

    const user = rows[0];

    if (!user.reset_otp_code || !user.reset_otp_expires_at)
      return res.status(400).json({ message: "No active reset OTP." });

    if (Date.now() > new Date(user.reset_otp_expires_at))
      return res.status(400).json({ message: "OTP expired." });

    if (user.reset_otp_code !== otp)
      return res.status(400).json({ message: "Invalid OTP." });

    res.json({ message: "OTP is valid. You may now reset your password." });
  } catch (err) {
    console.error("Verify reset OTP Error:", err.message);
    res.status(500).json({ message: "Error verifying OTP." });
  }
});

// --------------------------
// PASSWORD RESET — SET NEW PASSWORD
// --------------------------
router.post("/password/reset", async (req, res) => {
  const { emailOrUsername, otp, newPassword } = req.body;

  if (!emailOrUsername || !otp || !newPassword)
    return res.status(400).json({
      message: "Email/Username, OTP, and new password required.",
    });

  if (!isStrongPassword(newPassword))
    return res.status(400).json({
      message:
        "New password must be 8+ chars with uppercase, lowercase, number, and special char.",
    });

  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      "SELECT * FROM users WHERE email = ? OR username = ?",
      [emailOrUsername, emailOrUsername]
    );

    if (rows.length === 0)
      return res.status(404).json({ message: "User not found." });

    const user = rows[0];

    if (!user.reset_otp_code || !user.reset_otp_expires_at)
      return res.status(400).json({ message: "No active reset OTP." });

    if (Date.now() > new Date(user.reset_otp_expires_at))
      return res.status(400).json({ message: "OTP expired." });

    if (user.reset_otp_code !== otp)
      return res.status(400).json({ message: "Invalid OTP." });

    const hashed = await bcrypt.hash(newPassword, 10);

    await pool.query(
      `UPDATE users SET password = ?, reset_otp_code = NULL, reset_otp_expires_at = NULL WHERE id = ?`,
      [hashed, user.id]
    );

    res.json({ message: "Password reset successful." });
  } catch (err) {
    console.error("Reset password error:", err.message);
    res.status(500).json({ message: "Error resetting password." });
  }
});

// --------------------------
// GET USER INFO FROM TOKEN
// --------------------------
router.get("/me", authRequired, async (req, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      "SELECT id, username, firstname, email, role FROM users WHERE id = ?",
      [req.user.id]
    );

    if (rows.length === 0)
      return res.status(404).json({ message: "User not found." });

    res.json({ user: rows[0] });
  } catch (err) {
    console.error("/me error:", err.message);
    res.status(500).json({ message: "Failed to fetch user" });
  }
});

// --------------------------
// LOGOUT
// --------------------------
router.post("/logout", authRequired, (req, res) => {
  res.json({
    message: "Logged out. Remove the token from the client to complete logout.",
  });
});

module.exports = router;
