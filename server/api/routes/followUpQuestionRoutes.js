/**
 * Follow-up Question Routes
 * Handles API endpoints for follow-up questions
 */

const express = require("express");
const router = express.Router();
const { executeQuery, executeTransaction } = require("../core/mysql");
const { v4: uuidv4 } = require("uuid");
const { authenticateJWT, isAdmin } = require("../middleware/auth");

/**
 * Get all follow-up questions for a specific configuration
 */
router.get("/config/:configId", authenticateJWT, async (req, res) => {
  try {
    const { configId } = req.params;

    const questions = await executeQuery(
      `SELECT * FROM follow_up_questions 
       WHERE config_id = ? 
       ORDER BY display_order ASC`,
      [configId],
    );

    return res.json({
      success: true,
      data: questions.map((q) => ({
        id: q.id,
        configId: q.config_id,
        question: q.question,
        displayOrder: q.display_order,
        isActive: q.is_active,
        createdAt: q.created_at,
        updatedAt: q.updated_at,
      })),
    });
  } catch (error) {
    console.error("Error fetching follow-up questions:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch follow-up questions",
    });
  }
});

/**
 * Create a new follow-up question
 */
router.post("/", authenticateJWT, async (req, res) => {
  try {
    const { configId, question, displayOrder, isActive } = req.body;

    if (!configId || !question) {
      return res.status(400).json({
        success: false,
        error: "Configuration ID and question are required",
      });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    await executeQuery(
      `INSERT INTO follow_up_questions 
       (id, config_id, question, display_order, is_active, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        configId,
        question,
        displayOrder || 0,
        isActive !== undefined ? isActive : true,
        now,
        now,
      ],
    );

    // Fetch the created question
    const [createdQuestion] = await executeQuery(
      `SELECT * FROM follow_up_questions WHERE id = ?`,
      [id],
    );

    return res.status(201).json({
      success: true,
      data: {
        id: createdQuestion.id,
        configId: createdQuestion.config_id,
        question: createdQuestion.question,
        displayOrder: createdQuestion.display_order,
        isActive: createdQuestion.is_active,
        createdAt: createdQuestion.created_at,
        updatedAt: createdQuestion.updated_at,
      },
    });
  } catch (error) {
    console.error("Error creating follow-up question:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to create follow-up question",
    });
  }
});

/**
 * Update a follow-up question
 */
router.put("/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const { question, displayOrder, isActive } = req.body;

    const updateFields = [];
    const values = [];

    if (question !== undefined) {
      updateFields.push("question = ?");
      values.push(question);
    }

    if (displayOrder !== undefined) {
      updateFields.push("display_order = ?");
      values.push(displayOrder);
    }

    if (isActive !== undefined) {
      updateFields.push("is_active = ?");
      values.push(isActive);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No fields to update",
      });
    }

    // Add updated_at
    updateFields.push("updated_at = ?");
    values.push(new Date().toISOString());

    // Add ID to values
    values.push(id);

    await executeQuery(
      `UPDATE follow_up_questions 
       SET ${updateFields.join(", ")} 
       WHERE id = ?`,
      values,
    );

    // Fetch the updated question
    const [updatedQuestion] = await executeQuery(
      `SELECT * FROM follow_up_questions WHERE id = ?`,
      [id],
    );

    if (!updatedQuestion) {
      return res.status(404).json({
        success: false,
        error: "Follow-up question not found",
      });
    }

    return res.json({
      success: true,
      data: {
        id: updatedQuestion.id,
        configId: updatedQuestion.config_id,
        question: updatedQuestion.question,
        displayOrder: updatedQuestion.display_order,
        isActive: updatedQuestion.is_active,
        createdAt: updatedQuestion.created_at,
        updatedAt: updatedQuestion.updated_at,
      },
    });
  } catch (error) {
    console.error("Error updating follow-up question:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to update follow-up question",
    });
  }
});

/**
 * Delete a follow-up question
 */
router.delete("/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if the question exists
    const [question] = await executeQuery(
      `SELECT * FROM follow_up_questions WHERE id = ?`,
      [id],
    );

    if (!question) {
      return res.status(404).json({
        success: false,
        error: "Follow-up question not found",
      });
    }

    await executeQuery(`DELETE FROM follow_up_questions WHERE id = ?`, [id]);

    return res.json({
      success: true,
      message: "Follow-up question deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting follow-up question:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to delete follow-up question",
    });
  }
});

/**
 * Reorder follow-up questions
 */
router.post("/reorder", authenticateJWT, async (req, res) => {
  try {
    const { configId, questionIds } = req.body;

    if (!configId || !questionIds || !Array.isArray(questionIds)) {
      return res.status(400).json({
        success: false,
        error: "Configuration ID and question IDs array are required",
      });
    }

    // Use a transaction to ensure all updates succeed or fail together
    const queries = [];
    const now = new Date().toISOString();

    for (let i = 0; i < questionIds.length; i++) {
      queries.push({
        sql: `UPDATE follow_up_questions 
              SET display_order = ?, updated_at = ? 
              WHERE id = ? AND config_id = ?`,
        replacements: [i, now, questionIds[i], configId],
        queryType: "UPDATE",
      });
    }

    await executeTransaction(queries);

    return res.json({
      success: true,
      message: "Follow-up questions reordered successfully",
    });
  } catch (error) {
    console.error("Error reordering follow-up questions:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to reorder follow-up questions",
    });
  }
});

/**
 * Get follow-up questions for a chat session
 */
router.get("/chat/:configId", async (req, res) => {
  try {
    const { configId } = req.params;
    const limit = parseInt(req.query.limit) || 3;

    const questions = await executeQuery(
      `SELECT question FROM follow_up_questions 
       WHERE config_id = ? AND is_active = true 
       ORDER BY display_order ASC 
       LIMIT ?`,
      [configId, limit],
    );

    return res.json({
      success: true,
      data: questions.map((q) => q.question),
    });
  } catch (error) {
    console.error("Error fetching follow-up questions for chat:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch follow-up questions for chat",
    });
  }
});

module.exports = router;
