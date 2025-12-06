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
   Railway DATABASE_URL
--------------------------------------------- */
async function createPoolFromDatabaseUrl(url) {
  return mysql.createPool({
    uri: url,
    connectionLimit: DEFAULT_CONN_LIMIT,
    waitForConnections: true,
  });
}

/* ---------------------------------------------
   LOCAL MySQL connection
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

  // Wishlist base table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wishlist (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255),
      item_id INT,
      name VARCHAR(255),
      category VARCHAR(255),
      image_path VARCHAR(500),
      added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(username, item_id)
    )
  `);

  console.log("🧩 User + Wishlist tables ensured");
  // ---------- AUTO-MIGRATION: Check missing verification_method ----------
  const [userCols] = await pool.query(`SHOW COLUMNS FROM users`);
  const hasVerificationMethod = userCols.some(c => c.Field === "verification_method");

  if (!hasVerificationMethod) {
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN verification_method VARCHAR(20) DEFAULT 'email' AFTER otp_expires_at
    `);
    console.log("🛠️ Added missing verification_method to users");
  }

  // ---------- AUTO-MIGRATION: Check missing image_path in wishlist ----------
  const [wishCols] = await pool.query(`SHOW COLUMNS FROM wishlist`);
  const hasImagePath = wishCols.some((c) => c.Field === "image_path");

  if (!hasImagePath) {
    await pool.query(`
      ALTER TABLE wishlist 
      ADD COLUMN image_path VARCHAR(500) NULL AFTER category
    `);
    console.log("🛠️ Added missing image_path to wishlist");
  }


/* ---------------------------------------------
   UNIFIED CONTENT TABLE
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
   ACCOMMODATION BOOKINGS TABLE (AUTO-MIGRATED)
--------------------------------------------- */
async function ensureAccommodationBookingTable(pool) {
  console.log("🔍 Checking accommodation_bookings table...");

  // 1. Create table if it doesn't exist
  await pool.query(`
    CREATE TABLE IF NOT EXISTS accommodation_bookings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      accommodation_id INT,
      user_name VARCHAR(255),
      user_email VARCHAR(255),
      user_contact VARCHAR(50),
      check_in DATE,
      check_out DATE,
      guests INT,
      status ENUM('pending','awaiting_management','confirmed','cancelled') DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (accommodation_id) REFERENCES content_items(id)
    )
  `);

  console.log("📦 accommodation_bookings table ensured");

  /* ---------------------------------------------------
     2. AUTO-ADD missing columns (check_in/out_time)
  ---------------------------------------------------- */

  const [columns] = await pool.query(`
    SHOW COLUMNS FROM accommodation_bookings
  `);

  const hasCheckInTime = columns.some((c) => c.Field === "check_in_time");
  const hasCheckOutTime = columns.some((c) => c.Field === "check_out_time");

  if (!hasCheckInTime) {
    await pool.query(`
      ALTER TABLE accommodation_bookings
      ADD COLUMN check_in_time VARCHAR(8) NULL AFTER check_out
    `);
    console.log("🛠️ Added check_in_time column");
  }

  if (!hasCheckOutTime) {
    await pool.query(`
      ALTER TABLE accommodation_bookings
      ADD COLUMN check_out_time VARCHAR(8) NULL AFTER check_in_time
    `);
    console.log("🛠️ Added check_out_time column");
  }

  /* ---------------------------------------------------
     3. Ensure ENUM is correct (auto-patch)
  ---------------------------------------------------- */
  await pool.query(`
    ALTER TABLE accommodation_bookings
    MODIFY COLUMN status ENUM('pending','awaiting_management','confirmed','cancelled') DEFAULT 'pending'
  `);

  console.log("🔧 Booking status ENUM updated");

  console.log("✅ accommodation_bookings migration complete");
}


/* ---------------------------------------------
   VISITORS + ADMIN LOGS tables
--------------------------------------------- */
async function ensureVisitorsAndLogsTables(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS visitors (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ip_address VARCHAR(255),
      browser VARCHAR(255),
      device VARCHAR(255),
      page VARCHAR(255),
      country VARCHAR(100),
      city VARCHAR(100),
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
   TOURIST SPOTS + REVIEWS tables
--------------------------------------------- */
async function ensureTouristSpotTables(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tourist_spots (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255),
      lat DECIMAL(10,8),
      lng DECIMAL(11,8),
      category VARCHAR(100),
      description TEXT,
      media_path VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tourist_spot_reviews (
      id INT AUTO_INCREMENT PRIMARY KEY,
      spot_id INT,
      user_name VARCHAR(255),
      rating TINYINT,
      comment TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (spot_id) REFERENCES tourist_spots(id)
    )
  `);

  console.log("📍 Tourist spots + reviews ensured");
}

/* ---------------------------------------------
   Initialize (Local + Railway Compatible)
--------------------------------------------- */
async function initialize() {
  if (pool) return pool;

  if (process.env.DATABASE_URL) {
    pool = await createPoolFromDatabaseUrl(process.env.DATABASE_URL);
    console.log("🔗 Connected using DATABASE_URL (Railway)");
  } else {
    pool = await createPoolFromLocalConfig();
    console.log("🔗 Connected to LOCAL MySQL");
  }

  await pool.query("SELECT 1");

  await ensureUserAndWishlistTables(pool);
  await ensureSuperAdmin(pool);
  await ensureUnifiedContentTable(pool);
  await ensureVisitorsAndLogsTables(pool);
  await ensureTouristSpotTables(pool);
  await ensureAccommodationBookingTable(pool);

  return pool;
}

async function getPool() {
  if (!pool) pool = await initialize();
  return pool;
}

module.exports = { getPool, initialize };
