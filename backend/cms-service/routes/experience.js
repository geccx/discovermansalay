const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { getPool } = require('../../config/db');

const uploadDir = path.join(__dirname, '../../uploads/experience');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

function hashValue(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const base = req.body.title?.toLowerCase().replace(/\s+/g, '-') || 'card';
    const ext = path.extname(file.originalname);
    cb(null, `${base}-${Date.now()}${ext}`);
  }
});

const upload = multer({ storage });
const uploadFields = upload.fields([{ name: 'image', maxCount: 1 }]);

// ------------------------------------------------------------
// GET ALL EXPERIENCE CARDS
// ------------------------------------------------------------
router.get('/', async (_, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      "SELECT * FROM content_items WHERE source='experience' ORDER BY id ASC"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------
// ADD EXPERIENCE CARD
// ------------------------------------------------------------
router.post('/', uploadFields, async (req, res) => {
  const { title, link } = req.body;
  const file = req.files?.image?.[0];

  if (!title || !file) {
    return res.status(400).json({ error: 'Title and image are required' });
  }

  const media_path = `uploads/experience/${file.filename}`;
  const dedup_hash = hashValue(`${title}|${media_path}`);

  try {
    const pool = await getPool();

    const [countRows] = await pool.query(
      "SELECT COUNT(*) AS cnt FROM content_items WHERE source='experience'"
    );
    if (countRows[0].cnt >= 6) {
      return res.status(400).json({ error: 'Maximum of 6 experience cards allowed' });
    }

    await pool.query(
      `INSERT INTO content_items
        (source, title, link, media_type, media_path, category, dedup_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['experience', title, link || null, 'image', media_path, 'experience_card', dedup_hash]
    );

    res.status(201).json({ message: 'Experience card added' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------
// UPDATE EXPERIENCE CARD
// ------------------------------------------------------------
router.put('/:id', uploadFields, async (req, res) => {
  const { id } = req.params;
  const { title, link } = req.body;
  const file = req.files?.image?.[0];

  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      "SELECT * FROM content_items WHERE id=? AND source='experience'",
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Card not found' });
    }

    const current = rows[0];
    let media_path = current.media_path;

    if (file) {
      // Delete previous image
      const old = path.join(__dirname, '../../', current.media_path);
      if (fs.existsSync(old)) fs.unlinkSync(old);

      media_path = `uploads/experience/${file.filename}`;
    }

    const dedup_hash = hashValue(`${title}|${media_path}`);

    await pool.query(
      `UPDATE content_items SET title=?, link=?, media_path=?, dedup_hash=? WHERE id=?`,
      [title, link || null, media_path, dedup_hash, id]
    );

    res.json({ message: 'Experience card updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------
// DELETE EXPERIENCE CARD
// ------------------------------------------------------------
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const pool = await getPool();

    const [rows] = await pool.query(
      "SELECT media_path FROM content_items WHERE id=? AND source='experience'",
      [id]
    );

    if (rows.length > 0 && rows[0].media_path) {
      const img = path.join(__dirname, '../../', rows[0].media_path);
      if (fs.existsSync(img)) fs.unlinkSync(img);
    }

    await pool.query(
      "DELETE FROM content_items WHERE id=? AND source='experience'",
      [id]
    );

    res.json({ message: 'Card deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
