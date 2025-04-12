/**
 * Context Rules Controller
 *
 * This module provides controller functions for context rules operations.
 */

import { getMySQLClient, QueryTypes } from "../utils/dbHelpers.js";
import { v4 as uuidv4 } from "uuid";
import { formatResponse } from "../utils/responseFormatter.js";

/**
 * Get all context rules
 */
export const getContextRules = async (req, res) => {
  try {
    const { limit = 50, offset = 0, includeInactive = false } = req.query;

    const sequelize = await getMySQLClient();

    // Build the query based on whether to include inactive rules
    let query = `SELECT * FROM context_rules`;
    const queryParams = [];

    if (!includeInactive) {
      query += ` WHERE is_active = ?`;
      queryParams.push(true);
    }

    query += ` ORDER BY priority DESC LIMIT ? OFFSET ?`;
    queryParams.push(parseInt(limit), parseInt(offset));

    // Get the rules
    const rules = await sequelize.query(query, {
      replacements: queryParams,
      type: QueryTypes.SELECT,
    });

    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM context_rules`;
    if (!includeInactive) {
      countQuery += ` WHERE is_active = ?`;
    }

    const [countResult] = await sequelize.query(countQuery, {
      replacements: !includeInactive ? [true] : [],
      type: QueryTypes.SELECT,
    });

    // Transform to camelCase and parse JSON fields
    const formattedRules = rules.map((rule) => ({
      id: rule.id,
      name: rule.name,
      description: rule.description,
      priority: rule.priority,
      isActive: rule.is_active,
      conditions: JSON.parse(rule.conditions),
      actions: JSON.parse(rule.actions),
      createdAt: rule.created_at,
      updatedAt: rule.updated_at,
    }));

    return res.json(
      formatResponse({
        rules: formattedRules,
        totalCount: countResult.total,
      }),
    );
  } catch (error) {
    console.error("Error getting context rules", error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};

/**
 * Get a context rule by ID
 */
export const getContextRuleById = async (req, res) => {
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
    const [rule] = await sequelize.query(
      "SELECT * FROM context_rules WHERE id = ?",
      {
        replacements: [id],
        type: QueryTypes.SELECT,
      },
    );

    if (!rule) {
      return res.status(404).json(
        formatResponse(null, {
          message: "Context rule not found",
          code: "ERR_404",
        }),
      );
    }

    // Transform to camelCase and parse JSON fields
    const formattedRule = {
      id: rule.id,
      name: rule.name,
      description: rule.description,
      priority: rule.priority,
      isActive: rule.is_active,
      conditions: JSON.parse(rule.conditions),
      actions: JSON.parse(rule.actions),
      createdAt: rule.created_at,
      updatedAt: rule.updated_at,
    };

    return res.json(formatResponse(formattedRule));
  } catch (error) {
    console.error("Error getting context rule", error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};

/**
 * Create a new context rule
 */
export const createContextRule = async (req, res) => {
  try {
    const { name, description, priority, isActive, conditions, actions } =
      req.body;

    if (!name || !conditions || !actions) {
      return res.status(400).json(
        formatResponse(null, {
          message: "Name, conditions, and actions are required",
          code: "ERR_400",
        }),
      );
    }

    // Validate conditions and actions
    if (!Array.isArray(conditions) || !Array.isArray(actions)) {
      return res.status(400).json(
        formatResponse(null, {
          message: "Conditions and actions must be arrays",
          code: "ERR_400",
        }),
      );
    }

    const sequelize = await getMySQLClient();
    const id = uuidv4();
    const now = new Date().toISOString();

    await sequelize.query(
      `INSERT INTO context_rules 
       (id, name, description, priority, is_active, conditions, actions, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      {
        replacements: [
          id,
          name,
          description || null,
          priority || 0,
          isActive !== undefined ? isActive : true,
          JSON.stringify(conditions),
          JSON.stringify(actions),
          now,
          now,
        ],
        type: QueryTypes.INSERT,
      },
    );

    // Fetch the newly created rule
    const [rule] = await sequelize.query(
      "SELECT * FROM context_rules WHERE id = ?",
      {
        replacements: [id],
        type: QueryTypes.SELECT,
      },
    );

    // Transform to camelCase and parse JSON fields
    const formattedRule = {
      id: rule.id,
      name: rule.name,
      description: rule.description,
      priority: rule.priority,
      isActive: rule.is_active,
      conditions: JSON.parse(rule.conditions),
      actions: JSON.parse(rule.actions),
      createdAt: rule.created_at,
      updatedAt: rule.updated_at,
    };

    return res.json(formatResponse(formattedRule));
  } catch (error) {
    console.error("Error creating context rule", error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};

/**
 * Update a context rule
 */
export const updateContextRule = async (req, res) => {
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

    // Check if rule exists
    const [existingRule] = await sequelize.query(
      "SELECT * FROM context_rules WHERE id = ?",
      {
        replacements: [id],
        type: QueryTypes.SELECT,
      },
    );

    if (!existingRule) {
      return res.status(404).json(
        formatResponse(null, {
          message: "Context rule not found",
          code: "ERR_404",
        }),
      );
    }

    // Build the update data
    const updateData = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined)
      updateData.description = updates.description;
    if (updates.priority !== undefined) updateData.priority = updates.priority;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
    if (updates.conditions !== undefined)
      updateData.conditions = JSON.stringify(updates.conditions);
    if (updates.actions !== undefined)
      updateData.actions = JSON.stringify(updates.actions);
    updateData.updated_at = new Date().toISOString();

    // Build the SET clause and replacements array
    const setClause = Object.keys(updateData)
      .map((key) => `${key} = ?`)
      .join(", ");
    const replacements = [...Object.values(updateData), id];

    await sequelize.query(
      `UPDATE context_rules SET ${setClause} WHERE id = ?`,
      {
        replacements,
        type: QueryTypes.UPDATE,
      },
    );

    // Fetch the updated rule
    const [updatedRule] = await sequelize.query(
      "SELECT * FROM context_rules WHERE id = ?",
      {
        replacements: [id],
        type: QueryTypes.SELECT,
      },
    );

    // Transform to camelCase and parse JSON fields
    const formattedRule = {
      id: updatedRule.id,
      name: updatedRule.name,
      description: updatedRule.description,
      priority: updatedRule.priority,
      isActive: updatedRule.is_active,
      conditions: JSON.parse(updatedRule.conditions),
      actions: JSON.parse(updatedRule.actions),
      createdAt: updatedRule.created_at,
      updatedAt: updatedRule.updated_at,
    };

    return res.json(formatResponse(formattedRule));
  } catch (error) {
    console.error("Error updating context rule", error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};

/**
 * Delete a context rule
 */
export const deleteContextRule = async (req, res) => {
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

    // Check if rule exists
    const [existingRule] = await sequelize.query(
      "SELECT * FROM context_rules WHERE id = ?",
      {
        replacements: [id],
        type: QueryTypes.SELECT,
      },
    );

    if (!existingRule) {
      return res.status(404).json(
        formatResponse(null, {
          message: "Context rule not found",
          code: "ERR_404",
        }),
      );
    }

    await sequelize.query("DELETE FROM context_rules WHERE id = ?", {
      replacements: [id],
      type: QueryTypes.DELETE,
    });

    return res.json(formatResponse({ success: true }));
  } catch (error) {
    console.error("Error deleting context rule", error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};

/**
 * Update rule priorities
 */
export const updateRulePriorities = async (req, res) => {
  try {
    const { rulePriorities } = req.body;

    if (!rulePriorities || typeof rulePriorities !== "object") {
      return res.status(400).json(
        formatResponse(null, {
          message: "Rule priorities object is required",
          code: "ERR_400",
        }),
      );
    }

    const sequelize = await getMySQLClient();

    // Update each rule's priority
    for (const [ruleId, priority] of Object.entries(rulePriorities)) {
      await sequelize.query(
        "UPDATE context_rules SET priority = ?, updated_at = ? WHERE id = ?",
        {
          replacements: [priority, new Date().toISOString(), ruleId],
          type: QueryTypes.UPDATE,
        },
      );
    }

    return res.json(formatResponse({ success: true }));
  } catch (error) {
    console.error("Error updating rule priorities", error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};

/**
 * Toggle rule active status
 */
export const toggleRuleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (!id) {
      return res.status(400).json(
        formatResponse(null, {
          message: "Rule ID is required",
          code: "ERR_400",
        }),
      );
    }

    if (isActive === undefined) {
      return res.status(400).json(
        formatResponse(null, {
          message: "isActive status is required",
          code: "ERR_400",
        }),
      );
    }

    const sequelize = await getMySQLClient();

    // Check if rule exists
    const [existingRule] = await sequelize.query(
      "SELECT * FROM context_rules WHERE id = ?",
      {
        replacements: [id],
        type: QueryTypes.SELECT,
      },
    );

    if (!existingRule) {
      return res.status(404).json(
        formatResponse(null, {
          message: "Context rule not found",
          code: "ERR_404",
        }),
      );
    }

    await sequelize.query(
      "UPDATE context_rules SET is_active = ?, updated_at = ? WHERE id = ?",
      {
        replacements: [isActive, new Date().toISOString(), id],
        type: QueryTypes.UPDATE,
      },
    );

    // Fetch the updated rule
    const [updatedRule] = await sequelize.query(
      "SELECT * FROM context_rules WHERE id = ?",
      {
        replacements: [id],
        type: QueryTypes.SELECT,
      },
    );

    // Transform to camelCase and parse JSON fields
    const formattedRule = {
      id: updatedRule.id,
      name: updatedRule.name,
      description: updatedRule.description,
      priority: updatedRule.priority,
      isActive: updatedRule.is_active,
      conditions: JSON.parse(updatedRule.conditions),
      actions: JSON.parse(updatedRule.actions),
      createdAt: updatedRule.created_at,
      updatedAt: updatedRule.updated_at,
    };

    return res.json(formatResponse(formattedRule));
  } catch (error) {
    console.error("Error toggling rule status", error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};
