// backend/destination-service/routes/destinations.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { getPool } = require('../../config/db');

const ALLOWED_CATEGORIES = [
  'Featured Destinations',
  'Beaches',
  'Restaurants',
  'Adventures',
  'Hotels & Resort',
  'Accommodations'
];

const isValidCategory = (c) => ALLOWED_CATEGORIES.includes(c);
const slugify = (t) => t.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const category = req.body.category;
    if (!isValidCategory(category)) return cb(new Error("Invalid category"));

    const uploadDir = path.join(__dirname, "../../uploads/destination", category);
    fs.mkdirSync(uploadDir, { recursive: true });

    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const name = slugify(req.body.title || 'destination');
    const ext = path.extname(file.originalname);
    cb(null, `${name}-${Date.now()}${ext}`);
  }
});

const upload = multer({ storage });

/* ---------------------------------------
   GET all destinations (source = "destination")
--------------------------------------- */
router.get("/", async (req, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.execute(
      `SELECT id, title, description, category, media_path 
       FROM content_items 
       WHERE source = 'destination'
       ORDER BY id DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ---------------------------------------
   CREATE destination
--------------------------------------- */
router.post("/", upload.single("image"), async (req, res) => {
  const { title, name, category, description } = req.body;
  if (!isValidCategory(category)) {
    return res.status(400).json({ error: "Invalid category" });
  }
  if (!req.file) {
    return res.status(400).json({ error: "Image required" });
  }

  const mediaPath = `/uploads/destination/${category}/${req.file.filename}`;
  const hash = crypto.createHash("sha256").update(req.file.filename).digest("hex");

  try {
    const pool = await getPool();
    await pool.execute(
      `INSERT INTO content_items (source, title, name, description, category, media_type, media_path, dedup_hash)
       VALUES ('destination', ?, ?, ?, ?, 'image', ?, ?)`,
      [title, name, description, category, mediaPath, hash]
    );

    res.status(201).json({ message: "Destination created", media_path: mediaPath });
  } catch (err) {
    res.status(500).json({ error: "DB Insert failed", details: err.message });
  }
});

/* ---------------------------------------
   UPDATE destination
--------------------------------------- */
router.put("/:id", upload.single("image"), async (req, res) => {
  const id = req.params.id;

  try {
    const pool = await getPool();
    const [rows] = await pool.execute(
      "SELECT * FROM content_items WHERE id = ? AND source = 'destination'",
      [id]
    );

    if (rows.length === 0) return res.status(404).json({ error: "Not found" });

    const old = rows[0];
    const { title, name, category, description } = req.body;

    let mediaPath = old.media_path;

    if (req.file) {
      const newPath = `/uploads/destination/${category}/${req.file.filename}`;
      mediaPath = newPath;

      // delete old file
      const oldFilePath = path.join(__dirname, "../../", old.media_path);
      if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
    }

    await pool.execute(
      `UPDATE content_items 
       SET title=?, name=?, description=?, category=?, media_path=? 
       WHERE id=? AND source='destination'`,
      [title, name, description, category, mediaPath, id]
    );

    res.json({ message: "Updated successfully" });
  } catch (err) {
    res.status(500).json({ error: "Update failed", details: err.message });
  }
});

/* ---------------------------------------
   DELETE destination
--------------------------------------- */
router.delete("/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const pool = await getPool();
    const [rows] = await pool.execute(
      "SELECT * FROM content_items WHERE id = ? AND source='destination'",
      [id]
    );

    if (rows.length === 0) return res.status(404).json({ error: "Not found" });

    const item = rows[0];

    // delete file
    const filePath = path.join(__dirname, "../../", item.media_path);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await pool.execute("DELETE FROM content_items WHERE id = ?", [id]);

    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Delete failed", details: err.message });
  }
});

module.exports = router;
