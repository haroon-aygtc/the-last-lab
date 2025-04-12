/**
 * Database Routes
 *
 * These routes handle database operations for the web scraping module
 */

import express from "express";
import { getMySQLClient } from "../../utils/dbHelpers.js";
import { authenticateJWT } from "../middleware/auth.js";

const router = express.Router();

/**
 * @route GET /api/admin/database/tables
 * @desc Get all tables and their columns from the database
 * @access Private
 */
router.get("/tables", authenticateJWT, async (req, res) => {
  try {
    const sequelize = await getMySQLClient();

    // Get all tables
    const [tables] = await sequelize.query(
      `SELECT table_name 
       FROM information_schema.tables 
       WHERE table_schema = DATABASE() 
       ORDER BY table_name`,
    );

    // Get columns for each table
    const tablesWithColumns = [];

    for (const table of tables) {
      const tableName = table.table_name || table.TABLE_NAME; // Handle different case formats

      const [columns] = await sequelize.query(
        `SELECT column_name 
         FROM information_schema.columns 
         WHERE table_schema = DATABASE() 
         AND table_name = ? 
         ORDER BY ordinal_position`,
        {
          replacements: [tableName],
        },
      );

      tablesWithColumns.push({
        name: tableName,
        columns: columns.map((col) => col.column_name || col.COLUMN_NAME),
      });
    }

    res.json({ tables: tablesWithColumns });
  } catch (error) {
    console.error("Error fetching database tables:", error);
    res
      .status(500)
      .json({
        error: "Failed to fetch database tables",
        message: error.message,
      });
  }
});

/**
 * @route POST /api/admin/database/save
 * @desc Save scraping results to a database table
 * @access Private
 */
router.post("/save", authenticateJWT, async (req, res) => {
  const { results, config } = req.body;

  if (
    !results ||
    !Array.isArray(results) ||
    !config ||
    !config.table ||
    !config.columns
  ) {
    return res
      .status(400)
      .json({
        error:
          "Invalid request data. Results array and config object are required.",
      });
  }

  try {
    const sequelize = await getMySQLClient();
    const transaction = await sequelize.transaction();

    try {
      // Process each result
      for (const result of results) {
        if (!result.success) continue;

        // Prepare column data mapping
        const columnData = {};

        for (const [selectorId, columnName] of Object.entries(config.columns)) {
          if (result.data[selectorId] !== undefined) {
            // Handle arrays by converting to JSON string
            if (Array.isArray(result.data[selectorId])) {
              columnData[columnName] = JSON.stringify(result.data[selectorId]);
            } else {
              columnData[columnName] = result.data[selectorId];
            }
          }
        }

        // Add metadata columns
        columnData["source_url"] = result.url;
        columnData["scraped_at"] = new Date();

        // Build column names and placeholders for SQL query
        const columns = Object.keys(columnData).join(", ");
        const placeholders = Object.keys(columnData)
          .map(() => "?")
          .join(", ");

        // Execute insert query
        await sequelize.query(
          `INSERT INTO ${config.table} (${columns}) VALUES (${placeholders})`,
          {
            replacements: Object.values(columnData),
            type: sequelize.QueryTypes.INSERT,
            transaction,
          },
        );
      }

      // Commit transaction
      await transaction.commit();

      res.json({
        success: true,
        message: `Successfully saved ${results.filter((r) => r.success).length} results to table ${config.table}`,
      });
    } catch (dbError) {
      // Rollback transaction on error
      await transaction.rollback();
      throw dbError;
    }
  } catch (error) {
    console.error("Error saving to database:", error);
    res
      .status(500)
      .json({
        error: "Failed to save results to database",
        message: error.message,
      });
  }
});

export default router;
