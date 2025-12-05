const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const brevo = require("@getbrevo/brevo");

const { getPool } = require("../../config/db");
const { authRequired } = require("../../user-service/middleware/authMiddleware");

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_key";

/* ---------------------------------------------
   BREVO EMAIL API
--------------------------------------------- */
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

/* ---------------------------------------------
   Upload Folders
--------------------------------------------- */
const uploadFolder = path.join(__dirname, "../../uploads");
const adminsProfileFolder = path.join(uploadFolder, "admins-profile");

if (!fs.existsSync(uploadFolder)) fs.mkdirSync(uploadFolder, { recursive: true });
if (!fs.existsSync(adminsProfileFolder)) fs.mkdirSync(adminsProfileFolder, { recursive: true });

/* ---------------------------------------------
   Multer Setup
--------------------------------------------- */
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, adminsProfileFolder),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = req.body.username || "admin";
    cb(null, `${name}-${Date.now()}${ext}`);
  },
});
const upload = multer({ storage });

/* ---------------------------------------------
   Helpers
--------------------------------------------- */
function generateOtp(n = 6) {
  return [...Array(n)].map(() => Math.floor(Math.random() * 10)).join("");
}

function normalizeImagePath(u) {
  if (u?.profile_image) {
    u.profile_image = u.profile_image.replace(/\\/g, "/");
  }
  return u;
}

function deleteFileIfExists(filePath) {
  if (!filePath) return;
  const full = path.join(__dirname, "../../", filePath);
  if (fs.existsSync(full)) fs.unlinkSync(full);
}

/* ============================================================
   PUBLIC ROUTES
============================================================ */

/* Validate invitation token */
router.get("/invite/validate", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ message: "Token is required" });

    const pool = await getPool();
    const [rows] = await pool.query(
      `SELECT id, email, status, invite_expires_at
       FROM users WHERE invite_token = ? AND role = 'admin'`,
      [token]
    );

    if (!rows.length)
      return res.status(400).json({ message: "Invalid or used invitation link." });

    const invite = rows[0];

    if (invite.invite_expires_at && new Date(invite.invite_expires_at) < new Date())
      return res.status(400).json({ message: "Invitation link expired." });

    if (invite.status !== "invited")
      return res.status(400).json({ message: "Invitation invalid." });

    res.json({ id: invite.id, email: invite.email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed validating invite" });
  }
});

/* Registration from invite */
router.post("/register-from-invite", async (req, res) => {
  try {
    const { token, username, firstname, lastname, password, contact_number, address } =
      req.body;

    if (!token || !username || !firstname || !lastname || !password)
      return res.status(400).json({ message: "Missing fields." });

    const pool = await getPool();

    const [rows] = await pool.query(
      `SELECT id, email, status, invite_expires_at
       FROM users WHERE invite_token = ? AND role = 'admin'`,
      [token]
    );

    if (!rows.length)
      return res.status(400).json({ message: "Invalid or expired invitation." });

    const user = rows[0];

    if (new Date(user.invite_expires_at) < new Date())
      return res.status(400).json({ message: "Invitation expired." });

    const hashed = await bcrypt.hash(password, 10);
    const otp = generateOtp();
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      `UPDATE users SET
        username=?, firstname=?, lastname=?, password=?,
        contact_number=?, address=?,
        status='pending', otp_code=?, otp_expires_at=?, verification_method='email'
       WHERE id=?`,
      [
        username,
        firstname,
        lastname,
        hashed,
        contact_number || null,
        address || null,
        otp,
        expires,
        user.id,
      ]
    );

    await sendEmail(
      user.email,
      "Your Admin Verification Code",
      `<p>Hello ${firstname},</p><p>Your OTP is:</p><h2>${otp}</h2>`
    );

    res.json({ message: "OTP sent.", email: user.email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed registration" });
  }
});

/* Verify OTP for admin */
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp)
      return res.status(400).json({ message: "Missing OTP or email." });

    const pool = await getPool();

    const [rows] = await pool.query(
      `SELECT id, otp_code, otp_expires_at, role FROM users
       WHERE email = ? AND role IN ('admin','superadmin')`,
      [email]
    );

    if (!rows.length)
      return res.status(404).json({ message: "Admin not found." });

    const user = rows[0];

    if (String(user.otp_code) !== String(otp))
      return res.status(400).json({ message: "Invalid OTP." });

    if (new Date(user.otp_expires_at) < new Date())
      return res.status(400).json({ message: "OTP expired." });

    await pool.query(
      `UPDATE users SET 
        is_verified=1, is_approved=1, status='active',
        otp_code=NULL, otp_expires_at=NULL,
        invite_token=NULL, invite_expires_at=NULL
       WHERE id=?`,
      [user.id]
    );

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: "1d",
    });

    res.json({ message: "Account verified.", token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "OTP verification failed" });
  }
});

/* Resend Admin OTP */
router.post("/resend-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email)
      return res.status(400).json({ message: "Email required." });

    const pool = await getPool();

    const [rows] = await pool.query(
      `SELECT id, firstname FROM users 
       WHERE email=? AND role IN ('admin','superadmin')`,
      [email]
    );

    if (!rows.length)
      return res.status(404).json({ message: "Admin not found." });

    const user = rows[0];

    const otp = generateOtp();
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      `UPDATE users SET otp_code=?, otp_expires_at=? WHERE id=?`,
      [otp, expires, user.id]
    );

    await sendEmail(
      email,
      "Your New Admin OTP",
      `<p>Hello ${user.firstname},</p><p>Your new OTP is:</p><h2>${otp}</h2>`
    );

    res.json({ message: "OTP resent." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to resend OTP" });
  }
});

/* ============================================================
   PROTECTED ROUTES (JWT REQUIRED)
============================================================ */
router.use(authRequired);

router.get("/stats", async (req, res) => {
  try {
    const pool = await getPool();

    // Count ACTIVE & VERIFIED admins
    const [adminRows] = await pool.query(
      `SELECT COUNT(*) AS count 
       FROM users 
       WHERE role IN ('admin','superadmin') 
       AND is_verified = 1
       AND is_approved = 1
       AND status = 'active'`
    );

    // Count ACTIVE & VERIFIED users
    const [userRows] = await pool.query(
      `SELECT COUNT(*) AS count 
       FROM users 
       WHERE role = 'user'
       AND is_verified = 1
       AND is_approved = 1
       AND status = 'active'`
    );

    res.json({
      adminCount: adminRows[0].count,
      userCount: userRows[0].count,
    });
  } catch (error) {
    console.error("🔥 STATS ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});


/* Admin list */
router.get("/list", async (req, res) => {
  try {
    const pool = await getPool();

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const search = req.query.search ? `%${req.query.search}%` : "%%";
    const status = req.query.status || "all";

    let filter = "";
    if (status !== "all") filter = `AND status='${status}'`;

    const [count] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM users
       WHERE role IN ('admin','superadmin')
       AND (username LIKE ? OR firstname LIKE ? OR lastname LIKE ? OR email LIKE ?)
       ${filter}`,
      [search, search, search, search]
    );

    const [rows] = await pool.query(
      `SELECT * FROM users
       WHERE role IN ('admin','superadmin')
       AND (username LIKE ? OR firstname LIKE ? OR lastname LIKE ? OR email LIKE ?)
       ${filter}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [search, search, search, search, limit, offset]
    );

    res.json({
      users: rows.map(normalizeImagePath),
      total: count[0].total,
      page,
      limit,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed fetching admins" });
  }
});

/* Send Admin Invite */
router.post("/invite", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });

    const pool = await getPool();
    const [exists] = await pool.query("SELECT id FROM users WHERE email=?", [email]);

    if (exists.length)
      return res.status(400).json({ message: "Email already registered." });

    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await pool.query(
      `INSERT INTO users
       (email, role, status, invite_token, invite_expires_at, is_verified, invited, is_approved)
       VALUES (?, 'admin', 'invited', ?, ?, 0, 1, 0)`,
      [email, token, expires]
    );

    const inviteUrl = `${process.env.FRONTEND_URL}/admin/register?token=${token}`;

    await sendEmail(
      email,
      "Admin Invitation - Discover Mansalay",
      `<p>Hello,</p><p>You are invited to join as Admin.</p>
       <p><a href="${inviteUrl}">Complete Registration</a></p>`
    );

    res.json({ message: "Invite sent." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed sending invite" });
  }
});

/* Update admin */
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

    const [found] = await pool.query(
      "SELECT * FROM users WHERE id=? AND role IN ('admin','superadmin')",
      [id]
    );

    if (!found.length)
      return res.status(404).json({ message: "Admin not found" });

    const admin = found[0];

    let finalImage = admin.profile_image;
    if (req.file) {
      finalImage = `uploads/admins-profile/${req.file.filename}`;
      deleteFileIfExists(admin.profile_image);
    } else if (existing_image) {
      finalImage = existing_image;
    }

    await pool.query(
      `UPDATE users SET
        username=?, firstname=?, lastname=?, email=?,
        contact_number=?, address=?, profile_image=?,
        role=?, status=?
       WHERE id=?`,
      [
        username,
        firstname,
        lastname,
        email,
        contact_number || null,
        address || null,
        finalImage,
        role || admin.role,
        status || admin.status,
        id,
      ]
    );

    const [updated] = await pool.query("SELECT * FROM users WHERE id=?", [id]);

    res.json(normalizeImagePath(updated[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed updating admin" });
  }
});

/* Delete admin */
router.delete("/admin/:id", async (req, res) => {
  try {
    const pool = await getPool();
    const id = req.params.id;

    const [rows] = await pool.query(
      "SELECT * FROM users WHERE id=? AND role IN ('admin','superadmin')",
      [id]
    );

    if (!rows.length)
      return res.status(404).json({ message: "Admin not found" });

    const admin = rows[0];

    if (admin.profile_image) deleteFileIfExists(admin.profile_image);

    await pool.query("DELETE FROM users WHERE id=?", [id]);

    res.json({ message: "Admin deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed deleting admin" });
  }
});

module.exports = router;
