const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getPool } = require('../../config/db');

// VALID CATEGORIES
const ALLOWED_CATEGORIES = ['Beaches', 'Restaurants', 'Adventures', 'Hotels & Resort', 'Featured Destinations', 'Accommodations'];

// Helper: Validate category
const isValidCategory = (category) => ALLOWED_CATEGORIES.includes(category);

// Helper: Slugify
const slugify = (text) =>
  text.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-');

// Multer storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const category = req.body.category;
    if (!isValidCategory(category)) {
      return cb(new Error('Invalid category'), null);
    }

    const uploadPath = path.join(__dirname, '../../uploads/destination', category);
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const name = slugify(req.body.name || 'destination');
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now();
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  },
});
const upload = multer({ storage });

// GET all destinations
router.get('/', async (req, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.execute('SELECT * FROM destinations ORDER BY id DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch destinations', details: err.message });
  }
});

// CREATE destination
router.post('/', upload.single('image'), async (req, res) => {
  const { name, category, description } = req.body;

  if (!isValidCategory(category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'Image is required' });
  }

  const image = `/uploads/destination/${category}/${req.file.filename}`;

  try {
    const pool = await getPool();
    await pool.execute(
      'INSERT INTO destinations (name, category, description, image) VALUES (?, ?, ?, ?)',
      [name, category, description, image]
    );
    res.status(201).json({ message: 'Destination created successfully', image });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create destination', details: err.message });
  }
});

// UPDATE destination
router.put('/:id', upload.single('image'), async (req, res) => {
  const { name, category, description } = req.body;
  const id = req.params.id;

  if (category && !isValidCategory(category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }

  try {
    const pool = await getPool();
    const [rows] = await pool.execute('SELECT * FROM destinations WHERE id = ?', [id]);
    const old = rows[0];
    if (!old) return res.status(404).json({ error: 'Destination not found' });

    let query = 'UPDATE destinations SET name = ?, category = ?, description = ?';
    const values = [name, category || old.category, description];

    if (req.file) {
      const newImagePath = `/uploads/destination/${category}/${req.file.filename}`;
      query += ', image = ?';
      values.push(newImagePath);

      // Delete old image
      const oldPath = path.join(__dirname, '../../', old.image);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    query += ' WHERE id = ?';
    values.push(id);

    await pool.execute(query, values);
    res.json({ message: 'Destination updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Update failed', details: err.message });
  }
});

// DELETE destination
router.delete('/:id', async (req, res) => {
  const id = req.params.id;

  try {
    const pool = await getPool();
    const [rows] = await pool.execute('SELECT * FROM destinations WHERE id = ?', [id]);
    const dest = rows[0];
    if (!dest) return res.status(404).json({ error: 'Destination not found' });

    const imagePath = path.join(__dirname, '../../', dest.image);
    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);

    await pool.execute('DELETE FROM destinations WHERE id = ?', [id]);
    res.json({ message: 'Destination deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Deletion failed', details: err.message });
  }
});

module.exports = router;
