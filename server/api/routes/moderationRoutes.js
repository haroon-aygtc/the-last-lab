/**
 * Moderation Routes
 *
 * This module defines the API routes for content moderation.
 */

import express from "express";
import { checkAuth } from "../middleware/auth.js";
import {
  checkContent,
  isUserBanned,
  banUser,
  unbanUser,
  getModerationRules,
  createModerationRule,
  updateModerationRule,
  deleteModerationRule,
  getModerationEvents,
} from "../../controllers/moderationController.js";

const router = express.Router();

// Content moderation routes
router.post("/check", checkContent);

// User ban routes
router.get("/users/:userId/banned", isUserBanned);
router.post("/users/:userId/ban", checkAuth(["admin"]), banUser);
router.post("/users/:userId/unban", checkAuth(["admin"]), unbanUser);

// Moderation rules routes
router.get("/rules", getModerationRules);
router.post("/rules", checkAuth(["admin"]), createModerationRule);
router.put("/rules/:id", checkAuth(["admin"]), updateModerationRule);
router.delete("/rules/:id", checkAuth(["admin"]), deleteModerationRule);

// Moderation events routes
router.get("/events", checkAuth(["admin"]), getModerationEvents);

export default router;
