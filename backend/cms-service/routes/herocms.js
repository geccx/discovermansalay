const express = require('express');
const router = express.Router();
const { getPool } = require('../../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Define new upload folder
const uploadFolder = path.join(__dirname, '../../uploads');
const homeBackgroundFolder = path.join(uploadFolder, 'home-background');

// Ensure folders exist
if (!fs.existsSync(uploadFolder)) fs.mkdirSync(uploadFolder);
if (!fs.existsSync(homeBackgroundFolder)) fs.mkdirSync(homeBackgroundFolder);

// Multer storage setup with fixed filename: home_background + original ext
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, homeBackgroundFolder);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const fixedFilename = 'home_background' + ext;
    console.log('[MULTER] Saving file as:', fixedFilename);
    cb(null, fixedFilename);
  },
});

const upload = multer({ storage });

// GET latest hero content
router.get('/', async (req, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query('SELECT * FROM hero_content ORDER BY id DESC LIMIT 1');
    if (rows.length === 0) return res.status(404).json({ message: 'No content found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH update hero content
router.patch('/', upload.single('media'), async (req, res) => {
  try {
    const pool = await getPool();
    const { title, subtitle } = req.body;

    const [rows] = await pool.query('SELECT * FROM hero_content ORDER BY id DESC LIMIT 1');
    const current = rows[0];

    let media_type = 'image';
    let media_path;

    if (req.file) {
      media_path = `uploads/home-background/${req.file.filename}`;
      media_type = req.file.mimetype.startsWith('video/') ? 'video' : 'image';

      // Delete old media file if different
      if (
        current?.media_path &&
        current.media_path !== media_path &&
        !current.media_path.includes('default')
      ) {
        const oldFilePath = path.join(__dirname, '../../', current.media_path);
        fs.unlink(oldFilePath, (err) => {
          if (err) {
            console.error('[DELETE FILE ERROR] Failed to delete old media:', err);
          } else {
            console.log('[DELETE FILE] Old media deleted:', current.media_path);
          }
        });
      }
    } else {
      media_path = current?.media_path || 'uploads/home-background/default.jpg';
      media_type = current?.media_type || 'image';
    }

    await pool.query(
      'INSERT INTO hero_content (title, subtitle, media_type, media_path) VALUES (?, ?, ?, ?)',
      [title, subtitle, media_type, media_path]
    );

    res.json({ message: 'Hero content updated successfully' });
  } catch (err) {
    console.error('[PATCH ERROR]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
