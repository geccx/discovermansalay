const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { getPool } = require("../../config/db");

// -----------------------------------------------------
// UPLOAD ROOT: backend/uploads/logo
// Works in Local + Railway
// -----------------------------------------------------
const uploadsRoot = path.join(__dirname, "..", "..", "uploads");
const logoDir = path.join(uploadsRoot, "logo");

// Ensure main uploads folder exists
try {
  fs.mkdirSync(uploadsRoot, { recursive: true });
} catch (err) {
  console.warn("⚠️ Cannot create uploads root:", err.message);
}

// Ensure /logo folder exists
try {
  fs.mkdirSync(logoDir, { recursive: true });
  console.log("📁 Logo upload directory:", logoDir);
} catch (err) {
  console.warn("⚠️ Cannot create logo folder:", err.message);
}

// -----------------------------------------------------
// Multer Storage — Always save as logo.png / logo.webp
// -----------------------------------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, logoDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `logo${ext}`);
  },
});

const upload = multer({ storage });

// -----------------------------------------------------
// GET NAVBAR LOGO (from centralized content_items table)
// -----------------------------------------------------
router.get("/", async (req, res) => {
  try {
    const pool = await getPool();

    const [rows] = await pool.query(
      `
      SELECT media_path 
      FROM content_items
      WHERE source = 'navbar'
      ORDER BY updated_at DESC
      LIMIT 1
      `
    );

    if (!rows.length) {
      return res.json({ logo: "" });
    }

    return res.json({ logo: rows[0].media_path });
  } catch (err) {
    console.error("❌ Error fetching navbar logo:", err.message);
    return res.status(500).json({ error: "Database error" });
  }
});

// -----------------------------------------------------
// UPLOAD + UPDATE NAVBAR LOGO
// Saves ONLY in content_items (centralized CMS table)
// -----------------------------------------------------
router.post("/logo", upload.single("logo"), async (req, res) => {
  if (!req.file)
    return res.status(400).json({ error: "No file uploaded" });

  const logoPath = `logo/${req.file.filename}`; // public path

  try {
    const pool = await getPool();

    // --------------------------------------------
    // Insert centralized CMS entry using dedup hash
    // --------------------------------------------
    await pool.query(
      `
      INSERT INTO content_items (
        source, media_type, media_path, dedup_hash
      )
      VALUES (
        'navbar',
        'image',
        ?,
        SHA2(CONCAT('navbar|', ?), 256)
      )
      ON DUPLICATE KEY UPDATE 
        media_path = VALUES(media_path),
        updated_at = CURRENT_TIMESTAMP
      `,
      [logoPath, logoPath]
    );

    return res.json({
      ok: true,
      message: "Navbar logo updated successfully!",
      logo: logoPath,
    });
  } catch (err) {
    console.error("❌ Navbar logo upload failed:", err.message);
    return res.status(500).json({ error: "Database update failed" });
  }
});

module.exports = router;
