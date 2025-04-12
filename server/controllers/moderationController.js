/**
 * Moderation Controller
 *
 * This module provides controller functions for content moderation.
 */

import { getMySQLClient, QueryTypes } from "../utils/dbHelpers.js";
import { v4 as uuidv4 } from "uuid";
import { formatResponse } from "../utils/responseFormatter.js";

/**
 * Check content against moderation rules
 */
export const checkContent = async (req, res) => {
  try {
    const { content, userId } = req.body;

    if (!content) {
      return res.status(400).json(
        formatResponse(null, {
          message: "Content is required",
          code: "ERR_400",
        }),
      );
    }

    // Check if user is banned first
    const isBanned = await isUserBannedHelper(userId);
    if (isBanned) {
      return res.json(
        formatResponse({
          isAllowed: false,
          flagged: true,
          reason: "User is banned",
        }),
      );
    }

    // Get active moderation rules
    const rules = await getModerationRulesHelper(true);

    // Default result
    let result = {
      isAllowed: true,
      flagged: false,
    };

    // Apply each rule
    let modifiedContent = content;

    for (const rule of rules) {
      // Skip inactive rules
      if (!rule.isActive) continue;

      let matched = false;

      if (rule.type === "keyword") {
        // Simple keyword matching
        const keywords = rule.pattern
          .split(",")
          .map((k) => k.trim().toLowerCase());
        matched = keywords.some((keyword) =>
          content.toLowerCase().includes(keyword),
        );
      } else if (rule.type === "regex") {
        // Regex matching
        try {
          const regex = new RegExp(rule.pattern, "i");
          matched = regex.test(content);

          // If it's a modification action, apply the replacement
          if (matched && rule.action === "modify" && rule.replacement) {
            modifiedContent = modifiedContent.replace(regex, rule.replacement);
          }
        } catch (regexError) {
          console.error(
            `Invalid regex in moderation rule ${rule.id}`,
            regexError,
          );
        }
      }

      // Handle match based on action
      if (matched) {
        // Log the moderation event
        await logModerationEventHelper({
          userId,
          content,
          ruleId: rule.id,
          action: rule.action,
          severity: rule.severity,
        });

        if (rule.action === "block") {
          // Block the content
          return res.json(
            formatResponse({
              isAllowed: false,
              flagged: true,
              reason: `Content blocked by rule: ${rule.name}`,
            }),
          );
        } else if (rule.action === "flag") {
          // Flag the content but allow it
          result.flagged = true;
        } else if (rule.action === "modify") {
          // Content has already been modified above
          result.modifiedContent = modifiedContent;
          result.flagged = true;
        }
      }
    }

    // If content was modified, return the modified version
    if (modifiedContent !== content) {
      result.modifiedContent = modifiedContent;
    }

    return res.json(formatResponse(result));
  } catch (error) {
    console.error("Error checking content moderation", error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};

/**
 * Check if a user is banned
 */
export const isUserBanned = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json(
        formatResponse(null, {
          message: "User ID is required",
          code: "ERR_400",
        }),
      );
    }

    const isBanned = await isUserBannedHelper(userId);
    return res.json(formatResponse(isBanned));
  } catch (error) {
    console.error(`Error checking if user is banned`, error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};

/**
 * Ban a user
 */
export const banUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason, expiresAt, adminId } = req.body;

    if (!userId || !reason) {
      return res.status(400).json(
        formatResponse(null, {
          message: "User ID and reason are required",
          code: "ERR_400",
        }),
      );
    }

    const sequelize = await getMySQLClient();
    await sequelize.query(
      `INSERT INTO user_bans (id, user_id, reason, admin_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)`,
      {
        replacements: [
          uuidv4(),
          userId,
          reason,
          adminId || req.user?.id || null,
          new Date().toISOString(),
          expiresAt || null,
        ],
        type: QueryTypes.INSERT,
      },
    );

    return res.json(formatResponse(true));
  } catch (error) {
    console.error(`Error banning user`, error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};

/**
 * Unban a user
 */
export const unbanUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { adminId } = req.body;

    if (!userId) {
      return res.status(400).json(
        formatResponse(null, {
          message: "User ID is required",
          code: "ERR_400",
        }),
      );
    }

    const sequelize = await getMySQLClient();
    await sequelize.query(
      `UPDATE user_bans SET expires_at = ?, updated_by = ?, updated_at = ? WHERE user_id = ? AND expires_at > ?`,
      {
        replacements: [
          new Date().toISOString(),
          adminId || req.user?.id || null,
          new Date().toISOString(),
          userId,
          new Date().toISOString(),
        ],
        type: QueryTypes.UPDATE,
      },
    );

    return res.json(formatResponse(true));
  } catch (error) {
    console.error(`Error unbanning user`, error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};

/**
 * Get all moderation rules
 */
export const getModerationRules = async (req, res) => {
  try {
    const { activeOnly } = req.query;
    const rules = await getModerationRulesHelper(
      activeOnly === "true" || activeOnly === undefined,
    );
    return res.json(formatResponse(rules));
  } catch (error) {
    console.error("Error getting moderation rules", error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};

/**
 * Create a new moderation rule
 */
export const createModerationRule = async (req, res) => {
  try {
    const {
      name,
      description,
      type,
      pattern,
      action,
      replacement,
      severity,
      isActive,
    } = req.body;

    if (!name || !type || !pattern || !action || !severity) {
      return res.status(400).json(
        formatResponse(null, {
          message: "Missing required fields",
          code: "ERR_400",
        }),
      );
    }

    const sequelize = await getMySQLClient();
    const id = uuidv4();
    const now = new Date().toISOString();

    await sequelize.query(
      `INSERT INTO moderation_rules 
       (id, name, description, type, pattern, action, replacement, severity, is_active, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      {
        replacements: [
          id,
          name,
          description || null,
          type,
          pattern,
          action,
          replacement || null,
          severity,
          isActive !== undefined ? isActive : true,
          now,
          now,
        ],
        type: QueryTypes.INSERT,
      },
    );

    // Fetch the newly created rule
    const [data] = await sequelize.query(
      `SELECT * FROM moderation_rules WHERE id = ?`,
      {
        replacements: [id],
        type: QueryTypes.SELECT,
      },
    );

    return res.json(
      formatResponse({
        id: data.id,
        name: data.name,
        description: data.description,
        type: data.type,
        pattern: data.pattern,
        action: data.action,
        replacement: data.replacement,
        severity: data.severity,
        isActive: data.is_active,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      }),
    );
  } catch (error) {
    console.error("Error creating moderation rule", error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};

/**
 * Update a moderation rule
 */
export const updateModerationRule = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!id) {
      return res.status(400).json(
        formatResponse(null, {
          message: "Rule ID is required",
          code: "ERR_400",
        }),
      );
    }

    const sequelize = await getMySQLClient();

    const updateData = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined)
      updateData.description = updates.description;
    if (updates.type !== undefined) updateData.type = updates.type;
    if (updates.pattern !== undefined) updateData.pattern = updates.pattern;
    if (updates.action !== undefined) updateData.action = updates.action;
    if (updates.replacement !== undefined)
      updateData.replacement = updates.replacement;
    if (updates.severity !== undefined) updateData.severity = updates.severity;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
    updateData.updated_at = new Date().toISOString();

    // Build the SET clause and replacements array
    const setClause = Object.keys(updateData)
      .map((key) => `${key} = ?`)
      .join(", ");
    const replacements = [...Object.values(updateData), id];

    await sequelize.query(
      `UPDATE moderation_rules SET ${setClause} WHERE id = ?`,
      {
        replacements,
        type: QueryTypes.UPDATE,
      },
    );

    // Fetch the updated rule
    const [data] = await sequelize.query(
      `SELECT * FROM moderation_rules WHERE id = ?`,
      {
        replacements: [id],
        type: QueryTypes.SELECT,
      },
    );

    if (!data) {
      return res.status(404).json(
        formatResponse(null, {
          message: "Moderation rule not found",
          code: "ERR_404",
        }),
      );
    }

    return res.json(
      formatResponse({
        id: data.id,
        name: data.name,
        description: data.description,
        type: data.type,
        pattern: data.pattern,
        action: data.action,
        replacement: data.replacement,
        severity: data.severity,
        isActive: data.is_active,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      }),
    );
  } catch (error) {
    console.error(`Error updating moderation rule`, error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};

/**
 * Delete a moderation rule
 */
export const deleteModerationRule = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json(
        formatResponse(null, {
          message: "Rule ID is required",
          code: "ERR_400",
        }),
      );
    }

    const sequelize = await getMySQLClient();
    await sequelize.query(`DELETE FROM moderation_rules WHERE id = ?`, {
      replacements: [id],
      type: QueryTypes.DELETE,
    });

    return res.json(formatResponse(true));
  } catch (error) {
    console.error(`Error deleting moderation rule`, error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};

/**
 * Get moderation events
 */
export const getModerationEvents = async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const sequelize = await getMySQLClient();

    // Get total count
    const [countResult] = await sequelize.query(
      `SELECT COUNT(*) as total FROM moderation_events`,
      {
        type: QueryTypes.SELECT,
      },
    );

    const totalCount = countResult.total;

    // Get events with pagination
    const events = await sequelize.query(
      `SELECT e.*, r.name as rule_name, r.type as rule_type 
       FROM moderation_events e 
       LEFT JOIN moderation_rules r ON e.rule_id = r.id 
       ORDER BY e.created_at DESC 
       LIMIT ? OFFSET ?`,
      {
        replacements: [parseInt(limit), parseInt(offset)],
        type: QueryTypes.SELECT,
      },
    );

    return res.json(
      formatResponse({
        events: events.map((event) => ({
          id: event.id,
          userId: event.user_id,
          content: event.content,
          ruleId: event.rule_id,
          ruleName: event.rule_name,
          ruleType: event.rule_type,
          action: event.action,
          severity: event.severity,
          createdAt: event.created_at,
        })),
        totalCount,
      }),
    );
  } catch (error) {
    console.error("Error getting moderation events", error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};

// Helper functions

/**
 * Check if a user is banned (helper function)
 */
async function isUserBannedHelper(userId) {
  try {
    if (!userId) return false;

    const sequelize = await getMySQLClient();
    const [data] = await sequelize.query(
      `SELECT id FROM user_bans WHERE user_id = ? AND expires_at > ?`,
      {
        replacements: [userId, new Date().toISOString()],
        type: QueryTypes.SELECT,
      },
    );

    return !!data;
  } catch (error) {
    console.error(`Error checking if user ${userId} is banned`, error);
    return false;
  }
}

/**
 * Get all moderation rules (helper function)
 */
async function getModerationRulesHelper(activeOnly = true) {
  try {
    const sequelize = await getMySQLClient();
    let query = `SELECT * FROM moderation_rules ORDER BY severity DESC`;
    let replacements = [];

    if (activeOnly) {
      query = `SELECT * FROM moderation_rules WHERE is_active = ? ORDER BY severity DESC`;
      replacements = [true];
    }

    const data = await sequelize.query(query, {
      replacements,
      type: QueryTypes.SELECT,
    });

    return (data || []).map((rule) => ({
      id: rule.id,
      name: rule.name,
      description: rule.description,
      type: rule.type,
      pattern: rule.pattern,
      action: rule.action,
      replacement: rule.replacement,
      severity: rule.severity,
      isActive: rule.is_active,
      createdAt: rule.created_at,
      updatedAt: rule.updated_at,
    }));
  } catch (error) {
    console.error("Error getting moderation rules", error);
    return [];
  }
}

/**
 * Log a moderation event (helper function)
 */
async function logModerationEventHelper(event) {
  try {
    const sequelize = await getMySQLClient();
    await sequelize.query(
      `INSERT INTO moderation_events 
       (id, user_id, content, rule_id, action, severity, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      {
        replacements: [
          uuidv4(),
          event.userId || null,
          event.content,
          event.ruleId,
          event.action,
          event.severity,
          new Date().toISOString(),
        ],
        type: QueryTypes.INSERT,
      },
    );
  } catch (error) {
    console.error("Error logging moderation event", error);
    // Don't throw - logging failures shouldn't break the application
  }
}
