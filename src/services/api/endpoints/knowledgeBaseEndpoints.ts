/**
 * Knowledge Base API Endpoints
 *
 * Defines the API endpoints for knowledge base operations
 */

export const knowledgeBaseEndpoints = {
  // Configuration endpoints
  configs: "/knowledge-base/configs",
  configById: (id: string) => `/knowledge-base/configs/${id}`,
  syncConfig: (id: string) => `/knowledge-base/configs/${id}/sync`,

  // Query endpoints
  query: "/knowledge-base/query",
  logs: "/knowledge-base/logs",

  // Analytics endpoints
  analytics: "/knowledge-base/analytics",
  usage: "/knowledge-base/usage",
};
