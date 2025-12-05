// backend/config/db.js
const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");

// ---------------------------------------------
// Load dotenv for LOCAL (Railway uses env vars)
// ---------------------------------------------
if (!process.env.RAILWAY_ENVIRONMENT) {
  try {
    require("dotenv").config();
    console.log("ℹ️ DB: Running in LOCAL mode (.env loaded)");
  } catch (err) {
    console.warn("⚠️ dotenv not available, skipping");
  }
} else {
  console.log("ℹ️ DB: Running on RAILWAY");
}

let pool = null;

const DEFAULT_DB_NAME = "finaldiscovermansalay";
const DEFAULT_CONN_LIMIT = 10;

// ---------------------------------------------
// Create root connection for DB creation (LOCAL ONLY)
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
// Auto-create DB locally
// ---------------------------------------------
async function ensureDatabaseExists(dbName) {
  if (process.env.RAILWAY_ENVIRONMENT) return;

  try {
    const conn = await createRootConnection();
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    console.log(`📦 LOCAL DB ensured: ${dbName}`);
    await conn.end();
  } catch (err) {
    console.error("❌ Failed to ensure local DB:", err.message);
  }
}

// ---------------------------------------------
// Create pool from Railway DATABASE_URL
// ---------------------------------------------
async function createPoolFromDatabaseUrl(url) {
  return mysql.createPool({
    uri: url,
    waitForConnections: true,
    connectionLimit: DEFAULT_CONN_LIMIT,
  });
}

// ---------------------------------------------
// Create pool from local configuration
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
    connectionLimit: DEFAULT_CONN_LIMIT,
  });
}

// ---------------------------------------------
// SUPERADMIN CREATION
// ---------------------------------------------
async function ensureSuperAdmin(pool) {
  const SUPERADMIN_EMAIL = "discoverxmansalay@gmail.com";
  const DEFAULT_PASSWORD = "Admin123!";

  const [rows] = await pool.query(
    "SELECT id FROM users WHERE role = 'superadmin' LIMIT 1"
  );

  if (rows.length > 0) {
    console.log("⚡ Superadmin already exists");
    return;
  }

  console.log("🔐 Creating default Superadmin...");

  const hashed = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  await pool.query(
    `
      INSERT INTO users 
      (username, firstname, lastname, email, password, role, status, is_verified, is_approved)
      VALUES (?, ?, ?, ?, ?, 'superadmin', 'active', 1, 1)
    `,
    ["superadmin", "Super", "Admin", SUPERADMIN_EMAIL, hashed]
  );

  console.log("✅ Superadmin created");
}

// ---------------------------------------------
// USERS + WISHLIST TABLES (FULL MERGE VERSION)
// ---------------------------------------------
async function ensureUserAndWishlistTables(pool) {
  // Base USERS table (safest minimum schema)
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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // WISHLIST table
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

  // Fetch columns for dynamic upgrades
  const [columns] = await pool.query("SHOW COLUMNS FROM users");

  const addColumn = async (name, type) => {
    if (!columns.some((c) => c.Field === name)) {
      await pool.query(`ALTER TABLE users ADD COLUMN ${name} ${type}`);
      console.log(`🆕 Column added: ${name}`);
    }
  };

  // AUTH / VERIFICATION FIELDS
  await addColumn("is_verified", "TINYINT(1) DEFAULT 0");
  await addColumn("otp_code", "VARCHAR(10)");
  await addColumn("otp_expires_at", "DATETIME");
  await addColumn("verification_method", "ENUM('email','phone') DEFAULT 'email'");

  await addColumn("reset_otp_code", "VARCHAR(10)");
  await addColumn("reset_otp_expires_at", "DATETIME");

  // INVITE FLOW FIELDS
  await addColumn("invite_token", "VARCHAR(255)");
  await addColumn("invite_expires_at", "DATETIME");
  await addColumn("invited", "TINYINT(1) DEFAULT 0");

  // EMAIL VERIFICATION TOKEN (used by /verify/:token)
  await addColumn("verification_token", "VARCHAR(255)");
  await addColumn("verification_expires", "DATETIME");

  // USER APPROVAL
  await addColumn("is_approved", "TINYINT(1) DEFAULT 0");

  // ADMIN OTP FOR ADMIN LOGIN
  await addColumn("admin_otp_code", "VARCHAR(10)");
  await addColumn("admin_otp_expires_at", "DATETIME");

  // ENUM FIXES ------------------------------------------------
  await pool.query(`
    ALTER TABLE users 
    MODIFY role ENUM('user','admin','superadmin') DEFAULT 'user'
  `);

  await pool.query(`
    ALTER TABLE users 
    MODIFY status ENUM('pending','active','disabled','invited') DEFAULT 'pending'
  `);

  console.log("🔧 ENUM roles + status upgraded");
}

// ---------------------------------------------
// Unified content table
// ---------------------------------------------
async function ensureUnifiedContentTable(pool) {
  await pool.query(`
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
  `);
}

// ---------------------------------------------
// Initialize pool + migrate + ensure tables
// ---------------------------------------------
async function initialize() {
  if (pool) return pool;

  if (process.env.DATABASE_URL) {
    pool = await createPoolFromDatabaseUrl(process.env.DATABASE_URL);
    await pool.query("SELECT 1");
    console.log("🔗 Connected via DATABASE_URL");
  } else {
    pool = await createPoolFromConfig();
    await pool.query("SELECT 1");
    console.log("🔗 Connected to LOCAL MySQL");
  }

  await ensureUserAndWishlistTables(pool);
  await ensureSuperAdmin(pool);
  await ensureUnifiedContentTable(pool);

  return pool;
}

async function getPool() {
  if (!pool) pool = await initialize();
  return pool;
}

module.exports = { getPool, initialize };
