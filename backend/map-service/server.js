// backend/map-service/index.js
const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const { getPool } = require("../config/db"); // Correct shared DB

const app = express();

/* ============================================================
   CORS CONFIG
============================================================ */
const FRONTEND_ORIGIN =
  process.env.FRONTEND_URL ||
  process.env.VITE_API_BASE_URL ||
  "*";

app.use(
  cors({
    origin: FRONTEND_ORIGIN === "*" ? true : FRONTEND_ORIGIN,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

/* ============================================================
   BODY PARSERS
============================================================ */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ============================================================
   REQUEST LOGGER
============================================================ */
app.use((req, res, next) => {
  console.info(
    `${new Date().toISOString()} - ${req.method} ${req.originalUrl}`
  );
  next();
});

/* ============================================================
   UPLOADS DIRECTORY RESOLUTION
============================================================ */

const candidateBaseFolders = [
  path.join(__dirname, "..", "uploads"),       // map-service/uploads
  path.join(__dirname, "..", "..", "uploads"), // root/uploads
  path.join(process.cwd(), "uploads"),         // cwd/uploads
];

let baseUploads = candidateBaseFolders.find((p) => {
  try {
    return fs.existsSync(p) && fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
});

if (!baseUploads) {
  baseUploads = path.join(__dirname, "..", "..", "uploads");
  fs.mkdirSync(baseUploads, { recursive: true });
  console.log(`📁 Created uploads root at ${baseUploads}`);
}

const touristSpotsDir = path.join(baseUploads, "touristspotsmap");
if (!fs.existsSync(touristSpotsDir)) {
  fs.mkdirSync(touristSpotsDir, { recursive: true });
  console.log(`📁 Created touristspotsmap folder at ${touristSpotsDir}`);
}

/* ============================================================
   STATIC FILE SERVING
============================================================ */
app.use(
  "/uploads/touristspotsmap",
  express.static(touristSpotsDir, {
    extensions: ["jpg", "jpeg", "png", "webp", "gif"],
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "public, max-age=3600");
    },
  })
);

/* ============================================================
   DEBUG ENDPOINTS
============================================================ */

// List all files in uploads
app.get("/debug/list-uploads", (req, res) => {
  try {
    const files = fs
      .readdirSync(touristSpotsDir, { withFileTypes: true })
      .map((d) => ({
        name: d.name,
        isDir: d.isDirectory(),
      }));

    res.json({
      uploadsRoot: baseUploads,
      touristSpotsDir,
      filesCount: files.length,
      files,
    });
  } catch (err) {
    res.status(500).json({
      error: "Could not list uploads",
      message: err.message,
    });
  }
});

// Check specific file
app.get("/debug/check-file", (req, res) => {
  const p = req.query.path;
  if (!p) {
    return res.status(400).json({
      ok: false,
      error: "Provide ?path=filename.jpg",
    });
  }

  const safe = path.basename(p);
  const filePath = path.join(touristSpotsDir, safe);
  const exists = fs.existsSync(filePath);

  res.json({
    requested: p,
    safe,
    filePath,
    exists,
    size: exists ? fs.statSync(filePath).size : null,
  });
});

/* ============================================================
   LOAD ROUTES
============================================================ */

try {
  const touristSpotsRoutes = require("./routes/touristSpots");
  app.use("/map/touristspots", touristSpotsRoutes);
  console.log("✅ touristSpots routes mounted at /map/touristspots");
} catch (err) {
  console.warn("⚠️ Failed to load touristSpots routes:", err.message);
}

/* ============================================================
   HEALTH ENDPOINT
============================================================ */
app.get("/api/health", async (req, res) => {
  try {
    const pool = await getPool();
    await pool.query("SELECT 1");
    res.json({ status: "ok", db: "connected" });
  } catch (err) {
    res.status(500).json({
      status: "error",
      db: "unavailable",
      message: err.message,
    });
  }
});

/* ============================================================
   GLOBAL ERROR HANDLER
============================================================ */
app.use((err, req, res, next) => {
  console.error("🔥 MAP SERVICE ERROR:", err);
  res.status(500).json({
    error: "Something went wrong!",
    message: err.message,
  });
});

/* ============================================================
   START SERVER
============================================================ */
(async function start() {
  try {
    await getPool();
    const PORT = process.env.PORT || 3004;
    app.listen(PORT, () =>
      console.log(`🚀 Map service running on port ${PORT}`)
    );
  } catch (err) {
    console.error("❌ Failed to initialize DB for Map service:", err.message);
    process.exit(1);
  }
})();
