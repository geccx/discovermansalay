// backend/admin-service/index.js
const express = require('express');
const path = require('path');
const cors = require('cors');
const { getPool } = require('../config/db'); // adjust this path if needed

const app = express();

// ✅ Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Routes
const authRoutes = require('./routes/auth');
const wishlistRoutes = require('./routes/wishlist');

app.use('/api/auth', authRoutes);
app.use('/api/wishlist', wishlistRoutes);

// ✅ Health Check Route
app.get('/api/health', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', db: 'unavailable', message: err.message });
  }
});

// ✅ Error Handler (for uncaught errors)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// ✅ Start Server
(async function start() {
  try {
    await getPool(); // ensure DB connection before starting
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => console.log(`🚀 Admin service running on port ${PORT}`));
  } catch (err) {
    console.error('❌ Failed to initialize DB for Admin service:', err.message);
    process.exit(1);
  }
})();
