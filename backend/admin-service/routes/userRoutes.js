const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { getPool } = require('../../config/db');

// Ensure upload folders exist
const uploadFolder = path.join(__dirname, '../../uploads');
const userProfileFolder = path.join(uploadFolder, 'users-profile');

if (!fs.existsSync(uploadFolder)) fs.mkdirSync(uploadFolder);
if (!fs.existsSync(userProfileFolder)) fs.mkdirSync(userProfileFolder);

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, userProfileFolder),
  filename: (req, file, cb) => {
    const username = req.body.username || 'default_user';
    const ext = path.extname(file.originalname);
    cb(null, `${username}${ext}`);
  }
});
const upload = multer({ storage });

function deleteFileIfExists(filePath) {
  if (!filePath) return;
  const fullPath = path.join(__dirname, '../../', filePath);
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
}

function normalizeImagePath(user) {
  if (user.profile_image) {
    user.profile_image = user.profile_image.replace(/\\/g, '/');
  }
  return user;
}

// GET user count
router.get('/count', async (req, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query("SELECT COUNT(*) as count FROM users");
    res.status(200).json({ count: rows[0].count });
  } catch (err) {
    console.error('Failed to fetch user count:', err);
    res.status(500).json({ error: 'Failed to fetch user count' });
  }
});

// GET paginated users
router.get('/list', async (req, res) => {
  try {
    const pool = await getPool();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const [countResult] = await pool.query('SELECT COUNT(*) as count FROM users WHERE role != ?', ['admin']);
    const total = countResult[0].count;

    const [rows] = await pool.query(
      'SELECT * FROM users WHERE role != ? LIMIT ? OFFSET ?',
      ['admin', limit, offset]
    );

    res.json({
      total,
      page,
      limit,
      users: rows.map(normalizeImagePath)
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error fetching users' });
  }
});

// POST create user
router.post('/user', upload.single('profile_image'), async (req, res) => {
  try {
    const pool = await getPool();
    let {
      username, lastname, email, password, role,
      contact_number, address
    } = req.body;

    password = password?.trim() || 'password123';
    const hashedPassword = await bcrypt.hash(password, 10);

    const [existing] = await pool.query(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        message: existing[0].username === username
          ? 'Username is already taken'
          : 'Email is already registered'
      });
    }

    const profile_image = req.file
      ? `uploads/users-profile/${req.file.filename}`
      : null;

    const [result] = await pool.query(
      `INSERT INTO users 
        (username, lastname, email, password, role, contact_number, address, profile_image) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [username, lastname, email, hashedPassword, role, contact_number, address, profile_image]
    );

    const [newUserRows] = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
    res.status(201).json(normalizeImagePath(newUserRows[0]));
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Server error creating user' });
  }
});

// PUT update user
router.put('/user/:id', upload.single('profile_image'), async (req, res) => {
  try {
    const pool = await getPool();
    const userId = req.params.id;

    const [existingUserRows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (existingUserRows.length === 0) return res.status(404).json({ message: 'User not found' });

    const oldUser = existingUserRows[0];

    let {
      username, lastname, email, password, role,
      contact_number, address
    } = req.body;

    password = password?.trim()
      ? await bcrypt.hash(password.trim(), 10)
      : oldUser.password;

    const [conflicts] = await pool.query(
      'SELECT * FROM users WHERE (username = ? OR email = ?) AND id != ?',
      [username, email, userId]
    );
    if (conflicts.length > 0) {
      return res.status(400).json({
        message: conflicts[0].username === username
          ? 'Username is already taken by another user'
          : 'Email is already used by another user'
      });
    }

    const oldProfileImage = oldUser.profile_image;
    let profile_image = oldProfileImage;

    if (req.file) {
      profile_image = `uploads/users-profile/${req.file.filename}`;
      if (oldProfileImage && oldProfileImage !== profile_image) {
        deleteFileIfExists(oldProfileImage);
      }
    } else if (req.body.existing_image === '' || req.body.existing_image === 'null' || req.body.existing_image === null) {
      if (oldProfileImage) deleteFileIfExists(oldProfileImage);
      profile_image = null;
    }

    await pool.query(
      `UPDATE users SET 
        username = ?, lastname = ?, email = ?, 
        password = ?, role = ?, contact_number = ?, address = ?, 
        profile_image = ? 
      WHERE id = ?`,
      [username, lastname, email, password, role, contact_number, address, profile_image, userId]
    );

    const [updatedUser] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    res.json(normalizeImagePath(updatedUser[0]));
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Server error updating user' });
  }
});

// DELETE user
router.delete('/user/:id', async (req, res) => {
  try {
    const pool = await getPool();

    const [existingUserRows] = await pool.query('SELECT profile_image FROM users WHERE id = ?', [req.params.id]);
    if (existingUserRows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const oldProfileImage = existingUserRows[0].profile_image;
    const [result] = await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (oldProfileImage) deleteFileIfExists(oldProfileImage);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Server error deleting user' });
  }
});

module.exports = router;
