const express = require('express');
const router = express.Router();
const { getPool } = require('../../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Upload folders
const uploadFolder = path.join(__dirname, '../../uploads');
const homeBackgroundFolder = path.join(uploadFolder, 'home-background');

if (!fs.existsSync(uploadFolder)) fs.mkdirSync(uploadFolder);
if (!fs.existsSync(homeBackgroundFolder)) fs.mkdirSync(homeBackgroundFolder);

// Multer storage
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, homeBackgroundFolder),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname);
    const fixedName = 'home_background' + ext;
    console.log('[MULTER] Saving as:', fixedName);
    cb(null, fixedName);
  },
});

const upload = multer({ storage });

// Utility: Create dedup hash
function generateHash(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/* ---------------------------------------------------------
 * GET HERO CONTENT (latest)
 * --------------------------------------------------------- */
router.get('/', async (req, res) => {
  try {
    const pool = await getPool();

    const [rows] = await pool.query(
      "SELECT * FROM content_items WHERE source='hero' ORDER BY id DESC LIMIT 1"
    );

    if (rows.length === 0)
      return res.status(404).json({ message: 'No hero content found' });

    res.json(rows[0]);
  } catch (err) {
    console.error('[HERO GET ERROR]', err);
    res.status(500).json({ error: err.message });
  }
});

/* ---------------------------------------------------------
 * PATCH: UPDATE HERO CONTENT
 * Inserts new row into content_items (versioning)
 * --------------------------------------------------------- */
router.patch('/', upload.single('media'), async (req, res) => {
  try {
    const pool = await getPool();
    const { title, subtitle } = req.body;

    const [rows] = await pool.query(
      "SELECT * FROM content_items WHERE source='hero' ORDER BY id DESC LIMIT 1"
    );
    const current = rows[0];

    let media_type = current?.media_type || 'image';
    let media_path = current?.media_path || 'uploads/home-background/default.jpg';

    // If file uploaded
    if (req.file) {
      media_path = `uploads/home-background/${req.file.filename}`;
      media_type = req.file.mimetype.startsWith('video/') ? 'video' : 'image';

      // Delete old media if replaced
      if (current?.media_path && current.media_path !== media_path) {
        const oldPath = path.join(__dirname, '../../', current.media_path);
        fs.unlink(oldPath, (err) => {
          if (err) {
            console.warn('[DELETE FAILED] Old file not removed:', err.message);
          } else {
            console.log('[DELETE FILE] Old hero media removed:', current.media_path);
          }
        });
      }
    }

    // Create dedup hash
    const dedup_hash = generateHash(`${title}|${subtitle}|${media_path}`);

    // Insert new "version"
    await pool.query(
      `INSERT INTO content_items 
      (source, title, description, media_type, media_path, dedup_hash) 
      VALUES (?, ?, ?, ?, ?, ?)`,
      ['hero', title, subtitle, media_type, media_path, dedup_hash]
    );

    res.json({ message: 'Hero content updated successfully' });
  } catch (err) {
    console.error('[HERO PATCH ERROR]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
