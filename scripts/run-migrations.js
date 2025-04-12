/**
 * MySQL Migration Script Runner
 * This script runs all SQL migration files in the migrations directory
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const { promisify } = require("util");
const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);

// Get database configuration from environment variables or config file
const dbConfig = require("../config/database.js");
const env = process.env.NODE_ENV || "development";
const config = dbConfig[env];

// Function to run a single migration file
async function runMigration(connection, file) {
  console.log(`Running migration: ${file}`);
  try {
    const filePath = path.join(__dirname, "../migrations", file);
    const sql = await readFile(filePath, "utf8");

    // Split the SQL file into individual statements by semicolon
    // This is a simple approach and might not work for all SQL files
    // especially those with stored procedures or triggers
    const statements = sql
      .split(";")
      .filter((statement) => statement.trim() !== "");

    // Execute each statement
    for (const statement of statements) {
      await connection.query(statement);
    }

    console.log(`✅ Migration ${file} completed successfully`);
    return true;
  } catch (error) {
    console.error(`❌ Error running migration ${file}:`, error);
    return false;
  }
}

// Main function to run all migrations
async function runMigrations() {
  let connection;

  try {
    // Create database connection
    connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password,
      database: config.database,
      multipleStatements: true, // Enable multiple statements
    });

    console.log("Connected to MySQL database");

    // Create migrations table if it doesn't exist
    await connection.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get list of already executed migrations
    const [executedMigrations] = await connection.query(
      "SELECT name FROM migrations",
    );
    const executedMigrationNames = executedMigrations.map((row) => row.name);

    // Get all migration files
    const migrationFiles = (
      await readdir(path.join(__dirname, "../migrations"))
    )
      .filter((file) => file.endsWith(".sql"))
      .sort(); // Sort to ensure migrations run in order

    // Filter out already executed migrations
    const pendingMigrations = migrationFiles.filter(
      (file) => !executedMigrationNames.includes(file),
    );

    if (pendingMigrations.length === 0) {
      console.log("No pending migrations to run");
      return;
    }

    console.log(`Found ${pendingMigrations.length} pending migrations`);

    // Run each pending migration
    for (const file of pendingMigrations) {
      const success = await runMigration(connection, file);

      if (success) {
        // Record successful migration
        await connection.query("INSERT INTO migrations (name) VALUES (?)", [
          file,
        ]);
      } else {
        // Stop on first failure
        console.error(`Migration ${file} failed. Stopping migration process.`);
        break;
      }
    }

    console.log("Migration process completed");
  } catch (error) {
    console.error("Migration process failed:", error);
  } finally {
    if (connection) {
      await connection.end();
      console.log("Database connection closed");
    }
  }
}

// Run migrations
runMigrations().catch(console.error);
