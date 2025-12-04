// backend/config/db.js
const mysql = require("mysql2/promise");

// ---------------------------------------------
// Load dotenv ONLY for local development
// ---------------------------------------------
if (!process.env.RAILWAY_ENVIRONMENT) {
  try {
    require("dotenv").config();
    console.log("ℹ️ DB: Running in LOCAL mode (.env loaded)");
  } catch (err) {
    console.warn("⚠️ dotenv not available, skipping");
  }
} else {
  console.log("ℹ️ DB: Running on RAILWAY environment");
}

let pool = null;

// Defaults
const DEFAULT_DB_NAME = "finaldiscovermansalay";
const DEFAULT_CONN_LIMIT = 10;

// ---------------------------------------------
// Create a DB connection (root-level) for DB creation
// ---------------------------------------------
async function createRootConnection() {
  return mysql.createConnection({
    host: process.env.MYSQLHOST || "localhost",
    user: process.env.MYSQLUSER || "root",
    password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || "",
    port:
      Number(process.env.MYSQLPORT) ||
      Number(process.env.DB_PORT) ||
      3306,
    multipleStatements: true,
  });
}

// ---------------------------------------------
// Auto-create database on LOCAL ONLY
// (Railway DB already exists)
// ---------------------------------------------
async function ensureDatabaseExists(dbName) {
  if (process.env.RAILWAY_ENVIRONMENT) return; // Railway must NOT create DB

  try {
    const conn = await createRootConnection();
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    console.log(`📦 LOCAL DB ensured: ${dbName}`);
    await conn.end();
  } catch (err) {
    console.error("❌ Failed to ensure local database:", err.message);
  }
}

// ---------------------------------------------
// Create pool from DATABASE_URL (Railway)
// ---------------------------------------------
async function createPoolFromDatabaseUrl(databaseUrl) {
  return mysql.createPool({
    uri: databaseUrl,
    waitForConnections: true,
    connectionLimit: DEFAULT_CONN_LIMIT,
    queueLimit: 0,
  });
}

// ---------------------------------------------
// Create pool from local environment variables
// ---------------------------------------------
async function createPoolFromConfig() {
  const DB_NAME =
    process.env.MYSQLDATABASE ||
    process.env.DB_NAME ||
    DEFAULT_DB_NAME;

  await ensureDatabaseExists(DB_NAME);

  return mysql.createPool({
    host: process.env.MYSQLHOST || process.env.DB_HOST || "localhost",
    user: process.env.MYSQLUSER || process.env.DB_USER || "root",
    password:
      process.env.MYSQLPASSWORD ||
      process.env.DB_PASSWORD ||
      "123456789",
    port:
      Number(process.env.MYSQLPORT) ||
      Number(process.env.DB_PORT) ||
      3306,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit:
      Number(process.env.DB_CONN_LIMIT) || DEFAULT_CONN_LIMIT,
    queueLimit: 0,
  });
}

// ---------------------------------------------
// Base tables (Users + Wishlist only)
// ---------------------------------------------
async function ensureUserAndWishlistTables(pool) {
  // 1. Create base tables
  const baseQueries = [
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
    )`,

    `CREATE TABLE IF NOT EXISTS wishlist (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255),
      item_id INT,
      name VARCHAR(255),
      category VARCHAR(255),
      added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(username, item_id)
    )`,
  ];

  for (const sql of baseQueries) {
    await pool.query(sql);
  }

  // 2. Get existing columns
  const [columns] = await pool.query(`SHOW COLUMNS FROM users`);

  const addColumn = async (name, type) => {
    const exists = columns.some((col) => col.Field === name);
    if (!exists) {
      await pool.query(`ALTER TABLE users ADD COLUMN ${name} ${type}`);
      console.log(`✅ Added missing column: ${name}`);
    }
  };

  // 3. Add missing verification columns
  await addColumn("is_verified", "TINYINT(1) NOT NULL DEFAULT 0");
  await addColumn("otp_code", "VARCHAR(10)");
  await addColumn("otp_expires_at", "DATETIME");
  await addColumn(
    "verification_method",
    "ENUM('email', 'phone') DEFAULT 'email'"
  );

   // 4. Add missing reset password OTP columns
  await addColumn("reset_otp_code", "VARCHAR(10)");
  await addColumn("reset_otp_expires_at", "DATETIME");

}



// ---------------------------------------------
// Unified CMS content table
// ---------------------------------------------
async function ensureUnifiedContentTable(pool) {
  const sql = `
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
  await pool.query(sql);
}

// ---------------------------------------------
// Initialize DB Pool
// ---------------------------------------------
async function initialize() {
  if (pool) return pool;

  // 1. Use Railway DATABASE_URL
  if (process.env.DATABASE_URL) {
    try {
      pool = await createPoolFromDatabaseUrl(process.env.DATABASE_URL);
      await pool.query("SELECT 1");
      console.log("🔗 Connected using DATABASE_URL (Railway)");
    } catch (err) {
      console.error("❌ DATABASE_URL connection failed:", err.message);
      throw err;
    }
  } else {
    // 2. Local environment
    try {
      pool = await createPoolFromConfig();
      await pool.query("SELECT 1");
      console.log("🔗 Connected to LOCAL MySQL");
    } catch (err) {
      console.error("❌ LOCAL DB connection failed:", err.message);
      throw err;
    }
  }

  // Users + Wishlist tables only
  await ensureUserAndWishlistTables(pool);

  // CMS unified content table
  await ensureUnifiedContentTable(pool);

  return pool;
}

async function getPool() {
  if (!pool) pool = await initialize();
  return pool;
}

module.exports = { getPool, initialize };
