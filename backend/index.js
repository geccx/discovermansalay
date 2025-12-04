// backend/index.js
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

// ---------------------------------------------
// LOAD ENV (Local Only)
// ---------------------------------------------
if (!process.env.RAILWAY_ENVIRONMENT) {
  dotenv.config({ path: path.join(__dirname, ".env") });
  console.log("ℹ️ ENV loaded (LOCAL mode)");
} else {
  console.log("ℹ️ Railway environment detected — .env ignored");
}

// ---------------------------------------------
// INIT EXPRESS
// ---------------------------------------------
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------------------------------------------
// CORS CONFIG (Auto detects allowed origins)
// ---------------------------------------------
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  process.env.FRONTEND_URL,
  process.env.RAILWAY_PUBLIC_DOMAIN,
].filter(Boolean); // remove undefined

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      console.warn("❌ CORS blocked:", origin);
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// ---------------------------------------------
// REQUEST LOGGER (Production Friendly)
// ---------------------------------------------
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.originalUrl}`);
  next();
});

// ---------------------------------------------
// DATABASE INIT — WAIT FOR CONNECTION BEFORE SERVER STARTS
// ---------------------------------------------
const { getPool } = require("./config/db");

async function initDatabase() {
  try {
    const pool = await getPool();
    await pool.query("SELECT 1");
    console.log("✅ MySQL connection established");
  } catch (err) {
    console.error("❌ Database connection FAILED:", err.message);
  }
}

// ---------------------------------------------
// STATIC UPLOADS (Safe for Railway + Local)
// ---------------------------------------------
const uploadPaths = [
  path.join(__dirname, "uploads"),
  path.join(process.cwd(), "uploads"),
];

let uploadsFolder = uploadPaths.find((dir) => {
  try {
    return fs.existsSync(dir);
  } catch {
    return false;
  }
});

if (!uploadsFolder) {
  uploadsFolder = uploadPaths[0];
  fs.mkdirSync(uploadsFolder, { recursive: true });
  console.log("📁 Uploads folder created:", uploadsFolder);
} else {
  console.log("📁 Serving uploads from:", uploadsFolder);
}

app.use(
  "/uploads",
  express.static(uploadsFolder, {
    setHeaders: (res) =>
      res.setHeader("Cache-Control", "public, max-age=3600"),
  })
);

// ---------------------------------------------
// SAFE SERVICE LOADER (Prevents full API crash)
// ---------------------------------------------
function loadService(name, mountPath, loaderFn) {
  try {
    const routes = loaderFn();
    app.use(mountPath, routes);
    console.log(`✅ ${name} loaded at ${mountPath}`);
  } catch (err) {
    console.warn(`⚠️ ${name} FAILED to load:`, err.message);
  }
}

// ---------------------------------------------
// LOAD SERVICES (Fault-Tolerant)
// ---------------------------------------------
loadService("Admin Service", "/api/admin", () =>
  require("./admin-service/routes/adminRoutes")
);

loadService("Admin User Service", "/api/admin/users", () =>
  require("./admin-service/routes/userRoutes")
);

loadService("CMS Experience", "/api/cms/experience", () =>
  require("./cms-service/routes/experience")
);

loadService("CMS Explore", "/api/cms/explore", () =>
  require("./cms-service/routes/explorecms")
);

loadService("CMS Hero", "/api/cms/hero", () =>
  require("./cms-service/routes/herocms")
);

loadService("CMS Highlights", "/api/cms/highlight", () =>
  require("./cms-service/routes/highlightcms")
);

loadService("CMS Navbar", "/api/cms/navbar", () =>
  require("./cms-service/routes/navbar")
);

loadService("Destinations Service", "/api/destinations", () =>
  require("./destination-service/routes/destinations")
);

loadService("Map Service", "/map/touristspots", () =>
  require("./map-service/routes/touristSpots")
);

loadService("Search Service", "/api/search", () =>
  require("./searchFiltering-service/routes/search")
);

loadService("Auth Service", "/api/user", () =>
  require("./user-service/routes/auth")
);

loadService("Wishlist Service", "/api/user/wishlist", () =>
  require("./user-service/routes/wishlist")
);

// ---------------------------------------------
// HEALTH CHECK (Railway Requirement)
// ---------------------------------------------
app.get("/api/health", async (req, res) => {
  try {
    const pool = await getPool();
    await pool.query("SELECT 1");
    res.json({ status: "ok", db: "connected" });
  } catch (err) {
    res.status(500).json({ status: "error", db: "failed" });
  }
});

// ---------------------------------------------
// ROOT ENDPOINT
// ---------------------------------------------
app.get("/", (req, res) => {
  res.json({
    message: "🚀 Discover Mansalay Backend Running",
    environment: process.env.RAILWAY_ENVIRONMENT ? "Railway" : "Local",
  });
});

// ---------------------------------------------
// 404 HANDLER
// ---------------------------------------------
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: "Route Not Found",
    path: req.originalUrl,
  });
});

// ---------------------------------------------
// GLOBAL ERROR HANDLER
// ---------------------------------------------
app.use((err, req, res, next) => {
  console.error("🔥 SERVER ERROR:", err);
  res.status(500).json({
    ok: false,
    error: "Internal Server Error",
    message: err.message,
  });
});

// ---------------------------------------------
// START SERVER (After DB Initializes)
// ---------------------------------------------
async function startServer() {
  await initDatabase(); // Ensures DB connection success/failure is logged

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🌐 Server running on port ${PORT}`);
  });
}

startServer();
