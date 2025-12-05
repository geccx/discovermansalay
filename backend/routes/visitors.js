// backend/routes/visitors.js
const express = require("express");
const router = express.Router();
const { getPool } = require("../config/db");

// Helper to get client IP that works behind proxies (Railway, etc.)
function getClientIp(req) {
  const xfwd = req.headers["x-forwarded-for"];
  if (xfwd) {
    return xfwd.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || null;
}

// POST /api/visitors/track
router.post("/track", async (req, res) => {
  try {
    const pool = await getPool();

    const ip = getClientIp(req);
    const { browser, device, page } = req.body;

    await pool.query(
      `INSERT INTO visitors (ip_address, browser, device, page)
       VALUES (?, ?, ?, ?)`,
      [ip || "unknown", browser || "unknown", device || "unknown", page || "/"]
    );

    return res.json({ message: "Visitor tracked" });
  } catch (err) {
    console.error("VISITOR ERROR:", err);
    res.status(500).json({ message: "Server error saving visitor" });
  }
});

// GET /api/visitors
router.get("/", async (req, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      "SELECT * FROM visitors ORDER BY visit_time DESC"
    );
    res.json(rows);
  } catch (err) {
    console.error("VISITOR FETCH ERROR:", err);
    res.status(500).json({ message: "Error fetching visitors" });
  }
});

module.exports = router;
