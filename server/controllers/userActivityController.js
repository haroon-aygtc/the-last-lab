/**
 * User Activity Controller
 *
 * This module provides controller functions for user activity tracking.
 */

import { getMySQLClient, QueryTypes } from "../utils/dbHelpers.js";
import { v4 as uuidv4 } from "uuid";
import { formatResponse } from "../utils/responseFormatter.js";

/**
 * Log a user activity
 */
export const logActivity = async (req, res) => {
  try {
    const { user_id, action, ip_address, user_agent, metadata } = req.body;

    if (!user_id || !action) {
      return res.status(400).json(
        formatResponse(null, {
          message: "User ID and action are required",
          code: "ERR_400",
        }),
      );
    }

    const sequelize = await getMySQLClient();
    const id = uuidv4();
    const now = new Date().toISOString();

    await sequelize.query(
      `INSERT INTO user_activities 
       (id, user_id, action, ip_address, user_agent, metadata, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      {
        replacements: [
          id,
          user_id,
          action,
          ip_address || null,
          user_agent || null,
          metadata ? JSON.stringify(metadata) : null,
          now,
        ],
        type: QueryTypes.INSERT,
      },
    );

    return res.status(201).json(
      formatResponse({
        id,
        user_id,
        action,
        created_at: now,
      }),
    );
  } catch (error) {
    console.error("Error logging user activity:", error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};

/**
 * Get user activities
 */
export const getUserActivities = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    if (!userId) {
      return res.status(400).json(
        formatResponse(null, {
          message: "User ID is required",
          code: "ERR_400",
        }),
      );
    }

    // Check if the requesting user is the same as the target user or is an admin
    if (req.user.id !== userId && req.user.role !== "admin") {
      return res.status(403).json(
        formatResponse(null, {
          message: "Unauthorized to access this user's activities",
          code: "ERR_403",
        }),
      );
    }

    const sequelize = await getMySQLClient();

    // Get activities with pagination
    const activities = await sequelize.query(
      `SELECT * FROM user_activities 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      {
        replacements: [userId, parseInt(limit), offset],
        type: QueryTypes.SELECT,
      },
    );

    // Get total count for pagination
    const [countResult] = await sequelize.query(
      `SELECT COUNT(*) as count FROM user_activities WHERE user_id = ?`,
      {
        replacements: [userId],
        type: QueryTypes.SELECT,
      },
    );

    // Parse metadata JSON if it exists
    const formattedActivities = activities.map((activity) => {
      if (activity.metadata && typeof activity.metadata === "string") {
        try {
          activity.metadata = JSON.parse(activity.metadata);
        } catch (e) {
          // If parsing fails, keep as is
        }
      }
      return activity;
    });

    return res.json(
      formatResponse({
        activities: formattedActivities,
        pagination: {
          total: countResult.count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(countResult.count / limit),
        },
      }),
    );
  } catch (error) {
    console.error("Error getting user activities:", error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};

/**
 * Get user sessions
 */
export const getUserSessions = async (req, res) => {
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

    // Check if the requesting user is the same as the target user or is an admin
    if (req.user.id !== userId && req.user.role !== "admin") {
      return res.status(403).json(
        formatResponse(null, {
          message: "Unauthorized to access this user's sessions",
          code: "ERR_403",
        }),
      );
    }

    const sequelize = await getMySQLClient();

    const sessions = await sequelize.query(
      `SELECT * FROM user_sessions 
       WHERE user_id = ? 
       ORDER BY last_active_at DESC`,
      {
        replacements: [userId],
        type: QueryTypes.SELECT,
      },
    );

    // Parse device_info JSON if it exists
    const formattedSessions = sessions.map((session) => {
      if (session.device_info && typeof session.device_info === "string") {
        try {
          session.device_info = JSON.parse(session.device_info);
        } catch (e) {
          // If parsing fails, keep as is
        }
      }
      return session;
    });

    return res.json(formatResponse(formattedSessions));
  } catch (error) {
    console.error("Error getting user sessions:", error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};

/**
 * Terminate a user session
 */
export const terminateSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json(
        formatResponse(null, {
          message: "Session ID is required",
          code: "ERR_400",
        }),
      );
    }

    const sequelize = await getMySQLClient();

    // Get the session to check ownership
    const [session] = await sequelize.query(
      `SELECT * FROM user_sessions WHERE id = ?`,
      {
        replacements: [sessionId],
        type: QueryTypes.SELECT,
      },
    );

    if (!session) {
      return res.status(404).json(
        formatResponse(null, {
          message: "Session not found",
          code: "ERR_404",
        }),
      );
    }

    // Check if the requesting user is the same as the session owner or is an admin
    if (req.user.id !== session.user_id && req.user.role !== "admin") {
      return res.status(403).json(
        formatResponse(null, {
          message: "Unauthorized to terminate this session",
          code: "ERR_403",
        }),
      );
    }

    // Terminate the session
    await sequelize.query(`DELETE FROM user_sessions WHERE id = ?`, {
      replacements: [sessionId],
      type: QueryTypes.DELETE,
    });

    // Log the activity
    const activityId = uuidv4();
    const now = new Date().toISOString();

    await sequelize.query(
      `INSERT INTO user_activities 
       (id, user_id, action, metadata, created_at) 
       VALUES (?, ?, ?, ?, ?)`,
      {
        replacements: [
          activityId,
          req.user.id,
          "session_terminated",
          JSON.stringify({ terminated_session_id: sessionId }),
          now,
        ],
        type: QueryTypes.INSERT,
      },
    );

    return res.json(formatResponse({ success: true }));
  } catch (error) {
    console.error("Error terminating user session:", error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};

/**
 * Terminate all user sessions except the current one
 */
export const terminateAllSessions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { currentSessionId } = req.query;

    if (!userId) {
      return res.status(400).json(
        formatResponse(null, {
          message: "User ID is required",
          code: "ERR_400",
        }),
      );
    }

    // Check if the requesting user is the same as the target user or is an admin
    if (req.user.id !== userId && req.user.role !== "admin") {
      return res.status(403).json(
        formatResponse(null, {
          message: "Unauthorized to terminate this user's sessions",
          code: "ERR_403",
        }),
      );
    }

    const sequelize = await getMySQLClient();

    // Terminate all sessions except the current one
    let query = `DELETE FROM user_sessions WHERE user_id = ?`;
    let replacements = [userId];

    if (currentSessionId) {
      query += ` AND id != ?`;
      replacements.push(currentSessionId);
    }

    await sequelize.query(query, {
      replacements,
      type: QueryTypes.DELETE,
    });

    // Log the activity
    const activityId = uuidv4();
    const now = new Date().toISOString();

    await sequelize.query(
      `INSERT INTO user_activities 
       (id, user_id, action, metadata, created_at) 
       VALUES (?, ?, ?, ?, ?)`,
      {
        replacements: [
          activityId,
          req.user.id,
          "all_sessions_terminated",
          JSON.stringify({
            except_session_id: currentSessionId,
            target_user_id: userId,
          }),
          now,
        ],
        type: QueryTypes.INSERT,
      },
    );

    return res.json(formatResponse({ success: true }));
  } catch (error) {
    console.error("Error terminating all user sessions:", error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};
