/**
 * User Session Routes
 *
 * These routes handle user session management
 */

import express from "express";
import { getMySQLClient } from "../../utils/dbHelpers.js";
import { authenticateJWT } from "../middleware/auth.js";

const router = express.Router();

/**
 * @route GET /api/user-sessions/:userId
 * @desc Get active user sessions
 * @access Private
 */
router.get("/:userId", authenticateJWT, async (req, res) => {
  try {
    const { userId } = req.params;

    // Ensure the user can only access their own sessions unless they're an admin
    if (req.user.id !== userId && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Unauthorized access to user sessions" });
    }

    const sequelize = await getMySQLClient();

    const [sessions] = await sequelize.query(
      `SELECT * FROM user_sessions 
       WHERE user_id = ? 
       ORDER BY last_active_at DESC`,
      {
        replacements: [userId],
      },
    );

    res.json(sessions);
  } catch (error) {
    console.error("Error fetching user sessions:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route POST /api/user-sessions
 * @desc Create or update a user session
 * @access Private
 */
router.post("/", authenticateJWT, async (req, res) => {
  try {
    const { deviceInfo, ipAddress, location } = req.body;
    const userId = req.user.id;

    if (!deviceInfo) {
      return res.status(400).json({ error: "Device info is required" });
    }

    const sequelize = await getMySQLClient();
    const now = new Date().toISOString();

    // Check if session exists
    const [existingSessions] = await sequelize.query(
      `SELECT id FROM user_sessions 
       WHERE user_id = ? 
       AND JSON_EXTRACT(device_info, '$.name') = ? 
       AND JSON_EXTRACT(device_info, '$.browser') = ?`,
      {
        replacements: [userId, deviceInfo.name, deviceInfo.browser],
      },
    );

    let sessionId;

    if (existingSessions.length > 0) {
      // Update existing session
      sessionId = existingSessions[0].id;
      await sequelize.query(
        `UPDATE user_sessions 
         SET last_active_at = ?, 
             is_active = true, 
             ip_address = ?, 
             location = ? 
         WHERE id = ?`,
        {
          replacements: [now, ipAddress || null, location || null, sessionId],
        },
      );
    } else {
      // Create new session
      const [result] = await sequelize.query(
        `INSERT INTO user_sessions 
         (id, user_id, device_info, ip_address, location, last_active_at, created_at, is_active) 
         VALUES (UUID(), ?, ?, ?, ?, ?, ?, true)`,
        {
          replacements: [
            userId,
            JSON.stringify(deviceInfo),
            ipAddress || null,
            location || null,
            now,
            now,
          ],
        },
      );

      sessionId = result.insertId;
    }

    // Get the session
    const [session] = await sequelize.query(
      `SELECT * FROM user_sessions WHERE id = ?`,
      {
        replacements: [sessionId],
      },
    );

    res.json(session[0]);
  } catch (error) {
    console.error("Error updating user session:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route PUT /api/user-sessions/:id/terminate
 * @desc Terminate a specific user session
 * @access Private
 */
router.put("/:id/terminate", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const sequelize = await getMySQLClient();

    // Check if the session belongs to the user
    const [sessions] = await sequelize.query(
      `SELECT user_id FROM user_sessions WHERE id = ?`,
      {
        replacements: [id],
      },
    );

    if (sessions.length === 0) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Ensure the user can only terminate their own sessions unless they're an admin
    if (sessions[0].user_id !== req.user.id && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Unauthorized to terminate this session" });
    }

    await sequelize.query(
      `UPDATE user_sessions 
       SET is_active = false 
       WHERE id = ?`,
      {
        replacements: [id],
      },
    );

    res.json({ success: true, message: "Session terminated successfully" });
  } catch (error) {
    console.error("Error terminating user session:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route PUT /api/user-sessions/:userId/terminate-all
 * @desc Terminate all user sessions except the current one
 * @access Private
 */
router.put("/:userId/terminate-all", authenticateJWT, async (req, res) => {
  try {
    const { userId } = req.params;
    const { currentSessionId } = req.body;

    if (!currentSessionId) {
      return res.status(400).json({ error: "Current session ID is required" });
    }

    // Ensure the user can only terminate their own sessions unless they're an admin
    if (userId !== req.user.id && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Unauthorized to terminate these sessions" });
    }

    const sequelize = await getMySQLClient();

    await sequelize.query(
      `UPDATE user_sessions 
       SET is_active = false 
       WHERE user_id = ? 
       AND id != ?`,
      {
        replacements: [userId, currentSessionId],
      },
    );

    res.json({
      success: true,
      message: "All other sessions terminated successfully",
    });
  } catch (error) {
    console.error("Error terminating all user sessions:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
