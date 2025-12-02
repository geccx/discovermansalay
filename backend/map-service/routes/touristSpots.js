const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getPool } = require('../../config/db');
const router = express.Router();

const candidateBaseFolders = [
  path.join(__dirname, '..', '..', 'uploads'),
  path.join(__dirname, '..', 'uploads'),
  path.join(process.cwd(), 'uploads'),
];

let baseUploads = candidateBaseFolders.find(p => {
  try { return fs.existsSync(p) && fs.statSync(p).isDirectory(); }
  catch (e) { return false; }
});

if (!baseUploads) {
  baseUploads = path.join(__dirname, '..', '..', 'uploads');
  fs.mkdirSync(baseUploads, { recursive: true });
}

const uploadDir = path.join(baseUploads, 'touristspotsmap');
fs.mkdirSync(uploadDir, { recursive: true });

// multer storage & limits
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const name = `${Date.now()}-${Math.round(Math.random()*1e9)}${ext}`;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed.'));
  }
});

// helper to generate absolute image URL
function makeImageUrl(req, filename) {
  const base = process.env.MAP_SERVICE_BASE_URL || `${req.protocol}://${req.get('host')}`;
  return filename ? `${base.replace(/\/$/, '')}/uploads/touristspotsmap/${encodeURIComponent(filename)}` : null;
}

// GET
router.get('/', async (req, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query('SELECT * FROM tourist_spots ORDER BY id DESC');
    const mapped = rows.map(r => ({ ...r, image_url: makeImageUrl(req, r.image) }));
    res.json(mapped);
  } catch (err) {
    console.error('Error fetching tourist spots:', err);
    res.status(500).json({ error: 'Error fetching tourist spots', message: err.message });
  }
});

// ADD
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { name, lat, lng, category } = req.body;
    const image = req.file?.filename || null;

    if (!name || !lat || !lng || !category) {
      return res.status(400).json({ error: 'Fields name, lat, lng, category are required.' });
    }

    const pool = await getPool();
    const [result] = await pool.query(
      'INSERT INTO tourist_spots (name, lat, lng, category, image) VALUES (?, ?, ?, ?, ?)',
      [name, parseFloat(lat), parseFloat(lng), category, image]
    );

    res.status(201).json({ message: 'Tourist spot added successfully.', id: result.insertId, image });
  } catch (err) {
    console.error('Error adding spot:', err);
    res.status(500).json({ error: 'Internal server error.', message: err.message });
  }
});

// UPDATE
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, lat, lng, category } = req.body;
    const image = req.file?.filename || null;

    if (!name || !lat || !lng || !category) {
      return res.status(400).json({ error: 'Fields name, lat, lng, category are required.' });
    }

    const pool = await getPool();
    const [rows] = await pool.query('SELECT image FROM tourist_spots WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Tourist spot not found.' });

    const oldImage = rows[0].image;
    if (image && oldImage) {
      const oldPath = path.join(uploadDir, oldImage);
      try { if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath); } catch (e) { console.warn('Failed delete old image:', e.message); }
    }

    await pool.query(
      `UPDATE tourist_spots SET name=?, lat=?, lng=?, category=?, image=COALESCE(?, image) WHERE id=?`,
      [name, parseFloat(lat), parseFloat(lng), category, image, id]
    );

    res.json({ message: 'Tourist spot updated successfully.', image });
  } catch (err) {
    console.error('Error updating spot:', err);
    res.status(500).json({ error: 'Internal server error.', message: err.message });
  }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getPool();
    const [rows] = await pool.query('SELECT image FROM tourist_spots WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const filename = rows[0].image;
    if (filename) {
      const filePath = path.join(uploadDir, filename);
      try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (err) { console.warn('Failed to delete file', err.message); }
    }

    await pool.query('DELETE FROM tourist_spots WHERE id = ?', [id]);
    res.json({ message: 'Tourist spot deleted.' });
  } catch (err) {
    console.error('Error deleting tourist spot:', err);
    res.status(500).json({ error: 'Error deleting tourist spot', message: err.message });
  }
});

module.exports = router;
