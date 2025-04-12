/**
 * User Activity Routes
 *
 * This module defines the API routes for user activity tracking.
 */

import express from "express";
import { authenticateJWT, checkAuth } from "../middleware/auth.js";
import {
  logActivity,
  getUserActivities,
  getUserSessions,
  terminateSession,
  terminateAllSessions,
} from "../../controllers/userActivityController.js";

const router = express.Router();

/**
 * @route POST /api/users/activity
 * @desc Log a user activity
 * @access Private
 */
router.post("/activity", authenticateJWT, logActivity);

/**
 * @route GET /api/users/:userId/activity
 * @desc Get user activities
 * @access Private
 */
router.get("/:userId/activity", authenticateJWT, getUserActivities);

/**
 * @route GET /api/users/:userId/sessions
 * @desc Get user sessions
 * @access Private
 */
router.get("/:userId/sessions", authenticateJWT, getUserSessions);

/**
 * @route DELETE /api/users/sessions/:sessionId
 * @desc Terminate a specific session
 * @access Private
 */
router.delete("/sessions/:sessionId", authenticateJWT, terminateSession);

/**
 * @route DELETE /api/users/:userId/sessions
 * @desc Terminate all sessions except current one
 * @access Private
 */
router.delete("/:userId/sessions", authenticateJWT, terminateAllSessions);

export default router;
