// backend/index.js
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

/* ---------------------------------------------
   LOAD ENV (Local Only)
--------------------------------------------- */
if (!process.env.RAILWAY_ENVIRONMENT) {
  dotenv.config({ path: path.join(__dirname, ".env") });
  console.log("ℹ️ ENV loaded (LOCAL mode)");
} else {
  console.log("ℹ️ Railway environment detected — .env ignored");
}

/* ---------------------------------------------
   INIT EXPRESS
--------------------------------------------- */
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ---------------------------------------------
   CORS CONFIG
--------------------------------------------- */
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  process.env.FRONTEND_URL,
  process.env.RAILWAY_PUBLIC_DOMAIN,
].filter(Boolean);

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

/* ---------------------------------------------
   REQUEST LOGGER
--------------------------------------------- */
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.originalUrl}`);
  next();
});

/* ---------------------------------------------
   DATABASE INIT
--------------------------------------------- */
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

/* ---------------------------------------------
   STATIC UPLOADS
--------------------------------------------- */
const uploadPaths = [
  path.join(__dirname, "uploads"),
  path.join(process.cwd(), "uploads"),
];

let uploadsFolder = uploadPaths.find((dir) => fs.existsSync(dir));

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

/* ---------------------------------------------
   SERVICE LOADER FUNCTION
--------------------------------------------- */
function loadService(name, mountPath, loaderFn) {
  try {
    const routes = loaderFn();
    app.use(mountPath, routes);
    console.log(`✅ ${name} loaded at ${mountPath}`);
  } catch (err) {
    console.warn(`⚠️ ${name} FAILED to load:`, err.message);
  }
}

/* ---------------------------------------------
   PUBLIC ROUTES
--------------------------------------------- */
loadService("Public Invite Service", "/api/invite", () =>
  require("./public/publicInviteRoutes")
);

/* ---------------------------------------------
   ADMIN SERVICES
--------------------------------------------- */
loadService("Admin Service", "/api/admin", () =>
  require("./admin-service/routes/adminRoutes")
);

loadService("Admin User Service", "/api/admin/users", () =>
  require("./admin-service/routes/userRoutes")
);

/* ---------------------------------------------
   CMS SERVICES
--------------------------------------------- */
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

/* ---------------------------------------------
   DESTINATIONS + MAP
--------------------------------------------- */
loadService("Destinations Service", "/api/destinations", () =>
  require("./destination-service/routes/destinations")
);

loadService("Map Service", "/map/touristspots", () =>
  require("./map-service/routes/touristSpots")
);

/* ---------------------------------------------
   SEARCH SERVICE
--------------------------------------------- */
loadService("Search Service", "/api/search", () =>
  require("./searchFiltering-service/routes/search")
);

/* ---------------------------------------------
   AUTH & WISHLIST
--------------------------------------------- */
loadService("Auth Service", "/api/user", () =>
  require("./user-service/routes/auth")
);

loadService("Wishlist Service", "/api/user/wishlist", () =>
  require("./user-service/routes/wishlist")
);

/* ---------------------------------------------
   VISITOR TRACKING + ADMIN LOG ROUTES (NEW)
--------------------------------------------- */
app.use("/api/visitors", require("./routes/visitors"));
app.use("/api/adminlogs", require("./routes/adminLogs"));


console.log("🆕 Visitors + AdminLogs routes registered");

/* ---------------------------------------------
   HEALTH CHECK
--------------------------------------------- */
app.get("/api/health", async (req, res) => {
  try {
    const pool = await getPool();
    await pool.query("SELECT 1");
    res.json({ status: "ok", db: "connected" });
  } catch {
    res.status(500).json({ status: "error", db: "failed" });
  }
});

/* ---------------------------------------------
   ROOT API
--------------------------------------------- */
app.get("/", (req, res) => {
  res.json({
    message: "🚀 Discover Mansalay Backend Running",
    environment: process.env.RAILWAY_ENVIRONMENT ? "Railway" : "Local",
  });
});

/* ---------------------------------------------
   404 HANDLER
--------------------------------------------- */
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: "Route Not Found",
    path: req.originalUrl,
  });
});

/* ---------------------------------------------
   GLOBAL ERROR HANDLER
--------------------------------------------- */
app.use((err, req, res, next) => {
  console.error("🔥 SERVER ERROR:", err);
  res.status(500).json({
    ok: false,
    error: "Internal Server Error",
    message: err.message,
  });
});

/* ---------------------------------------------
   START SERVER
--------------------------------------------- */
async function startServer() {
  await initDatabase();
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () =>
    console.log(`🌐 Server running on port ${PORT}`)
  );
}

startServer();
