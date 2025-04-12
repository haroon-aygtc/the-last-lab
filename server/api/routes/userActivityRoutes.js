/**
 * User Activity Routes
 *
 * These routes handle user activity tracking
 */

import express from "express";
import { getMySQLClient } from "../../utils/dbHelpers.js";
import { authenticateJWT } from "../middleware/auth.js";

const router = express.Router();

/**
 * @route GET /api/user-activity/:userId
 * @desc Get user activity history
 * @access Private
 */
router.get("/:userId", authenticateJWT, async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const sequelize = await getMySQLClient();

    const [activities] = await sequelize.query(
      `SELECT * FROM user_activity 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      {
        replacements: [userId, parseInt(limit), parseInt(offset)],
      },
    );

    res.json(activities);
  } catch (error) {
    console.error("Error fetching user activity:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route POST /api/user-activity
 * @desc Log user activity
 * @access Private
 */
router.post("/", authenticateJWT, async (req, res) => {
  try {
    const { action, details } = req.body;
    const userId = req.user.id;

    if (!action) {
      return res.status(400).json({ error: "Action is required" });
    }

    const sequelize = await getMySQLClient();
    const now = new Date().toISOString();

    // Get IP address from request
    const ipAddress =
      req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const userAgent = req.headers["user-agent"];

    const [result] = await sequelize.query(
      `INSERT INTO user_activity 
       (id, user_id, action, details, ip_address, user_agent, created_at) 
       VALUES (UUID(), ?, ?, ?, ?, ?, ?)`,
      {
        replacements: [
          userId,
          action,
          details ? JSON.stringify(details) : null,
          ipAddress,
          userAgent,
          now,
        ],
      },
    );

    // Get the inserted record
    const [activity] = await sequelize.query(
      `SELECT * FROM user_activity WHERE id = ?`,
      {
        replacements: [result.insertId],
      },
    );

    res.status(201).json(activity[0]);
  } catch (error) {
    console.error("Error logging user activity:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/user-activity/stats
 * @desc Get activity statistics
 * @access Private
 */
router.get("/stats", authenticateJWT, async (req, res) => {
  try {
    const { timeframe = "week" } = req.query;
    const sequelize = await getMySQLClient();

    let timeframeClause;
    switch (timeframe) {
      case "day":
        timeframeClause = "created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)";
        break;
      case "month":
        timeframeClause = "created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)";
        break;
      case "year":
        timeframeClause = "created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)";
        break;
      case "week":
      default:
        timeframeClause = "created_at >= DATE_SUB(NOW(), INTERVAL 1 WEEK)";
        break;
    }

    // Get activity counts by day
    const [activityByDay] = await sequelize.query(
      `SELECT DATE(created_at) as date, COUNT(*) as count 
       FROM user_activity 
       WHERE ${timeframeClause} 
       GROUP BY DATE(created_at) 
       ORDER BY date`,
    );

    // Get activity counts by action
    const [activityByAction] = await sequelize.query(
      `SELECT action, COUNT(*) as count 
       FROM user_activity 
       WHERE ${timeframeClause} 
       GROUP BY action 
       ORDER BY count DESC`,
    );

    // Get total count
    const [totalCount] = await sequelize.query(
      `SELECT COUNT(*) as total FROM user_activity WHERE ${timeframeClause}`,
    );

    res.json({
      byDay: activityByDay,
      byAction: activityByAction,
      total: totalCount[0].total,
    });
  } catch (error) {
    console.error("Error fetching activity statistics:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/user-activity/most-active
 * @desc Get most active users
 * @access Private
 */
router.get("/most-active", authenticateJWT, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const sequelize = await getMySQLClient();

    const [mostActiveUsers] = await sequelize.query(
      `SELECT user_id, COUNT(*) as activity_count 
       FROM user_activity 
       GROUP BY user_id 
       ORDER BY activity_count DESC 
       LIMIT ?`,
      {
        replacements: [parseInt(limit)],
      },
    );

    res.json(mostActiveUsers);
  } catch (error) {
    console.error("Error fetching most active users:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/user-activity/common-actions
 * @desc Get most common actions
 * @access Private
 */
router.get("/common-actions", authenticateJWT, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const sequelize = await getMySQLClient();

    const [commonActions] = await sequelize.query(
      `SELECT action, COUNT(*) as count 
       FROM user_activity 
       GROUP BY action 
       ORDER BY count DESC 
       LIMIT ?`,
      {
        replacements: [parseInt(limit)],
      },
    );

    res.json(commonActions);
  } catch (error) {
    console.error("Error fetching common actions:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
