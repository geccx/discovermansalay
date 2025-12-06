// backend/booking-service/routes/booking.js
const express = require("express");
const router = express.Router();
const { getPool } = require("../../config/db");
const brevo = require("@getbrevo/brevo");

/* -------------------------------------------------------
   BREVO EMAIL API (Recommended for Railway)
--------------------------------------------------------- */
const brevoClient = new brevo.TransactionalEmailsApi();

if (process.env.BREVO_API_KEY) {
  brevoClient.setApiKey(
    brevo.TransactionalEmailsApiApiKeys.apiKey,
    process.env.BREVO_API_KEY
  );
  console.log("📧 Brevo email client initialized");
} else {
  console.warn("⚠️ BREVO_API_KEY missing. Emails will be skipped.");
}

async function sendEmail(to, subject, html) {
  if (!process.env.BREVO_API_KEY || !process.env.SMTP_FROM) {
    console.warn("⚠️ Missing Brevo config (BREVO_API_KEY / SMTP_FROM). Email skipped.");
    return false;
  }

  try {
    await brevoClient.sendTransacEmail({
      sender: { email: process.env.SMTP_FROM, name: "Discover Mansalay" },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    });

    console.log("📩 Email sent to:", to);
    return true;
  } catch (err) {
    console.error("❌ Email failed:", err.message);
    return false;
  }
}

/* -------------------------------------------------------
   DATE & TIME FORMATTERS
--------------------------------------------------------- */

// FORMAT DATE → YYYY-MM-DD
function formatDate(value) {
  if (!value) return null;

  if (typeof value === "string") {
    if (value.includes("T")) {
      return value.split("T")[0];
    }
    return value;
  }

  const d = new Date(value);
  if (isNaN(d)) return value;

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// FORMAT TIME → h:mm AM/PM
function formatTime(value) {
  if (!value) return null;

  let raw = String(value);

  const parts = raw.split(":");
  if (parts.length >= 2) {
    let hh = parseInt(parts[0], 10);
    const mm = parts[1] || "00";

    if (Number.isNaN(hh)) return raw;

    const suffix = hh >= 12 ? "PM" : "AM";
    hh = hh % 12;
    if (hh === 0) hh = 12;

    return `${hh}:${mm} ${suffix}`;
  }

  return raw;
}

/* -------------------------------------------------------
   USER CREATES BOOKING → STATUS = 'pending'
--------------------------------------------------------- */
router.post("/", async (req, res) => {
  try {
    const {
      accommodation_id,
      user_name,
      user_email,
      user_contact,
      check_in,
      check_out,
      check_in_time,
      check_out_time,
      guests,
    } = req.body;

    const pool = await getPool();

    await pool.query(
      `
      INSERT INTO accommodation_bookings 
      (accommodation_id, user_name, user_email, user_contact, check_in, check_out, check_in_time, check_out_time, guests)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        accommodation_id,
        user_name,
        user_email,
        user_contact,
        check_in,
        check_out,
        check_in_time || null,
        check_out_time || null,
        guests,
      ]
    );

    res.json({
      success: true,
      message:
        "Your booking request has been submitted. The admin will review it shortly.",
    });
  } catch (err) {
    console.error("BOOKING ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

/* -------------------------------------------------------
   ADMIN GET ALL BOOKINGS (CLEAN FORMATTED OUTPUT)
--------------------------------------------------------- */
router.get("/", async (req, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query(`
      SELECT b.*, 
      c.title AS accommodation_name,
      c.email AS manager_email,
      c.contact AS manager_phone
      FROM accommodation_bookings b
      JOIN content_items c ON b.accommodation_id = c.id
      ORDER BY b.created_at DESC
    `);

    const formatted = rows.map((b) => ({
      ...b,
      check_in: formatDate(b.check_in),
      check_out: formatDate(b.check_out),
      check_in_time: formatTime(b.check_in_time),
      check_out_time: formatTime(b.check_out_time),
    }));

    res.json(formatted);
  } catch (err) {
    console.error("FETCH ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

/* -------------------------------------------------------
   STEP 1 — ADMIN FORWARDS BOOKING TO MANAGEMENT
--------------------------------------------------------- */
router.put("/confirm/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getPool();

    const [rows] = await pool.query(
      `
      SELECT b.*, 
      c.title AS accommodation_name,
      c.email AS manager_email,
      c.contact AS manager_phone
      FROM accommodation_bookings b
      JOIN content_items c ON b.accommodation_id = c.id
      WHERE b.id = ?
      `,
      [id]
    );

    if (rows.length === 0)
      return res.status(404).json({ error: "Booking not found" });

    const booking = rows[0];

    await pool.query(
      `UPDATE accommodation_bookings SET status='awaiting_management' WHERE id=?`,
      [id]
    );

    const cleanInDate = formatDate(booking.check_in);
    const cleanOutDate = formatDate(booking.check_out);
    const cleanInTime = formatTime(booking.check_in_time);
    const cleanOutTime = formatTime(booking.check_out_time);

    await sendEmail(
      booking.manager_email,
      "Discover Mansalay – Booking Approval Needed",
      `
        <div style="font-family:Arial,sans-serif;color:#033859;">
          <h2>New Booking Request for Your Accommodation</h2>
          <p>The Discover Mansalay admin has forwarded this booking request to you for approval.</p>

          <h3>Accommodation: ${booking.accommodation_name}</h3>

          <p><b>Guest Name:</b> ${booking.user_name}</p>
          <p><b>Email:</b> ${booking.user_email}</p>
          <p><b>Contact:</b> ${booking.user_contact}</p>

          <p><b>Check-in:</b> ${cleanInDate || "-"}${
        cleanInTime ? " at " + cleanInTime : ""
      }</p>
          <p><b>Check-out:</b> ${cleanOutDate || "-"}${
        cleanOutTime ? " at " + cleanOutTime : ""
      }</p>

          <p><b>Guests:</b> ${booking.guests}</p>

          <hr />

          <p><b>Please choose an action:</b></p>

          <a href="${
            process.env.BACKEND_URL
          }/api/booking/email/confirm/${booking.id}"
             style="padding:12px 20px;background:#28a745;color:white;
             text-decoration:none;border-radius:6px;margin-right:10px;display:inline-block;">
             ✔ Confirm Booking
          </a>

          <a href="${
            process.env.BACKEND_URL
          }/api/booking/email/cancel/${booking.id}"
             style="padding:12px 20px;background:#d9534f;color:white;
             text-decoration:none;border-radius:6px;display:inline-block;">
             ✖ Cancel Booking
          </a>

          <hr />
          <p style="font-size:12px;color:#666;">If you did not expect this email, you can ignore it.</p>
          <p style="font-size:12px;color:#999;">Powered by Discover Mansalay</p>
        </div>
      `
    );

    res.json({
      success: true,
      message: "Booking forwarded to accommodation management for approval.",
    });
  } catch (err) {
    console.error("CONFIRM ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

/* -------------------------------------------------------
   OPTIONAL DIRECT MGMT UPDATE (not via email link)
--------------------------------------------------------- */
router.put("/management/confirm/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getPool();

    await pool.query(
      `UPDATE accommodation_bookings SET status='confirmed' WHERE id=?`,
      [id]
    );

    res.json({
      success: true,
      message: "Booking confirmed by accommodation management.",
    });
  } catch (err) {
    console.error("MGMT CONFIRM ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

router.put("/management/cancel/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getPool();

    await pool.query(
      `UPDATE accommodation_bookings SET status='cancelled' WHERE id=?`,
      [id]
    );

    res.json({
      success: true,
      message: "Booking has been cancelled by management.",
    });
  } catch (err) {
    console.error("MGMT CANCEL ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

/* -------------------------------------------------------
   EMAIL CONFIRM LINK → UPDATE + EMAIL USER + HTML PAGE
--------------------------------------------------------- */
router.get("/email/confirm/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getPool();

    const [rows] = await pool.query(
      `
      SELECT b.*, c.title AS accommodation_name
      FROM accommodation_bookings b
      JOIN content_items c ON b.accommodation_id = c.id
      WHERE b.id = ?
    `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).send("Invalid booking link.");
    }

    const booking = rows[0];

    await pool.query(
      `UPDATE accommodation_bookings SET status='confirmed' WHERE id=?`,
      [id]
    );

    const cleanInDate = formatDate(booking.check_in);
    const cleanOutDate = formatDate(booking.check_out);
    const cleanInTime = formatTime(booking.check_in_time);
    const cleanOutTime = formatTime(booking.check_out_time);

    await sendEmail(
      booking.user_email,
      `Your Booking is Confirmed – ${booking.accommodation_name}`,
      `
        <div style="font-family:Arial;padding:20px;color:#333;">
          <h2 style="color:#28a745;">Booking Confirmed</h2>
          <p>Hello <b>${booking.user_name}</b>,</p>
          <p>Your booking at <b>${booking.accommodation_name}</b> has been officially confirmed by the accommodation management.</p>

          <h3>Booking Details</h3>
          <p><b>Accommodation:</b> ${booking.accommodation_name}</p>
          <p><b>Check-in:</b> ${cleanInDate || "-"}${
        cleanInTime ? " at " + cleanInTime : ""
      }</p>
          <p><b>Check-out:</b> ${cleanOutDate || "-"}${
        cleanOutTime ? " at " + cleanOutTime : ""
      }</p>
          <p><b>Guests:</b> ${booking.guests}</p>

          <p>Please contact the management if you need additional assistance.</p>

          <br />
          <p style="color:#555;">Thank you for using Discover Mansalay!</p>
          <p style="font-size:12px;color:#888;">This is an automated message, please do not reply.</p>
        </div>
      `
    );

    return res.send(`
      <html>
      <head>
        <title>Booking Confirmed</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background:#f1f5f9;
            padding:40px;
            display:flex;
            justify-content:center;
            align-items:center;
          }
          .card {
            background:#fff;
            padding:30px 40px;
            border-radius:14px;
            max-width:480px;
            text-align:center;
            box-shadow:0 6px 20px rgba(0,0,0,0.12);
          }
          .icon { font-size:60px; color:#28a745; }
          h2 { color:#28a745; margin-top:10px; }
          p { color:#444; }
          .footer { margin-top:25px; font-size:13px; color:#888; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">✔</div>
          <h2>Booking Confirmed</h2>
          <p>The user has been notified of the confirmation.</p>
          <p>You may now coordinate with the guest for further arrangements.</p>
          <div class="footer">Powered by Discover Mansalay</div>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send("An error occurred.");
  }
});

/* -------------------------------------------------------
   EMAIL CANCEL LINK → UPDATE + EMAIL USER + HTML PAGE
--------------------------------------------------------- */
router.get("/email/cancel/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getPool();

    const [rows] = await pool.query(
      `
      SELECT b.*, c.title AS accommodation_name
      FROM accommodation_bookings b
      JOIN content_items c ON b.accommodation_id = c.id
      WHERE b.id = ?
    `,
      [id]
    );

    if (!rows.length) {
      return res.status(404).send("Invalid booking link.");
    }

    const booking = rows[0];

    await pool.query(
      `UPDATE accommodation_bookings SET status='cancelled' WHERE id=?`,
      [id]
    );

    const cleanInDate = formatDate(booking.check_in);
    const cleanOutDate = formatDate(booking.check_out);
    const cleanInTime = formatTime(booking.check_in_time);
    const cleanOutTime = formatTime(booking.check_out_time);

    await sendEmail(
      booking.user_email,
      `Your Booking was Cancelled – ${booking.accommodation_name}`,
      `
        <div style="font-family:Arial;padding:20px;color:#333;">
          <h2 style="color:#d9534f;">Booking Cancelled</h2>
          <p>Hello <b>${booking.user_name}</b>,</p>
          <p>Unfortunately, your booking at <b>${booking.accommodation_name}</b> has been declined by the accommodation management.</p>

          <h3>Booking Details</h3>
          <p><b>Check-in:</b> ${cleanInDate || "-"}${
        cleanInTime ? " at " + cleanInTime : ""
      }</p>
          <p><b>Check-out:</b> ${cleanOutDate || "-"}${
        cleanOutTime ? " at " + cleanOutTime : ""
      }</p>
          <p><b>Guests:</b> ${booking.guests}</p>

          <p>If you believe this is a mistake, you may try booking again or contact the accommodation directly.</p>

          <br />
          <p style="color:#555;">We apologize for the inconvenience.</p>
          <p style="font-size:12px;color:#888;">This is an automated message, please do not reply.</p>
        </div>
      `
    );

    return res.send(`
      <html>
      <head>
        <title>Booking Cancelled</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background:#fdf2f2;
            padding:40px;
            display:flex;
            justify-content:center;
            align-items:center;
          }
          .card {
            background:#fff;
            padding:30px 40px;
            border-radius:14px;
            max-width:480px;
            text-align:center;
            box-shadow:0 6px 20px rgba(0,0,0,0.12);
          }
          .icon { font-size:60px; color:#d9534f; }
          h2 { color:#d9534f; margin-top:10px; }
          p { color:#444; }
          .footer { margin-top:25px; font-size:13px; color:#888; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">✖</div>
          <h2>Booking Cancelled</h2>
          <p>The user has been notified about the cancellation.</p>
          <div class="footer">Powered by Discover Mansalay</div>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send("An error occurred.");
  }
});

module.exports = router;
