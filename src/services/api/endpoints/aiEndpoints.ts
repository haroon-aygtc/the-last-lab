/**
 * AI Service API Endpoints
 *
 * Defines the API endpoints for AI operations
 */

export const aiEndpoints = {
  // Core AI functionality
  generate: "/ai/generate",
  streamGenerate: "/ai/generate/stream",

  // Model management
  models: "/ai/models",
  modelById: (id: string) => `/ai/models/${id}`,
  defaultModel: "/ai/models/default",

  // Logging and analytics
  logs: "/ai/logs",
  logById: (id: string) => `/ai/logs/${id}`,
  performance: "/ai/performance",

  // Cache management
  cache: "/ai/cache",
  cacheItem: (id: string) => `/ai/cache/${id}`,
  clearCache: "/ai/cache/clear",

  // Prompt management
  prompts: "/ai/prompts",
  promptById: (id: string) => `/ai/prompts/${id}`,
  promptTemplates: "/ai/prompt-templates",
  promptTemplateById: (id: string) => `/ai/prompt-templates/${id}`,
};
