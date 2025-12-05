const express = require("express");
const router = express.Router();
const { getPool } = require("../../config/db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

/* STORAGE CONFIG */
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "accommodation-" + name + ext);
  },
});

const upload = multer({ storage });

/* GET ALL ACCOMMODATIONS */
router.get("/", async (_, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query(`
      SELECT * FROM content_items WHERE category='Accommodations' ORDER BY id DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* CREATE */
router.post("/", upload.single("media_path"), async (req, res) => {
  try {
    const { title, description, city, email, contact } = req.body;

    const media = req.file ? `/uploads/${req.file.filename}` : null;

    const pool = await getPool();
    await pool.query(
      `
      INSERT INTO content_items 
      (source, title, description, category, city, email, contact, media_path, dedup_hash)
      VALUES ('cms', ?, ?, 'Accommodations', ?, ?, ?, ?, MD5(CONCAT(?, NOW())))
      `,
      [title, description, city, email, contact, media, title]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("ADD ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

/* UPDATE */
router.put("/:id", upload.single("media_path"), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, city, email, contact } = req.body;

    const pool = await getPool();

    const [rows] = await pool.query(
      `SELECT media_path FROM content_items WHERE id=?`,
      [id]
    );

    let mediaPath = rows[0]?.media_path;

    if (req.file) {
      mediaPath = `/uploads/${req.file.filename}`;
      if (rows[0]?.media_path) {
        const oldPath = path.join(process.cwd(), rows[0].media_path);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
    }

    await pool.query(
      `
      UPDATE content_items
      SET title=?, description=?, city=?, email=?, contact=?, media_path=?
      WHERE id=?
      `,
      [title, description, city, email, contact, mediaPath, id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("UPDATE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

/* DELETE */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getPool();

    const [rows] = await pool.query(
      `SELECT media_path FROM content_items WHERE id=?`,
      [id]
    );

    if (rows.length === 0)
      return res.status(404).json({ error: "Not found" });

    const mediaPath = rows[0].media_path;

    await pool.query(`DELETE FROM content_items WHERE id=?`, [id]);

    if (mediaPath) {
      const file = path.join(process.cwd(), mediaPath);
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("DELETE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
