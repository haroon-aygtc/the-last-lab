/**
 * Notification Routes
 *
 * This module defines the API routes for notifications.
 */

import express from "express";
import { checkAuth } from "../middleware/auth.js";
import {
  getUserNotifications,
  getNotification,
  createNotification,
  markNotificationsAsRead,
  deleteNotification,
} from "../../controllers/notificationController.js";

const router = express.Router();

// Get notifications for a user
router.get("/user/:userId", getUserNotifications);

// Get a specific notification
router.get("/:id", getNotification);

// Create a notification
router.post("/", checkAuth(["admin"]), createNotification);

// Mark notifications as read
router.put("/mark-read", markNotificationsAsRead);

// Delete a notification
router.delete("/:id", checkAuth(["admin"]), deleteNotification);

export default router;
