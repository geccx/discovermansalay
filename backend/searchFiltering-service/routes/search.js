const express = require('express');
const router = express.Router();
const { getPool } = require('../../config/db');

// Allow keyword match (partial match)
router.get('/', async (req, res) => {
  const { q = '' } = req.query;
  const keyword = q.trim().toLowerCase();

  if (!keyword) return res.json({ results: [] });

  try {
    const pool = await getPool();
    const query = `
      SELECT id, name, category, image
      FROM destinations
      WHERE LOWER(name) LIKE ?
    `;
    const [rows] = await pool.query(query, [`%${keyword}%`]);

    const results = rows.map(item => ({
      ...item,
      image_url: item.image,
    }));

    res.json({ results });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Optional: keep suggestions starting with typed letters
router.get('/suggestions', async (req, res) => {
  const { q = '' } = req.query;
  const keyword = q.trim().toLowerCase();

  if (!keyword) return res.json({ suggestions: [] });

  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      `SELECT DISTINCT name FROM destinations WHERE LOWER(name) LIKE ? LIMIT 5`,
      [`${keyword}%`]
    );
    const suggestions = rows.map(row => row.name);
    res.json({ suggestions });
  } catch (err) {
    console.error('Suggestion fetch error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
