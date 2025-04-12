/**
 * Prompt Template Controller
 *
 * This module provides controller functions for prompt templates.
 */

import { getMySQLClient, QueryTypes } from "../utils/dbHelpers.js";
import { v4 as uuidv4 } from "uuid";
import { formatResponse } from "../utils/responseFormatter.js";

/**
 * Get all prompt templates
 */
export const getAllTemplates = async (req, res) => {
  try {
    const sequelize = await getMySQLClient();
    const templates = await sequelize.query(
      "SELECT * FROM prompt_templates ORDER BY is_default DESC, created_at DESC",
      {
        type: QueryTypes.SELECT,
      },
    );

    // Transform to camelCase
    const formattedTemplates = templates.map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description,
      template: template.template,
      systemPrompt: template.system_prompt,
      variables: template.variables ? JSON.parse(template.variables) : [],
      isDefault: template.is_default,
      isActive: template.is_active,
      createdAt: template.created_at,
      updatedAt: template.updated_at,
    }));

    return res.json(formatResponse(formattedTemplates));
  } catch (error) {
    console.error("Error getting prompt templates", error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};

/**
 * Get a prompt template by ID
 */
export const getTemplateById = async (req, res) => {
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
      "SELECT * FROM prompt_templates WHERE id = ?",
      {
        replacements: [id],
        type: QueryTypes.SELECT,
      },
    );

    if (!template) {
      return res.status(404).json(
        formatResponse(null, {
          message: "Prompt template not found",
          code: "ERR_404",
        }),
      );
    }

    // Transform to camelCase
    const formattedTemplate = {
      id: template.id,
      name: template.name,
      description: template.description,
      template: template.template,
      systemPrompt: template.system_prompt,
      variables: template.variables ? JSON.parse(template.variables) : [],
      isDefault: template.is_default,
      isActive: template.is_active,
      createdAt: template.created_at,
      updatedAt: template.updated_at,
    };

    return res.json(formatResponse(formattedTemplate));
  } catch (error) {
    console.error("Error getting prompt template", error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};

/**
 * Create a new prompt template
 */
export const createTemplate = async (req, res) => {
  try {
    const { name, description, template, systemPrompt, variables, isActive } =
      req.body;

    if (!name || !template) {
      return res.status(400).json(
        formatResponse(null, {
          message: "Name and template are required",
          code: "ERR_400",
        }),
      );
    }

    const sequelize = await getMySQLClient();
    const id = uuidv4();
    const now = new Date().toISOString();

    await sequelize.query(
      `INSERT INTO prompt_templates 
       (id, name, description, template, system_prompt, variables, is_default, is_active, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      {
        replacements: [
          id,
          name,
          description || null,
          template,
          systemPrompt || null,
          variables ? JSON.stringify(variables) : JSON.stringify([]),
          false, // New templates are not default by default
          isActive !== undefined ? isActive : true,
          now,
          now,
        ],
        type: QueryTypes.INSERT,
      },
    );

    // Fetch the newly created template
    const [newTemplate] = await sequelize.query(
      "SELECT * FROM prompt_templates WHERE id = ?",
      {
        replacements: [id],
        type: QueryTypes.SELECT,
      },
    );

    // Transform to camelCase
    const formattedTemplate = {
      id: newTemplate.id,
      name: newTemplate.name,
      description: newTemplate.description,
      template: newTemplate.template,
      systemPrompt: newTemplate.system_prompt,
      variables: newTemplate.variables ? JSON.parse(newTemplate.variables) : [],
      isDefault: newTemplate.is_default,
      isActive: newTemplate.is_active,
      createdAt: newTemplate.created_at,
      updatedAt: newTemplate.updated_at,
    };

    return res.json(formatResponse(formattedTemplate));
  } catch (error) {
    console.error("Error creating prompt template", error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};

/**
 * Update a prompt template
 */
export const updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!id) {
      return res.status(400).json(
        formatResponse(null, {
          message: "Template ID is required",
          code: "ERR_400",
        }),
      );
    }

    const sequelize = await getMySQLClient();

    // Check if template exists
    const [existingTemplate] = await sequelize.query(
      "SELECT * FROM prompt_templates WHERE id = ?",
      {
        replacements: [id],
        type: QueryTypes.SELECT,
      },
    );

    if (!existingTemplate) {
      return res.status(404).json(
        formatResponse(null, {
          message: "Prompt template not found",
          code: "ERR_404",
        }),
      );
    }

    // Build the update data
    const updateData = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined)
      updateData.description = updates.description;
    if (updates.template !== undefined) updateData.template = updates.template;
    if (updates.systemPrompt !== undefined)
      updateData.system_prompt = updates.systemPrompt;
    if (updates.variables !== undefined)
      updateData.variables = JSON.stringify(updates.variables);
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
    updateData.updated_at = new Date().toISOString();

    // Build the SET clause and replacements array
    const setClause = Object.keys(updateData)
      .map((key) => `${key} = ?`)
      .join(", ");
    const replacements = [...Object.values(updateData), id];

    await sequelize.query(
      `UPDATE prompt_templates SET ${setClause} WHERE id = ?`,
      {
        replacements,
        type: QueryTypes.UPDATE,
      },
    );

    // Fetch the updated template
    const [updatedTemplate] = await sequelize.query(
      "SELECT * FROM prompt_templates WHERE id = ?",
      {
        replacements: [id],
        type: QueryTypes.SELECT,
      },
    );

    // Transform to camelCase
    const formattedTemplate = {
      id: updatedTemplate.id,
      name: updatedTemplate.name,
      description: updatedTemplate.description,
      template: updatedTemplate.template,
      systemPrompt: updatedTemplate.system_prompt,
      variables: updatedTemplate.variables
        ? JSON.parse(updatedTemplate.variables)
        : [],
      isDefault: updatedTemplate.is_default,
      isActive: updatedTemplate.is_active,
      createdAt: updatedTemplate.created_at,
      updatedAt: updatedTemplate.updated_at,
    };

    return res.json(formatResponse(formattedTemplate));
  } catch (error) {
    console.error("Error updating prompt template", error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};

/**
 * Delete a prompt template
 */
export const deleteTemplate = async (req, res) => {
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

    // Check if template exists
    const [existingTemplate] = await sequelize.query(
      "SELECT * FROM prompt_templates WHERE id = ?",
      {
        replacements: [id],
        type: QueryTypes.SELECT,
      },
    );

    if (!existingTemplate) {
      return res.status(404).json(
        formatResponse(null, {
          message: "Prompt template not found",
          code: "ERR_404",
        }),
      );
    }

    // Don't allow deleting the default template
    if (existingTemplate.is_default) {
      return res.status(400).json(
        formatResponse(null, {
          message: "Cannot delete the default template",
          code: "ERR_400",
        }),
      );
    }

    await sequelize.query("DELETE FROM prompt_templates WHERE id = ?", {
      replacements: [id],
      type: QueryTypes.DELETE,
    });

    return res.json(formatResponse(true));
  } catch (error) {
    console.error("Error deleting prompt template", error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};

/**
 * Get the default prompt template
 */
export const getDefaultTemplate = async (req, res) => {
  try {
    const sequelize = await getMySQLClient();
    const [template] = await sequelize.query(
      "SELECT * FROM prompt_templates WHERE is_default = true LIMIT 1",
      {
        type: QueryTypes.SELECT,
      },
    );

    if (!template) {
      return res.status(404).json(
        formatResponse(null, {
          message: "No default prompt template found",
          code: "ERR_404",
        }),
      );
    }

    // Transform to camelCase
    const formattedTemplate = {
      id: template.id,
      name: template.name,
      description: template.description,
      template: template.template,
      systemPrompt: template.system_prompt,
      variables: template.variables ? JSON.parse(template.variables) : [],
      isDefault: template.is_default,
      isActive: template.is_active,
      createdAt: template.created_at,
      updatedAt: template.updated_at,
    };

    return res.json(formatResponse(formattedTemplate));
  } catch (error) {
    console.error("Error getting default prompt template", error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};

/**
 * Set a prompt template as default
 */
export const setDefaultTemplate = async (req, res) => {
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

    // Check if template exists
    const [existingTemplate] = await sequelize.query(
      "SELECT * FROM prompt_templates WHERE id = ?",
      {
        replacements: [id],
        type: QueryTypes.SELECT,
      },
    );

    if (!existingTemplate) {
      return res.status(404).json(
        formatResponse(null, {
          message: "Prompt template not found",
          code: "ERR_404",
        }),
      );
    }

    // Clear default flag from all templates
    await sequelize.query(
      "UPDATE prompt_templates SET is_default = false, updated_at = ?",
      {
        replacements: [new Date().toISOString()],
        type: QueryTypes.UPDATE,
      },
    );

    // Set this template as default
    await sequelize.query(
      "UPDATE prompt_templates SET is_default = true, updated_at = ? WHERE id = ?",
      {
        replacements: [new Date().toISOString(), id],
        type: QueryTypes.UPDATE,
      },
    );

    // Fetch the updated template
    const [updatedTemplate] = await sequelize.query(
      "SELECT * FROM prompt_templates WHERE id = ?",
      {
        replacements: [id],
        type: QueryTypes.SELECT,
      },
    );

    // Transform to camelCase
    const formattedTemplate = {
      id: updatedTemplate.id,
      name: updatedTemplate.name,
      description: updatedTemplate.description,
      template: updatedTemplate.template,
      systemPrompt: updatedTemplate.system_prompt,
      variables: updatedTemplate.variables
        ? JSON.parse(updatedTemplate.variables)
        : [],
      isDefault: updatedTemplate.is_default,
      isActive: updatedTemplate.is_active,
      createdAt: updatedTemplate.created_at,
      updatedAt: updatedTemplate.updated_at,
    };

    return res.json(formatResponse(formattedTemplate));
  } catch (error) {
    console.error("Error setting default prompt template", error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};
