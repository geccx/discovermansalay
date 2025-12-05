const express = require("express");
const { getPool } = require("../../config/db");
const router = express.Router();

/* ======================================================
   GET all wishlist items for a user
====================================================== */
router.get("/:username", async (req, res) => {
  const { username } = req.params;

  try {
    const pool = await getPool();

    const [rows] = await pool.query(
      `SELECT id, username, item_id, name, category, image_path, added_at
       FROM wishlist
       WHERE username = ?
       ORDER BY added_at DESC`,
      [username]
    );

    // Frontend expects ARRAY
    return res.json(rows || []);
  } catch (err) {
    console.error("Wishlist Fetch Error:", err);
    // On error, still return an array so frontend doesn't crash
    return res.status(500).json([]);
  }
});

/* ======================================================
   ADD an item to wishlist
====================================================== */
router.post("/", async (req, res) => {
  const { username, item_id, name, category, image_path } = req.body;

  if (!username || !item_id || !name || !category || !image_path) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const pool = await getPool();

    // Prevent duplicates
    const [existing] = await pool.query(
      "SELECT id FROM wishlist WHERE username = ? AND item_id = ? LIMIT 1",
      [username, item_id]
    );

    if (existing.length > 0) {
      return res.status(409).json({ message: "Item already in wishlist" });
    }

    await pool.query(
      `INSERT INTO wishlist (username, item_id, name, category, image_path)
       VALUES (?, ?, ?, ?, ?)`,
      [username, item_id, name, category, image_path]
    );

    res.status(201).json({ message: "Item added to wishlist" });
  } catch (err) {
    console.error("Wishlist Add Error:", err);
    res.status(500).json({ message: "Failed to add item" });
  }
});

/* ======================================================
   DELETE an item
====================================================== */
router.delete("/:username/:item_id", async (req, res) => {
  const { username, item_id } = req.params;

  try {
    const pool = await getPool();

    const [result] = await pool.query(
      "DELETE FROM wishlist WHERE username = ? AND item_id = ?",
      [username, item_id]
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Item not found" });

    res.json({ message: "Item removed from wishlist", item_id });
  } catch (err) {
    console.error("Wishlist Delete Error:", err);
    res.status(500).json({ message: "Failed to delete item" });
  }
});

module.exports = router;
