// backend/searchFiltering-service/routes/search.js
const express = require("express");
const router = express.Router();
const { getPool } = require("../../config/db");

/* ---------------------------------------------
   MAIN SEARCH (content_items + tourist_spots)
--------------------------------------------- */
router.get("/", async (req, res) => {
  const { q = "" } = req.query;
  const keyword = q.trim().toLowerCase();

  if (!keyword) return res.json({ results: [] });

  try {
    const pool = await getPool();

    const sql = `
      SELECT 
        id,
        name,
        category,
        description,
        COALESCE(image_url, media_path) AS image_url,
        created_at,
        'content' AS source
      FROM content_items
      WHERE LOWER(name) LIKE ?
         OR LOWER(category) LIKE ?
         OR LOWER(description) LIKE ?
         OR LOWER(city) LIKE ?

      UNION

      SELECT 
        id,
        name,
        category,
        description,
        media_path AS image_url,
        created_at,
        'tourist_spots' AS source
      FROM tourist_spots
      WHERE LOWER(name) LIKE ?
         OR LOWER(category) LIKE ?
         OR LOWER(description) LIKE ?
    `;

    const params = [
      `%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`,
      `%${keyword}%`, `%${keyword}%`, `%${keyword}%`,
    ];

    const [rows] = await pool.query(sql, params);

    // Simple relevance ranking
    const ranked = rows.sort((a, b) => {
      const kw = keyword;
      const nameA = (a.name || "").toLowerCase();
      const nameB = (b.name || "").toLowerCase();

      const exactA = nameA === kw;
      const exactB = nameB === kw;
      if (exactA && !exactB) return -1;
      if (!exactA && exactB) return 1;

      const startsA = nameA.startsWith(kw);
      const startsB = nameB.startsWith(kw);
      if (startsA && !startsB) return -1;
      if (!startsA && startsB) return 1;

      return nameA.localeCompare(nameB);
    });

    res.json({ results: ranked });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/* ---------------------------------------------
   LIVE SUGGESTIONS
--------------------------------------------- */
router.get("/suggestions", async (req, res) => {
  const { q = "" } = req.query;
  const keyword = q.trim().toLowerCase();

  if (!keyword) return res.json({ suggestions: [] });

  try {
    const pool = await getPool();

    const sql = `
      SELECT DISTINCT name, 'content' AS source
      FROM content_items
      WHERE LOWER(name) LIKE ?

      UNION

      SELECT DISTINCT name, 'tourist_spots' AS source
      FROM tourist_spots
      WHERE LOWER(name) LIKE ?
      LIMIT 7
    `;

    const [rows] = await pool.query(sql, [`${keyword}%`, `${keyword}%`]);

    res.json({ suggestions: rows });
  } catch (err) {
    console.error("Suggestion fetch error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
