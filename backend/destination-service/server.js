// backend/destination-service/index.js
const express = require('express');
const path = require('path');
const cors = require('cors');
const { getPool } = require('../config/db'); // adjust path as needed
const destinationsRoutes = require('./routes/destinations');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve uploads folder statically (adjust path if your uploads folder is different)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/destinations', destinationsRoutes);

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', db: 'unavailable', message: err.message });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server (after DB ready)
(async function start() {
  try {
    await getPool();
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Destinations service running on port ${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to initialize DB for Destinations service:', err.message);
    process.exit(1);
  }
})();
