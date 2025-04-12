/**
 * Knowledge Base API Service
 *
 * This service provides methods for interacting with knowledge base endpoints.
 */

import { api, ApiResponse } from "../middleware/apiMiddleware";
import {
  QueryResult,
  KnowledgeBaseConfig,
  KnowledgeBaseQueryRequest,
  KnowledgeBaseQueryLog,
} from "@/types/knowledgeBase";

export interface KnowledgeBaseAnalytics {
  totalQueries: number;
  queriesOverTime: Array<{ date: string; count: number }>;
  topQueries: Array<{ query: string; count: number }>;
  averageResultsPerQuery: number;
  knowledgeBaseUsage: Array<{ id: string; name: string; queries: number }>;
  userActivity: Array<{ userId: string; queries: number }>;
}

export interface KnowledgeBaseContextRule {
  id: string;
  name: string;
  description?: string;
  knowledgeBaseIds: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const knowledgeBaseApi = {
  /**
   * Get all knowledge base configurations
   */
  getAllConfigs: async (): Promise<ApiResponse<KnowledgeBaseConfig[]>> => {
    return api.get<KnowledgeBaseConfig[]>("/knowledge-base/configs");
  },

  /**
   * Get a knowledge base configuration by ID
   */
  getConfigById: async (
    id: string,
  ): Promise<ApiResponse<KnowledgeBaseConfig>> => {
    return api.get<KnowledgeBaseConfig>(`/knowledge-base/configs/${id}`);
  },

  /**
   * Create a new knowledge base configuration
   */
  createConfig: async (
    config: Omit<KnowledgeBaseConfig, "id" | "createdAt" | "updatedAt">,
  ): Promise<ApiResponse<KnowledgeBaseConfig>> => {
    return api.post<KnowledgeBaseConfig>("/knowledge-base/configs", config);
  },

  /**
   * Update a knowledge base configuration
   */
  updateConfig: async (
    id: string,
    config: Partial<KnowledgeBaseConfig>,
  ): Promise<ApiResponse<KnowledgeBaseConfig>> => {
    return api.put<KnowledgeBaseConfig>(
      `/knowledge-base/configs/${id}`,
      config,
    );
  },

  /**
   * Delete a knowledge base configuration
   */
  deleteConfig: async (id: string): Promise<ApiResponse<boolean>> => {
    return api.delete<boolean>(`/knowledge-base/configs/${id}`);
  },

  /**
   * Query knowledge bases
   */
  query: async (
    params: KnowledgeBaseQueryRequest,
  ): Promise<ApiResponse<QueryResult[]>> => {
    return api.post<QueryResult[]>("/knowledge-base/query", params);
  },

  /**
   * Sync a knowledge base to update its content
   */
  syncKnowledgeBase: async (id: string): Promise<ApiResponse<boolean>> => {
    return api.post<boolean>(`/knowledge-base/configs/${id}/sync`);
  },

  /**
   * Log a knowledge base query for analytics
   */
  logQuery: async (params: {
    userId: string;
    query: string;
    contextRuleId?: string;
    knowledgeBaseIds: string[];
    results: number;
  }): Promise<ApiResponse<{ id: string }>> => {
    return api.post<{ id: string }>("/knowledge-base/logs", params);
  },

  /**
   * Get knowledge base query logs
   */
  getQueryLogs: async (
    params: {
      page?: number;
      limit?: number;
      userId?: string;
      contextRuleId?: string;
      startDate?: string;
      endDate?: string;
    } = {},
  ): Promise<
    ApiResponse<{ logs: KnowledgeBaseQueryLog[]; totalCount: number }>
  > => {
    return api.get<{ logs: KnowledgeBaseQueryLog[]; totalCount: number }>(
      "/knowledge-base/logs",
      { params },
    );
  },

  /**
   * Get knowledge base analytics
   */
  getAnalytics: async (
    timeRange: string = "7d",
  ): Promise<ApiResponse<KnowledgeBaseAnalytics>> => {
    return api.get<KnowledgeBaseAnalytics>("/knowledge-base/analytics", {
      params: { timeRange },
    });
  },

  /**
   * Get all context rules
   */
  getAllContextRules: async (): Promise<
    ApiResponse<KnowledgeBaseContextRule[]>
  > => {
    return api.get<KnowledgeBaseContextRule[]>("/knowledge-base/context-rules");
  },

  /**
   * Get a context rule by ID
   */
  getContextRuleById: async (
    id: string,
  ): Promise<ApiResponse<KnowledgeBaseContextRule>> => {
    return api.get<KnowledgeBaseContextRule>(
      `/knowledge-base/context-rules/${id}`,
    );
  },

  /**
   * Create a new context rule
   */
  createContextRule: async (
    rule: Omit<KnowledgeBaseContextRule, "id" | "createdAt" | "updatedAt">,
  ): Promise<ApiResponse<KnowledgeBaseContextRule>> => {
    return api.post<KnowledgeBaseContextRule>(
      "/knowledge-base/context-rules",
      rule,
    );
  },

  /**
   * Update a context rule
   */
  updateContextRule: async (
    id: string,
    rule: Partial<KnowledgeBaseContextRule>,
  ): Promise<ApiResponse<KnowledgeBaseContextRule>> => {
    return api.put<KnowledgeBaseContextRule>(
      `/knowledge-base/context-rules/${id}`,
      rule,
    );
  },

  /**
   * Delete a context rule
   */
  deleteContextRule: async (id: string): Promise<ApiResponse<boolean>> => {
    return api.delete<boolean>(`/knowledge-base/context-rules/${id}`);
  },

  /**
   * Test a knowledge base connection
   */
  testConnection: async (
    config: Partial<KnowledgeBaseConfig>,
  ): Promise<
    ApiResponse<{
      success: boolean;
      message: string;
      details?: any;
    }>
  > => {
    return api.post<{
      success: boolean;
      message: string;
      details?: any;
    }>("/knowledge-base/test-connection", config);
  },

  /**
   * Get knowledge base schema
   */
  getSchema: async (
    id: string,
  ): Promise<
    ApiResponse<{
      fields: Array<{ name: string; type: string; description?: string }>;
      tables?: Array<{
        name: string;
        fields: Array<{ name: string; type: string }>;
      }>;
    }>
  > => {
    return api.get<{
      fields: Array<{ name: string; type: string; description?: string }>;
      tables?: Array<{
        name: string;
        fields: Array<{ name: string; type: string }>;
      }>;
    }>(`/knowledge-base/configs/${id}/schema`);
  },
};
