import { api, ApiResponse } from "../middleware/apiMiddleware";

export interface UserActivity {
  id: string;
  userId: string;
  action: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface UserSession {
  id: string;
  userId: string;
  deviceInfo: {
    type: string;
    name: string;
    browser: string;
    os: string;
  };
  ipAddress?: string;
  location?: string;
  lastActiveAt: string;
  createdAt: string;
  isActive: boolean;
}

export interface UserActivityResponse {
  activities: UserActivity[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export const userActivityApi = {
  /**
   * Log a user activity
   */
  logActivity: async (
    activity: Omit<UserActivity, "id" | "createdAt">,
  ): Promise<ApiResponse<{ id: string }>> => {
    return api.post<{ id: string }>("/users/activity", activity);
  },

  /**
   * Get user activity history
   */
  getUserActivity: async (
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<ApiResponse<UserActivityResponse>> => {
    return api.get<UserActivityResponse>(`/users/${userId}/activity`, {
      params: { page, limit },
    });
  },

  /**
   * Create or update a user session
   */
  updateSession: async (
    session: Omit<UserSession, "id" | "createdAt">,
  ): Promise<ApiResponse<{ id: string }>> => {
    return api.post<{ id: string }>("/users/sessions", session);
  },

  /**
   * Get active user sessions
   */
  getUserSessions: async (
    userId: string,
  ): Promise<ApiResponse<UserSession[]>> => {
    return api.get<UserSession[]>(`/users/${userId}/sessions`);
  },

  /**
   * Terminate a specific user session
   */
  terminateSession: async (
    sessionId: string,
  ): Promise<ApiResponse<{ success: boolean }>> => {
    return api.delete<{ success: boolean }>(`/users/sessions/${sessionId}`);
  },

  /**
   * Terminate all user sessions except the current one
   */
  terminateAllSessions: async (
    userId: string,
    exceptSessionId?: string,
  ): Promise<ApiResponse<{ success: boolean }>> => {
    return api.delete<{ success: boolean }>(`/users/${userId}/sessions`, {
      params: { exceptSessionId },
    });
  },
};
