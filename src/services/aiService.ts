import logger from "@/utils/logger";
import { api } from "./api/middleware/apiMiddleware";
import { AIModelRequest, AIModelResponse } from "./ai/types";

interface AIInteractionLogsParams {
  page: number;
  pageSize: number;
  query?: string;
  modelUsed?: string;
  contextRuleId?: string;
  startDate?: string;
  endDate?: string;
}

interface GenerateResponseOptions {
  query: string;
  contextRuleId?: string;
  userId: string;
  knowledgeBaseIds?: string[];
  promptTemplate?: string;
  systemPrompt?: string;
  preferredModel?: string;
  maxTokens?: number;
  temperature?: number;
  additionalParams?: Record<string, any>;
}

interface ModelPerformanceParams {
  timeRange?: string;
  startDate?: string;
  endDate?: string;
}

const aiService = {
  /**
   * Generate a response using AI models
   */
  generateResponse: async (
    options: GenerateResponseOptions,
  ): Promise<AIModelResponse> => {
    try {
      // Convert options to AIModelRequest format
      const modelRequest: AIModelRequest = {
        query: options.query,
        contextRuleId: options.contextRuleId,
        userId: options.userId,
        knowledgeBaseIds: options.knowledgeBaseIds,
        promptTemplate: options.promptTemplate,
        systemPrompt: options.systemPrompt,
        preferredModel: options.preferredModel,
        maxTokens: options.maxTokens,
        temperature: options.temperature,
        additionalParams: options.additionalParams,
      };

      // Use the API to generate a response
      const response = await api.post<AIModelResponse>(
        "/ai/generate",
        modelRequest,
      );

      if (!response.success || !response.data) {
        throw new Error(
          response.error?.message || "Failed to generate AI response",
        );
      }

      // Log the interaction
      await aiService.logInteraction({
        userId: options.userId,
        query: options.query,
        response: response.data.content,
        modelUsed: response.data.modelUsed,
        contextRuleId: options.contextRuleId,
        knowledgeBaseResults: response.data.knowledgeBaseResults || 0,
        knowledgeBaseIds: response.data.knowledgeBaseIds || [],
        metadata: response.data.metadata,
      });

      return response.data;
    } catch (error) {
      logger.error("Error generating AI response:", error);

      // Return a fallback response
      const fallbackResponse = {
        content:
          "I'm sorry, I encountered an error processing your request. Please try again later.",
        modelUsed: "fallback-model",
      };

      // Try to log the error
      try {
        await aiService.logInteraction({
          userId: options.userId,
          query: options.query,
          response: fallbackResponse.content,
          modelUsed: fallbackResponse.modelUsed,
          contextRuleId: options.contextRuleId,
          metadata: {
            error: error instanceof Error ? error.message : String(error),
          },
        });
      } catch (logError) {
        logger.error("Failed to log AI interaction error:", logError);
      }

      return fallbackResponse;
    }
  },

  /**
   * Log an AI interaction to the database
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
  }) => {
    try {
      const response = await api.post<{ id: string }>("/ai/logs", data);

      if (!response.success) {
        logger.error("Error logging AI interaction:", response.error);
        return false;
      }

      return true;
    } catch (error) {
      logger.error("Error logging AI interaction:", error);
      return false;
    }
  },

  /**
   * Get AI interaction logs with pagination and filtering
   */
  getInteractionLogs: async (params: AIInteractionLogsParams) => {
    try {
      const response = await api.get<{
        logs: any[];
        totalItems: number;
        totalPages: number;
        currentPage: number;
      }>("/ai/logs", { params });

      if (!response.success) {
        throw new Error(
          response.error?.message || "Failed to fetch AI interaction logs",
        );
      }

      return (
        response.data || {
          logs: [],
          totalItems: 0,
          totalPages: 0,
          currentPage: params.page,
        }
      );
    } catch (error) {
      logger.error("Error getting AI interaction logs:", error);
      return {
        logs: [],
        totalItems: 0,
        totalPages: 0,
        currentPage: params.page,
      };
    }
  },

  /**
   * Get available AI models
   */
  getAvailableModels: async () => {
    try {
      const response = await api.get<
        Array<{
          id: string;
          name: string;
          provider: string;
        }>
      >("/ai/models");

      if (!response.success) {
        throw new Error(
          response.error?.message || "Failed to fetch available AI models",
        );
      }

      return response.data || [];
    } catch (error) {
      logger.error("Error getting available AI models:", error);
      return [];
    }
  },

  /**
   * Set the default AI model
   */
  setDefaultModel: async (modelId: string) => {
    try {
      const response = await api.post<boolean>("/ai/models/default", {
        modelId,
      });

      if (!response.success) {
        throw new Error(
          response.error?.message || "Failed to set default AI model",
        );
      }

      return true;
    } catch (error) {
      logger.error("Error setting default AI model:", error);
      return false;
    }
  },

  /**
   * Get the default AI model
   */
  getDefaultModel: async () => {
    try {
      const response = await api.get<{
        id: string;
        name: string;
        provider: string;
      }>("/ai/models/default");

      if (!response.success) {
        throw new Error(
          response.error?.message || "Failed to get default AI model",
        );
      }

      return response.data || null;
    } catch (error) {
      logger.error("Error getting default AI model:", error);
      return null;
    }
  },

  /**
   * Get AI model performance metrics
   */
  getModelPerformance: async (params: ModelPerformanceParams = {}) => {
    try {
      const response = await api.get<{
        modelUsage: any[];
        avgResponseTimes: any[];
        dailyUsage: any[];
        timeRange: string;
      }>("/ai/performance", { params });

      if (!response.success) {
        throw new Error(
          response.error?.message ||
            "Failed to fetch AI model performance metrics",
        );
      }

      return (
        response.data || {
          modelUsage: [],
          avgResponseTimes: [],
          dailyUsage: [],
          timeRange: params.timeRange || "7d",
        }
      );
    } catch (error) {
      logger.error("Error getting AI model performance metrics:", error);
      return {
        modelUsage: [],
        avgResponseTimes: [],
        dailyUsage: [],
        timeRange: params.timeRange || "7d",
      };
    }
  },
};

// Add default export
export default aiService;

// Also keep named exports if needed
export { aiService };
