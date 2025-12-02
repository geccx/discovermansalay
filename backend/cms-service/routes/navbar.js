const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getPool } = require('../../config/db');

// ✅ Ensure uploads/logo directory exists
const logoDir = path.join(__dirname, '../../uploads/logo');
if (!fs.existsSync(logoDir)) {
  fs.mkdirSync(logoDir, { recursive: true });
}

// ✅ Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, logoDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, 'logo' + ext.toLowerCase()); // Always lowercase extension
  },
});
const upload = multer({ storage });

// ✅ GET current navbar logo info
router.get('/', async (req, res) => {
  try {
    const pool = await getPool();
    const [results] = await pool.query('SELECT * FROM navbar LIMIT 1');
    if (results.length === 0) {
      return res.json({ logo: '' });
    }
    res.json({ logo: results[0].logo });
  } catch (err) {
    console.error('Error fetching navbar logo:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ✅ POST update navbar logo
router.post('/logo', upload.single('logo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  // Browser-accessible path (matches frontend: /uploads/logo/logo.png)
  const logoPath = `logo/${req.file.filename}`;

  try {
    const pool = await getPool();

    // Update or insert the logo record
    const [existing] = await pool.query('SELECT * FROM navbar WHERE id = 1');
    if (existing.length > 0) {
      await pool.query('UPDATE navbar SET logo = ? WHERE id = 1', [logoPath]);
    } else {
      await pool.query('INSERT INTO navbar (id, logo) VALUES (1, ?)', [logoPath]);
    }

    res.json({ message: 'Logo uploaded successfully', logo: logoPath });
  } catch (err) {
    console.error('Error saving logo to DB:', err);
    res.status(500).json({ error: 'Database update failed' });
  }
});

module.exports = router;
