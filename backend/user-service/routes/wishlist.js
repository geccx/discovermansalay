const express = require('express');
const { getPool } = require('../../config/db');
const router = express.Router();

// GET all wishlist items for a user
router.get('/:username', async (req, res) => {
  const { username } = req.params;
  try {
    const pool = await getPool();
    const [rows] = await pool.query('SELECT * FROM wishlist WHERE username = ?', [username]);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch wishlist', error: err });
  }
});

// ADD a wishlist item
router.post('/', async (req, res) => {
const { username, item_id, name, category, image_path } = req.body;


if (!username || !item_id || !name || !category || !image_path) {
  return res.status(400).json({ message: 'Missing fields' });
}

  try {
    const pool = await getPool();

    // Prevent duplicates
    const [existing] = await pool.query(
      'SELECT * FROM wishlist WHERE username = ? AND item_id = ?',
      [username, item_id]
    );
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Item already in wishlist' });
    }

   await pool.query(
  'INSERT INTO wishlist (username, item_id, name, category, image_path) VALUES (?, ?, ?, ?, ?)',
  [username, item_id, name, category, image_path]
);


    res.status(201).json({ message: 'Item added to wishlist' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to add item', error: err });
  }
});

// DELETE an item
router.delete('/:username/:item_id', async (req, res) => {
  const { username, item_id } = req.params;
  try {
    const pool = await getPool();
    await pool.query(
      'DELETE FROM wishlist WHERE username = ? AND item_id = ?',
      [username, item_id]
    );
    res.json({ message: 'Item removed from wishlist' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete item', error: err });
  }
});

module.exports = router;
