/**
 * Response Formatting Routes
 *
 * API endpoints for managing response formatting configurations and templates
 */

import express from "express";
import { v4 as uuidv4 } from "uuid";
import { executeQuery, executeTransaction } from "../../utils/dbHelpers.js";
import {
  formatSuccess,
  formatError,
  sendResponse,
  errors,
} from "../../utils/responseFormatter.js";

const router = express.Router();

/**
 * @route GET /api/response-formatting
 * @desc Get all response formatting configurations for the authenticated user
 * @access Private
 */
router.get("/", async (req, res) => {
  try {
    const sql = `
      SELECT rfc.*, 
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'id', rt.id,
            'name', rt.name,
            'template', rt.template,
            'description', rt.description
          )
        ) as custom_templates
      FROM response_formatting_configs rfc
      LEFT JOIN response_templates rt ON rfc.id = rt.config_id
      WHERE rfc.user_id = ?
      GROUP BY rfc.id
    `;

    const configs = await executeQuery(sql, [req.user.id]);

    // Transform the data to match the expected format
    const formattedConfigs = configs.map((config) => ({
      id: config.id,
      userId: config.user_id,
      name: config.name,
      enableMarkdown: config.enable_markdown === 1,
      defaultHeadingLevel: config.default_heading_level,
      enableBulletPoints: config.enable_bullet_points === 1,
      enableNumberedLists: config.enable_numbered_lists === 1,
      enableEmphasis: config.enable_emphasis === 1,
      responseVariability: config.response_variability,
      defaultTemplate: config.default_template,
      isDefault: config.is_default === 1,
      customTemplates: JSON.parse(config.custom_templates || "[]"),
    }));

    sendResponse(res, formatSuccess(formattedConfigs));
  } catch (error) {
    console.error("Error fetching response formatting configs:", error);
    sendResponse(
      res,
      errors.internal("Failed to fetch response formatting configurations"),
    );
  }
});

/**
 * @route GET /api/response-formatting/:id
 * @desc Get a specific response formatting configuration
 * @access Private
 */
router.get("/:id", async (req, res) => {
  try {
    const sql = `
      SELECT rfc.*, 
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'id', rt.id,
            'name', rt.name,
            'template', rt.template,
            'description', rt.description
          )
        ) as custom_templates
      FROM response_formatting_configs rfc
      LEFT JOIN response_templates rt ON rfc.id = rt.config_id
      WHERE rfc.id = ? AND rfc.user_id = ?
      GROUP BY rfc.id
    `;

    const configs = await executeQuery(sql, [req.params.id, req.user.id]);

    if (!configs || configs.length === 0) {
      return sendResponse(
        res,
        errors.notFound("Response formatting configuration not found"),
      );
    }

    const config = configs[0];
    const formattedConfig = {
      id: config.id,
      userId: config.user_id,
      name: config.name,
      enableMarkdown: config.enable_markdown === 1,
      defaultHeadingLevel: config.default_heading_level,
      enableBulletPoints: config.enable_bullet_points === 1,
      enableNumberedLists: config.enable_numbered_lists === 1,
      enableEmphasis: config.enable_emphasis === 1,
      responseVariability: config.response_variability,
      defaultTemplate: config.default_template,
      isDefault: config.is_default === 1,
      customTemplates: JSON.parse(config.custom_templates || "[]"),
    };

    sendResponse(res, formatSuccess(formattedConfig));
  } catch (error) {
    console.error(
      `Error fetching response formatting config ${req.params.id}:`,
      error,
    );
    sendResponse(
      res,
      errors.internal("Failed to fetch response formatting configuration"),
    );
  }
});

/**
 * @route POST /api/response-formatting
 * @desc Create a new response formatting configuration
 * @access Private
 */
router.post("/", async (req, res) => {
  try {
    const {
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

    // Validate required fields
    if (!name) {
      return sendResponse(res, errors.validation("Name is required"));
    }

    const result = await executeTransaction(async (transaction) => {
      // If this is set as default, unset any existing default
      if (isDefault) {
        await executeQuery(
          `UPDATE response_formatting_configs SET is_default = 0 WHERE user_id = ? AND is_default = 1`,
          [req.user.id],
          "UPDATE",
          transaction,
        );
      }

      // Create the config
      const configId = uuidv4();
      await executeQuery(
        `INSERT INTO response_formatting_configs (
          id, user_id, name, enable_markdown, default_heading_level,
          enable_bullet_points, enable_numbered_lists, enable_emphasis,
          response_variability, default_template, is_default, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          configId,
          req.user.id,
          name,
          enableMarkdown !== undefined ? enableMarkdown : true,
          defaultHeadingLevel || 2,
          enableBulletPoints !== undefined ? enableBulletPoints : true,
          enableNumberedLists !== undefined ? enableNumberedLists : true,
          enableEmphasis !== undefined ? enableEmphasis : true,
          responseVariability || "balanced",
          defaultTemplate || null,
          isDefault || false,
        ],
        "INSERT",
        transaction,
      );

      // Create custom templates
      if (customTemplates && customTemplates.length > 0) {
        for (const templateData of customTemplates) {
          const templateId = uuidv4();
          await executeQuery(
            `INSERT INTO response_templates (
              id, config_id, name, template, description, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
            [
              templateId,
              configId,
              templateData.name,
              templateData.template,
              templateData.description || null,
            ],
            "INSERT",
            transaction,
          );
        }
      }

      return { configId };
    });

    // Fetch the newly created config with templates
    const sql = `
      SELECT rfc.*, 
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'id', rt.id,
            'name', rt.name,
            'template', rt.template,
            'description', rt.description
          )
        ) as custom_templates
      FROM response_formatting_configs rfc
      LEFT JOIN response_templates rt ON rfc.id = rt.config_id
      WHERE rfc.id = ?
      GROUP BY rfc.id
    `;

    const configs = await executeQuery(sql, [result.configId]);
    const config = configs[0];

    const formattedConfig = {
      id: config.id,
      userId: config.user_id,
      name: config.name,
      enableMarkdown: config.enable_markdown === 1,
      defaultHeadingLevel: config.default_heading_level,
      enableBulletPoints: config.enable_bullet_points === 1,
      enableNumberedLists: config.enable_numbered_lists === 1,
      enableEmphasis: config.enable_emphasis === 1,
      responseVariability: config.response_variability,
      defaultTemplate: config.default_template,
      isDefault: config.is_default === 1,
      customTemplates: JSON.parse(config.custom_templates || "[]"),
    };

    sendResponse(res, formatSuccess(formattedConfig, { status: 201 }));
  } catch (error) {
    console.error("Error creating response formatting config:", error);
    sendResponse(
      res,
      errors.internal("Failed to create response formatting configuration"),
    );
  }
});

/**
 * @route PUT /api/response-formatting/:id
 * @desc Update a response formatting configuration
 * @access Private
 */
router.put("/:id", async (req, res) => {
  try {
    const {
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

    // Validate required fields
    if (!name) {
      return sendResponse(res, errors.validation("Name is required"));
    }

    // Check if config exists and belongs to user
    const existingConfig = await executeQuery(
      `SELECT * FROM response_formatting_configs WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user.id],
    );

    if (!existingConfig || existingConfig.length === 0) {
      return sendResponse(
        res,
        errors.notFound("Response formatting configuration not found"),
      );
    }

    await executeTransaction(async (transaction) => {
      // If this is set as default, unset any existing default
      if (isDefault) {
        await executeQuery(
          `UPDATE response_formatting_configs SET is_default = 0 WHERE user_id = ? AND is_default = 1 AND id != ?`,
          [req.user.id, req.params.id],
          "UPDATE",
          transaction,
        );
      }

      // Update the config
      await executeQuery(
        `UPDATE response_formatting_configs SET 
          name = ?, 
          enable_markdown = ?, 
          default_heading_level = ?,
          enable_bullet_points = ?, 
          enable_numbered_lists = ?, 
          enable_emphasis = ?,
          response_variability = ?, 
          default_template = ?, 
          is_default = ?,
          updated_at = NOW()
        WHERE id = ? AND user_id = ?`,
        [
          name,
          enableMarkdown !== undefined ? enableMarkdown : true,
          defaultHeadingLevel || 2,
          enableBulletPoints !== undefined ? enableBulletPoints : true,
          enableNumberedLists !== undefined ? enableNumberedLists : true,
          enableEmphasis !== undefined ? enableEmphasis : true,
          responseVariability || "balanced",
          defaultTemplate || null,
          isDefault || false,
          req.params.id,
          req.user.id,
        ],
        "UPDATE",
        transaction,
      );

      // Handle custom templates
      if (customTemplates && customTemplates.length > 0) {
        // Get existing templates
        const existingTemplates = await executeQuery(
          `SELECT id FROM response_templates WHERE config_id = ?`,
          [req.params.id],
          "SELECT",
          transaction,
        );

        const existingIds = existingTemplates.map((t) => t.id);

        for (const templateData of customTemplates) {
          if (templateData.id && existingIds.includes(templateData.id)) {
            // Update existing template
            await executeQuery(
              `UPDATE response_templates SET 
                name = ?, 
                template = ?, 
                description = ?,
                updated_at = NOW()
              WHERE id = ? AND config_id = ?`,
              [
                templateData.name,
                templateData.template,
                templateData.description || null,
                templateData.id,
                req.params.id,
              ],
              "UPDATE",
              transaction,
            );
          } else {
            // Create new template
            const templateId = uuidv4();
            await executeQuery(
              `INSERT INTO response_templates (
                id, config_id, name, template, description, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
              [
                templateId,
                req.params.id,
                templateData.name,
                templateData.template,
                templateData.description || null,
              ],
              "INSERT",
              transaction,
            );
          }
        }

        // Delete templates that are no longer in the list
        const updatedIds = customTemplates.filter((t) => t.id).map((t) => t.id);
        const idsToDelete = existingIds.filter(
          (id) => !updatedIds.includes(id),
        );

        if (idsToDelete.length > 0) {
          await executeQuery(
            `DELETE FROM response_templates WHERE id IN (?)`,
            [idsToDelete],
            "DELETE",
            transaction,
          );
        }
      } else {
        // If no templates provided, delete all existing templates
        await executeQuery(
          `DELETE FROM response_templates WHERE config_id = ?`,
          [req.params.id],
          "DELETE",
          transaction,
        );
      }
    });

    // Fetch the updated config with templates
    const sql = `
      SELECT rfc.*, 
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'id', rt.id,
            'name', rt.name,
            'template', rt.template,
            'description', rt.description
          )
        ) as custom_templates
      FROM response_formatting_configs rfc
      LEFT JOIN response_templates rt ON rfc.id = rt.config_id
      WHERE rfc.id = ?
      GROUP BY rfc.id
    `;

    const configs = await executeQuery(sql, [req.params.id]);
    const config = configs[0];

    const formattedConfig = {
      id: config.id,
      userId: config.user_id,
      name: config.name,
      enableMarkdown: config.enable_markdown === 1,
      defaultHeadingLevel: config.default_heading_level,
      enableBulletPoints: config.enable_bullet_points === 1,
      enableNumberedLists: config.enable_numbered_lists === 1,
      enableEmphasis: config.enable_emphasis === 1,
      responseVariability: config.response_variability,
      defaultTemplate: config.default_template,
      isDefault: config.is_default === 1,
      customTemplates: JSON.parse(config.custom_templates || "[]"),
    };

    sendResponse(res, formatSuccess(formattedConfig));
  } catch (error) {
    console.error(
      `Error updating response formatting config ${req.params.id}:`,
      error,
    );
    sendResponse(
      res,
      errors.internal("Failed to update response formatting configuration"),
    );
  }
});

/**
 * @route DELETE /api/response-formatting/:id
 * @desc Delete a response formatting configuration
 * @access Private
 */
router.delete("/:id", async (req, res) => {
  try {
    // Check if config exists and belongs to user
    const existingConfig = await executeQuery(
      `SELECT * FROM response_formatting_configs WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user.id],
    );

    if (!existingConfig || existingConfig.length === 0) {
      return sendResponse(
        res,
        errors.notFound("Response formatting configuration not found"),
      );
    }

    // Check if this is the default config
    if (existingConfig[0].is_default === 1) {
      return sendResponse(
        res,
        errors.validation(
          "Cannot delete the default configuration. Please set another configuration as default first.",
        ),
      );
    }

    await executeTransaction(async (transaction) => {
      // Delete all templates associated with this config
      await executeQuery(
        `DELETE FROM response_templates WHERE config_id = ?`,
        [req.params.id],
        "DELETE",
        transaction,
      );

      // Delete the config
      await executeQuery(
        `DELETE FROM response_formatting_configs WHERE id = ? AND user_id = ?`,
        [req.params.id, req.user.id],
        "DELETE",
        transaction,
      );
    });

    sendResponse(res, formatSuccess({ id: req.params.id, deleted: true }));
  } catch (error) {
    console.error(
      `Error deleting response formatting config ${req.params.id}:`,
      error,
    );
    sendResponse(
      res,
      errors.internal("Failed to delete response formatting configuration"),
    );
  }
});

/**
 * @route POST /api/response-formatting/:id/templates
 * @desc Add a new template to a response formatting configuration
 * @access Private
 */
router.post("/:id/templates", async (req, res) => {
  try {
    const { name, template, description } = req.body;

    // Validate required fields
    if (!name || !template) {
      return sendResponse(
        res,
        errors.validation("Name and template are required"),
      );
    }

    // Check if config exists and belongs to user
    const existingConfig = await executeQuery(
      `SELECT * FROM response_formatting_configs WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user.id],
    );

    if (!existingConfig || existingConfig.length === 0) {
      return sendResponse(
        res,
        errors.notFound("Response formatting configuration not found"),
      );
    }

    // Create new template
    const templateId = uuidv4();
    await executeQuery(
      `INSERT INTO response_templates (
        id, config_id, name, template, description, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [templateId, req.params.id, name, template, description || null],
      "INSERT",
    );

    // Return the new template
    const newTemplate = {
      id: templateId,
      configId: req.params.id,
      name,
      template,
      description: description || null,
    };

    sendResponse(res, formatSuccess(newTemplate, { status: 201 }));
  } catch (error) {
    console.error(`Error adding template to config ${req.params.id}:`, error);
    sendResponse(
      res,
      errors.internal("Failed to add template to configuration"),
    );
  }
});

/**
 * @route PUT /api/response-formatting/:configId/templates/:templateId
 * @desc Update a template in a response formatting configuration
 * @access Private
 */
router.put("/:configId/templates/:templateId", async (req, res) => {
  try {
    const { name, template, description } = req.body;

    // Validate required fields
    if (!name || !template) {
      return sendResponse(
        res,
        errors.validation("Name and template are required"),
      );
    }

    // Check if config exists and belongs to user
    const existingConfig = await executeQuery(
      `SELECT * FROM response_formatting_configs WHERE id = ? AND user_id = ?`,
      [req.params.configId, req.user.id],
    );

    if (!existingConfig || existingConfig.length === 0) {
      return sendResponse(
        res,
        errors.notFound("Response formatting configuration not found"),
      );
    }

    // Check if template exists and belongs to the config
    const existingTemplate = await executeQuery(
      `SELECT * FROM response_templates WHERE id = ? AND config_id = ?`,
      [req.params.templateId, req.params.configId],
    );

    if (!existingTemplate || existingTemplate.length === 0) {
      return sendResponse(res, errors.notFound("Template not found"));
    }

    // Update the template
    await executeQuery(
      `UPDATE response_templates SET 
        name = ?, 
        template = ?, 
        description = ?,
        updated_at = NOW()
      WHERE id = ? AND config_id = ?`,
      [
        name,
        template,
        description || null,
        req.params.templateId,
        req.params.configId,
      ],
      "UPDATE",
    );

    // Return the updated template
    const updatedTemplate = {
      id: req.params.templateId,
      configId: req.params.configId,
      name,
      template,
      description: description || null,
    };

    sendResponse(res, formatSuccess(updatedTemplate));
  } catch (error) {
    console.error(`Error updating template ${req.params.templateId}:`, error);
    sendResponse(res, errors.internal("Failed to update template"));
  }
});

/**
 * @route DELETE /api/response-formatting/:configId/templates/:templateId
 * @desc Delete a template from a response formatting configuration
 * @access Private
 */
router.delete("/:configId/templates/:templateId", async (req, res) => {
  try {
    // Check if config exists and belongs to user
    const existingConfig = await executeQuery(
      `SELECT * FROM response_formatting_configs WHERE id = ? AND user_id = ?`,
      [req.params.configId, req.user.id],
    );

    if (!existingConfig || existingConfig.length === 0) {
      return sendResponse(
        res,
        errors.notFound("Response formatting configuration not found"),
      );
    }

    // Check if template exists and belongs to the config
    const existingTemplate = await executeQuery(
      `SELECT * FROM response_templates WHERE id = ? AND config_id = ?`,
      [req.params.templateId, req.params.configId],
    );

    if (!existingTemplate || existingTemplate.length === 0) {
      return sendResponse(res, errors.notFound("Template not found"));
    }

    // Delete the template
    await executeQuery(
      `DELETE FROM response_templates WHERE id = ? AND config_id = ?`,
      [req.params.templateId, req.params.configId],
      "DELETE",
    );

    sendResponse(
      res,
      formatSuccess({ id: req.params.templateId, deleted: true }),
    );
  } catch (error) {
    console.error(`Error deleting template ${req.params.templateId}:`, error);
    sendResponse(res, errors.internal("Failed to delete template"));
  }
});

export default router;
