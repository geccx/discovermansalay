// backend/config/db.js
const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");

/* ---------------------------------------------
   Load dotenv (LOCAL only)
--------------------------------------------- */
if (!process.env.RAILWAY_ENVIRONMENT) {
  try {
    require("dotenv").config();
    console.log("ℹ️ DB: Running in LOCAL mode (.env loaded)");
  } catch (err) {
    console.warn("⚠️ dotenv not available");
  }
} else {
  console.log("ℹ️ DB: Running on RAILWAY environment");
}

let pool = null;

const DEFAULT_DB_NAME = "finaldiscovermansalay";
const DEFAULT_CONN_LIMIT = 10;

/* ---------------------------------------------
   Create root connection for LOCAL DB creation
--------------------------------------------- */
async function createRootConnection() {
  return mysql.createConnection({
    host: process.env.MYSQLHOST || "localhost",
    user: process.env.MYSQLUSER || "root",
    password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || "",
    port: Number(process.env.MYSQLPORT || process.env.DB_PORT || 3306),
    multipleStatements: true,
  });
}

/* ---------------------------------------------
   LOCAL: Auto-create DB if missing
--------------------------------------------- */
async function ensureDatabaseExists(dbName) {
  if (process.env.RAILWAY_ENVIRONMENT) return;

  try {
    const conn = await createRootConnection();
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    console.log(`📦 Local DB ensured: ${dbName}`);
    await conn.end();
  } catch (err) {
    console.error("❌ Failed to create local DB:", err.message);
  }
}

/* ---------------------------------------------
   Use Railway DATABASE_URL
--------------------------------------------- */
async function createPoolFromDatabaseUrl(url) {
  return mysql.createPool({
    uri: url,
    connectionLimit: DEFAULT_CONN_LIMIT,
    waitForConnections: true,
  });
}

/* ---------------------------------------------
   Use standard MySQL ENV variables (LOCAL)
--------------------------------------------- */
async function createPoolFromLocalConfig() {
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
    database: DB_NAME,
    port: Number(process.env.MYSQLPORT || process.env.DB_PORT || 3306),
    waitForConnections: true,
    connectionLimit: DEFAULT_CONN_LIMIT,
  });
}

/* ---------------------------------------------
   SUPERADMIN creation
--------------------------------------------- */
async function ensureSuperAdmin(pool) {
  const email = "discoverxmansalay@gmail.com";
  const defaultPassword = "Admin123!";

  const [rows] = await pool.query(
    "SELECT id FROM users WHERE role='superadmin' LIMIT 1"
  );

  if (rows.length > 0) {
    console.log("⚡ Superadmin already exists");
    return;
  }

  console.log("🔐 Creating default Superadmin account...");
  const hashed = await bcrypt.hash(defaultPassword, 10);

  await pool.query(
    `
      INSERT INTO users 
      (username, firstname, lastname, email, password, role, status, is_verified, is_approved)
      VALUES ('superadmin','Super','Admin', ?, ?, 'superadmin','active',1,1)
    `,
    [email, hashed]
  );

  console.log("✅ Superadmin created successfully");
}

/* ---------------------------------------------
   USERS + WISHLIST tables
--------------------------------------------- */
async function ensureUserAndWishlistTables(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255),
      firstname VARCHAR(255),
      lastname VARCHAR(255),
      email VARCHAR(255) UNIQUE,
      password VARCHAR(255),
      role ENUM('user','admin','superadmin') DEFAULT 'user',
      status ENUM('pending','active','disabled','invited') DEFAULT 'pending',
      contact_number VARCHAR(20),
      address TEXT,
      profile_image VARCHAR(255),
      is_verified TINYINT(1) DEFAULT 0,
      otp_code VARCHAR(10),
      otp_expires_at DATETIME,
      reset_otp_code VARCHAR(10),
      reset_otp_expires_at DATETIME,
      verification_token VARCHAR(255),
      verification_expires DATETIME,
      admin_otp_code VARCHAR(10),
      admin_otp_expires_at DATETIME,
      invite_token VARCHAR(255),
      invite_expires_at DATETIME,
      invited TINYINT(1) DEFAULT 0,
      is_approved TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS wishlist (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255),
      item_id INT,
      name VARCHAR(255),
      category VARCHAR(255),
      added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(username, item_id)
    )
  `);

  console.log("🧩 User + Wishlist tables ensured");
}

/* ---------------------------------------------
   Unified Content Table
--------------------------------------------- */
async function ensureUnifiedContentTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS content_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      source VARCHAR(50),
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
      dedup_hash VARCHAR(64) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_hash (dedup_hash)
    )
  `);

  console.log("🗂️ Unified content table ensured");
}

/* ---------------------------------------------
   Visitors & Admin Logs Tables
--------------------------------------------- */
async function ensureVisitorsAndLogsTables(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS visitors (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ip_address VARCHAR(255),
      browser VARCHAR(255),
      device VARCHAR(255),
      page VARCHAR(255),
      visit_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      admin_id INT,
      action VARCHAR(255),
      details JSON,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (admin_id) REFERENCES users(id)
    )
  `);

  console.log("📊 Visitors + Admin Logs tables ensured");
}

/* ---------------------------------------------
   Initialize (Local + Railway Compatible)
--------------------------------------------- */
async function initialize() {
  if (pool) return pool;

  if (process.env.DATABASE_URL) {
    // RAILWAY DATABASE_URL
    pool = await createPoolFromDatabaseUrl(process.env.DATABASE_URL);
    console.log("🔗 Connected using DATABASE_URL (Railway)");
  } else {
    // LOCAL DB
    pool = await createPoolFromLocalConfig();
    console.log("🔗 Connected to LOCAL MySQL");
  }

  await pool.query("SELECT 1"); // Test connection

  // Auto-create tables
  await ensureUserAndWishlistTables(pool);
  await ensureSuperAdmin(pool);
  await ensureUnifiedContentTable(pool);
  await ensureVisitorsAndLogsTables(pool);

  return pool;
}

async function getPool() {
  if (!pool) pool = await initialize();
  return pool;
}

module.exports = { getPool, initialize };
