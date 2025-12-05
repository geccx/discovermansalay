// backend/admin-service/routes/userRoutes.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { getPool } = require("../../config/db");
const brevo = require("@getbrevo/brevo");

/* ========================================================
   ENV / CONFIG
======================================================== */
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

const brevoClient = new brevo.TransactionalEmailsApi();
brevoClient.setApiKey(
  brevo.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY
);

async function sendEmail(to, subject, html) {
  try {
    await brevoClient.sendTransacEmail({
      sender: { email: process.env.SMTP_FROM, name: "Discover Mansalay" },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    });

    console.log("📩 Email sent:", to);
  } catch (err) {
    console.error("❌ Email failed:", err.response?.body || err.message);
  }
}

/* ========================================================
   UPLOAD FOLDERS
======================================================== */
const uploadFolder = path.join(__dirname, "../../uploads");
const userProfileFolder = path.join(uploadFolder, "users-profile");

// Ensure folders exist
if (!fs.existsSync(uploadFolder)) fs.mkdirSync(uploadFolder, { recursive: true });
if (!fs.existsSync(userProfileFolder)) fs.mkdirSync(userProfileFolder, { recursive: true });

/* ========================================================
   MULTER STORAGE
======================================================== */
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, userProfileFolder),
  filename: (req, file, cb) => {
    const username = req.body.username || "user";
    const ext = path.extname(file.originalname);
    cb(null, `${username}-${Date.now()}${ext}`);
  },
});

const upload = multer({ storage });

/* ========================================================
   HELPERS
======================================================== */
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

function buildInviteEmailHtml(firstname, verificationUrl) {
  const safe = firstname || "Explorer";

  return `
  <div style="font-family:system-ui;background:#f9fafb;padding:24px;">
    <div style="max-width:600px;background:#fff;border-radius:14px;padding:24px;margin:auto;box-shadow:0 10px 30px rgba(0,0,0,0.05);">
      <h2 style="color:#f97316;text-align:center;margin-bottom:8px;">Discover Mansalay</h2>
      <p style="color:#4b5563;">Hi ${safe},</p>
      <p style="color:#4b5563;">You've been invited to join Discover Mansalay. Click the button below to activate your account.</p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${verificationUrl}" style="background:#f97316;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
          Activate Account
        </a>
      </div>
      <p style="font-size:12px;color:#9ca3af;text-align:center;margin-top:20px;">
        If you did not request this, ignore this message.
      </p>
    </div>
  </div>`;
}

/* ========================================================
   GET USER COUNT
======================================================== */
router.get("/count", async (req, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS count FROM users WHERE role='user'`
    );
    res.json({ count: rows[0].count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed fetching user count" });
  }
});

/* ========================================================
   USER LIST (Pagination + Search + Status)
======================================================== */
router.get("/list", async (req, res) => {
  try {
    const pool = await getPool();

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const search = req.query.search ? `%${req.query.search.toLowerCase()}%` : "%%";
    const status = req.query.status || "all";

    let where = [`role='user'`];
    let params = [];

    if (req.query.search) {
      where.push(`
        (LOWER(username) LIKE ? OR LOWER(firstname) LIKE ? OR LOWER(lastname) LIKE ? OR LOWER(email) LIKE ?)
      `);
      params.push(search, search, search, search);
    }

    if (status !== "all") {
      where.push(`LOWER(status)=?`);
      params.push(status.toLowerCase());
    }

    const whereSQL = where.join(" AND ");

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS count FROM users WHERE ${whereSQL}`,
      params
    );

    const [rows] = await pool.query(
      `SELECT * FROM users WHERE ${whereSQL} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      total: countRows[0].count,
      page,
      limit,
      users: rows.map(normalizeImagePath),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed fetching user list" });
  }
});

/* ========================================================
   CREATE USER (admin manually adds user)
======================================================== */
router.post("/user", upload.single("profile_image"), async (req, res) => {
  try {
    const pool = await getPool();

    const {
      username,
      firstname,
      lastname,
      email,
      password,
      contact_number,
      address,
    } = req.body;

    const hashed = await bcrypt.hash(password || "password123", 10);

    const [exists] = await pool.query(
      `SELECT id FROM users WHERE username=? OR email=?`,
      [username, email]
    );

    if (exists.length)
      return res.status(400).json({ message: "Username or Email already exists." });

    const profile_image = req.file
      ? `uploads/users-profile/${req.file.filename}`
      : null;

    const [insert] = await pool.query(
      `INSERT INTO users 
       (username, firstname, lastname, email, password, role, status, contact_number, address, profile_image)
       VALUES (?, ?, ?, ?, ?, 'user', 'active', ?, ?, ?)`,
      [
        username,
        firstname || null,
        lastname || null,
        email,
        hashed,
        contact_number || null,
        address || null,
        profile_image,
      ]
    );

    const [newUser] = await pool.query(
      `SELECT * FROM users WHERE id=?`,
      [insert.insertId]
    );

    res.json(normalizeImagePath(newUser[0]));
  } catch (err) {
    console.error("CREATE USER ERROR:", err);
    res.status(500).json({ message: "Failed creating user" });
  }
});

/* ========================================================
   SEND USER INVITE
======================================================== */
router.post("/invite", async (req, res) => {
  try {
    const { email, firstname, lastname } = req.body;

    if (!email) return res.status(400).json({ message: "Email required" });

    const pool = await getPool();

    const [exists] = await pool.query(
      "SELECT id FROM users WHERE email=?",
      [email]
    );

    if (exists.length)
      return res.status(400).json({ message: "Email already used." });

    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const verificationUrl = `${FRONTEND_URL}/invite/register?token=${token}`;

    await pool.query(
      `INSERT INTO users
       (email, firstname, lastname, role, status, invite_token, invite_expires_at, invited)
       VALUES (?, ?, ?, 'user', 'pending', ?, ?, 1)`,
      [email, firstname || null, lastname || null, token, expires]
    );

    await sendEmail(email, "You're invited!", buildInviteEmailHtml(firstname, verificationUrl));

    res.json({ message: "Invite sent." });
  } catch (err) {
    console.error("INVITE ERROR:", err);
    res.status(500).json({ message: "Failed sending invite" });
  }
});

/* ========================================================
   VALIDATE INVITE
======================================================== */
router.get("/invite/validate", async (req, res) => {
  try {
    const { token } = req.query;

    const pool = await getPool();
    const [rows] = await pool.query(
      `SELECT email, invite_expires_at FROM users WHERE invite_token=?`,
      [token]
    );

    if (!rows.length)
      return res.status(400).json({ message: "Invalid token" });

    if (new Date(rows[0].invite_expires_at) < new Date())
      return res.status(400).json({ message: "Expired link" });

    res.json({ email: rows[0].email });
  } catch (err) {
    console.error("VALIDATE ERROR:", err);
    res.status(500).json({ message: "Failed validating invite" });
  }
});

/* ========================================================
   REGISTER INVITED USER
======================================================== */
router.post("/invite/register", async (req, res) => {
  try {
    const { token, username, firstname, lastname, password, contact_number, address } =
      req.body;

    const hashed = await bcrypt.hash(password, 10);

    const pool = await getPool();

    const [rows] = await pool.query(
      `SELECT id FROM users WHERE invite_token=? AND status='pending'`,
      [token]
    );

    if (!rows.length)
      return res.status(400).json({ message: "Invalid or expired invite." });

    const user = rows[0];

    await pool.query(
      `UPDATE users SET
        username=?, firstname=?, lastname=?,
        password=?, contact_number=?, address=?,
        status='active', is_verified=1,
        invite_token=NULL, invite_expires_at=NULL, invited=0
       WHERE id=?`,
      [
        username,
        firstname,
        lastname,
        hashed,
        contact_number || null,
        address || null,
        user.id,
      ]
    );

    res.json({ message: "Account created!" });
  } catch (err) {
    console.error("REGISTER INVITED USER ERROR:", err);
    res.status(500).json({ message: "Failed registering user" });
  }
});

/* ========================================================
   VERIFY USER TOKEN (simple verify)
======================================================== */
router.post("/verify", async (req, res) => {
  try {
    const { token } = req.body;

    const pool = await getPool();

    const [rows] = await pool.query(
      `SELECT id, invite_expires_at FROM users WHERE invite_token=?`,
      [token]
    );

    if (!rows.length)
      return res.status(400).json({ message: "Invalid token" });

    if (new Date(rows[0].invite_expires_at) < new Date())
      return res.status(400).json({ message: "Expired token" });

    await pool.query(
      `UPDATE users SET 
        status='active',
        is_verified=1,
        invite_token=NULL,
        invite_expires_at=NULL,
        invited=0
       WHERE id=?`,
      [rows[0].id]
    );

    res.json({ message: "Account verified." });
  } catch (err) {
    console.error("VERIFY USER ERROR:", err);
    res.status(500).json({ message: "Failed verifying user" });
  }
});

/* ========================================================
   UPDATE USER
======================================================== */
router.put("/user/:id", upload.single("profile_image"), async (req, res) => {
  try {
    const pool = await getPool();
    const id = req.params.id;

    const [foundRows] = await pool.query(
      `SELECT * FROM users WHERE id=?`,
      [id]
    );

    if (!foundRows.length)
      return res.status(404).json({ message: "User not found" });

    const oldUser = foundRows[0];

    let {
      username,
      firstname,
      lastname,
      email,
      password,
      contact_number,
      address,
      existing_image,
    } = req.body;

    // Hash password if updated
    if (password?.trim()) {
      password = await bcrypt.hash(password, 10);
    } else {
      password = oldUser.password;
    }

    // Prevent admin creation
    const role = "user";

    // Check user conflicts
    const [conflicts] = await pool.query(
      `SELECT * FROM users WHERE (username=? OR email=?) AND id<>?`,
      [username, email, id]
    );

    if (conflicts.length)
      return res.status(400).json({ message: "Username or email already exists" });

    let profile_image = oldUser.profile_image;

    if (req.file) {
      profile_image = `uploads/users-profile/${req.file.filename}`;
      deleteFileIfExists(oldUser.profile_image);
    } else if (existing_image === "" || existing_image === "null") {
      deleteFileIfExists(oldUser.profile_image);
      profile_image = null;
    }

    await pool.query(
      `UPDATE users SET
        username=?, firstname=?, lastname=?, email=?,
        password=?, role=?, contact_number=?, address=?, profile_image=?
       WHERE id=?`,
      [
        username,
        firstname || null,
        lastname || null,
        email,
        password,
        role,
        contact_number || null,
        address || null,
        profile_image,
        id,
      ]
    );

    const [updated] = await pool.query(
      `SELECT * FROM users WHERE id=?`,
      [id]
    );

    res.json(normalizeImagePath(updated[0]));
  } catch (err) {
    console.error("UPDATE USER ERROR:", err);
    res.status(500).json({ message: "Failed updating user" });
  }
});

/* ========================================================
   DELETE USER
======================================================== */
router.delete("/user/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const pool = await getPool();

    const [rows] = await pool.query(
      `SELECT profile_image FROM users WHERE id=?`,
      [id]
    );

    if (!rows.length)
      return res.status(404).json({ message: "User not found" });

    const img = rows[0].profile_image;

    await pool.query(`DELETE FROM users WHERE id=?`, [id]);

    if (img) deleteFileIfExists(img);

    res.json({ message: "User deleted" });
  } catch (err) {
    console.error("DELETE USER ERROR:", err);
    res.status(500).json({ message: "Failed deleting user" });
  }
});

module.exports = router;
