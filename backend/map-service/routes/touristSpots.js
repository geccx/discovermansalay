// backend/map-service/routes/touristSpots.js
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { getPool } = require("../../config/db");

const router = express.Router();

/* ---------------------------------------------
   UPLOAD DIRECTORY DISCOVERY
--------------------------------------------- */
const candidateBaseFolders = [
  path.join(__dirname, "..", "..", "uploads"),
  path.join(__dirname, "..", "uploads"),
  path.join(process.cwd(), "uploads"),
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
  console.log("📁 Created uploads base folder:", baseUploads);
}

const uploadDir = path.join(baseUploads, "touristspotsmap");
fs.mkdirSync(uploadDir, { recursive: true });

/* ---------------------------------------------
   MULTER CONFIG
--------------------------------------------- */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || "";
    const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpe?g|png|webp|gif)$/i.test(file.mimetype)) cb(null, true);
    else cb(new Error("Only image files (jpeg, png, webp, gif) are allowed."));
  },
});

/* ---------------------------------------------
   HELPER: PUBLIC IMAGE URL
--------------------------------------------- */
function makeImageUrl(req, filename) {
  if (!filename) return null;
  const base =
    process.env.MAP_SERVICE_BASE_URL ||
    `${req.protocol}://${req.get("host")}`;
  return `${base.replace(/\/$/, "")}/uploads/touristspotsmap/${encodeURIComponent(
    filename
  )}`;
}

/* ---------------------------------------------
   GET ALL TOURIST SPOTS
   (from content_items where source='touristspot')
--------------------------------------------- */
router.get("/", async (req, res) => {
  try {
    const pool = await getPool();

    const [rows] = await pool.query(
      `
      SELECT *
      FROM content_items
      WHERE source = 'touristspot'
      ORDER BY id DESC
    `
    );

    const mapped = rows.map((r) => ({
      ...r,
      image_url: makeImageUrl(req, r.media_path),
    }));

    res.json(mapped);
  } catch (err) {
    console.error("Error fetching tourist spots:", err);
    res.status(500).json({
      error: "Error fetching tourist spots",
      message: err.message,
    });
  }
});

/* ---------------------------------------------
   ADD TOURIST SPOT
--------------------------------------------- */
router.post("/", upload.single("image"), async (req, res) => {
  try {
    const { name, lat, lng, category } = req.body;
    const image = req.file?.filename || null;

    if (!name || !lat || !lng || !category) {
      return res.status(400).json({
        error: "Fields name, lat, lng, category are required.",
      });
    }

    const pool = await getPool();
    const [result] = await pool.query(
      `
      INSERT INTO content_items
      (source, name, category, lat, lng, media_type, media_path, dedup_hash)
      VALUES (
        'touristspot',
        ?, ?, ?, ?,
        'image',
        ?,
        SHA2(CONCAT(?, NOW()), 256)
      )
    `,
      [name, category, parseFloat(lat), parseFloat(lng), image, name]
    );

    res.status(201).json({
      message: "Tourist spot added successfully.",
      id: result.insertId,
      media_path: image,
      image_url: makeImageUrl(req, image),
    });
  } catch (err) {
    console.error("Error adding spot:", err);
    res.status(500).json({
      error: "Internal server error.",
      message: err.message,
    });
  }
});

/* ---------------------------------------------
   UPDATE TOURIST SPOT
--------------------------------------------- */
router.put("/:id", upload.single("image"), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, lat, lng, category } = req.body;
    const newImage = req.file?.filename || null;

    if (!name || !lat || !lng || !category) {
      return res.status(400).json({
        error: "Fields name, lat, lng, category are required.",
      });
    }

    const pool = await getPool();

    const [rows] = await pool.query(
      `SELECT media_path FROM content_items WHERE id = ? AND source = 'touristspot'`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Tourist spot not found." });
    }

    const oldImage = rows[0].media_path;

    // delete old file if new file uploaded
    if (newImage && oldImage) {
      const oldPath = path.join(uploadDir, oldImage);
      try {
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      } catch (e) {
        console.warn("Failed to delete old image:", e.message);
      }
    }

    await pool.query(
      `
      UPDATE content_items
      SET
        name = ?,
        lat = ?,
        lng = ?,
        category = ?,
        media_path = COALESCE(?, media_path)
      WHERE id = ? AND source = 'touristspot'
    `,
      [name, parseFloat(lat), parseFloat(lng), category, newImage, id]
    );

    res.json({
      message: "Tourist spot updated successfully.",
      media_path: newImage || oldImage,
      image_url: makeImageUrl(req, newImage || oldImage),
    });
  } catch (err) {
    console.error("Error updating spot:", err);
    res.status(500).json({
      error: "Internal server error.",
      message: err.message,
    });
  }
});

/* ---------------------------------------------
   DELETE TOURIST SPOT
--------------------------------------------- */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getPool();

    const [rows] = await pool.query(
      `SELECT media_path FROM content_items WHERE id = ? AND source = 'touristspot'`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Not found" });
    }

    const filename = rows[0].media_path;

    if (filename) {
      const filePath = path.join(uploadDir, filename);
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (err) {
        console.warn("Failed to delete file:", err.message);
      }
    }

    await pool.query(
      `DELETE FROM content_items WHERE id = ? AND source = 'touristspot'`,
      [id]
    );

    res.json({ message: "Tourist spot deleted." });
  } catch (err) {
    console.error("Error deleting tourist spot:", err);
    res.status(500).json({
      error: "Error deleting tourist spot",
      message: err.message,
    });
  }
});

module.exports = router;
