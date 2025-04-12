/**
 * Moderation API Service
 *
 * This service provides methods for interacting with moderation endpoints.
 * This service has been refactored to remove direct database access and use the API layer.
 */

import { api, ApiResponse } from "../middleware/apiMiddleware";
import { moderationEndpoints } from "../endpoints";

export interface ModerationResult {
  isAllowed: boolean;
  flagged: boolean;
  modifiedContent?: string;
  reason?: string;
  score?: number;
  categories?: Record<string, number>;
}

export interface ModerationRule {
  id: string;
  name: string;
  description?: string;
  type: "keyword" | "regex" | "ai";
  pattern: string;
  action: "block" | "flag" | "modify";
  replacement?: string;
  severity: "low" | "medium" | "high";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ModerationEvent {
  id: string;
  userId: string;
  content: string;
  ruleId: string;
  action: string;
  severity: string;
  createdAt: string;
}

export const moderationApi = {
  /**
   * Check content against moderation rules
   */
  checkContent: async (
    content: string,
    userId: string,
  ): Promise<ApiResponse<ModerationResult>> => {
    return api.post<ModerationResult>(moderationEndpoints.checkContent, {
      content,
      userId,
    });
  },

  /**
   * Check if a user is banned
   */
  isUserBanned: async (userId: string): Promise<ApiResponse<boolean>> => {
    return api.get<boolean>(moderationEndpoints.isUserBanned(userId));
  },

  /**
   * Ban a user
   */
  banUser: async (
    userId: string,
    reason: string,
    expiresAt?: string,
    adminId?: string,
  ): Promise<ApiResponse<boolean>> => {
    return api.post<boolean>(moderationEndpoints.banUser(userId), {
      reason,
      expiresAt,
      adminId,
    });
  },

  /**
   * Unban a user
   */
  unbanUser: async (
    userId: string,
    adminId?: string,
  ): Promise<ApiResponse<boolean>> => {
    return api.post<boolean>(moderationEndpoints.unbanUser(userId), {
      adminId,
    });
  },

  /**
   * Get all moderation rules
   */
  getModerationRules: async (
    activeOnly: boolean = true,
  ): Promise<ApiResponse<ModerationRule[]>> => {
    return api.get<ModerationRule[]>(moderationEndpoints.getRules, {
      params: { activeOnly },
    });
  },

  /**
   * Create a new moderation rule
   */
  createModerationRule: async (
    rule: Omit<ModerationRule, "id" | "createdAt" | "updatedAt">,
  ): Promise<ApiResponse<ModerationRule>> => {
    return api.post<ModerationRule>(moderationEndpoints.createRule, rule);
  },

  /**
   * Update a moderation rule
   */
  updateModerationRule: async (
    id: string,
    updates: Partial<Omit<ModerationRule, "id" | "createdAt" | "updatedAt">>,
  ): Promise<ApiResponse<ModerationRule>> => {
    return api.put<ModerationRule>(moderationEndpoints.updateRule(id), updates);
  },

  /**
   * Delete a moderation rule
   */
  deleteModerationRule: async (id: string): Promise<ApiResponse<boolean>> => {
    return api.delete<boolean>(moderationEndpoints.deleteRule(id));
  },

  /**
   * Get moderation events
   */
  getModerationEvents: async (
    limit: number = 50,
    offset: number = 0,
  ): Promise<
    ApiResponse<{ events: ModerationEvent[]; totalCount: number }>
  > => {
    return api.get<{ events: ModerationEvent[]; totalCount: number }>(
      moderationEndpoints.getEvents,
      {
        params: { limit, offset },
      },
    );
  },
};
