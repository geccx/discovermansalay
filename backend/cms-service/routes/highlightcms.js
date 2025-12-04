// cms-service/routes/highlightcms.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const { getPool } = require("../../config/db");
const crypto = require("crypto");
const fs = require("fs");

// Upload directory
const uploadDir = path.join(__dirname, "../../uploads/highlightevents");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Generate SHA-256 hash for dedup
function hashContent(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

// Sanitize filenames
function sanitizeTitle(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "");
}

// Multer storage setup
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safe = sanitizeTitle(req.body.title || "event");
    const ext = path.extname(file.originalname);
    cb(null, `${safe}${ext}`);
  },
});
const upload = multer({ storage });

/* ---------------------------------------------------------
 * GET ROOT MESSAGE
 * --------------------------------------------------------- */
router.get("/", (_, res) => {
  res.json({
    ok: true,
    message: "Highlight CMS Root",
    endpoints: [
      "/highlight-events (GET, POST)",
      "/highlight-events/:id (PUT, DELETE)",
    ],
  });
});

/* ---------------------------------------------------------
 * GET ALL HIGHLIGHT EVENTS
 * --------------------------------------------------------- */
router.get("/highlight-events", async (_, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      "SELECT * FROM content_items WHERE source='highlight_event' ORDER BY id DESC"
    );
    res.json(rows);
  } catch (err) {
    console.error("[GET highlight_events ERROR]", err);
    res.status(500).json({ error: err.message });
  }
});

/* ---------------------------------------------------------
 * CREATE HIGHLIGHT EVENT
 * --------------------------------------------------------- */
router.post("/highlight-events", upload.single("image"), async (req, res) => {
  const { title, description, date_range, link } = req.body;
  const file = req.file;

  if (!title || !description || !date_range)
    return res.status(400).json({ error: "Missing required fields" });

  const media_path = file
    ? `uploads/highlightevents/${file.filename}`
    : null;

  const media_type = file?.mimetype.startsWith("video") ? "video" : "image";

  const dedup_hash = hashContent(`${title}|${description}|${date_range}|${media_path}`);

  try {
    const pool = await getPool();
    await pool.query(
      `INSERT INTO content_items 
      (source, title, description, category, media_type, media_path, link, dedup_hash) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "highlight_event",
        title,
        description,
        date_range,
        media_type,
        media_path,
        link || null,
        dedup_hash,
      ]
    );

    res.status(201).json({ message: "Event created" });
  } catch (err) {
    console.error("[POST highlight_event ERROR]", err);
    res.status(500).json({ error: err.message });
  }
});

/* ---------------------------------------------------------
 * UPDATE EVENT
 * --------------------------------------------------------- */
router.put("/highlight-events/:id", upload.single("image"), async (req, res) => {
  const id = req.params.id;
  const { title, description, date_range, link } = req.body;

  try {
    const pool = await getPool();

    const [rows] = await pool.query(
      "SELECT * FROM content_items WHERE id=? AND source='highlight_event'",
      [id]
    );
    const event = rows[0];
    if (!event)
      return res.status(404).json({ error: "Event not found" });

    let media_path = event.media_path;
    let media_type = event.media_type;

    if (req.file) {
      media_path = `uploads/highlightevents/${req.file.filename}`;
      media_type = req.file.mimetype.startsWith("video") ? "video" : "image";

      // Delete old file
      if (event.media_path) {
        const oldPath = path.join(__dirname, "../../", event.media_path);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
    }

    const dedup_hash = hashContent(`${title}|${description}|${date_range}|${media_path}`);

    await pool.query(
      `UPDATE content_items 
      SET title=?, description=?, category=?, media_type=?, media_path=?, link=?, dedup_hash=?
      WHERE id=? AND source='highlight_event'`,
      [
        title,
        description,
        date_range,
        media_type,
        media_path,
        link || null,
        dedup_hash,
        id,
      ]
    );

    res.json({ message: "Event updated" });
  } catch (err) {
    console.error("[PUT highlight_event ERROR]", err);
    res.status(500).json({ error: err.message });
  }
});

/* ---------------------------------------------------------
 * DELETE EVENT
 * --------------------------------------------------------- */
router.delete("/highlight-events/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const pool = await getPool();

    const [rows] = await pool.query(
      "SELECT media_path FROM content_items WHERE id=? AND source='highlight_event'",
      [id]
    );
    const event = rows[0];
    if (!event)
      return res.status(404).json({ error: "Event not found" });

    // Delete file
    if (event.media_path) {
      const fullPath = path.join(__dirname, "../../", event.media_path);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }

    await pool.query(
      "DELETE FROM content_items WHERE id=? AND source='highlight_event'",
      [id]
    );

    res.json({ message: "Event deleted" });
  } catch (err) {
    console.error("[DELETE highlight_event ERROR]", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
