// map-service/index.js
const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const { getPool } = require('../config/db'); // adjust path if needed

const app = express();

// Middleware
const FRONTEND_ORIGIN = process.env.FRONTEND_URL || process.env.VITE_API_BASE_URL || '*';

app.use(cors({
  origin: FRONTEND_ORIGIN === '*' ? true : FRONTEND_ORIGIN,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple request logger
app.use((req, res, next) => {
  console.info(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});

// Determine uploads root consistently (same logic used in router)
const candidateBaseFolders = [
  path.join(__dirname, '..', 'uploads'),        // map-service/uploads
  path.join(__dirname, '..', '..', 'uploads'), // repo root /uploads
  path.join(process.cwd(), 'uploads'),          // CWD/uploads
];

let baseUploads = candidateBaseFolders.find(p => {
  try { return fs.existsSync(p) && fs.statSync(p).isDirectory(); }
  catch (e) { return false; }
});

if (!baseUploads) {
  baseUploads = path.join(__dirname, '..', '..', 'uploads');
  try {
    fs.mkdirSync(baseUploads, { recursive: true });
    console.info(`Created uploads root at ${baseUploads}`);
  } catch (err) {
    console.warn(`Could not create uploads root at ${baseUploads}:`, err.message);
  }
}

const touristSpotsDir = path.join(baseUploads, 'touristspotsmap');
if (!fs.existsSync(touristSpotsDir)) {
  try {
    fs.mkdirSync(touristSpotsDir, { recursive: true });
    console.info(`Created touristspotsmap folder at ${touristSpotsDir}`);
  } catch (err) {
    console.warn(`Could not create touristspotsmap folder at ${touristSpotsDir}:`, err.message);
  }
}

// Serve uploaded images at /uploads/touristspotsmap
app.use(
  '/uploads/touristspotsmap',
  express.static(touristSpotsDir, {
    extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    setHeaders: (res, filePath) => {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    },
  })
);

// Debug endpoints to help verify file placement
app.get('/debug/list-uploads', (req, res) => {
  try {
    const files = fs.readdirSync(touristSpotsDir, { withFileTypes: true })
      .map(d => ({ name: d.name, isDir: d.isDirectory() }));
    res.json({ uploadsRoot: baseUploads, touristSpotsDir, filesCount: files.length, files: files.slice(0, 200) });
  } catch (err) {
    res.status(500).json({ error: 'Could not list uploads', message: err.message });
  }
});

app.get('/debug/check-file', (req, res) => {
  const p = req.query.path;
  if (!p) return res.status(400).json({ ok: false, error: 'Provide ?path=filename.jpg' });

  // sanitize
  const safe = path.basename(p);
  const filePath = path.join(touristSpotsDir, safe);
  const exists = fs.existsSync(filePath);
  let size = null;
  try { if (exists) size = fs.statSync(filePath).size; } catch (e) {}
  res.json({ requested: p, safe, filePath, exists, size });
});

// Routes
try {
  const touristSpotsRoutes = require('./routes/touristSpots');
  app.use('/map/touristspots', touristSpotsRoutes);
  console.info('✅ touristSpots routes mounted at /map/touristspots');
} catch (err) {
  console.warn('⚠️ Skipping touristSpots routes:', err.message);
}

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

// Generic error handler
app.use((err, req, res, next) => {
  console.error(err.stack || err);
  res.status(500).json({ error: 'Something went wrong!', message: err.message });
});

// Start server
(async function start() {
  try {
    await getPool();
    const PORT = process.env.PORT || 3004;
    app.listen(PORT, () => console.log(`🚀 Map service running on port ${PORT}`));
  } catch (err) {
    console.error('❌ Failed to initialize DB for Map service:', err.message);
    process.exit(1);
  }
})();
