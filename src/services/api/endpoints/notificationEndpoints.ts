/**
 * Notification API Endpoints
 *
 * Defines the API endpoints for notification operations
 */

export const notificationEndpoints = {
  // Get user notifications
  getUserNotifications: (userId: string) => `/notifications/user/${userId}`,

  // Mark notifications as read
  markAsRead: "/notifications/mark-read",

  // Get notification by ID
  getNotification: (id: string) => `/notifications/${id}`,

  // Create notification
  createNotification: "/notifications",

  // Delete notification
  deleteNotification: (id: string) => `/notifications/${id}`,
};
