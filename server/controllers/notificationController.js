/**
 * Notification Controller
 *
 * This module provides controller functions for notifications.
 */

import { getMySQLClient, QueryTypes } from "../utils/dbHelpers.js";
import { v4 as uuidv4 } from "uuid";
import { formatResponse } from "../utils/responseFormatter.js";

/**
 * Get notifications for a user
 */
export const getUserNotifications = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 5, read = false } = req.query;

    if (!userId) {
      return res.status(400).json(
        formatResponse(null, {
          message: "User ID is required",
          code: "ERR_400",
        }),
      );
    }

    const sequelize = await getMySQLClient();
    let query = `
      SELECT * FROM notifications 
      WHERE user_id = ? 
    `;

    const replacements = [userId];

    // Only include unread notifications if read is false
    if (read === "false") {
      query += " AND is_read = ? ";
      replacements.push(false);
    }

    query += " ORDER BY created_at DESC LIMIT ?";
    replacements.push(parseInt(limit));

    const notifications = await sequelize.query(query, {
      replacements,
      type: QueryTypes.SELECT,
    });

    // Transform to camelCase
    const formattedNotifications = notifications.map((notification) => ({
      id: notification.id,
      userId: notification.user_id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      isRead: notification.is_read,
      metadata: notification.metadata
        ? JSON.parse(notification.metadata)
        : null,
      createdAt: notification.created_at,
    }));

    return res.json(formatResponse(formattedNotifications));
  } catch (error) {
    console.error("Error getting user notifications", error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};

/**
 * Get a specific notification
 */
export const getNotification = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json(
        formatResponse(null, {
          message: "Notification ID is required",
          code: "ERR_400",
        }),
      );
    }

    const sequelize = await getMySQLClient();
    const [notification] = await sequelize.query(
      "SELECT * FROM notifications WHERE id = ?",
      {
        replacements: [id],
        type: QueryTypes.SELECT,
      },
    );

    if (!notification) {
      return res.status(404).json(
        formatResponse(null, {
          message: "Notification not found",
          code: "ERR_404",
        }),
      );
    }

    // Transform to camelCase
    const formattedNotification = {
      id: notification.id,
      userId: notification.user_id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      isRead: notification.is_read,
      metadata: notification.metadata
        ? JSON.parse(notification.metadata)
        : null,
      createdAt: notification.created_at,
    };

    return res.json(formatResponse(formattedNotification));
  } catch (error) {
    console.error("Error getting notification", error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};

/**
 * Create a notification
 */
export const createNotification = async (req, res) => {
  try {
    const { userId, title, message, type, metadata } = req.body;

    if (!userId || !title || !message || !type) {
      return res.status(400).json(
        formatResponse(null, {
          message: "User ID, title, message, and type are required",
          code: "ERR_400",
        }),
      );
    }

    const sequelize = await getMySQLClient();
    const id = uuidv4();
    const now = new Date().toISOString();

    await sequelize.query(
      `INSERT INTO notifications 
       (id, user_id, title, message, type, is_read, metadata, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      {
        replacements: [
          id,
          userId,
          title,
          message,
          type,
          false,
          metadata ? JSON.stringify(metadata) : null,
          now,
        ],
        type: QueryTypes.INSERT,
      },
    );

    // Fetch the newly created notification
    const [notification] = await sequelize.query(
      "SELECT * FROM notifications WHERE id = ?",
      {
        replacements: [id],
        type: QueryTypes.SELECT,
      },
    );

    // Transform to camelCase
    const formattedNotification = {
      id: notification.id,
      userId: notification.user_id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      isRead: notification.is_read,
      metadata: notification.metadata
        ? JSON.parse(notification.metadata)
        : null,
      createdAt: notification.created_at,
    };

    return res.json(formatResponse(formattedNotification));
  } catch (error) {
    console.error("Error creating notification", error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};

/**
 * Mark notifications as read
 */
export const markNotificationsAsRead = async (req, res) => {
  try {
    const { notificationIds } = req.body;

    if (
      !notificationIds ||
      !Array.isArray(notificationIds) ||
      notificationIds.length === 0
    ) {
      return res.status(400).json(
        formatResponse(null, {
          message: "Notification IDs array is required",
          code: "ERR_400",
        }),
      );
    }

    const sequelize = await getMySQLClient();
    await sequelize.query(
      "UPDATE notifications SET is_read = true WHERE id IN (?)",
      {
        replacements: [notificationIds],
        type: QueryTypes.UPDATE,
      },
    );

    return res.json(formatResponse(true));
  } catch (error) {
    console.error("Error marking notifications as read", error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};

/**
 * Delete a notification
 */
export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json(
        formatResponse(null, {
          message: "Notification ID is required",
          code: "ERR_400",
        }),
      );
    }

    const sequelize = await getMySQLClient();
    await sequelize.query("DELETE FROM notifications WHERE id = ?", {
      replacements: [id],
      type: QueryTypes.DELETE,
    });

    return res.json(formatResponse(true));
  } catch (error) {
    console.error("Error deleting notification", error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};
