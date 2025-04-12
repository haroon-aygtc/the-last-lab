/**
 * AI API Service
 *
 * This service provides methods for interacting with AI endpoints.
 */

import { api, ApiResponse } from "../middleware/apiMiddleware";

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  description?: string;
  maxTokens: number;
  isAvailable: boolean;
}

export interface GenerateRequest {
  query: string;
  contextRuleId?: string;
  promptTemplateId?: string;
  userId: string;
  knowledgeBaseIds?: string[];
  preferredModel?: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  additionalParams?: Record<string, any>;
}

export interface GenerateResponse {
  content: string;
  modelUsed: string;
  metadata?: Record<string, any>;
  knowledgeBaseResults?: number;
  knowledgeBaseIds?: string[];
}

export interface AIInteractionLog {
  id: string;
  userId: string;
  query: string;
  response: string;
  modelUsed: string;
  contextRuleId?: string;
  contextRule?: {
    name: string;
  };
  knowledgeBaseResults?: number;
  knowledgeBaseIds?: string[];
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface LogQueryParams {
  page?: number;
  pageSize?: number;
  userId?: string;
  modelUsed?: string;
  contextRuleId?: string;
  startDate?: string;
  endDate?: string;
  query?: string;
}

export interface LogsResponse {
  logs: AIInteractionLog[];
  totalPages: number;
  currentPage: number;
  totalItems: number;
}

export interface PerformanceMetrics {
  modelUsage: Array<{ model: string; count: number }>;
  avgResponseTimes: Array<{ model: string; avgTime: number }>;
  dailyUsage: Array<{ date: string; count: number }>;
  timeRange: string;
}

export const aiApi = {
  /**
   * Generate a response using AI
   */
  generate: async (
    request: GenerateRequest,
  ): Promise<ApiResponse<GenerateResponse>> => {
    return api.post<GenerateResponse>("/ai/generate", request);
  },

  /**
   * Generate a response using AI with streaming
   * This returns a ReadableStream for processing chunks
   */
  generateStream: async (
    request: GenerateRequest,
  ): Promise<ReadableStream<Uint8Array>> => {
    const response = await fetch(`${api.getBaseUrl()}/ai/generate/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Stream request failed: ${response.status}`);
    }

    return response.body as ReadableStream<Uint8Array>;
  },

  /**
   * Get available AI models
   */
  getModels: async (): Promise<ApiResponse<AIModel[]>> => {
    return api.get<AIModel[]>("/ai/models");
  },

  /**
   * Get a specific AI model by ID
   */
  getModelById: async (id: string): Promise<ApiResponse<AIModel>> => {
    return api.get<AIModel>(`/ai/models/${id}`);
  },

  /**
   * Set the default AI model
   */
  setDefaultModel: async (
    modelId: string,
  ): Promise<ApiResponse<{ success: boolean }>> => {
    return api.post<{ success: boolean }>("/ai/models/default", { modelId });
  },

  /**
   * Get the default AI model
   */
  getDefaultModel: async (): Promise<ApiResponse<AIModel>> => {
    return api.get<AIModel>("/ai/models/default");
  },

  /**
   * Get AI interaction logs
   */
  getLogs: async (
    params: LogQueryParams = {},
  ): Promise<ApiResponse<LogsResponse>> => {
    return api.get<LogsResponse>("/ai/logs", { params });
  },

  /**
   * Get a specific AI interaction log
   */
  getLogById: async (id: string): Promise<ApiResponse<AIInteractionLog>> => {
    return api.get<AIInteractionLog>(`/ai/logs/${id}`);
  },

  /**
   * Log an AI interaction
   */
  logInteraction: async (data: {
    userId: string;
    query: string;
    response: string;
    modelUsed: string;
    contextRuleId?: string;
    knowledgeBaseResults?: number;
    knowledgeBaseIds?: string[];
    metadata?: Record<string, any>;
  }): Promise<ApiResponse<{ id: string }>> => {
    return api.post<{ id: string }>("/ai/logs", data);
  },

  /**
   * Get AI performance metrics
   */
  getPerformance: async (
    timeRange: string = "7d",
  ): Promise<ApiResponse<PerformanceMetrics>> => {
    return api.get<PerformanceMetrics>("/ai/performance", {
      params: { timeRange },
    });
  },

  /**
   * Get AI response cache
   */
  getCache: async (): Promise<ApiResponse<any[]>> => {
    return api.get<any[]>("/ai/cache");
  },

  /**
   * Get a specific AI cache item
   */
  getCacheItem: async (id: string): Promise<ApiResponse<any>> => {
    return api.get<any>(`/ai/cache/${id}`);
  },

  /**
   * Clear the AI response cache
   */
  clearCache: async (): Promise<ApiResponse<{ success: boolean }>> => {
    return api.post<{ success: boolean }>("/ai/cache/clear");
  },

  /**
   * Get prompt templates
   */
  getPromptTemplates: async (): Promise<ApiResponse<any[]>> => {
    return api.get<any[]>("/ai/prompt-templates");
  },

  /**
   * Get a specific prompt template
   */
  getPromptTemplateById: async (id: string): Promise<ApiResponse<any>> => {
    return api.get<any>(`/ai/prompt-templates/${id}`);
  },

  /**
   * Create a prompt template
   */
  createPromptTemplate: async (data: any): Promise<ApiResponse<any>> => {
    return api.post<any>("/ai/prompt-templates", data);
  },

  /**
   * Update a prompt template
   */
  updatePromptTemplate: async (
    id: string,
    data: any,
  ): Promise<ApiResponse<any>> => {
    return api.put<any>(`/ai/prompt-templates/${id}`, data);
  },

  /**
   * Delete a prompt template
   */
  deletePromptTemplate: async (id: string): Promise<ApiResponse<boolean>> => {
    return api.delete<boolean>(`/ai/prompt-templates/${id}`);
  },
};
