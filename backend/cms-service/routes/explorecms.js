const express = require('express');
const router = express.Router();
const { getPool } = require('../../config/db');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');

// ---------- Helpers ----------
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

function hashContent(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// ---------- Multer Storage ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/top_destinations');
    fs.mkdir(uploadDir, { recursive: true }, (err) => {
      if (err) return cb(err);
      cb(null, uploadDir);
    });
  },

  filename: (req, file, cb) => {
    const title = req.body.title || 'untitled';
    const safeTitle = slugify(title);
    const ext = path.extname(file.originalname);
    cb(null, `${safeTitle}${ext}`);
  },
});

const upload = multer({ storage });

// ---------------------------------------------------------------------------
// GET ALL TOP DESTINATIONS
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      "SELECT * FROM content_items WHERE source='top_destination' ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ---------------------------------------------------------------------------
// POST: ADD NEW DESTINATION
// ---------------------------------------------------------------------------
router.post('/', upload.single('image'), async (req, res) => {
  const { title, city, email, contact } = req.body;
  const file = req.file;

  if (!title || !city || !file) {
    return res.status(400).json({ error: 'Title, city, and image are required' });
  }

  const media_path = `uploads/top_destinations/${file.filename}`;
  const media_type = file.mimetype.startsWith('video') ? 'video' : 'image';

  const dedup_hash = hashContent(`${title}|${city}|${media_path}`);

  try {
    const pool = await getPool();
    const [result] = await pool.query(
      `INSERT INTO content_items 
        (source, title, city, email, contact, media_type, media_path, dedup_hash)
       VALUES 
        (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'top_destination',
        title,
        city,
        email || null,
        contact || null,
        media_type,
        media_path,
        dedup_hash,
      ]
    );

    res.status(201).json({ message: 'Destination added', id: result.insertId });
  } catch (err) {
    console.error('Insert error:', err);
    res.status(500).json({ error: 'Failed to save destination' });
  }
});

// ---------------------------------------------------------------------------
// PUT: UPDATE DESTINATION
// ---------------------------------------------------------------------------
router.put('/:id', upload.single('image'), async (req, res) => {
  const id = req.params.id;
  const { title, city, email, contact } = req.body;
  const file = req.file;

  if (!title || !city) {
    return res.status(400).json({ error: 'Title and city are required' });
  }

  try {
    const pool = await getPool();
    const [existing] = await pool.query(
      "SELECT * FROM content_items WHERE id=? AND source='top_destination'",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ message: 'Destination not found' });
    }

    const current = existing[0];
    let media_path = current.media_path;
    let media_type = current.media_type;

    // If a new image was uploaded
    if (file) {
      media_path = `uploads/top_destinations/${file.filename}`;
      media_type = file.mimetype.startsWith('video') ? 'video' : 'image';

      // Delete old image
      if (current.media_path && current.media_path !== media_path) {
        const oldPath = path.join(__dirname, '../../', current.media_path);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
    }

    const dedup_hash = hashContent(`${title}|${city}|${media_path}`);

    await pool.query(
      `UPDATE content_items 
       SET title=?, city=?, email=?, contact=?, media_type=?, media_path=?, dedup_hash=? 
       WHERE id=? AND source='top_destination'`,
      [
        title,
        city,
        email || null,
        contact || null,
        media_type,
        media_path,
        dedup_hash,
        id,
      ]
    );

    res.json({ message: 'Destination updated' });
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ message: 'Update failed' });
  }
});

// ---------------------------------------------------------------------------
// DELETE DESTINATION
// ---------------------------------------------------------------------------
router.delete('/:id', async (req, res) => {
  const id = req.params.id;

  try {
    const pool = await getPool();
    const [existing] = await pool.query(
      "SELECT media_path FROM content_items WHERE id=? AND source='top_destination'",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ message: 'Destination not found' });
    }

    const imagePath = existing[0].media_path;

    // Delete the file
    if (imagePath) {
      const fullPath = path.join(__dirname, '../../', imagePath);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }

    await pool.query(
      "DELETE FROM content_items WHERE id=? AND source='top_destination'",
      [id]
    );

    res.json({ message: 'Destination deleted' });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ message: 'Delete failed' });
  }
});

module.exports = router;
