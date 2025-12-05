const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const QRCode = require("qrcode");
const nodemailer = require("nodemailer");
const { getPool } = require("../config/db");

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// Email Transporter
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
   VALIDATE INVITE TOKEN (PUBLIC)
   ======================================================== */
router.get("/validate", async (req, res) => {
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
    console.error("PUBLIC VALIDATE INVITE ERROR:", err);
    res.status(500).json({ message: "Failed to validate invitation." });
  }
});

/* ========================================================
   REGISTER FROM INVITE (PUBLIC)
   ======================================================== */
router.post("/register", async (req, res) => {
  try {
    const {
      token,
      username,
      firstname,
      lastname,
      password,
      contact_number,
      address,
    } = req.body;

    const pool = await getPool();

    // Check invited user
    const [rows] = await pool.query(
      "SELECT * FROM users WHERE invite_token = ? AND status = 'pending'",
      [token]
    );

    if (rows.length === 0)
      return res.status(400).json({ message: "Invalid or expired invitation." });

    const invited = rows[0];

    const hashedPassword = await bcrypt.hash(password, 10);

    // Complete registration
    await pool.query(
      `UPDATE users SET 
        username = ?, firstname = ?, lastname = ?, 
        password = ?, contact_number = ?, address = ?, 
        status = 'active',
        is_verified = 1,
        invited = 0,
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
        invited.id,
      ]
    );

    res.json({ message: "Registration complete! Your account is now active." });
  } catch (err) {
    console.error("PUBLIC REGISTER INVITE ERROR:", err);
    res.status(500).json({ message: "Failed to finish registration." });
  }
});

module.exports = router;
