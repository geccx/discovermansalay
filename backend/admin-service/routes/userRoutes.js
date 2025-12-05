// backend/admin-service/routes/userRoutes.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const QRCode = require("qrcode");
const nodemailer = require("nodemailer");
const { getPool } = require("../../config/db");

/* ========================================================
   ENV / CONFIG
   ======================================================== */
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});


/* ========================================================
   UPLOAD FOLDERS
   ======================================================== */
const uploadFolder = path.join(__dirname, "../../uploads");
const userProfileFolder = path.join(uploadFolder, "users-profile");

// Ensure folders exist
try {
  if (!fs.existsSync(uploadFolder)) {
    fs.mkdirSync(uploadFolder, { recursive: true });
    console.log("📁 Created upload folder:", uploadFolder);
  }
  if (!fs.existsSync(userProfileFolder)) {
    fs.mkdirSync(userProfileFolder, { recursive: true });
    console.log("📁 Created users-profile:", userProfileFolder);
  }
} catch (err) {
  console.warn("⚠️ Failed to ensure upload folders:", err.message);
}

/* ========================================================
   MULTER STORAGE
   ======================================================== */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, userProfileFolder),
  filename: (req, file, cb) => {
    const username = req.body.username || "user";
    const ext = path.extname(file.originalname || "");
    cb(null, `${username}${ext}`);
  },
});

const upload = multer({ storage });

/* ========================================================
   HELPERS
   ======================================================== */
function deleteFileIfExists(filePath) {
  try {
    if (!filePath) return;
    const fullPath = path.join(__dirname, "../../", filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      console.log("🗑️ Deleted file:", fullPath);
    }
  } catch (err) {
    console.warn("⚠️ Failed to delete file:", err.message);
  }
}

function normalizeImagePath(user) {
  if (user?.profile_image) {
    user.profile_image = user.profile_image.replace(/\\/g, "/");
  }
  return user;
}

/**
 * Build branded Discover Mansalay email HTML
 */
function buildInviteEmailHtml(firstname, verificationUrl) {
  const safeName = firstname || "Explorer";

  return `
  <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color:#f9fafb; padding:24px;">
    <div style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:16px; padding:24px; box-shadow:0 10px 30px rgba(0,0,0,0.05);">
      <div style="text-align:center; margin-bottom:20px;">
        <div style="font-size:26px; font-weight:800; color:#f97316; letter-spacing:0.04em; text-transform:uppercase;">
          Discover Mansalay
        </div>
        <p style="color:#6b7280; margin-top:6px; font-size:14px;">
          Your gateway to experiences, culture, and local stories.
        </p>
      </div>

      <p style="font-size:16px; color:#111827; margin-bottom:12px;">
        Hi ${safeName},
      </p>

      <p style="font-size:14px; color:#4b5563; margin-bottom:12px;">
        You’ve been invited to join <strong>Discover Mansalay</strong>. Click the button below to verify your email and complete your account setup.
      </p>

      <div style="text-align:center; margin:24px 0;">
        <a href="${verificationUrl}" 
           style="display:inline-block; background:#f97316; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:999px; font-weight:600; font-size:14px;">
          Verify My Account
        </a>
      </div>

      <p style="font-size:13px; color:#6b7280; margin-bottom:12px;">
        Or copy and paste this link into your browser:
        <br/>
        <span style="word-break:break-all; color:#2563eb;">${verificationUrl}</span>
      </p>

      <p style="font-size:13px; color:#6b7280; margin-bottom:12px;">
        We’ve also attached a QR code with the same verification link. You can scan it with your camera to open the verification page on your device.
      </p>

      <hr style="border:none; border-top:1px solid #e5e7eb; margin:24px 0;" />

      <p style="font-size:12px; color:#9ca3af; text-align:center;">
        If you did not expect this email, you can safely ignore it.
        <br/>
        © ${new Date().getFullYear()} Discover Mansalay. All rights reserved.
      </p>
    </div>
  </div>
  `;
}

/* ========================================================
   GET USER COUNT (normal users only)
   ======================================================== */
router.get("/count", async (req, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      'SELECT COUNT(*) AS count FROM users WHERE role = "user"'
    );
    res.json({ count: rows[0].count });
  } catch (err) {
    console.error("Error fetching user count:", err);
    res.status(500).json({ error: "Failed to fetch user count" });
  }
});

/* ========================================================
   GET USER LIST (PAGINATION + SEARCH + STATUS FILTER)
   ======================================================== */
router.get("/list", async (req, res) => {
  try {
    const pool = await getPool();

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    const search = req.query.search?.trim().toLowerCase() || "";
    const status = req.query.status?.toLowerCase() || "all";

    let whereClauses = [`role = "user"`];
    let params = [];

    // SEARCH conditions
    if (search) {
      whereClauses.push(`
        (
          LOWER(username) LIKE ? OR 
          LOWER(firstname) LIKE ? OR 
          LOWER(lastname) LIKE ? OR
          LOWER(email) LIKE ?
        )
      `);
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    // STATUS FILTER
    if (status !== "all") {
      whereClauses.push("LOWER(status) = ?");
      params.push(status);
    }

    const whereSQL = whereClauses.join(" AND ");

    // COUNT
    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS count FROM users WHERE ${whereSQL}`,
      params
    );

    const total = countRows[0].count;

    // LIST USERS
    const [rows] = await pool.query(
      `SELECT * FROM users 
       WHERE ${whereSQL} 
       ORDER BY id DESC 
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      total,
      page,
      limit,
      users: rows.map(normalizeImagePath),
    });

  } catch (err) {
    console.error("Error fetching user list:", err);
    res.status(500).json({ message: "Server error fetching users" });
  }
});


/* ========================================================
   CREATE USER (manual add by admin)
   ======================================================== */
router.post("/user", upload.single("profile_image"), async (req, res) => {
  try {
    const pool = await getPool();
    let {
      username,
      firstname,
      lastname,
      email,
      password,
      role,
      contact_number,
      address,
    } = req.body;

    // Enforce "user" role — prevents admin creation here
    role = "user";

    password = password?.trim() || "password123";
    const hashedPassword = await bcrypt.hash(password, 10);

    const [existing] = await pool.query(
      "SELECT * FROM users WHERE username = ? OR email = ?",
      [username, email]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        message:
          existing[0].username === username
            ? "Username already taken"
            : "Email already registered",
      });
    }

    const profile_image = req.file
      ? `uploads/users-profile/${req.file.filename}`
      : null;

    const [result] = await pool.query(
      `INSERT INTO users 
      (username, firstname, lastname, email, password, role, contact_number, address, profile_image, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        username,
        firstname || null,
        lastname || null,
        email,
        hashedPassword,
        role,
        contact_number || null,
        address || null,
        profile_image,
        "active", // manual add = already active
      ]
    );

    const [newUser] = await pool.query("SELECT * FROM users WHERE id = ?", [
      result.insertId,
    ]);

    res.status(201).json(normalizeImagePath(newUser[0]));
  } catch (err) {
    console.error("Error creating user:", err);
    res.status(500).json({ message: "Server error creating user" });
  }
});

/* ========================================================
   INVITE USER (EMAIL + QR CODE)
   ======================================================== */
router.post("/invite", async (req, res) => {
  try {
    const pool = await getPool();
    const { email, firstname, lastname } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    // Check if email already exists
    const [existing] = await pool.query(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    if (existing.length > 0) {
      return res.status(400).json({ message: "Email is already registered." });
    }

    // Create invite token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const verificationUrl = `${FRONTEND_URL}/invite/register?token=${token}`;

    // Insert INVITE ONLY (email only, NO username)
    await pool.query(
      `INSERT INTO users 
      (email, firstname, lastname, role, status, invite_token, invite_expires_at, invited)
      VALUES (?, ?, ?, "user", "pending", ?, ?, 1)`,
      [email, firstname || null, lastname || null, token, expiresAt]
    );

    // Send email
    const qrDataUrl = await QRCode.toDataURL(verificationUrl);
    const qrBuffer = Buffer.from(qrDataUrl.split(",")[1], "base64");

    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: email,
      subject: "You're invited to Discover Mansalay",
      html: buildInviteEmailHtml(firstname, verificationUrl),
      attachments: [
        { filename: "verify.png", content: qrBuffer }
      ],
    });

    res.json({ message: "Invitation sent successfully." });
  } catch (err) {
    console.error("INVITE USER ERROR:", err);
    res.status(500).json({ message: "Failed to send invitation." });
  }
});

router.get("/invite/validate", async (req, res) => {
  try {
    const { token } = req.query;

    const pool = await getPool();
    const [rows] = await pool.query(
      "SELECT email, invite_expires_at FROM users WHERE invite_token = ?",
      [token]
    );

    if (rows.length === 0)
      return res.status(400).json({ message: "Invalid invite token." });

    if (new Date(rows[0].invite_expires_at) < new Date())
      return res.status(400).json({ message: "Invitation link expired." });

    res.json({ email: rows[0].email });
  } catch (err) {
    console.error("VALIDATE INVITE ERROR:", err);
    res.status(500).json({ message: "Failed to validate invite." });
  }
});

router.post("/invite/register", async (req, res) => {
  try {
    const { token, username, firstname, lastname, password, contact_number, address } = req.body;

    const pool = await getPool();

    const [rows] = await pool.query(
      "SELECT * FROM users WHERE invite_token = ? AND status = 'pending'",
      [token]
    );

    if (rows.length === 0)
      return res.status(400).json({ message: "Invalid or expired invitation." });

    const invitedUser = rows[0];

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      `UPDATE users SET 
        username = ?, firstname = ?, lastname = ?, 
        password = ?, contact_number = ?, address = ?, 
        status = 'active',
        invited = 0,
        is_verified = 1,
        invite_token = NULL,
        invite_expires_at = NULL
      WHERE id = ?`,
      [
        username,
        firstname,
        lastname,
        hashedPassword,
        contact_number,
        address,
        invitedUser.id
      ]
    );

    res.json({ message: "Account created successfully!" });
  } catch (err) {
    console.error("REGISTER INVITED USER ERROR:", err);
    res.status(500).json({ message: "Failed to create account." });
  }
});


/* ========================================================
   VERIFY USER TOKEN (API for /verify/:token page)
   ======================================================== */
router.post("/verify", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ message: "Missing verification token." });
    }

    const pool = await getPool();
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE invite_token = ? AND role = "user"',
      [token]
    );

    if (rows.length === 0) {
      return res.status(400).json({ message: "Invalid or expired token." });
    }

    const user = rows[0];

    if (
      user.invite_expires_at &&
      new Date(user.invite_expires_at) < new Date()
    ) {
      return res.status(400).json({ message: "Verification link has expired." });
    }

    await pool.query(
      `UPDATE users 
       SET status = "active",
           invite_token = NULL,
           invite_expires_at = NULL,
           invited = 0,
           is_verified = 1
       WHERE id = ?`,
      [user.id]
    );

    res.json({ message: "Account verified successfully." });
  } catch (err) {
    console.error("VERIFY USER ERROR:", err);
    res.status(500).json({ message: "Failed to verify account." });
  }
});

/* ========================================================
   UPDATE USER
   ======================================================== */
router.put("/user/:id", upload.single("profile_image"), async (req, res) => {
  try {
    const pool = await getPool();
    const userId = req.params.id;

    const [existingRows] = await pool.query(
      "SELECT * FROM users WHERE id = ?",
      [userId]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const oldUser = existingRows[0];

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

    // Password logic
    if (password?.trim()) {
      password = await bcrypt.hash(password.trim(), 10);
    } else {
      password = oldUser.password;
    }

    // Always keep as normal user from this endpoint
    const role = "user";

    // Check conflicts
    const [conflicts] = await pool.query(
      "SELECT * FROM users WHERE (username = ? OR email = ?) AND id != ?",
      [username, email, userId]
    );

    if (conflicts.length > 0) {
      return res.status(400).json({
        message:
          conflicts[0].username === username
            ? "Username is already taken"
            : "Email is already used",
      });
    }

    // Handle image update
    const oldImage = oldUser.profile_image;
    let profile_image = oldImage;

    if (req.file) {
      profile_image = `uploads/users-profile/${req.file.filename}`;
      if (oldImage && oldImage !== profile_image) deleteFileIfExists(oldImage);
    } else if (existing_image === "" || existing_image === "null") {
      if (oldImage) deleteFileIfExists(oldImage);
      profile_image = null;
    }

    await pool.query(
      `UPDATE users SET 
        username = ?, firstname = ?, lastname = ?, email = ?, 
        password = ?, role = ?, contact_number = ?, address = ?, 
        profile_image = ?
      WHERE id = ?`,
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
        userId,
      ]
    );

    const [updated] = await pool.query("SELECT * FROM users WHERE id = ?", [
      userId,
    ]);

    res.json(normalizeImagePath(updated[0]));
  } catch (err) {
    console.error("Error updating user:", err);
    res.status(500).json({ message: "Server error updating user" });
  }
});

/* ========================================================
   DELETE USER
   ======================================================== */
router.delete("/user/:id", async (req, res) => {
  try {
    const pool = await getPool();
    const userId = req.params.id;

    const [rows] = await pool.query(
      "SELECT profile_image FROM users WHERE id = ?",
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const image = rows[0].profile_image;

    const [del] = await pool.query("DELETE FROM users WHERE id = ?", [userId]);

    if (del.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    if (image) deleteFileIfExists(image);

    res.json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("Error deleting user:", err);
    res.status(500).json({ message: "Server error deleting user" });
  }
});

module.exports = router;
