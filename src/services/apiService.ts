import axios from "axios";
import { env } from "@/config/env";
import logger from "@/utils/logger";
import {
  ContextRule,
  ContextRuleCreateInput,
  ContextRuleUpdateInput,
  ContextRuleTestResult,
} from "@/types/contextRules";
import { PromptTemplate } from "@/types/promptTemplates";
import { v4 as uuidv4 } from "uuid";
import { getMySQLClient } from "./mysqlClient";
import { QueryTypes } from "./mysqlClient";

// Create axios instance with base URL
const api = axios.create({
  baseURL: `/api`,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add request interceptor for authentication
api.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    const token = localStorage.getItem("authToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 Unauthorized errors
    if (error.response && error.response.status === 401) {
      // Clear token and redirect to login
      localStorage.removeItem("authToken");
      window.location.href = "/auth/login";
    }
    return Promise.reject(error);
  },
);

// Context Rules API
export const contextRulesApi = {
  getAll: async (): Promise<ContextRule[]> => {
    try {
      const response = await api.get("/context-rules");
      return response.data;
    } catch (error) {
      logger.error(
        "Error fetching context rules",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  },

  getById: async (id: string): Promise<ContextRule> => {
    try {
      const response = await api.get(`/context-rules/${id}`);
      return response.data;
    } catch (error) {
      logger.error(
        `Error fetching context rule ${id}`,
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  },

  create: async (rule: ContextRuleCreateInput): Promise<ContextRule> => {
    try {
      const response = await api.post("/context-rules", rule);
      return response.data;
    } catch (error) {
      logger.error(
        "Error creating context rule",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  },

  update: async (
    id: string,
    rule: ContextRuleUpdateInput,
  ): Promise<ContextRule> => {
    try {
      const response = await api.put(`/context-rules/${id}`, rule);
      return response.data;
    } catch (error) {
      logger.error(
        `Error updating context rule ${id}`,
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  },

  delete: async (id: string): Promise<boolean> => {
    try {
      await api.delete(`/context-rules/${id}`);
      return true;
    } catch (error) {
      logger.error(
        `Error deleting context rule ${id}`,
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  },

  testRule: async (
    ruleId: string,
    query: string,
  ): Promise<ContextRuleTestResult> => {
    try {
      const response = await api.post(`/context-rules/${ruleId}/test`, {
        query,
      });
      return response.data;
    } catch (error) {
      logger.error(
        `Error testing context rule ${ruleId}`,
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  },
};

// Chat API
export const chatApi = {
  sendMessage: async (message: string, contextRuleId?: string) => {
    try {
      const response = await api.post("/chat/message", {
        message,
        contextRuleId,
      });
      return response.data;
    } catch (error) {
      logger.error(
        "Error sending chat message",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  },

  getHistory: async () => {
    try {
      const response = await api.get("/chat/history");
      return response.data;
    } catch (error) {
      logger.error(
        "Error fetching chat history",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  },

  // Delete chat history
  deleteChatHistory: async () => {
    try {
      await api.delete("/chat/history");
      return { success: true };
    } catch (error) {
      logger.error(
        "Error deleting chat history",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  },

  // Get chat history for a specific context
  getContextHistory: async (contextRuleId: string) => {
    try {
      const response = await api.get(`/chat/history/${contextRuleId}`);
      return response.data;
    } catch (error) {
      logger.error(
        `Error fetching chat history for context ${contextRuleId}`,
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  },
};

// Widget Configuration API
export const widgetConfigApi = {
  getAll: async () => {
    try {
      const response = await api.get("/widget-configs");
      return response.data;
    } catch (error) {
      logger.error(
        "Error fetching widget configurations",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  },

  getByUserId: async (userId: string) => {
    try {
      const response = await api.get(`/widget-configs/user/${userId}`);
      return response.data;
    } catch (error) {
      logger.error(
        `Error fetching widget configuration for user ${userId}`,
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  },

  getById: async (id: string) => {
    try {
      const response = await api.get(`/widget-configs/${id}`);
      return response.data;
    } catch (error) {
      logger.error(
        `Error fetching widget configuration with id ${id}`,
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  },

  create: async (config: any) => {
    try {
      const response = await api.post("/widget-configs", config);
      return response.data;
    } catch (error) {
      logger.error(
        "Error creating widget configuration",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  },

  update: async (id: string, config: any) => {
    try {
      const response = await api.put(`/widget-configs/${id}`, config);
      return response.data;
    } catch (error) {
      logger.error(
        `Error updating widget configuration with id ${id}`,
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  },

  delete: async (id: string) => {
    try {
      await api.delete(`/widget-configs/${id}`);
      return true;
    } catch (error) {
      logger.error(
        `Error deleting widget configuration with id ${id}`,
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  },
};

// System Settings API
export const systemSettingsApi = {
  getSettings: async (category: string, environment = "production") => {
    try {
      const response = await api.get(
        `/system-settings/${category}?environment=${environment}`,
      );
      return response.data;
    } catch (error) {
      logger.error(
        `Error fetching system settings for category ${category} and environment ${environment}`,
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  },

  saveSettings: async (
    category: string,
    settings: any,
    environment = "production",
  ) => {
    try {
      const response = await api.post(`/system-settings/${category}`, {
        settings,
        environment,
      });
      return response.data;
    } catch (error) {
      logger.error(
        `Error saving system settings for category ${category} and environment ${environment}`,
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  },
};

// Prompt Templates API
export const promptTemplatesApi = {
  getAll: async (): Promise<PromptTemplate[]> => {
    try {
      const response = await api.get("/prompt-templates");
      return response.data;
    } catch (error) {
      logger.error(
        "Error fetching prompt templates",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  },

  getById: async (id: string): Promise<PromptTemplate> => {
    try {
      const response = await api.get(`/prompt-templates/${id}`);
      return response.data;
    } catch (error) {
      logger.error(
        `Error fetching prompt template ${id}`,
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  },

  create: async (
    template: Partial<PromptTemplate>,
  ): Promise<PromptTemplate> => {
    try {
      const response = await api.post("/prompt-templates", template);
      return response.data;
    } catch (error) {
      logger.error(
        "Error creating prompt template",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  },

  update: async (
    id: string,
    template: Partial<PromptTemplate>,
  ): Promise<PromptTemplate> => {
    try {
      const response = await api.put(`/prompt-templates/${id}`, template);
      return response.data;
    } catch (error) {
      logger.error(
        `Error updating prompt template ${id}`,
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  },

  delete: async (id: string): Promise<boolean> => {
    try {
      await api.delete(`/prompt-templates/${id}`);
      return true;
    } catch (error) {
      logger.error(
        `Error deleting prompt template ${id}`,
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  },
};

export default {
  contextRulesApi,
  chatApi,
  widgetConfigApi,
  systemSettingsApi,
  promptTemplatesApi,
};
