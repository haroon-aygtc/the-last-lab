/**
 * MySQL Migration Script Runner
 * This script runs all SQL migration files in the migrations directory
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

// Get database configuration from environment variables
const dbConfig = {
  host: process.env.MYSQL_HOST || "localhost",
  port: parseInt(process.env.MYSQL_PORT || "3306", 10),
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || "chat_app_dev",
};

// Check if --fresh flag is provided
const isFreshMigration = process.argv.includes("--fresh");

// Function to run a single migration file
async function runMigration(connection, file) {
  console.log(`Running migration: ${file}`);
  try {
    const filePath = path.join(__dirname, "../migrations", file);
    const sql = fs.readFileSync(filePath, "utf8");

    // Split the SQL file into individual statements by semicolon
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
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.database,
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

    // If fresh migration, drop all existing tables
    if (isFreshMigration) {
      console.log("Fresh migration requested. Dropping existing tables...");

      // Get all tables except migrations
      const [tables] = await connection.query(
        `
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = ? AND table_name != 'migrations'
      `,
        [dbConfig.database],
      );

      // Disable foreign key checks temporarily
      await connection.query("SET FOREIGN_KEY_CHECKS = 0");

      // Drop each table
      for (const table of tables) {
        const tableName = table.TABLE_NAME || table.table_name;
        await connection.query(`DROP TABLE IF EXISTS \`${tableName}\``);
        console.log(`Dropped table: ${tableName}`);
      }

      // Re-enable foreign key checks
      await connection.query("SET FOREIGN_KEY_CHECKS = 1");

      // Clear migrations table
      await connection.query("TRUNCATE TABLE migrations");
      console.log("Cleared migrations history");
    }

    // Get list of already executed migrations
    const [executedMigrations] = await connection.query(
      "SELECT name FROM migrations",
    );
    const executedMigrationNames = executedMigrations.map((row) => row.name);

    // Get all migration files
    const migrationFiles = fs
      .readdirSync(path.join(__dirname, "../migrations"))
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
        process.exit(1);
      }
    }

    console.log("Migration process completed successfully");
  } catch (error) {
    console.error("Migration process failed:", error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log("Database connection closed");
    }
  }
}

// Run migrations
runMigrations();
