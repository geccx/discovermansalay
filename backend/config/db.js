// backend/config/db.js
const mysql = require('mysql2/promise');

// Load dotenv only for local development
try {
  if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
  }
} catch (e) {
  // ignore if dotenv isn't installed in production
}

let pool = null;

const DEFAULT_DB_NAME = 'finaldiscovermansalay';
const DEFAULT_CONN_LIMIT = 10;

async function createPoolFromDatabaseUrl(databaseUrl) {
  // mysql2 supports URI style connection string
  return mysql.createPool({
    uri: databaseUrl,
    waitForConnections: true,
    connectionLimit: DEFAULT_CONN_LIMIT,
    queueLimit: 0,
  });
}

async function createPoolFromConfig() {
  const DB_NAME = process.env.MYSQLDATABASE || process.env.DB_NAME || DEFAULT_DB_NAME;
  const DB_CONFIG = {
    host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
    user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
    password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '123456789',
    port: process.env.MYSQLPORT
      ? Number(process.env.MYSQLPORT)
      : process.env.DB_PORT
      ? Number(process.env.DB_PORT)
      : 3306,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: process.env.DB_CONN_LIMIT ? Number(process.env.DB_CONN_LIMIT) : DEFAULT_CONN_LIMIT,
    queueLimit: 0,
    // add timezone/charset here if needed
    // charset: 'utf8mb4',
  };

  return mysql.createPool(DB_CONFIG);
}

async function ensureBaseTables(pool) {
  // Optional: keep original table creation for prototypes (idempotent)
  const tableQueries = [
    `CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) UNIQUE,
      firstname VARCHAR(255),
      lastname VARCHAR(255),
      email VARCHAR(255) UNIQUE,
      password VARCHAR(255),
      role ENUM('user','admin'),
      contact_number VARCHAR(20),
      address TEXT,
      profile_image VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE TABLE IF NOT EXISTS wishlist (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255),
      item_id INT,
      name VARCHAR(255),
      category VARCHAR(255),
      added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(username, item_id)
    );`,

    `CREATE TABLE IF NOT EXISTS navbar (
      id INT AUTO_INCREMENT PRIMARY KEY,
      logo VARCHAR(255)
    );`,

    `CREATE TABLE IF NOT EXISTS experience_cards (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(100),
      image_path VARCHAR(255),
      link VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );`,

    `CREATE TABLE IF NOT EXISTS explorecms (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255),
      city VARCHAR(255),
      email VARCHAR(255),
      contact VARCHAR(50),
      image_path VARCHAR(500),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE TABLE IF NOT EXISTS hero_content (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      subtitle TEXT,
      media_type ENUM('image', 'video') DEFAULT 'image',
      media_path VARCHAR(255) DEFAULT 'default.jpg',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );`,

    `CREATE TABLE IF NOT EXISTS highlight_events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255),
      description TEXT,
      date_range VARCHAR(100),
      image_url VARCHAR(500),
      link VARCHAR(255)
    );`,

    `CREATE TABLE IF NOT EXISTS tourist_spots (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255),
      lat DECIMAL(9,6),
      lng DECIMAL(9,6),
      image VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      category VARCHAR(100)
    );`,

    `CREATE TABLE IF NOT EXISTS destinations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      category VARCHAR(100),
      image VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`
  ];

  for (const q of tableQueries) {
    try {
      await pool.query(q);
    } catch (err) {
      console.warn('⚠️ Base table creation failed:', err.message);
    }
  }
}

/**
 * Create unified content_items table (idempotent)
 */
async function ensureUnifiedContentTable(pool) {
  const createContentItemsSQL = `
  CREATE TABLE IF NOT EXISTS content_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    source VARCHAR(50) NOT NULL,
    title VARCHAR(255),
    name VARCHAR(255),
    description TEXT,
    category VARCHAR(100),
    city VARCHAR(255),
    email VARCHAR(255),
    contact VARCHAR(50),
    lat DECIMAL(9,6),
    lng DECIMAL(9,6),
    media_type ENUM('image','video') DEFAULT 'image',
    media_path VARCHAR(500),
    image_url VARCHAR(500),
    link VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    dedup_hash VARCHAR(64) NOT NULL,
    UNIQUE KEY uniq_dedup (dedup_hash)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  await pool.query(createContentItemsSQL);
}

/**
 * Check if a table exists in the current database
 */
async function tableExists(conn, dbName, tableName) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS cnt 
     FROM information_schema.tables 
     WHERE table_schema = ? AND table_name = ?`,
    [dbName, tableName]
  );
  return rows[0].cnt > 0;
}

/**
 * Run a mapping of migrations for tables that exist.
 * Each insert uses SHA2-based dedup_hash to avoid duplicates.
 */
async function runMigrations(pool) {
  // Determine database name used by the pool - fallback to env or default
  const DB_NAME = process.env.MYSQLDATABASE || process.env.DB_NAME || DEFAULT_DB_NAME;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Ensure content_items created
    await ensureUnifiedContentTable(pool);

    // For each source table, check existence then run insert
    const migrations = [
      {
        table: 'navbar',
        insertSQL: `
          INSERT IGNORE INTO content_items
            (source, media_path, created_at, dedup_hash)
          SELECT
            'navbar' AS source,
            logo AS media_path,
            NOW() AS created_at,
            SHA2(CONCAT('navbar|', COALESCE(logo, '')) , 256) AS dedup_hash
          FROM navbar;
        `
      },

      {
        table: 'experience_cards',
        insertSQL: `
          INSERT IGNORE INTO content_items
            (source, title, media_path, link, created_at, dedup_hash)
          SELECT
            'experience_cards' AS source,
            title,
            image_path,
            link,
            created_at,
            SHA2(CONCAT('experience_cards|', COALESCE(title,''), '|', COALESCE(image_path,''), '|', COALESCE(link,'')), 256) AS dedup_hash
          FROM experience_cards;
        `
      },

      {
        table: 'explorecms',
        insertSQL: `
          INSERT IGNORE INTO content_items
            (source, title, city, email, contact, media_path, created_at, dedup_hash)
          SELECT
            'explorecms' AS source,
            title,
            city,
            email,
            contact,
            image_path,
            created_at,
            SHA2(CONCAT('explorecms|', COALESCE(title,''), '|', COALESCE(city,''), '|', COALESCE(email,''), '|', COALESCE(image_path,'')), 256) AS dedup_hash
          FROM explorecms;
        `
      },

      {
        table: 'hero_content',
        insertSQL: `
          INSERT IGNORE INTO content_items
            (source, title, description, media_type, media_path, updated_at, dedup_hash)
          SELECT
            'hero_content' AS source,
            title,
            subtitle AS description,
            media_type,
            media_path,
            updated_at,
            SHA2(CONCAT('hero_content|', COALESCE(title,''), '|', COALESCE(subtitle,''), '|', COALESCE(media_type,''), '|', COALESCE(media_path,'')), 256) AS dedup_hash
          FROM hero_content;
        `
      },

      {
        table: 'highlight_events',
        insertSQL: `
          INSERT IGNORE INTO content_items
            (source, title, description, category, image_url, link, dedup_hash)
          SELECT
            'highlight_events' AS source,
            title,
            description,
            date_range AS category,
            image_url,
            link,
            SHA2(CONCAT('highlight_events|', COALESCE(title,''), '|', COALESCE(date_range,''), '|', COALESCE(image_url,'')), 256) AS dedup_hash
          FROM highlight_events;
        `
      },

      {
        table: 'tourist_spots',
        insertSQL: `
          INSERT IGNORE INTO content_items
            (source, name, lat, lng, image_url, category, created_at, dedup_hash)
          SELECT
            'tourist_spots' AS source,
            name,
            lat,
            lng,
            image AS image_url,
            category,
            created_at,
            SHA2(CONCAT('tourist_spots|', COALESCE(name,''), '|', COALESCE(lat,''), '|', COALESCE(lng,'')), 256) AS dedup_hash
          FROM tourist_spots;
        `
      },

      {
        table: 'destinations',
        insertSQL: `
          INSERT IGNORE INTO content_items
            (source, name, description, category, image_url, created_at, dedup_hash)
          SELECT
            'destinations' AS source,
            name,
            description,
            category,
            image,
            created_at,
            SHA2(CONCAT('destinations|', COALESCE(name,''), '|', COALESCE(category,''), '|', COALESCE(image,'')), 256) AS dedup_hash
          FROM destinations;
        `
      },
    ];

    for (const m of migrations) {
      const exists = await tableExists(conn, DB_NAME, m.table);
      if (exists) {
        try {
          await conn.query(m.insertSQL);
          // note: using INSERT IGNORE + unique dedup_hash makes these idempotent
          console.log(`➡️ Migrated data from "${m.table}" (if any).`);
        } catch (err) {
          console.warn(`⚠️ Migration for table "${m.table}" failed:`, err.message);
          // continue with other migrations
        }
      } else {
        // skip if source table not present
        // console.log(`Skipping migration for "${m.table}" (table not found).`);
      }
    }

    await conn.commit();
    console.log('✅ Migration to content_items completed (idempotent).');

    // NOTE: If you want to drop old tables once verified, do it manually:
    // await conn.query('DROP TABLE IF EXISTS navbar, experience_cards, explorecms, hero_content, highlight_events, tourist_spots, destinations;');
    // (Dropping is commented out above intentionally.)
  } catch (err) {
    await conn.rollback();
    console.error('❌ Migration transaction failed:', err.message);
    throw err;
  } finally {
    conn.release();
  }
}

async function initialize() {
  if (pool) return pool;

  // If Railway provides DATABASE_URL, use that directly
  if (process.env.DATABASE_URL) {
    try {
      pool = await createPoolFromDatabaseUrl(process.env.DATABASE_URL);
      // quick test
      await pool.query('SELECT 1');
      console.log('✅ Connected to Railway MySQL via DATABASE_URL');
    } catch (err) {
      console.error('❌ Failed to connect using DATABASE_URL:', err.message);
      throw err;
    }
  } else {
    // Fallback to explicit config
    try {
      pool = await createPoolFromConfig();
      await pool.query('SELECT 1');
      const DB_NAME = process.env.MYSQLDATABASE || process.env.DB_NAME || DEFAULT_DB_NAME;
      console.log(`✅ Connected to MySQL: ${DB_NAME}`);
    } catch (err) {
      console.error('❌ Failed to connect to MySQL:', err.message);
      throw err;
    }
  }

  // Ensure base prototype tables exist (idempotent)
  try {
    await ensureBaseTables(pool);
  } catch (err) {
    console.warn('⚠️ ensureBaseTables error:', err.message);
  }

  // Run migration to unified content table (idempotent)
  try {
    await runMigrations(pool);
  } catch (err) {
    console.warn('⚠️ runMigrations error:', err.message);
  }

  return pool;
}

async function getPool() {
  if (!pool) {
    pool = await initialize();
  }
  return pool;
}

module.exports = { getPool, initialize };
