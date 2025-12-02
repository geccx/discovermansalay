const express = require('express');
const router = express.Router();
const { getPool } = require('../../config/db');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

// Helper function to slugify title into a safe filename
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-');        // Replace multiple - with single -
}

// Multer storage setup - save to uploads/top_destinations with filename based on title
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/top_destinations');
    fs.mkdir(uploadDir, { recursive: true }, (err) => {
      if (err) return cb(err);
      cb(null, uploadDir);
    });
  },
  filename: (req, file, cb) => {
    // Get title from request body, slugify it for filename
    const title = req.body.title || 'untitled';
    const safeTitle = slugify(title);

    // Use original file extension
    const ext = path.extname(file.originalname);

    // Compose filename like: title + ext
    const filename = `${safeTitle}${ext}`;
    cb(null, filename);
  },
});

const upload = multer({ storage });

// GET all destinations
router.get('/', async (req, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query('SELECT * FROM explorecms ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST new destination with image
router.post('/', upload.single('image'), async (req, res) => {
  const { title, city, email, contact } = req.body;
  const image_path = req.file ? req.file.filename : null;

  if (!title || !city || !image_path) {
    return res.status(400).json({ error: 'Title, city, and image are required' });
  }

  try {
    const pool = await getPool();
    const [result] = await pool.query(
      'INSERT INTO explorecms (title, city, email, contact, image_path) VALUES (?, ?, ?, ?, ?)',
      [title, city, email || null, contact || null, image_path]
    );
    res.status(201).json({ message: 'Destination added', id: result.insertId });
  } catch (err) {
    console.error('Insert error:', err);
    res.status(500).json({ error: 'Failed to save destination' });
  }
});

// PUT update destination (optional image upload)
router.put('/:id', upload.single('image'), async (req, res) => {
  const id = req.params.id;
  const { title, city, email, contact } = req.body;
  const newImagePath = req.file ? req.file.filename : null;

  if (!title || !city) {
    return res.status(400).json({ error: 'Title and city are required' });
  }

  try {
    const pool = await getPool();

    const [existing] = await pool.query('SELECT * FROM explorecms WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Destination not found' });
    }

    // Delete old image if replaced and different filename
    if (newImagePath && existing[0].image_path && existing[0].image_path !== newImagePath) {
      const oldImageFullPath = path.join(__dirname, '../../uploads/top_destinations', existing[0].image_path);
      if (fs.existsSync(oldImageFullPath)) {
        fs.unlinkSync(oldImageFullPath);
      }
    }

    let query = 'UPDATE explorecms SET title = ?, city = ?, email = ?, contact = ?';
    const params = [title, city, email || null, contact || null];

    if (newImagePath) {
      query += ', image_path = ?';
      params.push(newImagePath);
    }

    query += ' WHERE id = ?';
    params.push(id);

    await pool.query(query, params);
    res.json({ message: 'Destination updated' });
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ message: 'Update failed' });
  }
});

// DELETE a destination by id (remove DB record and image file)
router.delete('/:id', async (req, res) => {
  const id = req.params.id;

  try {
    const pool = await getPool();

    const [existing] = await pool.query('SELECT image_path FROM explorecms WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Destination not found' });
    }

    const imagePath = existing[0].image_path;
    if (imagePath) {
      const fullImagePath = path.join(__dirname, '../../uploads/top_destinations', imagePath);
      if (fs.existsSync(fullImagePath)) {
        fs.unlinkSync(fullImagePath);
      }
    }

    const [result] = await pool.query('DELETE FROM explorecms WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Destination not found' });
    }

    res.json({ message: 'Destination deleted' });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ message: 'Delete failed' });
  }
});

module.exports = router;
