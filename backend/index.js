// backend/index.js
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

// Load environment variables
dotenv.config({ path: path.join(__dirname, ".env") });

// Database initialization
const { getPool } = require("./config/db");

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple request logger for debugging (lightweight)
app.use((req, res, next) => {
  console.info(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});

// Connect to MySQL (Railway or local)
(async () => {
  try {
    await getPool();
    console.log("✅ Connected to MySQL successfully!");
  } catch (err) {
    console.error("❌ Failed to connect to MySQL:", err.message);
  }
})();

// ------------------
// Uploads static serving (robust)
// ------------------
// Try several candidate upload folders and pick the one that exists.
// If none exists, create `__dirname/uploads` so static serving works.
const candidateFolders = [
  path.join(__dirname, "uploads"),         // typical: backend/uploads
  path.join(__dirname, "..", "uploads"),   // sometimes at repo root /uploads
  path.join(process.cwd(), "uploads"),     // current working directory fallback
];

let uploadsFolder = candidateFolders.find((p) => {
  try { return fs.existsSync(p) && fs.statSync(p).isDirectory(); }
  catch (e) { return false; }
});

// If none exists, create the default one at __dirname/uploads
if (!uploadsFolder) {
  uploadsFolder = path.join(__dirname, "uploads");
  try {
    fs.mkdirSync(uploadsFolder, { recursive: true });
    console.log(`ℹ️ Created uploads folder at ${uploadsFolder}`);
  } catch (err) {
    console.warn(`⚠️ Could not create uploads folder at ${uploadsFolder}:`, err.message);
  }
} else {
  console.log(`ℹ️ Serving uploads from ${uploadsFolder}`);
}

// Set headers (CORS already enabled globally but ensure caching)
app.use("/uploads", express.static(uploadsFolder, {
  extensions: ['jpg','jpeg','png','webp','gif','mp4'],
  setHeaders: (res, filePath) => {
    // Let browser and any CDN cache for a short while — change as needed
    res.setHeader('Cache-Control', 'public, max-age=3600');
    // Express static will set Content-Type automatically; CORS is handled globally by cors()
  }
}));

// ------------------
// Debug endpoints
// ------------------
app.get("/debug/list-uploads", (req, res) => {
  const inspect = (folder) => {
    try {
      const exists = fs.existsSync(folder);
      const files = exists ? fs.readdirSync(folder, { withFileTypes: true })
        .map(d => ({ name: d.name, isDir: d.isDirectory() })) : [];
      return { folder, exists, filesCount: files.length, files: files.slice(0, 200) };
    } catch (err) {
      return { folder, error: String(err) };
    }
  };

  const specificPath = path.join(uploadsFolder, 'top_destinations', 'sidell-kite-and-beach-resort.jpeg');
  const specificExists = fs.existsSync(specificPath);

  res.json({
    message: "Uploads debug",
    uploadsRoot: uploadsFolder,
    checkedCandidates: candidateFolders.map(inspect),
    specificCheck: { path: specificPath, exists: specificExists },
  });
});

// Check arbitrary path inside uploads (useful: ?path=top_destinations/some.jpg)
app.get("/debug/check-file", (req, res) => {
  const p = req.query.path;
  if (!p) {
    return res.status(400).json({ ok: false, error: "Provide ?path=<relative/path/inside/uploads>" });
  }
  // prevent path traversal
  const safePath = path.normalize(p).replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = path.join(uploadsFolder, safePath);
  const exists = fs.existsSync(filePath);
  let size = null;
  try { size = exists ? fs.statSync(filePath).size : null; } catch (e) {}
  res.json({ ok: true, requested: p, safePath, filePath, exists, size });
});

// ------------------
// --- ROUTE MOUNTS --- //
// Each service is modular and mounted under its own route prefix
// (Keep mounts after static serving so /uploads is not intercepted)

// Admin service
try {
  const adminRoutes = require("./admin-service/routes/adminRoutes");
  const userRoutes = require("./admin-service/routes/userRoutes");
  app.use("/api/admin", adminRoutes);
  app.use("/api/admin/users", userRoutes);
  console.log("✅ Admin service loaded");
} catch (err) {
  console.warn("⚠️ Skipping admin-service routes:", err.message);
}

// CMS service
try {
  const experienceRoutes = require("./cms-service/routes/experience");
  const exploreCMSRoutes = require("./cms-service/routes/explorecms");
  const heroCMSRoutes = require("./cms-service/routes/herocms");
  const highlightCMSRoutes = require("./cms-service/routes/highlightcms");
  const navbarRoutes = require("./cms-service/routes/navbar");
  app.use("/api/cms/experience", experienceRoutes);
  app.use("/api/cms/explore", exploreCMSRoutes);
  app.use("/api/cms/hero", heroCMSRoutes);
  app.use("/api/cms/highlight", highlightCMSRoutes);
  app.use("/api/cms/navbar", navbarRoutes);
  console.log("✅ CMS service loaded");
} catch (err) {
  console.warn("⚠️ Skipping cms-service routes:", err.message);
}

// Destination service
try {
  const destinationRoutes = require("./destination-service/routes/destinations");
  app.use("/api/destinations", destinationRoutes);
  console.log("✅ Destination service loaded");
} catch (err) {
  console.warn("⚠️ Skipping destination-service routes:", err.message);
}

// Map service
// Map service
try {
  const mapRoutes = require("./map-service/routes/touristSpots");
  // Mount at same path your frontend originally called:
  app.use("/map/touristspots", mapRoutes);
  console.log("✅ Map service loaded at /map/touristspots");
} catch (err) {
  console.warn("⚠️ Skipping map-service routes:", err && err.stack ? err.stack : err.message);
}


// Search filtering service
try {
  const searchRoutes = require("./searchFiltering-service/routes/search");
  app.use("/api/search", searchRoutes);
  console.log("✅ Search filtering service loaded");
} catch (err) {
  console.warn("⚠️ Skipping searchFiltering-service routes:", err.message);
}

// User service
try {
  const authRoutes = require("./user-service/routes/auth");
  const wishlistRoutes = require("./user-service/routes/wishlist");
  app.use("/api/user", authRoutes);
  app.use("/api/user/wishlist", wishlistRoutes);
  console.log("✅ User service loaded");
} catch (err) {
  console.warn("⚠️ Skipping user-service routes:", err.message);
}

// --- ROOT ENDPOINT --- //
app.get("/", (req, res) => {
  res.json({
    message: "🚀 Discover Mansalay Backend API Gateway is running",
    services: [
      "/api/admin",
      "/api/cms",
      "/api/destinations",
      "/api/map",
      "/api/search",
      "/api/user",
    ],
  });
});


// Health check for gateway + DB
app.get("/api/health", async (req, res) => {
  try {
    const pool = await getPool();
    await pool.query("SELECT 1");
    res.status(200).json({ status: "ok", db: "connected" });
  } catch (err) {
    console.error("Healthcheck DB error:", err);
    res.status(500).json({ status: "error", db: "unavailable", message: err.message });
  }
});

// 404 handler for unknown API routes (after mounts)
app.use((req, res, next) => {
  res.status(404).json({ ok: false, error: "Not Found", path: req.originalUrl });
});

// Generic error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ ok: false, error: err.message || "Internal Server Error" });
});

// --- SERVER LISTEN --- //
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🌐 Server running on port ${PORT}`));
