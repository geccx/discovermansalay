const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");

const { getPool } = require("../../config/db");
const { authRequired } = require("../../user-service/middleware/authMiddleware");

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_key";

// ----------------------------------------------------
// Upload folders
// ----------------------------------------------------
const uploadFolder = path.join(__dirname, "../../uploads");
const adminsProfileFolder = path.join(uploadFolder, "admins-profile");

if (!fs.existsSync(uploadFolder)) fs.mkdirSync(uploadFolder, { recursive: true });
if (!fs.existsSync(adminsProfileFolder)) fs.mkdirSync(adminsProfileFolder, { recursive: true });

// ----------------------------------------------------
// Multer storage
// ----------------------------------------------------
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, adminsProfileFolder),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = req.body.username || "admin";
    cb(null, `${name}-${Date.now()}${ext}`);
  },
});
const upload = multer({ storage });

// ----------------------------------------------------
// Email Transporter
// ----------------------------------------------------
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

function generateOtp(n = 6) {
  return [...Array(n)].map(() => Math.floor(Math.random() * 10)).join("");
}

async function sendInviteLink(email, token) {
  const baseUrl = process.env.CLIENT_URL || "http://localhost:5173";
  const link = `${baseUrl}/admin/register?token=${token}`;

  const mailOptions = {
    from: `"Discover Mansalay" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to: email,
    subject: "Admin Invitation - Discover Mansalay",
    html: `
      <p>Hello,</p>
      <p>You have been invited to become an Admin of Discover Mansalay.</p>
      <p>Click the link below to complete your registration:</p>
      <p><a href="${link}" style="font-size: 16px;">Complete Admin Registration</a></p>
      <p>This link will expire in <strong>24 hours</strong>.</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("📧 Sent admin invite link to:", email);
  } catch (err) {
    console.error("❌ Invite email failed:", err.message);
  }
}

async function sendAdminOtpEmail(email, name, otp) {
  const mailOptions = {
    from: `"Discover Mansalay" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to: email,
    subject: "Your Admin Verification Code",
    html: `
      <p>Hello ${name || ""},</p>
      <p>Use the code below to verify your admin account:</p>
      <h2>${otp}</h2>
      <p>This code will expire in 10 minutes.</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("📧 Sent admin OTP to:", email);
  } catch (err) {
    console.error("❌ OTP email failed:", err.message);
  }
}

// Helpers
function deleteFileIfExists(filePath) {
  if (!filePath) return;
  const full = path.join(__dirname, "../../", filePath);
  if (fs.existsSync(full)) fs.unlinkSync(full);
}

function normalizeImagePath(user) {
  if (user?.profile_image) {
    user.profile_image = user.profile_image.replace(/\\/g, "/");
  }
  return user;
}

/* ---------------------------------------------------
   PUBLIC ROUTES (NO AUTH)
--------------------------------------------------- */

// Validate invitation token
// GET /api/admin/invite/validate?token=...
router.get("/invite/validate", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ message: "Token is required" });

    const pool = await getPool();
    const [rows] = await pool.query(
      `
      SELECT id, email, status, invite_expires_at
      FROM users
      WHERE invite_token = ? AND role = 'admin'
      `,
      [token]
    );

    if (rows.length === 0) {
      return res.status(400).json({ message: "Invalid or used invitation link." });
    }

    const invite = rows[0];

    if (invite.invite_expires_at && new Date(invite.invite_expires_at) < new Date()) {
      return res.status(400).json({ message: "Invitation link has expired." });
    }

    if (invite.status !== "invited") {
      return res.status(400).json({ message: "Invitation is no longer valid." });
    }

    return res.json({
      id: invite.id,
      email: invite.email,
      message: "Invite token valid.",
    });
  } catch (err) {
    console.error("❌ INVITE VALIDATE ERROR:", err);
    res.status(500).json({ message: "Failed to validate invitation" });
  }
});

// Complete registration from invite
// POST /api/admin/register-from-invite
// body: { token, username, firstname, lastname, password, contact_number, address }
router.post("/register-from-invite", async (req, res) => {
  try {
    const { token, username, firstname, lastname, password, contact_number, address } =
      req.body;

    if (!token || !username || !firstname || !lastname || !password) {
      return res.status(400).json({ message: "All required fields must be filled." });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    }

    const pool = await getPool();

    // Validate invite token
    const [rows] = await pool.query(
      `
      SELECT id, email, status, invite_expires_at
      FROM users
      WHERE invite_token = ? AND role = 'admin'
      `,
      [token]
    );

    if (rows.length === 0) {
      return res.status(400).json({ message: "Invalid or used invitation link." });
    }

    const user = rows[0];

    if (user.invite_expires_at && new Date(user.invite_expires_at) < new Date()) {
      return res.status(400).json({ message: "Invitation link has expired." });
    }

    if (user.status !== "invited") {
      return res.status(400).json({ message: "This invitation is no longer valid." });
    }

    // Ensure username is unique
    const [conflict] = await pool.query(
      "SELECT id FROM users WHERE username = ? AND id <> ?",
      [username, user.id]
    );
    if (conflict.length > 0) {
      return res.status(400).json({ message: "Username is already taken." });
    }

    const hashed = await bcrypt.hash(password, 10);
    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      `
      UPDATE users SET
        username = ?, firstname = ?, lastname = ?,
        password = ?, contact_number = ?, address = ?,
        status = 'pending', otp_code = ?, otp_expires_at = ?, 
        verification_method = 'email'
      WHERE id = ?
      `,
      [
        username,
        firstname,
        lastname,
        hashed,
        contact_number || null,
        address || null,
        otp,
        otpExpires,
        user.id,
      ]
    );

    await sendAdminOtpEmail(user.email, firstname, otp);

    return res.json({
      message: "Registration data saved. OTP sent to your email.",
      email: user.email,
    });
  } catch (err) {
    console.error("❌ REGISTER FROM INVITE ERROR:", err);
    res.status(500).json({ message: "Failed to complete registration" });
  }
});

// Verify OTP for admin account (invite flow)
// POST /api/admin/verify-otp
// body: { email, otp }
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required." });
    }

    const pool = await getPool();
    const [rows] = await pool.query(
      `
      SELECT id, email, otp_code, otp_expires_at, status, role
      FROM users
      WHERE email = ? AND role IN ('admin','superadmin')
      `,
      [email]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Admin not found." });
    }

    const user = rows[0];

    if (!user.otp_code) {
      return res.status(400).json({ message: "No active OTP found." });
    }

    // 🔑 FIX: compare as strings to avoid number vs string mismatch
    if (String(user.otp_code) !== String(otp)) {
      return res.status(400).json({ message: "Invalid OTP." });
    }

    if (user.otp_expires_at && new Date(user.otp_expires_at) < new Date()) {
      return res.status(400).json({ message: "OTP has expired." });
    }

    await pool.query(
      `
      UPDATE users
      SET is_verified = 1,
          is_approved = 1,
          status = 'active',
          otp_code = NULL,
          otp_expires_at = NULL,
          invite_token = NULL,
          invite_expires_at = NULL,
          invited = 1
      WHERE id = ?
      `,
      [user.id]
    );

    const token = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.json({
      message: "Admin account verified and activated.",
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("❌ VERIFY OTP ERROR:", err);
    res.status(500).json({ message: "Failed to verify OTP" });
  }
});

// Resend OTP for admin verification
// POST /api/admin/resend-otp
// body: { email }
router.post("/resend-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const pool = await getPool();
    const [rows] = await pool.query(
      `
      SELECT id, email, firstname, role, is_verified
      FROM users
      WHERE email = ? AND role IN ('admin', 'superadmin')
      `,
      [email]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Admin not found." });
    }

    const user = rows[0];

    if (user.is_verified) {
      return res.status(400).json({ message: "Account already verified." });
    }

    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      `
      UPDATE users
      SET otp_code = ?, otp_expires_at = ?
      WHERE id = ?
      `,
      [otp, otpExpires, user.id]
    );

    await sendAdminOtpEmail(user.email, user.firstname, otp);

    res.json({ message: "OTP resent successfully." });
  } catch (err) {
    console.error("❌ RESEND ADMIN OTP ERROR:", err);
    res.status(500).json({ message: "Failed to resend OTP" });
  }
});

/* ---------------------------------------------------
   PROTECTED ROUTES (JWT REQUIRED)
--------------------------------------------------- */

router.use(authRequired);

// GET /api/admin/list
router.get("/list", async (req, res) => {
  try {
    const pool = await getPool();

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const search = req.query.search ? `%${req.query.search}%` : "%%";
    const status = req.query.status || "all";

    let filterStatus = "";
    if (status === "active") filterStatus = "AND status = 'active'";
    if (status === "pending") filterStatus = "AND status = 'pending'";
    if (status === "disabled") filterStatus = "AND status = 'disabled'";
    if (status === "invited") filterStatus = "AND status = 'invited'";

    const [count] = await pool.query(
      `
        SELECT COUNT(*) AS total
        FROM users
        WHERE role IN ('admin','superadmin')
        AND (
          username LIKE ? OR firstname LIKE ? OR lastname LIKE ? OR email LIKE ?
        )
        ${filterStatus}
      `,
      [search, search, search, search]
    );

    const [rows] = await pool.query(
      `
        SELECT id, username, firstname, lastname, email, role, status,
               contact_number, address, profile_image, created_at
        FROM users
        WHERE role IN ('admin','superadmin')
        AND (
          username LIKE ? OR firstname LIKE ? OR lastname LIKE ? OR email LIKE ?
        )
        ${filterStatus}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `,
      [search, search, search, search, limit, offset]
    );

    res.json({
      users: rows.map(normalizeImagePath),
      total: count[0].total,
      page,
      limit,
    });
  } catch (err) {
    console.error("❌ LIST ERROR:", err);
    res.status(500).json({ message: "Failed to fetch admins" });
  }
});

// POST /api/admin/invite  (protected)
router.post("/invite", async (req, res) => {
  try {
    const pool = await getPool();
    const { email } = req.body;

    if (!email) return res.status(400).json({ message: "Email required" });

    const [exists] = await pool.query("SELECT id FROM users WHERE email = ?", [email]);
    if (exists.length > 0)
      return res.status(400).json({ message: "Email already registered." });

    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const [insert] = await pool.query(
      `
        INSERT INTO users 
        (email, role, status, invite_token, invite_expires_at, is_verified, invited, is_approved)
        VALUES (?, 'admin', 'invited', ?, ?, 0, 1, 0)
      `,
      [email, token, expires]
    );

    await sendInviteLink(email, token);

    res.json({ message: "Invitation sent successfully.", id: insert.insertId });
  } catch (err) {
    console.error("❌ INVITE ERROR:", err);
    res.status(500).json({ message: "Failed to send admin invite" });
  }
});

// PUT /api/admin/admin/:id (update admin)
router.put("/admin/:id", upload.single("profile_image"), async (req, res) => {
  try {
    const pool = await getPool();
    const id = req.params.id;

    const {
      username,
      firstname,
      lastname,
      email,
      contact_number,
      address,
      role,
      status,
      existing_image,
    } = req.body;

    if (!username || !firstname || !lastname || !email)
      return res.status(400).json({ message: "Missing required fields" });

    const [found] = await pool.query(
      "SELECT * FROM users WHERE id=? AND role IN ('admin','superadmin')",
      [id]
    );
    if (found.length === 0)
      return res.status(404).json({ message: "Admin not found" });

    const admin = found[0];

    const [conflict] = await pool.query(
      "SELECT id FROM users WHERE (username = ? OR email = ?) AND id <> ?",
      [username, email, id]
    );
    if (conflict.length > 0)
      return res.status(400).json({ message: "Username or email already used" });

    let finalImage = admin.profile_image;
    if (req.file) {
      finalImage = `uploads/admins-profile/${req.file.filename}`;
      deleteFileIfExists(admin.profile_image);
    } else if (existing_image) {
      finalImage = existing_image;
    }

    let finalRole = admin.role;
    if (req.user.role === "superadmin" && role) finalRole = role;

    let finalStatus = status || admin.status;

    await pool.query(
      `
        UPDATE users SET 
          username=?, firstname=?, lastname=?, email=?,
          contact_number=?, address=?, profile_image=?,
          role=?, status=?
        WHERE id=?
      `,
      [
        username,
        firstname,
        lastname,
        email,
        contact_number || null,
        address || null,
        finalImage,
        finalRole,
        finalStatus,
        id,
      ]
    );

    const [updated] = await pool.query("SELECT * FROM users WHERE id=?", [id]);

    res.json(normalizeImagePath(updated[0]));
  } catch (err) {
    console.error("❌ UPDATE ERROR:", err);
    res.status(500).json({ message: "Failed to update admin" });
  }
});

// PUT /api/admin/admin/:id/password
router.put("/admin/:id/password", async (req, res) => {
  try {
    const pool = await getPool();
    const { password } = req.body;

    if (!password || password.length < 6)
      return res.status(400).json({ message: "Password too weak" });

    const hashed = await bcrypt.hash(password, 10);

    await pool.query("UPDATE users SET password=? WHERE id=?", [
      hashed,
      req.params.id,
    ]);

    res.json({ message: "Password updated" });
  } catch (err) {
    console.error("❌ PASSWORD ERROR:", err);
    res.status(500).json({ message: "Failed to update password" });
  }
});

// DELETE /api/admin/admin/:id
router.delete("/admin/:id", async (req, res) => {
  try {
    const pool = await getPool();
    const id = req.params.id;

    const [rows] = await pool.query(
      "SELECT * FROM users WHERE id=? AND role IN ('admin','superadmin')",
      [id]
    );
    if (rows.length === 0)
      return res.status(404).json({ message: "Admin not found" });

    const admin = rows[0];

    if (admin.role === "superadmin") {
      const [count] = await pool.query(
        "SELECT COUNT(*) AS total FROM users WHERE role='superadmin'"
      );
      if (count[0].total <= 1)
        return res.status(400).json({ message: "Cannot delete last superadmin" });
    }

    if (admin.profile_image) deleteFileIfExists(admin.profile_image);

    await pool.query("DELETE FROM users WHERE id=?", [id]);

    res.json({ message: "Admin deleted" });
  } catch (err) {
    console.error("❌ DELETE ERROR:", err);
    res.status(500).json({ message: "Failed to delete admin" });
  }
});

module.exports = router;
