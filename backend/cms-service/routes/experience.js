const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getPool } = require('../../config/db');

// Upload directory
const uploadDir = path.join(__dirname, '../../uploads/experience');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = req.body.title?.toLowerCase().replace(/\s+/g, '-') || 'image';
    cb(null, `${base}-${Date.now()}${ext}`);
  },
});
const upload = multer({ storage });

// Use .fields to reliably handle files and text
const uploadFields = upload.fields([
  { name: 'image', maxCount: 1 },
]);

// GET all cards
router.get('/', async (req, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query('SELECT * FROM experience_cards ORDER BY id ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST new card
router.post('/', uploadFields, async (req, res) => {
  const title = req.body.title;
  const link = req.body.link;
  const imagePath = req.files?.image ? `experience/${req.files.image[0].filename}` : null;

  try {
    const pool = await getPool();

    const [existing] = await pool.query('SELECT COUNT(*) AS count FROM experience_cards');
    if (existing[0].count >= 6) {
      return res.status(400).json({ error: 'Maximum of 6 experience cards allowed' });
    }

    await pool.query(
      'INSERT INTO experience_cards (title, link, image_path, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
      [title, link, imagePath]
    );

    res.status(201).json({ message: 'Card added' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update card
router.put('/:id', uploadFields, async (req, res) => {
  const { id } = req.params;
  const title = req.body.title;
  const link = req.body.link;
  const imagePath = req.files?.image ? `experience/${req.files.image[0].filename}` : null;

  try {
    const pool = await getPool();

    let query = 'UPDATE experience_cards SET title=?, link=?, updated_at=NOW()';
    const params = [title, link];

    if (imagePath) {
      query += ', image_path=?';
      params.push(imagePath);
    }

    query += ' WHERE id=?';
    params.push(id);

    await pool.query(query, params);
    res.json({ message: 'Card updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE card
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const pool = await getPool();

    const [rows] = await pool.query('SELECT image_path FROM experience_cards WHERE id=?', [id]);
    if (rows.length > 0 && rows[0].image_path) {
      const filePath = path.join(uploadDir, path.basename(rows[0].image_path));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await pool.query('DELETE FROM experience_cards WHERE id=?', [id]);
    res.json({ message: 'Card deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
