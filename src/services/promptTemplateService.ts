import logger from "@/utils/logger";
import { api } from "./api/middleware/apiMiddleware";

export interface PromptTemplate {
  id: string;
  name: string;
  description?: string;
  template: string;
  systemPrompt?: string;
  variables?: string[];
  isDefault?: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const promptTemplateService = {
  /**
   * Get all prompt templates
   */
  getAllTemplates: async (): Promise<PromptTemplate[]> => {
    try {
      const response = await api.get<PromptTemplate[]>("/prompt-templates");

      if (!response.success) {
        throw new Error(
          response.error?.message || "Failed to fetch prompt templates",
        );
      }

      return response.data || [];
    } catch (error) {
      logger.error("Error fetching prompt templates:", error);
      throw new Error(`Failed to fetch prompt templates: ${error.message}`);
    }
  },

  /**
   * Get a prompt template by ID
   */
  getTemplateById: async (id: string): Promise<PromptTemplate | null> => {
    try {
      const response = await api.get<PromptTemplate>(`/prompt-templates/${id}`);

      if (!response.success) {
        if (response.error?.code === "ERR_404") {
          return null;
        }
        throw new Error(
          response.error?.message || "Failed to fetch prompt template",
        );
      }

      return response.data || null;
    } catch (error) {
      logger.error(`Error fetching prompt template ${id}:`, error);
      throw new Error(`Failed to fetch prompt template: ${error.message}`);
    }
  },

  /**
   * Create a new prompt template
   */
  createTemplate: async (
    template: Omit<PromptTemplate, "id" | "createdAt" | "updatedAt">,
  ): Promise<PromptTemplate> => {
    try {
      const response = await api.post<PromptTemplate>(
        "/prompt-templates",
        template,
      );

      if (!response.success || !response.data) {
        throw new Error(
          response.error?.message || "Failed to create prompt template",
        );
      }

      return response.data;
    } catch (error) {
      logger.error("Error creating prompt template:", error);
      throw new Error(`Failed to create prompt template: ${error.message}`);
    }
  },

  /**
   * Update a prompt template
   */
  updateTemplate: async (
    id: string,
    template: Partial<PromptTemplate>,
  ): Promise<PromptTemplate> => {
    try {
      const response = await api.put<PromptTemplate>(
        `/prompt-templates/${id}`,
        template,
      );

      if (!response.success || !response.data) {
        throw new Error(
          response.error?.message || "Failed to update prompt template",
        );
      }

      return response.data;
    } catch (error) {
      logger.error(`Error updating prompt template ${id}:`, error);
      throw new Error(`Failed to update prompt template: ${error.message}`);
    }
  },

  /**
   * Delete a prompt template
   */
  deleteTemplate: async (id: string): Promise<boolean> => {
    try {
      const response = await api.delete<boolean>(`/prompt-templates/${id}`);

      if (!response.success) {
        throw new Error(
          response.error?.message || "Failed to delete prompt template",
        );
      }

      return true;
    } catch (error) {
      logger.error(`Error deleting prompt template ${id}:`, error);
      throw new Error(`Failed to delete prompt template: ${error.message}`);
    }
  },

  /**
   * Get the default prompt template
   */
  getDefaultTemplate: async (): Promise<PromptTemplate | null> => {
    try {
      const response = await api.get<PromptTemplate>(
        "/prompt-templates/default",
      );

      if (!response.success) {
        if (response.error?.code === "ERR_404") {
          return null;
        }
        throw new Error(
          response.error?.message || "Failed to fetch default prompt template",
        );
      }

      return response.data || null;
    } catch (error) {
      logger.error("Error fetching default prompt template:", error);
      throw new Error(
        `Failed to fetch default prompt template: ${error.message}`,
      );
    }
  },

  /**
   * Set a prompt template as default
   */
  setDefaultTemplate: async (id: string): Promise<PromptTemplate> => {
    try {
      const response = await api.put<PromptTemplate>(
        `/prompt-templates/${id}/set-default`,
      );

      if (!response.success || !response.data) {
        throw new Error(
          response.error?.message || "Failed to set default prompt template",
        );
      }

      return response.data;
    } catch (error) {
      logger.error(`Error setting default prompt template ${id}:`, error);
      throw new Error(
        `Failed to set default prompt template: ${error.message}`,
      );
    }
  },
};

export default promptTemplateService;
export { promptTemplateService };
