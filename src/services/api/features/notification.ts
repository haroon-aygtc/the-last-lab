/**
 * Notification API Service
 *
 * This service provides methods for interacting with notification endpoints.
 */

import { api, ApiResponse } from "../middleware/apiMiddleware";

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  metadata?: Record<string, any>;
  createdAt: string;
}

export const notificationApi = {
  /**
   * Get notifications for a user
   */
  getUserNotifications: async (
    userId: string,
    limit: number = 5,
    includeRead: boolean = false,
  ): Promise<ApiResponse<Notification[]>> => {
    return api.get<Notification[]>(`/notifications/user/${userId}`, {
      params: { limit, read: includeRead },
    });
  },

  /**
   * Mark notifications as read
   */
  markNotificationsAsRead: async (
    notificationIds: string[],
  ): Promise<ApiResponse<boolean>> => {
    return api.put<boolean>("/notifications/mark-read", { notificationIds });
  },

  /**
   * Get a notification by ID
   */
  getNotification: async (id: string): Promise<ApiResponse<Notification>> => {
    return api.get<Notification>(`/notifications/${id}`);
  },

  /**
   * Create a notification
   */
  createNotification: async (
    notification: Omit<Notification, "id" | "createdAt" | "isRead">,
  ): Promise<ApiResponse<Notification>> => {
    return api.post<Notification>("/notifications", notification);
  },

  /**
   * Delete a notification
   */
  deleteNotification: async (id: string): Promise<ApiResponse<boolean>> => {
    return api.delete<boolean>(`/notifications/${id}`);
  },
};
