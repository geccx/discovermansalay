const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const nodemailer = require("nodemailer");
const { getPool } = require("../../config/db");
const { authRequired } = require("../middleware/authMiddleware");

const router = express.Router();

/* ---------------------------------------------
   CONFIG
--------------------------------------------- */
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_key";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST, // smtp-relay.brevo.com
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM_EMAIL = process.env.SMTP_FROM;

/* ---------------------------------------------
   RATE LIMITER
--------------------------------------------- */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

router.use("/login", authLimiter);
router.use("/register", authLimiter);
router.use("/admin/register", authLimiter);
router.use("/verify-otp", authLimiter);
router.use("/resend-otp", authLimiter);
router.use("/admin/resend-otp", authLimiter);
router.use("/password", authLimiter);

/* ---------------------------------------------
   HELPERS
--------------------------------------------- */
function generateOtp(len = 6) {
  return [...Array(len)].map(() => Math.floor(Math.random() * 10)).join("");
}

const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

function isStrongPassword(pwd) {
  return PASSWORD_REGEX.test(pwd);
}

async function sendEmail(to, subject, html) {
  try {
    await transporter.sendMail({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });
    console.log("📩 Email sent:", to);
  } catch (err) {
    console.error("❌ Email failed:", err.message);
  }
}

/* ============================================================
   USER REGISTRATION
============================================================ */
router.post("/register", async (req, res) => {
  const { username, email, password, firstname, lastname } = req.body;

  if (!username || !email || !password || !firstname)
    return res.status(400).json({
      message: "All fields (username, email, password, firstname) are required.",
    });

  if (!isStrongPassword(password))
    return res.status(400).json({
      message:
        "Password must be 8+ chars with uppercase, lowercase, number, special character.",
    });

  try {
    const pool = await getPool();

    const [existing] = await pool.query(
      "SELECT * FROM users WHERE email = ? OR username = ?",
      [email, username]
    );

    if (existing.length)
      return res.status(409).json({ message: "Email or Username already exists." });

    const hashed = await bcrypt.hash(password, 10);
    const otp = generateOtp();
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      `INSERT INTO users (username, email, password, firstname, lastname, role, status, is_verified, otp_code, otp_expires_at)
       VALUES (?, ?, ?, ?, ?, 'user', 'active', 0, ?, ?)`,
      [username, email, hashed, firstname, lastname || null, otp, expires]
    );

    sendEmail(
      email,
      "Your Discover Mansalay verification code",
      `<p>Hello ${firstname},</p><p>Your OTP is:</p><h2>${otp}</h2>`
    );

    res.status(201).json({
      message: "Registration successful! Check your email for your OTP.",
    });
  } catch (err) {
    console.error("Registration Error:", err);
    res.status(500).json({ message: "Internal server error." });
  }
});

/* ============================================================
   VERIFY OTP (USER)
============================================================ */
router.post("/verify-otp", async (req, res) => {
  const { emailOrUsername, otp } = req.body;

  if (!emailOrUsername || !otp)
    return res.status(400).json({ message: "Email/Username and OTP are required." });

  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      "SELECT * FROM users WHERE email = ? OR username = ?",
      [emailOrUsername, emailOrUsername]
    );

    if (!rows.length)
      return res.status(404).json({ message: "User not found." });

    const user = rows[0];

    if (!user.otp_code || !user.otp_expires_at)
      return res.status(400).json({ message: "No OTP active." });

    if (Date.now() > new Date(user.otp_expires_at))
      return res.status(400).json({ message: "OTP expired." });

    if (String(user.otp_code) !== String(otp))
      return res.status(400).json({ message: "Invalid OTP." });

    await pool.query(
      `UPDATE users SET is_verified = 1, otp_code = NULL, otp_expires_at = NULL WHERE id = ?`,
      [user.id]
    );

    res.json({ message: "Account verified!" });
  } catch (err) {
    console.error("Verify OTP Error:", err);
    res.status(500).json({ message: "Error verifying OTP." });
  }
});

/* ============================================================
   LOGIN (USER + ADMIN 2FA)
============================================================ */
router.post("/login", async (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password)
    return res.status(400).json({ message: "Email/Username and password required." });

  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      "SELECT * FROM users WHERE email = ? OR username = ?",
      [identifier, identifier]
    );

    if (!rows.length)
      return res.status(401).json({ message: "User not found." });

    const user = rows[0];

    if (!user.is_verified)
      return res.status(403).json({
        message: "Account not verified. Check your email for the OTP.",
      });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ message: "Incorrect password." });

    /* -----------------------------------------
       ADMIN / SUPERADMIN OTP
    ----------------------------------------- */
    if (user.role === "admin" || user.role === "superadmin") {
      const otp = generateOtp();
      const expires = new Date(Date.now() + 5 * 60 * 1000);

      await pool.query(
        `UPDATE users SET admin_otp_code = ?, admin_otp_expires_at = ? WHERE id = ?`,
        [otp, expires, user.id]
      );

      sendEmail(
        user.email,
        "Your Admin Login Verification Code",
        `<p>Hello ${user.firstname},</p><p>Your admin login OTP is:</p><h2>${otp}</h2>`
      );

      return res.json({
        requiresAdminOtp: true,
        userId: user.id,
        message: "Enter the OTP sent to your email.",
      });
    }

    /* -----------------------------------------
       NORMAL USER LOGIN
    ----------------------------------------- */
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
    console.error("Login Error:", err);
    res.status(500).json({ message: "Login failed." });
  }
});

/* ============================================================
   ADMIN VERIFY OTP
============================================================ */
router.post("/admin/verify-otp", async (req, res) => {
  const { userId, otp } = req.body;

  if (!userId || !otp)
    return res.status(400).json({ message: "User ID and OTP required." });

  try {
    const pool = await getPool();
    const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [
      userId,
    ]);

    if (!rows.length)
      return res.status(404).json({ message: "User not found." });

    const user = rows[0];

    if (String(user.admin_otp_code) !== String(otp))
      return res.status(400).json({ message: "Invalid OTP." });

    await pool.query(
      `UPDATE users SET admin_otp_code = NULL, admin_otp_expires_at = NULL WHERE id = ?`,
      [user.id]
    );

    const token = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Admin login successful.",
      token,
      user: {
        id: user.id,
        username: user.username,
        firstname: user.firstname,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Admin Verify OTP Error:", err);
    res.status(500).json({ message: "Error verifying admin OTP." });
  }
});

/* ============================================================
   ADMIN RESEND OTP
============================================================ */
router.post("/admin/resend-otp", async (req, res) => {
  const { userId } = req.body;

  if (!userId)
    return res.status(400).json({ message: "User ID required." });

  try {
    const pool = await getPool();
    const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [
      userId,
    ]);

    if (!rows.length)
      return res.status(404).json({ message: "User not found." });

    const user = rows[0];
    const otp = generateOtp();
    const expires = new Date(Date.now() + 5 * 60 * 1000);

    await pool.query(
      `UPDATE users SET admin_otp_code = ?, admin_otp_expires_at = ? WHERE id = ?`,
      [otp, expires, userId]
    );

    sendEmail(
      user.email,
      "Your NEW Admin Login Verification Code",
      `<p>Hello ${user.firstname},</p><p>Your new admin login OTP is:</p><h2>${otp}</h2>`
    );

    res.json({ message: "New OTP sent to your email." });
  } catch (err) {
    console.error("Admin Resend OTP Error:", err);
    res.status(500).json({ message: "Failed to resend OTP." });
  }
});

module.exports = router;
