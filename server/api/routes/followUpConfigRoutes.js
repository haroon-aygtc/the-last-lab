const express = require("express");
const router = express.Router();
const { authMiddleware, adminMiddleware } = require("../middleware/auth");
const { getMySQLClient } = require("../../utils/dbHelpers");
const { v4: uuidv4 } = require("uuid");

// Get all follow-up configurations for the authenticated user
router.get("/", authMiddleware, async (req, res) => {
  try {
    const sequelize = await getMySQLClient();

    const [configs] = await sequelize.query(
      `SELECT fc.*, 
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'id', pqs.id,
            'name', pqs.name,
            'description', pqs.description,
            'triggerKeywords', pqs.trigger_keywords,
            'questions', (
              SELECT JSON_ARRAYAGG(pq.question_text)
              FROM predefined_questions pq
              WHERE pq.set_id = pqs.id
              ORDER BY pq.display_order
            )
          )
        ) as predefined_question_sets,
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'id', tbqs.id,
            'topic', tbqs.topic,
            'questions', (
              SELECT JSON_ARRAYAGG(tbq.question_text)
              FROM topic_based_questions tbq
              WHERE tbq.set_id = tbqs.id
              ORDER BY tbq.display_order
            )
          )
        ) as topic_based_question_sets
      FROM follow_up_configs fc
      LEFT JOIN predefined_question_sets pqs ON fc.id = pqs.config_id
      LEFT JOIN topic_based_question_sets tbqs ON fc.id = tbqs.config_id
      WHERE fc.user_id = ?
      GROUP BY fc.id`,
      {
        replacements: [req.user.id],
        type: sequelize.QueryTypes.SELECT,
      },
    );

    // Transform the data to match the expected format
    const formattedConfigs = configs.map((config) => ({
      id: config.id,
      userId: config.user_id,
      name: config.name,
      enableFollowUpQuestions: config.enable_follow_up_questions === 1,
      maxFollowUpQuestions: config.max_follow_up_questions,
      showFollowUpAs: config.show_follow_up_as,
      generateAutomatically: config.generate_automatically === 1,
      isDefault: config.is_default === 1,
      predefinedQuestionSets: JSON.parse(
        config.predefined_question_sets || "[]",
      ),
      topicBasedQuestionSets: JSON.parse(
        config.topic_based_question_sets || "[]",
      ),
    }));

    res.json(formattedConfigs);
  } catch (error) {
    console.error("Error fetching follow-up configs:", error);
    res.status(500).json({ error: "Failed to fetch follow-up configurations" });
  }
});

// Get a specific follow-up configuration
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const sequelize = await getMySQLClient();

    const [configs] = await sequelize.query(
      `SELECT fc.*, 
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'id', pqs.id,
            'name', pqs.name,
            'description', pqs.description,
            'triggerKeywords', pqs.trigger_keywords,
            'questions', (
              SELECT JSON_ARRAYAGG(pq.question_text)
              FROM predefined_questions pq
              WHERE pq.set_id = pqs.id
              ORDER BY pq.display_order
            )
          )
        ) as predefined_question_sets,
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'id', tbqs.id,
            'topic', tbqs.topic,
            'questions', (
              SELECT JSON_ARRAYAGG(tbq.question_text)
              FROM topic_based_questions tbq
              WHERE tbq.set_id = tbqs.id
              ORDER BY tbq.display_order
            )
          )
        ) as topic_based_question_sets
      FROM follow_up_configs fc
      LEFT JOIN predefined_question_sets pqs ON fc.id = pqs.config_id
      LEFT JOIN topic_based_question_sets tbqs ON fc.id = tbqs.config_id
      WHERE fc.id = ? AND fc.user_id = ?
      GROUP BY fc.id`,
      {
        replacements: [req.params.id, req.user.id],
        type: sequelize.QueryTypes.SELECT,
      },
    );

    if (!configs || configs.length === 0) {
      return res
        .status(404)
        .json({ error: "Follow-up configuration not found" });
    }

    const config = configs[0];
    const formattedConfig = {
      id: config.id,
      userId: config.user_id,
      name: config.name,
      enableFollowUpQuestions: config.enable_follow_up_questions === 1,
      maxFollowUpQuestions: config.max_follow_up_questions,
      showFollowUpAs: config.show_follow_up_as,
      generateAutomatically: config.generate_automatically === 1,
      isDefault: config.is_default === 1,
      predefinedQuestionSets: JSON.parse(
        config.predefined_question_sets || "[]",
      ),
      topicBasedQuestionSets: JSON.parse(
        config.topic_based_question_sets || "[]",
      ),
    };

    res.json(formattedConfig);
  } catch (error) {
    console.error(`Error fetching follow-up config ${req.params.id}:`, error);
    res.status(500).json({ error: "Failed to fetch follow-up configuration" });
  }
});

// Create a new follow-up configuration
router.post("/", authMiddleware, async (req, res) => {
  const sequelize = await getMySQLClient();
  const transaction = await sequelize.transaction();

  try {
    const {
      name,
      enableFollowUpQuestions,
      maxFollowUpQuestions,
      showFollowUpAs,
      generateAutomatically,
      isDefault,
      predefinedQuestionSets,
      topicBasedQuestionSets,
    } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    // If this is set as default, unset any existing default
    if (isDefault) {
      await sequelize.query(
        `UPDATE follow_up_configs SET is_default = 0 WHERE user_id = ? AND is_default = 1`,
        {
          replacements: [req.user.id],
          type: sequelize.QueryTypes.UPDATE,
          transaction,
        },
      );
    }

    // Create the config
    const configId = uuidv4();
    await sequelize.query(
      `INSERT INTO follow_up_configs (
        id, user_id, name, enable_follow_up_questions, max_follow_up_questions,
        show_follow_up_as, generate_automatically, is_default, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      {
        replacements: [
          configId,
          req.user.id,
          name,
          enableFollowUpQuestions !== undefined
            ? enableFollowUpQuestions
            : true,
          maxFollowUpQuestions || 3,
          showFollowUpAs || "buttons",
          generateAutomatically !== undefined ? generateAutomatically : true,
          isDefault || false,
        ],
        type: sequelize.QueryTypes.INSERT,
        transaction,
      },
    );

    // Create predefined question sets
    if (predefinedQuestionSets && predefinedQuestionSets.length > 0) {
      for (const setData of predefinedQuestionSets) {
        const setId = uuidv4();
        await sequelize.query(
          `INSERT INTO predefined_question_sets (
            id, config_id, name, description, trigger_keywords, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
          {
            replacements: [
              setId,
              configId,
              setData.name,
              setData.description || null,
              setData.triggerKeywords
                ? JSON.stringify(setData.triggerKeywords)
                : null,
            ],
            type: sequelize.QueryTypes.INSERT,
            transaction,
          },
        );

        // Create questions for this set
        if (setData.questions && setData.questions.length > 0) {
          for (let i = 0; i < setData.questions.length; i++) {
            await sequelize.query(
              `INSERT INTO predefined_questions (
                id, set_id, question_text, display_order, created_at, updated_at
              ) VALUES (?, ?, ?, ?, NOW(), NOW())`,
              {
                replacements: [uuidv4(), setId, setData.questions[i], i],
                type: sequelize.QueryTypes.INSERT,
                transaction,
              },
            );
          }
        }
      }
    }

    // Create topic-based question sets
    if (topicBasedQuestionSets && topicBasedQuestionSets.length > 0) {
      for (const setData of topicBasedQuestionSets) {
        const setId = uuidv4();
        await sequelize.query(
          `INSERT INTO topic_based_question_sets (
            id, config_id, topic, created_at, updated_at
          ) VALUES (?, ?, ?, NOW(), NOW())`,
          {
            replacements: [setId, configId, setData.topic],
            type: sequelize.QueryTypes.INSERT,
            transaction,
          },
        );

        // Create questions for this set
        if (setData.questions && setData.questions.length > 0) {
          for (let i = 0; i < setData.questions.length; i++) {
            await sequelize.query(
              `INSERT INTO topic_based_questions (
                id, set_id, question_text, display_order, created_at, updated_at
              ) VALUES (?, ?, ?, ?, NOW(), NOW())`,
              {
                replacements: [uuidv4(), setId, setData.questions[i], i],
                type: sequelize.QueryTypes.INSERT,
                transaction,
              },
            );
          }
        }
      }
    }

    await transaction.commit();

    // Return the created config
    res
      .status(201)
      .json({
        id: configId,
        message: "Follow-up configuration created successfully",
      });
  } catch (error) {
    await transaction.rollback();
    console.error("Error creating follow-up config:", error);
    res.status(500).json({ error: "Failed to create follow-up configuration" });
  }
});

// Update an existing follow-up configuration
router.put("/:id", authMiddleware, async (req, res) => {
  const sequelize = await getMySQLClient();
  const transaction = await sequelize.transaction();

  try {
    const {
      name,
      enableFollowUpQuestions,
      maxFollowUpQuestions,
      showFollowUpAs,
      generateAutomatically,
      isDefault,
      predefinedQuestionSets,
      topicBasedQuestionSets,
    } = req.body;

    // Check if the config exists and belongs to the user
    const [configs] = await sequelize.query(
      `SELECT * FROM follow_up_configs WHERE id = ? AND user_id = ?`,
      {
        replacements: [req.params.id, req.user.id],
        type: sequelize.QueryTypes.SELECT,
      },
    );

    if (!configs || configs.length === 0) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ error: "Follow-up configuration not found" });
    }

    // If this is set as default, unset any existing default
    if (isDefault) {
      await sequelize.query(
        `UPDATE follow_up_configs SET is_default = 0 WHERE user_id = ? AND is_default = 1 AND id != ?`,
        {
          replacements: [req.user.id, req.params.id],
          type: sequelize.QueryTypes.UPDATE,
          transaction,
        },
      );
    }

    // Update the config
    await sequelize.query(
      `UPDATE follow_up_configs SET
        name = ?,
        enable_follow_up_questions = ?,
        max_follow_up_questions = ?,
        show_follow_up_as = ?,
        generate_automatically = ?,
        is_default = ?,
        updated_at = NOW()
      WHERE id = ?`,
      {
        replacements: [
          name !== undefined ? name : configs[0].name,
          enableFollowUpQuestions !== undefined
            ? enableFollowUpQuestions
            : configs[0].enable_follow_up_questions,
          maxFollowUpQuestions !== undefined
            ? maxFollowUpQuestions
            : configs[0].max_follow_up_questions,
          showFollowUpAs !== undefined
            ? showFollowUpAs
            : configs[0].show_follow_up_as,
          generateAutomatically !== undefined
            ? generateAutomatically
            : configs[0].generate_automatically,
          isDefault !== undefined ? isDefault : configs[0].is_default,
          req.params.id,
        ],
        type: sequelize.QueryTypes.UPDATE,
        transaction,
      },
    );

    // Update predefined question sets if provided
    if (predefinedQuestionSets !== undefined) {
      // Delete existing sets and questions
      await sequelize.query(
        `DELETE FROM predefined_question_sets WHERE config_id = ?`,
        {
          replacements: [req.params.id],
          type: sequelize.QueryTypes.DELETE,
          transaction,
        },
      );

      // Create new sets and questions
      if (predefinedQuestionSets && predefinedQuestionSets.length > 0) {
        for (const setData of predefinedQuestionSets) {
          const setId = uuidv4();
          await sequelize.query(
            `INSERT INTO predefined_question_sets (
              id, config_id, name, description, trigger_keywords, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
            {
              replacements: [
                setId,
                req.params.id,
                setData.name,
                setData.description || null,
                setData.triggerKeywords
                  ? JSON.stringify(setData.triggerKeywords)
                  : null,
              ],
              type: sequelize.QueryTypes.INSERT,
              transaction,
            },
          );

          // Create questions for this set
          if (setData.questions && setData.questions.length > 0) {
            for (let i = 0; i < setData.questions.length; i++) {
              await sequelize.query(
                `INSERT INTO predefined_questions (
                  id, set_id, question_text, display_order, created_at, updated_at
                ) VALUES (?, ?, ?, ?, NOW(), NOW())`,
                {
                  replacements: [uuidv4(), setId, setData.questions[i], i],
                  type: sequelize.QueryTypes.INSERT,
                  transaction,
                },
              );
            }
          }
        }
      }
    }

    // Update topic-based question sets if provided
    if (topicBasedQuestionSets !== undefined) {
      // Delete existing sets and questions
      await sequelize.query(
        `DELETE FROM topic_based_question_sets WHERE config_id = ?`,
        {
          replacements: [req.params.id],
          type: sequelize.QueryTypes.DELETE,
          transaction,
        },
      );

      // Create new sets and questions
      if (topicBasedQuestionSets && topicBasedQuestionSets.length > 0) {
        for (const setData of topicBasedQuestionSets) {
          const setId = uuidv4();
          await sequelize.query(
            `INSERT INTO topic_based_question_sets (
              id, config_id, topic, created_at, updated_at
            ) VALUES (?, ?, ?, NOW(), NOW())`,
            {
              replacements: [setId, req.params.id, setData.topic],
              type: sequelize.QueryTypes.INSERT,
              transaction,
            },
          );

          // Create questions for this set
          if (setData.questions && setData.questions.length > 0) {
            for (let i = 0; i < setData.questions.length; i++) {
              await sequelize.query(
                `INSERT INTO topic_based_questions (
                  id, set_id, question_text, display_order, created_at, updated_at
                ) VALUES (?, ?, ?, ?, NOW(), NOW())`,
                {
                  replacements: [uuidv4(), setId, setData.questions[i], i],
                  type: sequelize.QueryTypes.INSERT,
                  transaction,
                },
              );
            }
          }
        }
      }
    }

    await transaction.commit();

    res.json({ message: "Follow-up configuration updated successfully" });
  } catch (error) {
    await transaction.rollback();
    console.error(`Error updating follow-up config ${req.params.id}:`, error);
    res.status(500).json({ error: "Failed to update follow-up configuration" });
  }
});

// Delete a follow-up configuration
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const sequelize = await getMySQLClient();

    // Check if the config exists and belongs to the user
    const [configs] = await sequelize.query(
      `SELECT * FROM follow_up_configs WHERE id = ? AND user_id = ?`,
      {
        replacements: [req.params.id, req.user.id],
        type: sequelize.QueryTypes.SELECT,
      },
    );

    if (!configs || configs.length === 0) {
      return res
        .status(404)
        .json({ error: "Follow-up configuration not found" });
    }

    // Delete the config (cascade will delete related sets and questions)
    await sequelize.query(`DELETE FROM follow_up_configs WHERE id = ?`, {
      replacements: [req.params.id],
      type: sequelize.QueryTypes.DELETE,
    });

    res.json({ message: "Follow-up configuration deleted successfully" });
  } catch (error) {
    console.error(`Error deleting follow-up config ${req.params.id}:`, error);
    res.status(500).json({ error: "Failed to delete follow-up configuration" });
  }
});

module.exports = router;
