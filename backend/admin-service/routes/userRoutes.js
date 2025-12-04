// backend/admin-service/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { getPool } = require('../../config/db');

// ---------------------------------------------
// Upload folders for USER profile images
// ---------------------------------------------
const uploadFolder = path.join(__dirname, '../../uploads');          // backend/uploads
const userProfileFolder = path.join(uploadFolder, 'users-profile');

try {
  if (!fs.existsSync(uploadFolder)) {
    fs.mkdirSync(uploadFolder, { recursive: true });
    console.log('📁 Created uploadFolder for users:', uploadFolder);
  }
  if (!fs.existsSync(userProfileFolder)) {
    fs.mkdirSync(userProfileFolder, { recursive: true });
    console.log('📁 Created userProfileFolder:', userProfileFolder);
  }
} catch (err) {
  console.warn('⚠️ Failed to ensure user upload folders:', err.message);
}

// ---------------------------------------------
// Multer storage for user profile images
// ---------------------------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, userProfileFolder),
  filename: (req, file, cb) => {
    const username = req.body.username || 'default_user';
    const ext = path.extname(file.originalname || '');
    cb(null, `${username}${ext}`);
  },
});

const upload = multer({ storage });

// ---------------------------------------------
// Helpers
// ---------------------------------------------
function deleteFileIfExists(filePath) {
  try {
    if (!filePath) return;
    const fullPath = path.join(__dirname, '../../', filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      console.log('🗑️ Deleted file:', fullPath);
    }
  } catch (err) {
    console.warn('⚠️ Failed to delete file:', err.message);
  }
}

function normalizeImagePath(user) {
  if (user && user.profile_image) {
    user.profile_image = user.profile_image.replace(/\\/g, '/');
  }
  return user;
}

// ---------------------------------------------
// GET /api/admin/users/count
// (Currently counts ALL users; adjust WHERE if you want only non-admin)
// ---------------------------------------------
router.get('/count', async (req, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query('SELECT COUNT(*) AS count FROM users');
    res.status(200).json({ count: rows[0].count });
  } catch (err) {
    console.error('Failed to fetch user count:', err);
    res.status(500).json({ error: 'Failed to fetch user count' });
  }
});

// ---------------------------------------------
// GET /api/admin/users/list?page=&limit=
// Paginated list of NON-ADMIN users (role != 'admin')
// ---------------------------------------------
router.get('/list', async (req, res) => {
  try {
    const pool = await getPool();
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    const [countResult] = await pool.query(
      'SELECT COUNT(*) AS count FROM users WHERE role != ?',
      ['admin']
    );
    const total = countResult[0].count;

    const [rows] = await pool.query(
      'SELECT * FROM users WHERE role != ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      ['admin', limit, offset]
    );

    res.json({
      total,
      page,
      limit,
      users: rows.map(normalizeImagePath),
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error fetching users' });
  }
});

// ---------------------------------------------
// POST /api/admin/users/user
// Create a regular user (from admin panel)
// Body (multipart/form-data):
//  - username, lastname, email, password?, role? (default 'user'),
//  - contact_number, address
//  - profile_image (file)
// ---------------------------------------------
router.post('/user', upload.single('profile_image'), async (req, res) => {
  try {
    const pool = await getPool();
    let {
      username,
      firstname,  // optional from panel
      lastname,
      email,
      password,
      role,
      contact_number,
      address,
    } = req.body;

    // Enforce default role if not provided or invalid
    if (role !== 'admin') {
      role = 'user';
    }

    password = (password && password.trim()) || 'password123';
    const hashedPassword = await bcrypt.hash(password, 10);

    const [existing] = await pool.query(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        message:
          existing[0].username === username
            ? 'Username is already taken'
            : 'Email is already registered',
      });
    }

    const profile_image = req.file
      ? `uploads/users-profile/${req.file.filename}`
      : null;

    const [result] = await pool.query(
      `INSERT INTO users 
        (username, firstname, lastname, email, password, role, contact_number, address, profile_image) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        username,
        firstname || null,
        lastname,
        email,
        hashedPassword,
        role,
        contact_number,
        address,
        profile_image,
      ]
    );

    const [newUserRows] = await pool.query(
      'SELECT * FROM users WHERE id = ?',
      [result.insertId]
    );
    res.status(201).json(normalizeImagePath(newUserRows[0]));
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Server error creating user' });
  }
});

// ---------------------------------------------
// PUT /api/admin/users/user/:id
// Update user (including profile image and optional password)
// ---------------------------------------------
router.put('/user/:id', upload.single('profile_image'), async (req, res) => {
  try {
    const pool = await getPool();
    const userId = req.params.id;

    const [existingUserRows] = await pool.query(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );
    if (existingUserRows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const oldUser = existingUserRows[0];

    let {
      username,
      firstname,
      lastname,
      email,
      password,
      role,
      contact_number,
      address,
      existing_image,
    } = req.body;

    // If no new password provided, keep old hash
    if (password && password.trim()) {
      password = await bcrypt.hash(password.trim(), 10);
    } else {
      password = oldUser.password;
    }

    // Prevent accidentally making this user an admin unless explicitly set
    if (role !== 'admin') {
      role = 'user';
    }

    // Check username/email conflicts
    const [conflicts] = await pool.query(
      'SELECT * FROM users WHERE (username = ? OR email = ?) AND id != ?',
      [username, email, userId]
    );

    if (conflicts.length > 0) {
      return res.status(400).json({
        message:
          conflicts[0].username === username
            ? 'Username is already taken by another user'
            : 'Email is already used by another user',
      });
    }

    const oldProfileImage = oldUser.profile_image;
    let profile_image = oldProfileImage;

    // If new file uploaded, update image and delete old one (if different)
    if (req.file) {
      profile_image = `uploads/users-profile/${req.file.filename}`;
      if (oldProfileImage && oldProfileImage !== profile_image) {
        deleteFileIfExists(oldProfileImage);
      }
    } else if (
      existing_image === '' ||
      existing_image === 'null' ||
      existing_image === null
    ) {
      // If explicitly cleared from frontend, delete old file
      if (oldProfileImage) {
        deleteFileIfExists(oldProfileImage);
      }
      profile_image = null;
    }

    await pool.query(
      `UPDATE users SET 
        username = ?, 
        firstname = ?, 
        lastname = ?, 
        email = ?, 
        password = ?, 
        role = ?, 
        contact_number = ?, 
        address = ?, 
        profile_image = ? 
       WHERE id = ?`,
      [
        username,
        firstname || null,
        lastname,
        email,
        password,
        role,
        contact_number,
        address,
        profile_image,
        userId,
      ]
    );

    const [updatedUser] = await pool.query(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );
    res.json(normalizeImagePath(updatedUser[0]));
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Server error updating user' });
  }
});

// ---------------------------------------------
// DELETE /api/admin/users/user/:id
// Delete user + profile image
// ---------------------------------------------
router.delete('/user/:id', async (req, res) => {
  try {
    const pool = await getPool();
    const userId = req.params.id;

    const [existingUserRows] = await pool.query(
      'SELECT profile_image FROM users WHERE id = ?',
      [userId]
    );
    if (existingUserRows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const oldProfileImage = existingUserRows[0].profile_image;

    const [result] = await pool.query('DELETE FROM users WHERE id = ?', [
      userId,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (oldProfileImage) {
      deleteFileIfExists(oldProfileImage);
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Server error deleting user' });
  }
});

module.exports = router;
