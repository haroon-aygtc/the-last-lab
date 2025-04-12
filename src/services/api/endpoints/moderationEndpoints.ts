/**
 * Moderation API Endpoints
 *
 * Defines the API endpoints for moderation operations
 */

export const moderationEndpoints = {
  // Content moderation
  checkContent: "/moderation/check",

  // User ban management
  isUserBanned: (userId: string) => `/moderation/users/${userId}/banned`,
  banUser: (userId: string) => `/moderation/users/${userId}/ban`,
  unbanUser: (userId: string) => `/moderation/users/${userId}/unban`,

  // Moderation rules management
  getRules: "/moderation/rules",
  getRule: (id: string) => `/moderation/rules/${id}`,
  createRule: "/moderation/rules",
  updateRule: (id: string) => `/moderation/rules/${id}`,
  deleteRule: (id: string) => `/moderation/rules/${id}`,

  // Moderation events
  getEvents: "/moderation/events",
};
