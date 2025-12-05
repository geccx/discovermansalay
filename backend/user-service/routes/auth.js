const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const nodemailer = require("nodemailer");
const { getPool } = require("../../config/db");
const { authRequired } = require("../middleware/authMiddleware");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_key";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

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
router.use("/admin/register", authLimiter);
router.use("/verify-otp", authLimiter);
router.use("/resend-otp", authLimiter);
router.use("/password", authLimiter);

// --------------------------
// NODEMAILER
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
// EMAIL HELPERS
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

async function sendAdminInviteEmail(to, inviteLink) {
  const mailOptions = {
    from: FROM_EMAIL,
    to,
    subject: `Discover Mansalay Admin Invitation`,
    html: `
      <p>Hello,</p>
      <p>You have been invited to become an <b>Admin</b> on Discover Mansalay.</p>
      <p>Click the link below to complete your registration:</p>
      <p>
        <a href="${inviteLink}" style="font-size:16px; font-weight:bold;">
          Complete Admin Registration
        </a>
      </p>
      <p>This link expires in 24 hours.</p>
      <br/>
      <p>Discover Mansalay System</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("📩 Admin invitation sent:", to);
  } catch (err) {
    console.error("❌ Admin invite email failed:", err.message);
  }
}

// --------------------------
// REGISTER (normal user)
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
      INSERT INTO users (username, email, password, firstname, lastname, role, status, is_verified, otp_code, otp_expires_at)
      VALUES (?, ?, ?, ?, ?, 'user', 'active', 0, ?, ?)
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
    });
  }
});

// --------------------------
// VERIFY OTP (user or admin email otp_code)
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

    // 🔑 FIX: compare as strings
    if (String(user.otp_code) !== String(otp))
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
// ADMIN LOGIN 2FA VERIFY (admin_otp_code)
// --------------------------
router.post("/admin/verify-otp", async (req, res) => {
  const { userId, otp } = req.body;

  if (!userId || !otp)
    return res.status(400).json({ message: "User ID and OTP required." });

  try {
    const pool = await getPool();
    const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [userId]);

    if (rows.length === 0)
      return res.status(404).json({ message: "User not found." });

    const user = rows[0];

    if (!user.admin_otp_code || !user.admin_otp_expires_at)
      return res.status(400).json({ message: "No active admin OTP." });

    if (Date.now() > new Date(user.admin_otp_expires_at))
      return res.status(400).json({ message: "OTP expired." });

    // 🔑 FIX: compare as strings
    if (String(user.admin_otp_code) !== String(otp))
      return res.status(400).json({ message: "Invalid OTP." });

    // Clear admin OTP
    await pool.query(
      `UPDATE users SET admin_otp_code = NULL, admin_otp_expires_at = NULL WHERE id = ?`,
      [userId]
    );

    // Generate admin session token
    const token = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Admin verification successful.",
      token,
      user: {
        id: user.id,
        username: user.username,
        firstname: user.firstname,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Admin OTP Verify Error:", err.message);
    res.status(500).json({ message: "Error verifying admin OTP." });
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
// LOGIN (user + admin 2FA)
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

    if (!user.password) {
      return res.status(400).json({
        message:
          "Your account does not have a password set yet. Please complete registration.",
      });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ message: "Incorrect password." });

    // Admin / Superadmin: 2FA with admin OTP
    if (user.role === "admin" || user.role === "superadmin") {
      const otp = generateOtp();
      const expires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      await pool.query(
        `UPDATE users SET admin_otp_code = ?, admin_otp_expires_at = ? WHERE id = ?`,
        [otp, expires, user.id]
      );

      // Send Admin OTP email
      await transporter.sendMail({
        from: FROM_EMAIL,
        to: user.email,
        subject: "Your Admin Login Verification Code",
        html: `
          <p>Hello ${user.firstname || ""},</p>
          <p>Your admin login verification code is:</p>
          <h2>${otp}</h2>
          <p>This code expires in 5 minutes.</p>
        `,
      });

      return res.json({
        requiresAdminOtp: true,
        message: "Enter the OTP sent to your email.",
        userId: user.id,
        email: user.email,
      });
    }

    // Normal user login
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

    // 🔑 FIX: compare as strings
    if (String(user.reset_otp_code) !== String(otp))
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

    // 🔑 FIX: compare as strings
    if (String(user.reset_otp_code) !== String(otp))
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
// INVITE ADMIN (superadmin only)
// --------------------------
router.post("/admin/invite", authRequired, async (req, res) => {
  try {
    if (req.user.role !== "superadmin") {
      return res.status(403).json({ message: "Only superadmins can invite admins." });
    }

    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required." });

    const pool = await getPool();

    // Check if email already used
    const [exists] = await pool.query("SELECT id FROM users WHERE email = ?", [email]);
    if (exists.length > 0) {
      return res.status(400).json({ message: "Email is already registered." });
    }

    const inviteToken = jwt.sign({ email }, JWT_SECRET, { expiresIn: "24h" });
    const inviteExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const [insert] = await pool.query(
      `
        INSERT INTO users (email, role, status, is_verified, is_approved, invited, invite_token, invite_expires_at)
        VALUES (?, 'admin', 'pending', 0, 0, 1, ?, ?)
      `,
      [email, inviteToken, inviteExpires]
    );

    const inviteLink = `${FRONTEND_URL}/admin-register?token=${inviteToken}`;

    await sendAdminInviteEmail(email, inviteLink);

    res.json({
      message: "Admin invitation sent.",
      inviteLink,
      userId: insert.insertId,
    });
  } catch (err) {
    console.error("Invite Admin Error:", err);
    res.status(500).json({ message: "Error sending admin invite." });
  }
});

// --------------------------
// ADMIN REGISTRATION FROM INVITE LINK
// --------------------------
router.post("/admin/register", async (req, res) => {
  const { token, username, password, firstname, lastname } = req.body;

  if (!token || !username || !password || !firstname) {
    return res.status(400).json({
      message: "Token, username, password, and firstname are required.",
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

    // Decode token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(400).json({ message: "Invalid or expired invitation token." });
    }

    const email = decoded.email;

    // Find invited admin row
    const [rows] = await pool.query(
      "SELECT * FROM users WHERE email = ? AND invited = 1 AND invite_token = ?",
      [email, token]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Invitation not found or already used." });
    }

    const invitedUser = rows[0];

    // Check username uniqueness
    const [uConflict] = await pool.query(
      "SELECT id FROM users WHERE username = ? AND id <> ?",
      [username, invitedUser.id]
    );
    if (uConflict.length > 0) {
      return res.status(400).json({ message: "Username already taken." });
    }

    const hashed = await bcrypt.hash(password, 10);
    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      `
        UPDATE users SET 
          username = ?, password = ?, firstname = ?, lastname = ?,
          otp_code = ?, otp_expires_at = ?, invited = 0
        WHERE id = ?
      `,
      [username, hashed, firstname, lastname || null, otp, otpExpires, invitedUser.id]
    );

    await sendWelcomeOtpEmail(email, firstname, otp);

    res.json({
      message: "Admin registration complete. Check your email for verification OTP.",
      userId: invitedUser.id,
    });
  } catch (err) {
    console.error("Admin Register Error:", err);
    res.status(500).json({ message: "Admin registration failed." });
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
