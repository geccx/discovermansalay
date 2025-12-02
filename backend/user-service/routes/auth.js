const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { getPool } = require('../../config/db');
const router = express.Router();

const SECRET = 'your_jwt_secret';

// Register Route
router.post('/register', async (req, res) => {
  const { username, email, password, role, firstname } = req.body;

  if (!username || !email || !password || !firstname) {
    return res.status(400).json({ message: 'All fields (username, email, password, firstname) are required.' });
  }

  try {
    const pool = await getPool();

    // Check for existing user
    const [existing] = await pool.query(
      'SELECT * FROM users WHERE email = ? OR username = ?',
      [email, username]
    );

    if (existing.length > 0) {
      const existingUser = existing[0];
      if (existingUser.email === email && existingUser.username === username) {
        return res.status(409).json({ message: 'A user with this email and username already exists.' });
      } else if (existingUser.email === email) {
        return res.status(409).json({ message: 'Email is already in use.' });
      } else {
        return res.status(409).json({ message: 'Username is already taken.' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      'INSERT INTO users (username, email, password, role, firstname) VALUES (?, ?, ?, ?, ?)',
      [username, email, hashedPassword, role || 'user', firstname]
    );

    res.status(201).json({ message: 'Registration successful. You can now log in.' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Internal server error during registration.', error: error.message });
  }
});

// Login Route
router.post('/login', async (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ message: 'Email/Username and password are required.' });
  }

  try {
    const pool = await getPool();
    const [users] = await pool.query(
      'SELECT * FROM users WHERE email = ? OR username = ?',
      [identifier, identifier]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: 'No user found with the provided email or username.' });
    }

    const user = users[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(401).json({ message: 'Incorrect password. Please try again.' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        firstname: user.firstname,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error during login.', error: error.message });
  }
});

module.exports = router;
