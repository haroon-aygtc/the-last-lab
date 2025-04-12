/**
 * AI Cache Routes
 *
 * These routes handle AI response caching for improved performance and reduced API costs
 */

import express from "express";
import { getMySQLClient } from "../../utils/dbHelpers.js";
import { authenticateJWT } from "../middleware/auth.js";
import crypto from "crypto";

const router = express.Router();

/**
 * @route GET /api/ai-cache/:hash
 * @desc Get a cached AI response by hash
 * @access Private
 */
router.get("/:hash", authenticateJWT, async (req, res) => {
  try {
    const { hash } = req.params;
    const { model } = req.query;

    if (!hash) {
      return res.status(400).json({ error: "Hash parameter is required" });
    }

    // Validate hash format to prevent injection attacks
    if (!/^[a-f0-9]{64}$/.test(hash)) {
      return res.status(400).json({ error: "Invalid hash format" });
    }

    const sequelize = await getMySQLClient();
    const now = new Date();

    const [cacheEntries] = await sequelize.query(
      `SELECT * FROM ai_response_cache 
       WHERE prompt_hash = ? AND model_used = ? AND expires_at > ?`,
      {
        replacements: [hash, model || "default", now],
        type: sequelize.QueryTypes.SELECT,
      },
    );

    if (
      !cacheEntries ||
      (Array.isArray(cacheEntries) && cacheEntries.length === 0)
    ) {
      return res.status(404).json({ error: "Cache entry not found" });
    }

    // Handle both array and single object responses
    const cacheEntry = Array.isArray(cacheEntries)
      ? cacheEntries[0]
      : cacheEntries;

    // Safely parse metadata with error handling
    let metadata = {};
    if (cacheEntry.metadata) {
      try {
        metadata =
          typeof cacheEntry.metadata === "string"
            ? JSON.parse(cacheEntry.metadata)
            : cacheEntry.metadata;
      } catch (parseError) {
        console.warn("Failed to parse cache entry metadata:", parseError);
      }
    }

    res.json({
      prompt: cacheEntry.prompt,
      response: cacheEntry.response,
      modelUsed: cacheEntry.model_used,
      metadata,
      createdAt: cacheEntry.created_at,
      expiresAt: cacheEntry.expires_at,
    });
  } catch (error) {
    console.error("Error getting cached response:", error);
    res.status(500).json({
      error: "Failed to retrieve cache entry",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * @route POST /api/ai-cache
 * @desc Cache an AI response
 * @access Private
 */
router.post("/", authenticateJWT, async (req, res) => {
  try {
    const { prompt, response, model, metadata, ttlSeconds = 3600 } = req.body;

    if (!prompt || !response) {
      return res.status(400).json({
        error: "Prompt and response are required",
      });
    }

    // Validate ttlSeconds to ensure it's a reasonable value
    const parsedTTL = parseInt(ttlSeconds, 10);
    if (isNaN(parsedTTL) || parsedTTL < 60 || parsedTTL > 2592000) {
      // Between 1 minute and 30 days
      return res.status(400).json({
        error: "TTL must be between 60 and 2592000 seconds",
      });
    }

    const modelName = model || "default";

    // Use SHA-256 for production-grade hashing
    const promptHash = crypto.createHash("sha256").update(prompt).digest("hex");

    const now = new Date();
    const expiresAt = new Date(now.getTime() + parsedTTL * 1000);
    const sequelize = await getMySQLClient();

    // Prepare metadata for storage with validation
    let metadataJson;
    try {
      metadataJson = JSON.stringify(metadata || {});
    } catch (error) {
      return res.status(400).json({
        error: "Invalid metadata format",
      });
    }

    // Use a transaction for data consistency
    const transaction = await sequelize.transaction();

    try {
      // Check if entry already exists
      const [existingEntries] = await sequelize.query(
        `SELECT id FROM ai_response_cache 
         WHERE prompt_hash = ? AND model_used = ?`,
        {
          replacements: [promptHash, modelName],
          type: sequelize.QueryTypes.SELECT,
          transaction,
        },
      );

      // Handle both array and single object responses
      const existingEntriesArray = Array.isArray(existingEntries)
        ? existingEntries
        : [existingEntries].filter(Boolean);

      if (existingEntriesArray.length > 0) {
        // Update existing cache entry
        await sequelize.query(
          `UPDATE ai_response_cache 
           SET response = ?, metadata = ?, updated_at = ?, expires_at = ? 
           WHERE id = ?`,
          {
            replacements: [
              response,
              metadataJson,
              now,
              expiresAt,
              existingEntriesArray[0].id,
            ],
            type: sequelize.QueryTypes.UPDATE,
            transaction,
          },
        );

        await transaction.commit();

        res.json({
          success: true,
          message: "Cache entry updated",
          id: existingEntriesArray[0].id,
          hash: promptHash,
        });
      } else {
        // Create new cache entry
        const [result] = await sequelize.query(
          `INSERT INTO ai_response_cache 
           (id, prompt, prompt_hash, response, model_used, metadata, created_at, updated_at, expires_at) 
           VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?)`,
          {
            replacements: [
              prompt,
              promptHash,
              response,
              modelName,
              metadataJson,
              now,
              now,
              expiresAt,
            ],
            type: sequelize.QueryTypes.INSERT,
            transaction,
          },
        );

        await transaction.commit();

        res.status(201).json({
          success: true,
          message: "Cache entry created",
          id: result.insertId || result,
          hash: promptHash,
        });
      }
    } catch (error) {
      // Rollback on error
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error("Error caching response:", error);
    res.status(500).json({
      error: "Failed to cache response",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * @route DELETE /api/ai-cache/expired
 * @desc Clear expired cache entries
 * @access Private
 */
router.delete("/expired", authenticateJWT, async (req, res) => {
  try {
    const now = new Date();
    const sequelize = await getMySQLClient();

    const [result] = await sequelize.query(
      `DELETE FROM ai_response_cache WHERE expires_at < ?`,
      {
        replacements: [now],
        type: sequelize.QueryTypes.DELETE,
      },
    );

    const affectedRows = result?.affectedRows || 0;
    console.info(`Cleared ${affectedRows} expired cache entries`);

    res.json({
      success: true,
      message: "Expired cache entries cleared",
      count: affectedRows,
    });
  } catch (error) {
    console.error("Error clearing expired cache:", error);
    res.status(500).json({
      error: "Failed to clear expired cache entries",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * @route DELETE /api/ai-cache
 * @desc Invalidate cache entries for a specific prompt pattern
 * @access Private
 */
router.delete("/", authenticateJWT, async (req, res) => {
  try {
    const { promptPattern, model } = req.body;

    if (!promptPattern) {
      return res.status(400).json({ error: "Prompt pattern is required" });
    }

    // Validate promptPattern to prevent SQL injection
    if (
      promptPattern.includes(";") ||
      promptPattern.includes("--") ||
      promptPattern.includes("/*") ||
      promptPattern.length > 1000
    ) {
      return res.status(400).json({ error: "Invalid prompt pattern" });
    }

    const sequelize = await getMySQLClient();
    let query = `DELETE FROM ai_response_cache WHERE prompt LIKE ?`;
    const replacements = [`%${promptPattern}%`];

    if (model) {
      query += ` AND model_used = ?`;
      replacements.push(model);
    }

    const [result] = await sequelize.query(query, {
      replacements,
      type: sequelize.QueryTypes.DELETE,
    });

    const affectedRows = result?.affectedRows || 0;
    console.info(
      `Invalidated ${affectedRows} cache entries matching pattern: ${promptPattern}`,
    );

    res.json({
      success: true,
      message: "Cache entries invalidated",
      count: affectedRows,
    });
  } catch (error) {
    console.error("Error invalidating cache:", error);
    res.status(500).json({
      error: "Failed to invalidate cache entries",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

export default router;
