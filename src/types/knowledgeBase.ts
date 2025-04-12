/**
 * Knowledge Base Types
 *
 * This module defines types related to the knowledge base functionality.
 */

/**
 * Represents a query result from the knowledge base
 */
export interface QueryResult {
  source: string;
  content: string;
  metadata?: Record<string, any>;
  relevanceScore?: number;
  timestamp?: string;
}

/**
 * Represents a knowledge base configuration
 */
export interface KnowledgeBaseConfig {
  id: string;
  name: string;
  type: "api" | "database" | "cms" | "vector" | "file";
  endpoint?: string;
  apiKey?: string;
  connectionString?: string;
  refreshInterval?: number; // in minutes
  lastSyncedAt?: string;
  parameters?: Record<string, any>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Represents a knowledge base query request
 */
export interface KnowledgeBaseQueryRequest {
  query: string;
  filters?: Record<string, any>;
  limit?: number;
  contextRuleId?: string;
  userId?: string;
}

/**
 * Represents a knowledge base query log entry
 */
export interface KnowledgeBaseQueryLog {
  id: string;
  userId: string;
  query: string;
  contextRuleId?: string;
  knowledgeBaseIds: string[];
  resultsCount: number;
  createdAt: string;
}
