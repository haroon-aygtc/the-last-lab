/**
 * User Activity Routes
 *
 * This module defines the API routes for user activity tracking.
 */

import express from "express";
import { authenticateJWT, checkAuth } from "../middleware/auth";
import UserActivityController from "../../controllers/UserActivityController";

const router = express.Router();

/**
 * @route POST /api/user-activity
 * @desc Log a user activity
 * @access Private
 */
router.post("/activity", authenticateJWT, UserActivityController.logActivity);

/**
 * @route GET /api/user-activity/:userId
 * @desc Get user activities
 * @access Private
 */
router.get(
  "/:userId/activity",
  authenticateJWT,
  UserActivityController.getUserActivities,
);

/**
 * @route GET /api/user-activity/:userId/sessions
 * @desc Get user sessions
 * @access Private
 */
router.get(
  "/:userId/sessions",
  authenticateJWT,
  UserActivityController.getUserSessions,
);

/**
 * @route DELETE /api/user-activity/sessions/:sessionId
 * @desc Terminate a specific session
 * @access Private
 */
router.delete(
  "/sessions/:sessionId",
  authenticateJWT,
  UserActivityController.terminateSession,
);

/**
 * @route DELETE /api/user-activity/:userId/sessions
 * @desc Terminate all sessions except current one
 * @access Private
 */
router.delete(
  "/:userId/sessions",
  authenticateJWT,
  UserActivityController.terminateAllSessions,
);

export default router;
