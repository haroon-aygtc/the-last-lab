/**
 * Context Rule Routes
 *
 * This module defines the API routes for context rule management.
 */

import express from "express";
import { authenticateJWT, checkAuth } from "../middleware/auth";
import ContextRuleController from "../../controllers/ContextRuleController";

const router = express.Router();

/**
 * @route POST /api/context-rules
 * @desc Create a new context rule
 * @access Private
 */
router.post("/", authenticateJWT, ContextRuleController.createContextRule);

/**
 * @route GET /api/context-rules/user/:userId
 * @desc Get all context rules for a user
 * @access Private
 */
router.get(
  "/user/:userId",
  authenticateJWT,
  ContextRuleController.getUserContextRules,
);

/**
 * @route GET /api/context-rules/:id
 * @desc Get a context rule by ID
 * @access Private
 */
router.get("/:id", authenticateJWT, ContextRuleController.getContextRule);

/**
 * @route PUT /api/context-rules/:id
 * @desc Update a context rule
 * @access Private
 */
router.put("/:id", authenticateJWT, ContextRuleController.updateContextRule);

/**
 * @route DELETE /api/context-rules/:id
 * @desc Delete a context rule
 * @access Private
 */
router.delete("/:id", authenticateJWT, ContextRuleController.deleteContextRule);

/**
 * @route PUT /api/context-rules/:id/status
 * @desc Update context rule status
 * @access Private
 */
router.put(
  "/:id/status",
  authenticateJWT,
  ContextRuleController.updateContextRuleStatus,
);

export default router;
