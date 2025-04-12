/**
 * Widget Routes
 *
 * This module defines the API routes for widget management.
 */

import express from "express";
import { authenticateJWT, checkAuth } from "../middleware/auth";
import WidgetController from "../../controllers/WidgetController";

const router = express.Router();

/**
 * @route POST /api/widgets
 * @desc Create a new widget
 * @access Private
 */
router.post("/", authenticateJWT, WidgetController.createWidget);

/**
 * @route GET /api/widgets/user/:userId
 * @desc Get all widgets for a user
 * @access Private
 */
router.get("/user/:userId", authenticateJWT, WidgetController.getUserWidgets);

/**
 * @route GET /api/widgets/:id
 * @desc Get a widget by ID
 * @access Private
 */
router.get("/:id", authenticateJWT, WidgetController.getWidget);

/**
 * @route PUT /api/widgets/:id
 * @desc Update a widget
 * @access Private
 */
router.put("/:id", authenticateJWT, WidgetController.updateWidget);

/**
 * @route DELETE /api/widgets/:id
 * @desc Delete a widget
 * @access Private
 */
router.delete("/:id", authenticateJWT, WidgetController.deleteWidget);

/**
 * @route PUT /api/widgets/:id/status
 * @desc Update widget status
 * @access Private
 */
router.put("/:id/status", authenticateJWT, WidgetController.updateWidgetStatus);

/**
 * @route GET /api/widgets/:id/embed-code
 * @desc Get widget embed code
 * @access Private
 */
router.get(
  "/:id/embed-code",
  authenticateJWT,
  WidgetController.getWidgetEmbedCode,
);

export default router;
