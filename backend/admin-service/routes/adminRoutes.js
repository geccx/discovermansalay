const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { getPool } = require('../../config/db');

const uploadFolder = path.join(__dirname, '../../uploads');
const adminsProfileFolder = path.join(uploadFolder, 'admins-profile');

if (!fs.existsSync(uploadFolder)) fs.mkdirSync(uploadFolder);
if (!fs.existsSync(adminsProfileFolder)) fs.mkdirSync(adminsProfileFolder);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, adminsProfileFolder),
  filename: (req, file, cb) => {
    const username = req.body.username || 'default_admin';
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

// ✅ Count admin users using MySQL
router.get('/count', async (req, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query("SELECT COUNT(*) as count FROM users WHERE role = 'admin'");
    res.status(200).json({ count: rows[0].count });
  } catch (err) {
    console.error('Failed to fetch admin count:', err);
    res.status(500).json({ error: 'Failed to fetch admin count' });
  }
});



// GET admins
router.get('/list', async (req, res) => {
  try {
    const pool = await getPool();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const [countResult] = await pool.query('SELECT COUNT(*) as count FROM users WHERE role = ?', ['admin']);
    const total = countResult[0].count;

    const [rows] = await pool.query('SELECT * FROM users WHERE role = ? LIMIT ? OFFSET ?', ['admin', limit, offset]);
    const usersWithNormalizedImage = rows.map(normalizeImagePath);

    res.json({ total, page, limit, users: usersWithNormalizedImage });
  } catch (error) {
    console.error('Error fetching admins:', error);
    res.status(500).json({ message: 'Server error fetching admins' });
  }
});

// POST create admin
router.post('/admin', upload.single('profile_image'), async (req, res) => {
  try {
    const pool = await getPool();
    let {
      username, firstname, lastname, email, password,
      role = 'admin', contact_number, address
    } = req.body;

    if (role !== 'admin') {
      return res.status(400).json({ message: 'Only admins can be created here' });
    }

    password = password || 'password';

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

    const hashedPassword = await bcrypt.hash(password, 10);

    const profile_image = req.file
      ? `uploads/admins-profile/${req.file.filename}`
      : null;

    const [result] = await pool.query(
      `INSERT INTO users 
      (username, firstname, lastname, email, password, role, contact_number, address, profile_image) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [username, firstname, lastname, email, hashedPassword, role, contact_number, address, profile_image]
    );

    const [newUserRows] = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
    res.status(201).json(normalizeImagePath(newUserRows[0]));
  } catch (error) {
    console.error('Error creating admin user:', error);
    res.status(500).json({ message: 'Server error creating admin' });
  }
});

// PUT change admin password
router.put('/admin/:id/password', async (req, res) => {
  try {
    const pool = await getPool();
    const userId = req.params.id;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ message: 'Server error updating password' });
  }
});

// DELETE admin
router.delete('/admin/:id', async (req, res) => {
  try {
    const pool = await getPool();
    const userId = req.params.id;

    const [rows] = await pool.query('SELECT * FROM users WHERE id = ? AND role = ?', [userId, 'admin']);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Admin user not found' });
    }

    if (rows[0].profile_image) {
      deleteFileIfExists(rows[0].profile_image);
    }

    await pool.query('DELETE FROM users WHERE id = ?', [userId]);

    res.json({ message: 'Admin user deleted successfully' });
  } catch (error) {
    console.error('Error deleting admin user:', error);
    res.status(500).json({ message: 'Server error deleting admin' });
  }
});

module.exports = router;
