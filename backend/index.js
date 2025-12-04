// backend/index.js
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

// ---------------------------------------------
// Load .env only in LOCAL development
// ---------------------------------------------
if (!process.env.RAILWAY_ENVIRONMENT) {
  dotenv.config({ path: path.join(__dirname, ".env") });
  console.log("ℹ️ Running in LOCAL mode (dotenv enabled)");
} else {
  console.log("ℹ️ Running on RAILWAY (dotenv disabled, env vars auto-loaded)");
}

// ---------------------------------------------
// MySQL Database Initialization
// ---------------------------------------------
const { getPool } = require("./config/db");

// ---------------------------------------------
// EXPRESS APP INIT
// ---------------------------------------------
const app = express();

// ---------------------------------------------
// CORS FIX — Allows Localhost + Railway Frontend
// ---------------------------------------------
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  process.env.FRONTEND_URL,
  process.env.RAILWAY_PUBLIC_DOMAIN,
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // allow mobile apps, curl
      if (allowedOrigins.includes(origin)) return callback(null, true);

      console.warn("❌ CORS blocked:", origin);
      return callback(new Error("Not allowed by CORS: " + origin));
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------------------------------------------
// Simple request logger
// ---------------------------------------------
app.use((req, res, next) => {
  console.info(
    `${new Date().toISOString()} - ${req.method} ${req.originalUrl}`
  );
  next();
});

// ---------------------------------------------
// Connect to MySQL (Railway or Local)
// ---------------------------------------------
(async () => {
  try {
    await getPool();
    console.log("✅ Connected to MySQL successfully!");
  } catch (err) {
    console.error("❌ Failed to connect to MySQL:", err.message);
  }
})();

// ---------------------------------------------
// UPLOADS STATIC FOLDER
// ---------------------------------------------
const possibleUploadLocations = [
  path.join(__dirname, "uploads"), // backend/uploads
  path.join(process.cwd(), "uploads"), // fallback (Railway-safe)
];

let uploadsFolder = possibleUploadLocations.find((folder) => {
  try {
    return fs.existsSync(folder) && fs.statSync(folder).isDirectory();
  } catch (_) {
    return false;
  }
});

// Create if missing (local)
if (!uploadsFolder) {
  uploadsFolder = path.join(__dirname, "uploads");
  try {
    fs.mkdirSync(uploadsFolder, { recursive: true });
    console.log("📁 Created uploads folder:", uploadsFolder);
  } catch (err) {
    console.warn("⚠️ Could NOT create uploads folder:", err.message);
  }
} else {
  console.log("📁 Serving uploads from:", uploadsFolder);
}

app.use(
  "/uploads",
  express.static(uploadsFolder, {
    extensions: ["jpg", "jpeg", "png", "webp", "gif", "mp4"],
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "public, max-age=3600");
    },
  })
);

// ---------------------------------------------
// DEBUG ROUTES (Local Only)
// ---------------------------------------------
if (!process.env.RAILWAY_ENVIRONMENT) {
  app.get("/debug/list-uploads", (req, res) => {
    const files = fs.readdirSync(uploadsFolder);
    res.json({ uploadsFolder, files });
  });

  app.get("/debug/check-file", (req, res) => {
    const p = req.query.path;
    if (!p) return res.status(400).json({ error: "Missing ?path" });

    const safePath = path.normalize(p).replace(/^(\.\.(\/|\\|$))+/, "");
    const fullPath = path.join(uploadsFolder, safePath);
    const exists = fs.existsSync(fullPath);

    res.json({ ok: true, fullPath, exists });
  });
}

// ---------------------------------------------
// ROUTES
// ---------------------------------------------
try {
  const adminRoutes = require("./admin-service/routes/adminRoutes");
  const userRoutes = require("./admin-service/routes/userRoutes");
  app.use("/api/admin", adminRoutes);
  app.use("/api/admin/users", userRoutes);
  console.log("✅ Admin service loaded");
} catch (err) {
  console.warn("⚠️ Admin service failed:", err.message);
}

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
  console.warn("⚠️ CMS service failed:", err.message);
}

try {
  const destinationRoutes = require("./destination-service/routes/destinations");
  app.use("/api/destinations", destinationRoutes);
  console.log("✅ Destination service loaded");
} catch (err) {
  console.warn("⚠️ Destination service failed:", err.message);
}

try {
  const mapRoutes = require("./map-service/routes/touristSpots");
  app.use("/map/touristspots", mapRoutes);
  console.log("✅ Map service loaded");
} catch (err) {
  console.warn("⚠️ Map service failed:", err.message);
}

try {
  const searchRoutes = require("./searchFiltering-service/routes/search");
  app.use("/api/search", searchRoutes);
  console.log("✅ Search service loaded");
} catch (err) {
  console.warn("⚠️ Search service failed:", err.message);
}

try {
  const authRoutes = require("./user-service/routes/auth");
  const wishlistRoutes = require("./user-service/routes/wishlist");
  app.use("/api/user", authRoutes);
  app.use("/api/user/wishlist", wishlistRoutes);
  console.log("✅ User service loaded");
} catch (err) {
  console.warn("⚠️ User service failed:", err.message);
}

// ---------------------------------------------
// ROOT ENDPOINT
// ---------------------------------------------
app.get("/", (req, res) => {
  res.json({
    message: "🚀 Discover Mansalay Backend is running",
    mode: process.env.RAILWAY_ENVIRONMENT ? "Railway" : "Local",
  });
});

// ---------------------------------------------
// HEALTH CHECK
// ---------------------------------------------
app.get("/api/health", async (req, res) => {
  try {
    const pool = await getPool();
    await pool.query("SELECT 1");
    res.json({ status: "ok", db: "connected" });
  } catch (err) {
    res.status(500).json({ status: "error", db: "failed", message: err.message });
  }
});

// ---------------------------------------------
// 404 Handler
// ---------------------------------------------
app.use((req, res) => {
  res.status(404).json({ ok: false, error: "Not Found", path: req.originalUrl });
});

// ---------------------------------------------
// ERROR Handler
// ---------------------------------------------
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ ok: false, error: err.message });
});

// ---------------------------------------------
// START SERVER
// ---------------------------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
});
