const express = require('express');
const cors = require('cors');
const path = require('path');

const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { getPool } = require('../config/db'); // adjust path if needed

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.get('/api/health', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', db: 'unavailable', message: err.message });
  }
});
app.use('/api/users', userRoutes);
app.use('/api/admins', adminRoutes);
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

// Start server after DB is ready
(async function start() {
  try {
    await getPool(); // initialize DB connection & ensure tables (if allowed)
    const PORT = process.env.PORT || 3002;
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  } catch (err) {
    console.error('❌ Failed to initialize DB. Server will not start:', err.message);
    // Exit so Railway / other PaaS will attempt a restart — comment this out if you prefer a different strategy.
    process.exit(1);
  }
})();
