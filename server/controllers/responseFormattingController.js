/**
 * Response Formatting Controller
 *
 * This module provides controller functions for response formatting configurations.
 */

import { getMySQLClient, QueryTypes } from "../utils/dbHelpers.js";
import { v4 as uuidv4 } from "uuid";
import { formatResponse } from "../utils/responseFormatter.js";

/**
 * Get all response formatting configurations for a user
 */
export const getResponseFormattingConfigs = async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json(
        formatResponse(null, {
          message: "User ID is required",
          code: "ERR_400",
        }),
      );
    }

    const sequelize = await getMySQLClient();
    const configs = await sequelize.query(
      "SELECT * FROM response_formatting_configs WHERE user_id = ? ORDER BY is_default DESC, created_at DESC",
      {
        replacements: [userId],
        type: QueryTypes.SELECT,
      },
    );

    // Transform to camelCase
    const formattedConfigs = await Promise.all(
      configs.map(async (config) => {
        // Get custom templates for this config
        const templates = await sequelize.query(
          "SELECT * FROM response_templates WHERE config_id = ?",
          {
            replacements: [config.id],
            type: QueryTypes.SELECT,
          },
        );

        const formattedTemplates = templates.map((template) => ({
          id: template.id,
          name: template.name,
          template: template.template,
          description: template.description,
        }));

        return {
          id: config.id,
          userId: config.user_id,
          name: config.name,
          enableMarkdown: config.enable_markdown,
          defaultHeadingLevel: config.default_heading_level,
          enableBulletPoints: config.enable_bullet_points,
          enableNumberedLists: config.enable_numbered_lists,
          enableEmphasis: config.enable_emphasis,
          responseVariability: config.response_variability,
          defaultTemplate: config.default_template,
          isDefault: config.is_default,
          customTemplates: formattedTemplates,
        };
      }),
    );

    return res.json(formatResponse(formattedConfigs));
  } catch (error) {
    console.error("Error getting response formatting configs", error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};

/**
 * Get a specific response formatting configuration
 */
export const getResponseFormattingConfig = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json(
        formatResponse(null, {
          message: "Config ID is required",
          code: "ERR_400",
        }),
      );
    }

    const sequelize = await getMySQLClient();
    const [config] = await sequelize.query(
      "SELECT * FROM response_formatting_configs WHERE id = ?",
      {
        replacements: [id],
        type: QueryTypes.SELECT,
      },
    );

    if (!config) {
      return res.status(404).json(
        formatResponse(null, {
          message: "Response formatting configuration not found",
          code: "ERR_404",
        }),
      );
    }

    // Get custom templates for this config
    const templates = await sequelize.query(
      "SELECT * FROM response_templates WHERE config_id = ?",
      {
        replacements: [config.id],
        type: QueryTypes.SELECT,
      },
    );

    const formattedTemplates = templates.map((template) => ({
      id: template.id,
      name: template.name,
      template: template.template,
      description: template.description,
    }));

    // Transform to camelCase
    const formattedConfig = {
      id: config.id,
      userId: config.user_id,
      name: config.name,
      enableMarkdown: config.enable_markdown,
      defaultHeadingLevel: config.default_heading_level,
      enableBulletPoints: config.enable_bullet_points,
      enableNumberedLists: config.enable_numbered_lists,
      enableEmphasis: config.enable_emphasis,
      responseVariability: config.response_variability,
      defaultTemplate: config.default_template,
      isDefault: config.is_default,
      customTemplates: formattedTemplates,
    };

    return res.json(formatResponse(formattedConfig));
  } catch (error) {
    console.error("Error getting response formatting config", error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};

/**
 * Get the default response formatting configuration for a user
 */
export const getDefaultResponseFormattingConfig = async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json(
        formatResponse(null, {
          message: "User ID is required",
          code: "ERR_400",
        }),
      );
    }

    const sequelize = await getMySQLClient();
    const [config] = await sequelize.query(
      "SELECT * FROM response_formatting_configs WHERE user_id = ? AND is_default = true LIMIT 1",
      {
        replacements: [userId],
        type: QueryTypes.SELECT,
      },
    );

    if (!config) {
      return res.status(404).json(
        formatResponse(null, {
          message: "No default response formatting configuration found",
          code: "ERR_404",
        }),
      );
    }

    // Get custom templates for this config
    const templates = await sequelize.query(
      "SELECT * FROM response_templates WHERE config_id = ?",
      {
        replacements: [config.id],
        type: QueryTypes.SELECT,
      },
    );

    const formattedTemplates = templates.map((template) => ({
      id: template.id,
      name: template.name,
      template: template.template,
      description: template.description,
    }));

    // Transform to camelCase
    const formattedConfig = {
      id: config.id,
      userId: config.user_id,
      name: config.name,
      enableMarkdown: config.enable_markdown,
      defaultHeadingLevel: config.default_heading_level,
      enableBulletPoints: config.enable_bullet_points,
      enableNumberedLists: config.enable_numbered_lists,
      enableEmphasis: config.enable_emphasis,
      responseVariability: config.response_variability,
      defaultTemplate: config.default_template,
      isDefault: config.is_default,
      customTemplates: formattedTemplates,
    };

    return res.json(formatResponse(formattedConfig));
  } catch (error) {
    console.error("Error getting default response formatting config", error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};

/**
 * Create a new response formatting configuration
 */
export const createResponseFormattingConfig = async (req, res) => {
  try {
    const {
      userId,
      name,
      enableMarkdown,
      defaultHeadingLevel,
      enableBulletPoints,
      enableNumberedLists,
      enableEmphasis,
      responseVariability,
      defaultTemplate,
      isDefault,
      customTemplates,
    } = req.body;

    if (!userId || !name) {
      return res.status(400).json(
        formatResponse(null, {
          message: "User ID and name are required",
          code: "ERR_400",
        }),
      );
    }

    const sequelize = await getMySQLClient();
    const id = uuidv4();
    const now = new Date().toISOString();

    // If this is set as default, clear default flag from other configs
    if (isDefault) {
      await sequelize.query(
        "UPDATE response_formatting_configs SET is_default = false WHERE user_id = ?",
        {
          replacements: [userId],
          type: QueryTypes.UPDATE,
        },
      );
    }

    await sequelize.query(
      `INSERT INTO response_formatting_configs 
       (id, user_id, name, enable_markdown, default_heading_level, enable_bullet_points, 
        enable_numbered_lists, enable_emphasis, response_variability, default_template, is_default, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      {
        replacements: [
          id,
          userId,
          name,
          enableMarkdown !== undefined ? enableMarkdown : true,
          defaultHeadingLevel || 2,
          enableBulletPoints !== undefined ? enableBulletPoints : true,
          enableNumberedLists !== undefined ? enableNumberedLists : true,
          enableEmphasis !== undefined ? enableEmphasis : true,
          responseVariability || "balanced",
          defaultTemplate || null,
          isDefault !== undefined ? isDefault : false,
          now,
          now,
        ],
        type: QueryTypes.INSERT,
      },
    );

    // Create custom templates if provided
    if (customTemplates && Array.isArray(customTemplates)) {
      for (const template of customTemplates) {
        const templateId = uuidv4();
        await sequelize.query(
          `INSERT INTO response_templates 
           (id, config_id, name, template, description, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          {
            replacements: [
              templateId,
              id,
              template.name,
              template.template,
              template.description || null,
              now,
              now,
            ],
            type: QueryTypes.INSERT,
          },
        );
      }
    }

    // Fetch the newly created config with its templates
    const [config] = await sequelize.query(
      "SELECT * FROM response_formatting_configs WHERE id = ?",
      {
        replacements: [id],
        type: QueryTypes.SELECT,
      },
    );

    const templates = await sequelize.query(
      "SELECT * FROM response_templates WHERE config_id = ?",
      {
        replacements: [id],
        type: QueryTypes.SELECT,
      },
    );

    const formattedTemplates = templates.map((template) => ({
      id: template.id,
      name: template.name,
      template: template.template,
      description: template.description,
    }));

    // Transform to camelCase
    const formattedConfig = {
      id: config.id,
      userId: config.user_id,
      name: config.name,
      enableMarkdown: config.enable_markdown,
      defaultHeadingLevel: config.default_heading_level,
      enableBulletPoints: config.enable_bullet_points,
      enableNumberedLists: config.enable_numbered_lists,
      enableEmphasis: config.enable_emphasis,
      responseVariability: config.response_variability,
      defaultTemplate: config.default_template,
      isDefault: config.is_default,
      customTemplates: formattedTemplates,
    };

    return res.json(formatResponse(formattedConfig));
  } catch (error) {
    console.error("Error creating response formatting config", error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};

/**
 * Update an existing response formatting configuration
 */
export const updateResponseFormattingConfig = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!id) {
      return res.status(400).json(
        formatResponse(null, {
          message: "Config ID is required",
          code: "ERR_400",
        }),
      );
    }

    const sequelize = await getMySQLClient();

    // Check if config exists
    const [existingConfig] = await sequelize.query(
      "SELECT * FROM response_formatting_configs WHERE id = ?",
      {
        replacements: [id],
        type: QueryTypes.SELECT,
      },
    );

    if (!existingConfig) {
      return res.status(404).json(
        formatResponse(null, {
          message: "Response formatting configuration not found",
          code: "ERR_404",
        }),
      );
    }

    // If setting as default, clear default flag from other configs
    if (updates.isDefault) {
      await sequelize.query(
        "UPDATE response_formatting_configs SET is_default = false WHERE user_id = ?",
        {
          replacements: [existingConfig.user_id],
          type: QueryTypes.UPDATE,
        },
      );
    }

    // Build the update data
    const updateData = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.enableMarkdown !== undefined)
      updateData.enable_markdown = updates.enableMarkdown;
    if (updates.defaultHeadingLevel !== undefined)
      updateData.default_heading_level = updates.defaultHeadingLevel;
    if (updates.enableBulletPoints !== undefined)
      updateData.enable_bullet_points = updates.enableBulletPoints;
    if (updates.enableNumberedLists !== undefined)
      updateData.enable_numbered_lists = updates.enableNumberedLists;
    if (updates.enableEmphasis !== undefined)
      updateData.enable_emphasis = updates.enableEmphasis;
    if (updates.responseVariability !== undefined)
      updateData.response_variability = updates.responseVariability;
    if (updates.defaultTemplate !== undefined)
      updateData.default_template = updates.defaultTemplate;
    if (updates.isDefault !== undefined)
      updateData.is_default = updates.isDefault;
    updateData.updated_at = new Date().toISOString();

    // Build the SET clause and replacements array
    const setClause = Object.keys(updateData)
      .map((key) => `${key} = ?`)
      .join(", ");
    const replacements = [...Object.values(updateData), id];

    await sequelize.query(
      `UPDATE response_formatting_configs SET ${setClause} WHERE id = ?`,
      {
        replacements,
        type: QueryTypes.UPDATE,
      },
    );

    // Handle custom templates if provided
    if (updates.customTemplates && Array.isArray(updates.customTemplates)) {
      // Delete existing templates
      await sequelize.query(
        "DELETE FROM response_templates WHERE config_id = ?",
        {
          replacements: [id],
          type: QueryTypes.DELETE,
        },
      );

      // Create new templates
      const now = new Date().toISOString();
      for (const template of updates.customTemplates) {
        const templateId = uuidv4();
        await sequelize.query(
          `INSERT INTO response_templates 
           (id, config_id, name, template, description, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          {
            replacements: [
              templateId,
              id,
              template.name,
              template.template,
              template.description || null,
              now,
              now,
            ],
            type: QueryTypes.INSERT,
          },
        );
      }
    }

    // Fetch the updated config with its templates
    const [updatedConfig] = await sequelize.query(
      "SELECT * FROM response_formatting_configs WHERE id = ?",
      {
        replacements: [id],
        type: QueryTypes.SELECT,
      },
    );

    const templates = await sequelize.query(
      "SELECT * FROM response_templates WHERE config_id = ?",
      {
        replacements: [id],
        type: QueryTypes.SELECT,
      },
    );

    const formattedTemplates = templates.map((template) => ({
      id: template.id,
      name: template.name,
      template: template.template,
      description: template.description,
    }));

    // Transform to camelCase
    const formattedConfig = {
      id: updatedConfig.id,
      userId: updatedConfig.user_id,
      name: updatedConfig.name,
      enableMarkdown: updatedConfig.enable_markdown,
      defaultHeadingLevel: updatedConfig.default_heading_level,
      enableBulletPoints: updatedConfig.enable_bullet_points,
      enableNumberedLists: updatedConfig.enable_numbered_lists,
      enableEmphasis: updatedConfig.enable_emphasis,
      responseVariability: updatedConfig.response_variability,
      defaultTemplate: updatedConfig.default_template,
      isDefault: updatedConfig.is_default,
      customTemplates: formattedTemplates,
    };

    return res.json(formatResponse(formattedConfig));
  } catch (error) {
    console.error("Error updating response formatting config", error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};

/**
 * Delete a response formatting configuration
 */
export const deleteResponseFormattingConfig = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json(
        formatResponse(null, {
          message: "Config ID is required",
          code: "ERR_400",
        }),
      );
    }

    const sequelize = await getMySQLClient();

    // Check if config exists
    const [existingConfig] = await sequelize.query(
      "SELECT * FROM response_formatting_configs WHERE id = ?",
      {
        replacements: [id],
        type: QueryTypes.SELECT,
      },
    );

    if (!existingConfig) {
      return res.status(404).json(
        formatResponse(null, {
          message: "Response formatting configuration not found",
          code: "ERR_404",
        }),
      );
    }

    // Don't allow deleting the default config
    if (existingConfig.is_default) {
      return res.status(400).json(
        formatResponse(null, {
          message: "Cannot delete the default configuration",
          code: "ERR_400",
        }),
      );
    }

    // Delete associated templates first
    await sequelize.query(
      "DELETE FROM response_templates WHERE config_id = ?",
      {
        replacements: [id],
        type: QueryTypes.DELETE,
      },
    );

    // Delete the config
    await sequelize.query(
      "DELETE FROM response_formatting_configs WHERE id = ?",
      {
        replacements: [id],
        type: QueryTypes.DELETE,
      },
    );

    return res.json(formatResponse(true));
  } catch (error) {
    console.error("Error deleting response formatting config", error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};

/**
 * Get all response templates
 */
export const getResponseTemplates = async (req, res) => {
  try {
    const sequelize = await getMySQLClient();
    const templates = await sequelize.query(
      "SELECT * FROM response_templates ORDER BY created_at DESC",
      {
        type: QueryTypes.SELECT,
      },
    );

    // Transform to camelCase
    const formattedTemplates = templates.map((template) => ({
      id: template.id,
      configId: template.config_id,
      name: template.name,
      template: template.template,
      description: template.description,
    }));

    return res.json(formatResponse(formattedTemplates));
  } catch (error) {
    console.error("Error getting response templates", error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};

/**
 * Get a specific response template
 */
export const getResponseTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json(
        formatResponse(null, {
          message: "Template ID is required",
          code: "ERR_400",
        }),
      );
    }

    const sequelize = await getMySQLClient();
    const [template] = await sequelize.query(
      "SELECT * FROM response_templates WHERE id = ?",
      {
        replacements: [id],
        type: QueryTypes.SELECT,
      },
    );

    if (!template) {
      return res.status(404).json(
        formatResponse(null, {
          message: "Response template not found",
          code: "ERR_404",
        }),
      );
    }

    // Transform to camelCase
    const formattedTemplate = {
      id: template.id,
      configId: template.config_id,
      name: template.name,
      template: template.template,
      description: template.description,
    };

    return res.json(formatResponse(formattedTemplate));
  } catch (error) {
    console.error("Error getting response template", error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};
