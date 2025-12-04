// backend/admin-service/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const { getPool } = require('../../config/db');
const { authRequired } = require('../../user-service/middleware/authMiddleware');

// ---------------------------------------------
// Protect ALL admin routes with JWT
// ---------------------------------------------
router.use(authRequired);

// ---------------------------------------------
// Upload folders for ADMIN profile images
// ---------------------------------------------
const uploadFolder = path.join(__dirname, '../../uploads');           // backend/uploads
const adminsProfileFolder = path.join(uploadFolder, 'admins-profile');

// Ensure folders exist (Local & Railway – Railway is ephemeral but fine)
try {
  if (!fs.existsSync(uploadFolder)) {
    fs.mkdirSync(uploadFolder, { recursive: true });
    console.log('📁 Created uploadFolder for admins:', uploadFolder);
  }
  if (!fs.existsSync(adminsProfileFolder)) {
    fs.mkdirSync(adminsProfileFolder, { recursive: true });
    console.log('📁 Created adminsProfileFolder:', adminsProfileFolder);
  }
} catch (err) {
  console.warn('⚠️ Failed to ensure admin upload folders:', err.message);
}

// ---------------------------------------------
// Multer storage for admin profile images
// ---------------------------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, adminsProfileFolder),
  filename: (req, file, cb) => {
    const username = req.body.username || 'default_admin';
    const ext = path.extname(file.originalname || '');
    cb(null, `${username}${ext}`);
  }
});

const upload = multer({ storage });

// ---------------------------------------------
// Email (OTP) for new admins
// ---------------------------------------------
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM_EMAIL = `"Discover Mansalay" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`;

function generateOtp(len = 6) {
  return [...Array(len)].map(() => Math.floor(Math.random() * 10)).join('');
}

async function sendAdminOtpEmail(to, firstname, otp) {
  if (!to) return;

  const mailOptions = {
    from: FROM_EMAIL,
    to,
    subject: 'Your Discover Mansalay admin verification code',
    html: `
      <p>Hello ${firstname || ''},</p>
      <p>You have been registered as an admin in Discover Mansalay.</p>
      <p>Your email verification code is:</p>
      <h2>${otp}</h2>
      <p>This code expires in 10 minutes.</p>
      <p>If you did not expect this, please contact the current system administrator.</p>
      <br/>
      <p>Discover Mansalay Admin System</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('📩 Admin OTP sent:', to);
  } catch (err) {
    console.error('❌ Admin OTP email failed:', err.message);
  }
}

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
// GET /api/admin/count
// Count admin users
// ---------------------------------------------
router.get('/count', async (req, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      "SELECT COUNT(*) AS count FROM users WHERE role = 'admin'"
    );
    res.status(200).json({ count: rows[0].count });
  } catch (err) {
    console.error('Failed to fetch admin count:', err);
    res.status(500).json({ error: 'Failed to fetch admin count' });
  }
});

// ---------------------------------------------
// GET /api/admin/list?page=&limit=
// Paginated list of admins
// ---------------------------------------------
router.get('/list', async (req, res) => {
  try {
    const pool = await getPool();
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    const [countResult] = await pool.query(
      "SELECT COUNT(*) AS count FROM users WHERE role = 'admin'"
    );
    const total = countResult[0].count;

    const [rows] = await pool.query(
      'SELECT * FROM users WHERE role = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      ['admin', limit, offset]
    );

    const usersWithNormalizedImage = rows.map(normalizeImagePath);

    res.json({
      total,
      page,
      limit,
      users: usersWithNormalizedImage,
    });
  } catch (error) {
    console.error('Error fetching admins:', error);
    res.status(500).json({ message: 'Server error fetching admins' });
  }
});

// ---------------------------------------------
// POST /api/admin/admin
// Create new admin user
// Body (multipart/form-data):
//  - username, firstname, lastname, email, password?,
//  - contact_number, address
//  - profile_image (file)
//
// Rules:
//  - First-ever admin => is_verified = 1 (no OTP)
//  - Next admins      => is_verified = 0 + email OTP
// ---------------------------------------------
router.post('/admin', upload.single('profile_image'), async (req, res) => {
  try {
    const pool = await getPool();
    let {
      username,
      firstname,
      lastname,
      email,
      password,
      contact_number,
      address,
    } = req.body;

    // Basic validation
    if (!username || !firstname || !lastname || !email) {
      return res.status(400).json({
        message: 'Username, firstname, lastname, and email are required.',
      });
    }

    // Default password if none provided
    password = (password && password.trim()) || 'password123';

    // Check if username or email already exists
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

    // Count admins to see if this is the first one
    const [adminCountRows] = await pool.query(
      "SELECT COUNT(*) AS count FROM users WHERE role = 'admin'"
    );
    const isFirstAdmin = adminCountRows[0].count === 0;

    const hashedPassword = await bcrypt.hash(password, 10);

    const profile_image = req.file
      ? `uploads/admins-profile/${req.file.filename}`
      : null;

    let is_verified = 1;
    let otp_code = null;
    let otp_expires_at = null;

    if (!isFirstAdmin) {
      // Other admins must verify by email OTP
      is_verified = 0;
      otp_code = generateOtp();
      otp_expires_at = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    }

    const [result] = await pool.query(
      `
        INSERT INTO users 
          (username, firstname, lastname, email, password, role, contact_number, address, profile_image, is_verified, otp_code, otp_expires_at, verification_method) 
        VALUES (?, ?, ?, ?, ?, 'admin', ?, ?, ?, ?, ?, ?, 'email')
      `,
      [
        username,
        firstname,
        lastname,
        email,
        hashedPassword,
        contact_number || null,
        address || null,
        profile_image,
        is_verified,
        otp_code,
        otp_expires_at,
      ]
    );

    // Send OTP email for non-first admins
    if (!isFirstAdmin && otp_code) {
      await sendAdminOtpEmail(email, firstname, otp_code);
    }

    const [newUserRows] = await pool.query(
      'SELECT * FROM users WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json(normalizeImagePath(newUserRows[0]));
  } catch (error) {
    console.error('Error creating admin user:', error);
    res.status(500).json({ message: 'Server error creating admin' });
  }
});

// ---------------------------------------------
// PUT /api/admin/admin/:id
// Update admin details (with optional new profile image)
// ---------------------------------------------
router.put('/admin/:id', upload.single('profile_image'), async (req, res) => {
  try {
    const pool = await getPool();
    const userId = req.params.id;
    const {
      username,
      firstname,
      lastname,
      email,
      contact_number,
      address,
      existing_image,
    } = req.body;

    if (!username || !firstname || !lastname || !email) {
      return res.status(400).json({
        message: 'Username, firstname, lastname, and email are required.',
      });
    }

    // Check if admin exists
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE id = ? AND role = ?',
      [userId, 'admin']
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Admin user not found' });
    }
    const existingAdmin = rows[0];

    // Check uniqueness for username/email (excluding this admin)
    const [conflicts] = await pool.query(
      'SELECT id FROM users WHERE (username = ? OR email = ?) AND id <> ?',
      [username, email, userId]
    );
    if (conflicts.length > 0) {
      return res.status(400).json({
        message: 'Username or email is already taken by another user.',
      });
    }

    let newProfileImagePath = existingAdmin.profile_image;

    // If new image uploaded, replace
    if (req.file) {
      newProfileImagePath = `uploads/admins-profile/${req.file.filename}`;
      if (existingAdmin.profile_image) {
        deleteFileIfExists(existingAdmin.profile_image);
      }
    } else if (existing_image) {
      // Keep existing image from frontend
      newProfileImagePath = existing_image;
    } else {
      newProfileImagePath = null;
    }

    await pool.query(
      `
        UPDATE users 
        SET username = ?, firstname = ?, lastname = ?, email = ?, 
            contact_number = ?, address = ?, profile_image = ?
        WHERE id = ? AND role = 'admin'
      `,
      [
        username,
        firstname,
        lastname,
        email,
        contact_number || null,
        address || null,
        newProfileImagePath,
        userId,
      ]
    );

    const [updatedRows] = await pool.query(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );

    if (updatedRows.length === 0) {
      return res.status(404).json({ message: 'Admin user not found after update' });
    }

    res.json(normalizeImagePath(updatedRows[0]));
  } catch (error) {
    console.error('Error updating admin:', error);
    res.status(500).json({ message: 'Server error updating admin' });
  }
});

// ---------------------------------------------
// PUT /api/admin/admin/:id/password
// Change admin password
// Body: { password }
// ---------------------------------------------
router.put('/admin/:id/password', async (req, res) => {
  try {
    const pool = await getPool();
    const userId = req.params.id;
    const { password } = req.body;

    if (!password || password.trim().length < 6) {
      return res
        .status(400)
        .json({ message: 'Password must be at least 6 characters long' });
    }

    const [users] = await pool.query(
      'SELECT * FROM users WHERE id = ? AND role = ?',
      [userId, 'admin']
    );
    if (users.length === 0) {
      return res.status(404).json({ message: 'Admin user not found' });
    }

    const hashedPassword = await bcrypt.hash(password.trim(), 10);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [
      hashedPassword,
      userId,
    ]);

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ message: 'Server error updating password' });
  }
});

// ---------------------------------------------
// DELETE /api/admin/admin/:id
// Delete admin + profile image
// (Optional safety: do not delete last admin)
// ---------------------------------------------
router.delete('/admin/:id', async (req, res) => {
  try {
    const pool = await getPool();
    const userId = req.params.id;

    const [rows] = await pool.query(
      'SELECT * FROM users WHERE id = ? AND role = ?',
      [userId, 'admin']
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Admin user not found' });
    }

    const [adminCountRows] = await pool.query(
      "SELECT COUNT(*) AS count FROM users WHERE role = 'admin'"
    );
    if (adminCountRows[0].count <= 1) {
      return res
        .status(400)
        .json({ message: 'Cannot delete the last remaining admin.' });
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
