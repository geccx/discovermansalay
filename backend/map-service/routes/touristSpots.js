// backend/map-service/routes/touristSpots.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { getPool } = require('../../config/db');

const router = express.Router();

/* ---------------------------------------------
   UPLOADS SETUP
--------------------------------------------- */

const candidateBaseFolders = [
  path.join(__dirname, '..', '..', 'uploads'), // root/uploads
  path.join(__dirname, '..', 'uploads'),       // map-service/uploads
  path.join(process.cwd(), 'uploads'),
];

let baseUploads = candidateBaseFolders.find((p) => {
  try {
    return fs.existsSync(p) && fs.statSync(p).isDirectory();
  } catch (e) {
    return false;
  }
});

if (!baseUploads) {
  baseUploads = path.join(__dirname, '..', '..', 'uploads');
  fs.mkdirSync(baseUploads, { recursive: true });
}

const touristSpotsDir = path.join(baseUploads, 'touristspotsmap');
if (!fs.existsSync(touristSpotsDir)) {
  fs.mkdirSync(touristSpotsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, touristSpotsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/\s+/g, '_');
    const unique = Date.now();
    cb(null, `${base}_${unique}${ext}`);
  },
});

const upload = multer({ storage });

/* ---------------------------------------------
   HELPERS
--------------------------------------------- */

function buildImageUrl(mediaPath) {
  if (!mediaPath) return null;
  // relative path so it works on both local & Railway
  return `/uploads/touristspotsmap/${encodeURIComponent(mediaPath)}`;
}

/* ---------------------------------------------
   GET ALL SPOTS (with avg rating + count)
--------------------------------------------- */

router.get('/', async (req, res) => {
  try {
    const pool = await getPool();

    const [spots] = await pool.query(
      'SELECT id, name, lat, lng, category, media_path FROM tourist_spots ORDER BY name ASC'
    );

    const [stats] = await pool.query(
      `SELECT spot_id, AVG(rating) AS avg_rating, COUNT(*) AS rating_count
       FROM tourist_spot_reviews
       GROUP BY spot_id`
    );

    const statsMap = new Map();
    stats.forEach((row) => {
      statsMap.set(row.spot_id, {
        avg_rating: row.avg_rating ? Number(row.avg_rating) : null,
        rating_count: row.rating_count || 0,
      });
    });

    const withMeta = spots.map((spot) => {
      const s = statsMap.get(spot.id) || { avg_rating: null, rating_count: 0 };
      return {
        ...spot,
        image_url: buildImageUrl(spot.media_path),
        avg_rating: s.avg_rating,
        rating_count: s.rating_count,
      };
    });

    res.json(withMeta);
  } catch (err) {
    console.error('Error fetching tourist spots:', err);
    res.status(500).json({ error: 'Failed to fetch tourist spots' });
  }
});

/* ---------------------------------------------
   GET SINGLE SPOT
--------------------------------------------- */

router.get('/:id', async (req, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      'SELECT id, name, lat, lng, category, media_path FROM tourist_spots WHERE id = ?',
      [req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Spot not found' });
    }
    const spot = rows[0];
    spot.image_url = buildImageUrl(spot.media_path);
    res.json(spot);
  } catch (err) {
    console.error('Error fetching spot:', err);
    res.status(500).json({ error: 'Failed to fetch spot' });
  }
});

/* ---------------------------------------------
   CREATE SPOT
--------------------------------------------- */

router.post('/', upload.single('image'), async (req, res) => {
  const { name, lat, lng, category } = req.body;

  if (!name || lat === undefined || lng === undefined || !category) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const mediaPath = req.file ? req.file.filename : null;

  try {
    const pool = await getPool();
    const [result] = await pool.query(
      'INSERT INTO tourist_spots (name, lat, lng, category, media_path) VALUES (?,?,?,?,?)',
      [name, lat, lng, category, mediaPath]
    );

    res.status(201).json({
      id: result.insertId,
      name,
      lat,
      lng,
      category,
      media_path: mediaPath,
      image_url: buildImageUrl(mediaPath),
    });
  } catch (err) {
    console.error('Error creating spot:', err);
    res.status(500).json({ error: 'Failed to create spot' });
  }
});

/* ---------------------------------------------
   UPDATE SPOT
--------------------------------------------- */

router.put('/:id', upload.single('image'), async (req, res) => {
  const { name, lat, lng, category } = req.body;
  const id = req.params.id;

  try {
    const pool = await getPool();

    const [rows] = await pool.query(
      'SELECT media_path FROM tourist_spots WHERE id = ?',
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Spot not found' });
    }

    let mediaPath = rows[0].media_path;

    if (req.file) {
      const newFile = req.file.filename;

      if (mediaPath) {
        fs.unlink(path.join(touristSpotsDir, mediaPath), () => {});
      }

      mediaPath = newFile;
    }

    await pool.query(
      `UPDATE tourist_spots
       SET name = ?, lat = ?, lng = ?, category = ?, media_path = ?
       WHERE id = ?`,
      [name, lat, lng, category, mediaPath, id]
    );

    res.json({
      id,
      name,
      lat,
      lng,
      category,
      media_path: mediaPath,
      image_url: buildImageUrl(mediaPath),
    });
  } catch (err) {
    console.error('Error updating spot:', err);
    res.status(500).json({ error: 'Failed to update spot' });
  }
});

/* ---------------------------------------------
   DELETE SPOT
--------------------------------------------- */

router.delete('/:id', async (req, res) => {
  try {
    const pool = await getPool();

    const [rows] = await pool.query(
      'SELECT media_path FROM tourist_spots WHERE id = ?',
      [req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Spot not found' });
    }

    const mediaPath = rows[0].media_path;

    await pool.query('DELETE FROM tourist_spots WHERE id = ?', [
      req.params.id,
    ]);

    if (mediaPath) {
      const filePath = path.join(touristSpotsDir, mediaPath);
      fs.unlink(filePath, (err) => {
        if (err) console.warn('Could not delete image file:', err.message);
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting spot:', err);
    res.status(500).json({ error: 'Failed to delete spot' });
  }
});

/* ---------------------------------------------
   REVIEWS & RATINGS
--------------------------------------------- */

router.get('/:id/reviews', async (req, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      `SELECT id, user_name, rating, comment, created_at
       FROM tourist_spot_reviews
       WHERE spot_id = ?
       ORDER BY created_at DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching reviews:', err);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

router.post('/:id/reviews', async (req, res) => {
  const { user_name, rating, comment } = req.body;
  const spotId = req.params.id;

  if (!user_name || !rating) {
    return res.status(400).json({ error: 'user_name and rating are required' });
  }

  const numericRating = Number(rating);
  if (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
    return res
      .status(400)
      .json({ error: 'rating must be a number between 1 and 5' });
  }

  try {
    const pool = await getPool();

    const [spots] = await pool.query(
      'SELECT id FROM tourist_spots WHERE id = ?',
      [spotId]
    );
    if (!spots.length) {
      return res.status(404).json({ error: 'Spot not found' });
    }

    const [result] = await pool.query(
      `INSERT INTO tourist_spot_reviews (spot_id, user_name, rating, comment)
       VALUES (?,?,?,?)`,
      [spotId, user_name, numericRating, comment || null]
    );

    res.status(201).json({
      id: result.insertId,
      spot_id: spotId,
      user_name,
      rating: numericRating,
      comment: comment || null,
    });
  } catch (err) {
    console.error('Error creating review:', err);
    res.status(500).json({ error: 'Failed to create review' });
  }
});

module.exports = router;
