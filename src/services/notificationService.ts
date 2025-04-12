/**
 * Notification Service
 *
 * This service handles notifications using the API layer
 * instead of direct database access.
 */

import logger from "@/utils/logger";
import { notificationApi, Notification } from "./api/features/notification";

const notificationService = {
  /**
   * Get notifications for a user
   */
  getUserNotifications: async (
    userId: string,
    limit: number = 5,
    includeRead: boolean = false
  ): Promise<Notification[]> => {
    try {
      const response = await notificationApi.getUserNotifications(
        userId,
        limit,
        includeRead
      );

      if (!response.success) {
        throw new Error(
          response.error?.message || "Failed to fetch user notifications"
        );
      }

      return response.data || [];
    } catch (error) {
      logger.error("Error getting user notifications:", error);
      return [];
    }
  },

  /**
   * Mark notifications as read
   */
  markNotificationsAsRead: async (notificationIds: string[]): Promise<boolean> => {
    try {
      if (notificationIds.length === 0) return true;

      const response = await notificationApi.markNotificationsAsRead(notificationIds);

      if (!response.success) {
        throw new Error(
          response.error?.message || "Failed to mark notifications as read"
        );
      }

      return true;
    } catch (error) {
      logger.error("Error marking notifications as read:", error);
      return false;
    }
  },

  /**
   * Get a notification by ID