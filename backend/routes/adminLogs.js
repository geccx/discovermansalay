const express = require("express");
const router = express.Router();
const { getPool } = require("../config/db");

// POST /api/adminlogs/add
router.post("/add", async (req, res) => {
  try {
    const { admin_id, action, details } = req.body;

    console.log("📥 Incoming Admin Log:", req.body);

    if (!admin_id || !action) {
      return res.status(400).json({
        message: "admin_id and action are required",
      });
    }

    const pool = await getPool();

    await pool.query(
      `INSERT INTO admin_logs (admin_id, action, details)
       VALUES (?, ?, ?)`,
      [admin_id, action, JSON.stringify(details || {})]
    );

    return res.json({ message: "Log saved" });
  } catch (err) {
    console.error("🔥 ADMIN LOG ERROR:", err);
    res.status(500).json({ message: "Error saving log" });
  }
});

// GET /api/adminlogs
router.get("/", async (req, res) => {
  try {
    const pool = await getPool();

    const [rows] = await pool.query(
      `SELECT admin_logs.*, users.firstname, users.lastname
       FROM admin_logs
       LEFT JOIN users ON admin_logs.admin_id = users.id
       ORDER BY admin_logs.timestamp DESC`
    );

    res.json(rows);
  } catch (err) {
    console.error("🔥 ADMIN LOG FETCH ERROR:", err);
    res.status(500).json({ message: "Error fetching admin logs" });
  }
});

module.exports = router;
