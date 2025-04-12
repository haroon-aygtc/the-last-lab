import express from "express";
import axios from "axios";
import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { rateLimit } from "express-rate-limit";
import { getMySQLClient } from "../../utils/dbHelpers.js";
import { authenticateJWT } from "../middleware/auth.js";
import cheerio from "cheerio";

const router = express.Router();

// Rate limiting to prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests from this IP, please try again after 15 minutes",
});

/**
 * @route POST /api/scraping/fetch
 * @desc Fetch HTML content from a URL
 * @access Private
 */
router.post("/fetch", authenticateJWT, async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ success: false, error: "URL is required" });
  }

  try {
    // Validate URL
    const parsedUrl = new URL(url);

    // Block requests to local network
    const hostname = parsedUrl.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.16.") ||
      hostname.endsWith(".local")
    ) {
      return res.status(403).json({
        success: false,
        error: "Access to local network addresses is forbidden",
      });
    }

    // Fetch the URL
    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      timeout: 30000, // 30 seconds timeout
    });

    res.json({
      success: true,
      html: response.data,
    });
  } catch (error) {
    console.error("Error fetching URL:", error);
    res.status(500).json({
      success: false,
      error: `Failed to fetch URL: ${error.message}`,
    });
  }
});

/**
 * @route POST /api/scraping/proxy-url
 * @desc Create a proxy URL for iframe embedding
 * @access Private
 */
router.post("/proxy-url", authenticateJWT, async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ success: false, error: "URL is required" });
  }

  try {
    // Validate URL
    const parsedUrl = new URL(url);

    // Block requests to local network
    const hostname = parsedUrl.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.16.") ||
      hostname.endsWith(".local")
    ) {
      return res.status(403).json({
        success: false,
        error: "Access to local network addresses is forbidden",
      });
    }

    // In a real implementation, this would create a proxy URL
    // For now, we'll just return the original URL with a proxy parameter
    const proxyUrl = `/api/scraping/proxy?url=${encodeURIComponent(url)}`;

    res.json({
      success: true,
      proxyUrl,
    });
  } catch (error) {
    console.error("Error creating proxy URL:", error);
    res.status(500).json({
      success: false,
      error: `Failed to create proxy URL: ${error.message}`,
    });
  }
});

/**
 * @route GET /api/scraping/proxy
 * @desc Proxy a request to an external website
 * @access Public (with rate limiting)
 */
router.get("/proxy", limiter, async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res
      .status(400)
      .json({ success: false, error: "URL parameter is required" });
  }

  try {
    // Validate URL
    const parsedUrl = new URL(url);

    // Block requests to local network
    const hostname = parsedUrl.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.16.") ||
      hostname.endsWith(".local")
    ) {
      return res.status(403).json({
        success: false,
        error: "Access to local network addresses is forbidden",
      });
    }

    // Launch headless browser
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
      const page = await browser.newPage();

      // Set viewport and user agent
      await page.setViewport({ width: 1280, height: 800 });
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      );

      // Navigate to URL
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

      // Add custom styles and scripts for selector tool
      await page.addStyleTag({
        content: `
          .selector-highlight {
            outline: 2px solid #3b82f6 !important;
            background-color: rgba(59, 130, 246, 0.1) !important;
          }
        `,
      });

      // Get page content
      const content = await page.content();

      // Set response headers
      res.setHeader("Content-Type", "text/html");
      res.setHeader("X-Frame-Options", "SAMEORIGIN");

      // Send the modified HTML
      res.send(content);
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.error("Proxy error:", error);
    res.status(500).json({
      success: false,
      error: `Failed to proxy request: ${error.message}`,
    });
  }
});

/**
 * @route POST /api/scraping/scrape
 * @desc Scrape multiple URLs with provided selectors
 * @access Private
 */
router.post("/scrape", authenticateJWT, async (req, res) => {
  const { targets } = req.body;

  if (!targets || !Array.isArray(targets) || targets.length === 0) {
    return res.status(400).json({
      success: false,
      error: "Valid targets array is required",
    });
  }

  try {
    // Process URLs concurrently for efficiency
    const results = await Promise.all(
      targets.map(async (target) => {
        try {
          // Fetch the URL
          const response = await axios.get(target.url, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
              Accept:
                "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.5",
              Connection: "keep-alive",
              "Upgrade-Insecure-Requests": "1",
              "Cache-Control": "max-age=0",
            },
            timeout: 30000, // 30 seconds timeout
          });

          const $ = cheerio.load(response.data);
          const data = {};

          // Process each selector
          for (const selector of target.selectors) {
            try {
              switch (selector.type) {
                case "text":
                  data[selector.id] = $(selector.selector).text().trim();
                  break;
                case "html":
                  data[selector.id] = $(selector.selector).html();
                  break;
                case "attribute":
                  if (selector.attribute) {
                    data[selector.id] = $(selector.selector).attr(
                      selector.attribute,
                    );
                  }
                  break;
                case "list":
                  if (selector.listItemSelector) {
                    const listItems = [];
                    $(selector.selector)
                      .find(selector.listItemSelector)
                      .each((_, el) => {
                        listItems.push($(el).text().trim());
                      });
                    data[selector.id] = listItems;
                  }
                  break;
              }
            } catch (selectorError) {
              console.warn(
                `Error processing selector ${selector.id} for URL ${target.url}:`,
                selectorError,
              );
              data[selector.id] = null;
            }
          }

          return {
            url: target.url,
            timestamp: new Date().toISOString(),
            data,
            success: true,
          };
        } catch (error) {
          console.error(`Error scraping URL ${target.url}:`, error);
          return {
            url: target.url,
            timestamp: new Date().toISOString(),
            data: {},
            success: false,
            error: error.message,
          };
        }
      }),
    );

    res.json(results);
  } catch (error) {
    console.error("Error in scrapeMultipleUrls:", error);
    res.status(500).json({
      success: false,
      error: `Failed to scrape multiple URLs: ${error.message}`,
    });
  }
});

/**
 * @route POST /api/scraping/save-file
 * @desc Save scraping results to a file
 * @access Private
 */
router.post("/save-file", authenticateJWT, async (req, res) => {
  const { results, filename } = req.body;

  if (!results || !Array.isArray(results) || !filename) {
    return res.status(400).json({
      success: false,
      error: "Results array and filename are required",
    });
  }

  try {
    // Create data directory if it doesn't exist
    const dataDir = path.join(process.cwd(), "data", "scraping");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Write results to file
    const filePath = path.join(dataDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(results, null, 2));

    res.json({
      success: true,
      filePath: `data/scraping/${filename}`,
    });
  } catch (error) {
    console.error("Error saving to file:", error);
    res.status(500).json({
      success: false,
      error: `Failed to save to file: ${error.message}`,
    });
  }
});

/**
 * @route POST /api/scraping/save-db
 * @desc Save scraping results to database
 * @access Private
 */
router.post("/save-db", authenticateJWT, async (req, res) => {
  const { results, dbConfig } = req.body;

  if (
    !results ||
    !Array.isArray(results) ||
    !dbConfig ||
    !dbConfig.table ||
    !dbConfig.columns
  ) {
    return res.status(400).json({
      success: false,
      error: "Results array and database configuration are required",
    });
  }

  // Validate table name to prevent SQL injection
  const tableNameRegex = /^[a-zA-Z0-9_]+$/;
  if (!tableNameRegex.test(dbConfig.table)) {
    return res.status(400).json({
      success: false,
      error: "Invalid table name format",
    });
  }

  // Validate column names to prevent SQL injection
  for (const columnName of Object.values(dbConfig.columns)) {
    if (!tableNameRegex.test(columnName)) {
      return res.status(400).json({
        success: false,
        error: `Invalid column name format: ${columnName}`,
      });
    }
  }

  let sequelize;
  let transaction;

  try {
    sequelize = await getMySQLClient();
    transaction = await sequelize.transaction();

    // Check if table exists
    const [tableExists] = await sequelize.query(
      `SELECT COUNT(*) as count FROM information_schema.tables 
       WHERE table_schema = DATABASE() AND table_name = ?`,
      {
        replacements: [dbConfig.table],
        type: sequelize.QueryTypes.SELECT,
        transaction,
      },
    );

    if (!tableExists || tableExists.count === 0) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        error: `Table '${dbConfig.table}' does not exist in the database`,
      });
    }

    // Process each result
    const successCount = 0;
    for (const result of results) {
      if (!result.success) continue;

      try {
        // Prepare column data mapping
        const columnData = {};

        for (const [selectorId, columnName] of Object.entries(
          dbConfig.columns,
        )) {
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
          `INSERT INTO ${dbConfig.table} (${columns}) VALUES (${placeholders})`,
          {
            replacements: Object.values(columnData),
            type: sequelize.QueryTypes.INSERT,
            transaction,
          },
        );

        successCount++;
      } catch (itemError) {
        console.error(`Error processing item from ${result.url}:`, itemError);
        // Continue with other items instead of failing the entire batch
      }
    }

    // Commit transaction
    await transaction.commit();

    res.json({
      success: true,
      message: `Successfully saved ${successCount} results to table ${dbConfig.table}`,
    });
  } catch (error) {
    console.error("Error saving to database:", error);

    // Ensure transaction is rolled back if it exists
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error("Error rolling back transaction:", rollbackError);
      }
    }

    // Send appropriate error response based on error type
    if (
      error.name === "SequelizeConnectionError" ||
      error.name === "SequelizeConnectionRefusedError"
    ) {
      res.status(503).json({
        success: false,
        error: "Database connection failed. Please try again later.",
      });
    } else if (error.name === "SequelizeUniqueConstraintError") {
      res.status(409).json({
        success: false,
        error:
          "Duplicate entry detected. Some records may already exist in the database.",
      });
    } else {
      res.status(500).json({
        success: false,
        error: `Failed to save to database: ${error.message}`,
      });
    }
  }
});

/**
 * @route GET /api/scraping/database/tables
 * @desc Get database tables and columns
 * @access Private
 */
router.get("/database/tables", authenticateJWT, async (req, res) => {
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

    res.json(tablesWithColumns);
  } catch (error) {
    console.error("Error fetching database tables:", error);
    res.status(500).json({
      message: `Failed to fetch database tables: ${error.message}`,
    });
  }
});

export default router;
