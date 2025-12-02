// server.js (CMS Service)
const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const { getPool } = require('../config/db'); // adjust path if needed

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();

// 🧩 Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 📂 Serve uploads folder statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 🧭 CMS Routes
try {
  const navbarRoutes = require('./routes/navbar');
  const heroRoutes = require('./routes/herocms');
  const exploreRoutes = require('./routes/explorecms');
  const highlightRoutes = require('./routes/highlightcms');
  const experienceRoutes = require('./routes/experience');

  app.use('/api/cms/navbar', navbarRoutes);
  app.use('/api/cms/hero', heroRoutes);
  app.use('/api/cms/explore', exploreRoutes);
  app.use('/api/cms/highlight', highlightRoutes);
  app.use('/api/cms/experience', experienceRoutes);

  console.log('✅ CMS routes loaded');
} catch (err) {
  console.error('❌ Failed to load CMS routes:', err.message);
}

// 🧠 Health check route
app.get('/api/health', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', db: 'unavailable', message: err.message });
  }
});

// ⚠️ Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 🚀 Start server after DB initialization
(async function start() {
  try {
    await getPool(); // initialize DB
    const PORT = process.env.PORT || 3003;
    app.listen(PORT, () => {
      console.log(`🚀 CMS service running on port ${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to initialize database:', err.message);
    process.exit(1); // Railway will restart if DB temporarily fails
  }
})();
