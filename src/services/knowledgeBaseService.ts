import axios from "axios";
import logger from "@/utils/logger";
import { api } from "./api/middleware/apiMiddleware";
import { v4 as uuidv4 } from "uuid";

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

export interface QueryResult {
  source: string;
  content: string;
  metadata?: Record<string, any>;
  relevanceScore?: number;
  timestamp?: string;
}

export interface KnowledgeBaseQuery {
  query: string;
  filters?: Record<string, any>;
  limit?: number;
  contextRuleId?: string;
  userId?: string;
}

/**
 * Service for integrating with external knowledge bases
 */
class KnowledgeBaseService {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes in milliseconds

  /**
   * Get all knowledge base configurations
   */
  async getAllConfigs(): Promise<KnowledgeBaseConfig[]> {
    try {
      const response = await api.get<KnowledgeBaseConfig[]>("/knowledge-bases");

      if (!response.success) {
        throw new Error(
          response.error?.message || "Failed to fetch knowledge base configs",
        );
      }

      return response.data || [];
    } catch (error) {
      logger.error("Error fetching knowledge base configs", error);
      return [];
    }
  }

  /**
   * Get a knowledge base configuration by ID
   */
  async getConfigById(id: string): Promise<KnowledgeBaseConfig | null> {
    try {
      const response = await api.get<KnowledgeBaseConfig>(
        `/knowledge-bases/${id}`,
      );

      if (!response.success) {
        if (response.error?.code === "ERR_404") {
          return null;
        }
        throw new Error(
          response.error?.message || "Failed to fetch knowledge base config",
        );
      }

      return response.data || null;
    } catch (error) {
      logger.error(`Error fetching knowledge base config with ID ${id}`, error);
      return null;
    }
  }

  /**
   * Create a new knowledge base configuration
   */
  async createConfig(
    config: Omit<KnowledgeBaseConfig, "id" | "createdAt" | "updatedAt">,
  ): Promise<KnowledgeBaseConfig | null> {
    try {
      const response = await api.post<KnowledgeBaseConfig>(
        "/knowledge-bases",
        config,
      );

      if (!response.success || !response.data) {
        throw new Error(
          response.error?.message || "Failed to create knowledge base config",
        );
      }

      return response.data;
    } catch (error) {
      logger.error("Error creating knowledge base config", error);
      return null;
    }
  }

  /**
   * Update a knowledge base configuration
   */
  async updateConfig(
    id: string,
    config: Partial<KnowledgeBaseConfig>,
  ): Promise<KnowledgeBaseConfig | null> {
    try {
      const response = await api.put<KnowledgeBaseConfig>(
        `/knowledge-bases/${id}`,
        config,
      );

      if (!response.success || !response.data) {
        throw new Error(
          response.error?.message || "Failed to update knowledge base config",
        );
      }

      return response.data;
    } catch (error) {
      logger.error(`Error updating knowledge base config with ID ${id}`, error);
      return null;
    }
  }

  /**
   * Delete a knowledge base configuration
   */
  async deleteConfig(id: string): Promise<boolean> {
    try {
      const response = await api.delete<{ success: boolean }>(
        `/knowledge-bases/${id}`,
      );

      if (!response.success) {
        throw new Error(
          response.error?.message || "Failed to delete knowledge base config",
        );
      }

      return true;
    } catch (error) {
      logger.error(`Error deleting knowledge base config with ID ${id}`, error);
      return false;
    }
  }

  /**
   * Query knowledge bases based on the provided query and context rule
   */
  async query(params: KnowledgeBaseQuery): Promise<QueryResult[]> {
    try {
      // Get active knowledge bases for the context rule
      const knowledgeBases = await this.getKnowledgeBasesForContextRule(
        params.contextRuleId,
      );

      if (knowledgeBases.length === 0) {
        return [];
      }

      // Query each knowledge base in parallel
      const results = await Promise.all(
        knowledgeBases.map((kb) => this.queryKnowledgeBase(kb, params)),
      );

      // Flatten results and filter out nulls
      const flattenedResults = results
        .flat()
        .filter((result) => result !== null) as QueryResult[];

      // Sort by relevance score if available
      return flattenedResults.sort(
        (a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0),
      );
    } catch (error) {
      logger.error("Error querying knowledge bases", error);
      return [];
    }
  }

  /**
   * Get knowledge bases associated with a context rule
   */
  private async getKnowledgeBasesForContextRule(
    contextRuleId?: string,
  ): Promise<KnowledgeBaseConfig[]> {
    try {
      const endpoint = contextRuleId
        ? `/context-rules/${contextRuleId}/knowledge-bases`
        : "/knowledge-bases/active";

      const response = await api.get<KnowledgeBaseConfig[]>(endpoint);

      if (!response.success) {
        throw new Error(
          response.error?.message ||
            "Failed to fetch knowledge bases for context rule",
        );
      }

      return response.data || [];
    } catch (error) {
      logger.error("Error getting knowledge bases for context rule", error);
      return [];
    }
  }

  /**
   * Query a specific knowledge base
   */
  private async queryKnowledgeBase(
    kb: KnowledgeBaseConfig,
    params: KnowledgeBaseQuery,
  ): Promise<QueryResult[] | null> {
    try {
      switch (kb.type) {
        case "api":
          return await this.queryApiKnowledgeBase(kb, params);
        case "database":
          return await this.queryDatabaseKnowledgeBase(kb, params);
        case "cms":
          return await this.queryCmsKnowledgeBase(kb, params);
        case "vector":
          return await this.queryVectorKnowledgeBase(kb, params);
        case "file":
          return await this.queryFileKnowledgeBase(kb, params);
        default:
          logger.warn(`Unsupported knowledge base type: ${kb.type}`);
          return null;
      }
    } catch (error) {
      logger.error(`Error querying knowledge base ${kb.id}`, error);
      return null;
    }
  }

  /**
   * Query an API-based knowledge base
   */
  private async queryApiKnowledgeBase(
    kb: KnowledgeBaseConfig,
    params: KnowledgeBaseQuery,
  ): Promise<QueryResult[]> {
    try {
      // Check cache first
      const cacheKey = `api-${kb.id}-${params.query}`;
      const cachedResult = this.getFromCache(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      if (!kb.endpoint) {
        throw new Error("API endpoint is required for API knowledge base");
      }

      // Prepare request headers
      const headers: Record<string, string> = {};
      if (kb.apiKey) {
        headers["Authorization"] = `Bearer ${kb.apiKey}`;
      }

      // Prepare request parameters
      const requestParams = {
        query: params.query,
        filters: params.filters,
        limit: params.limit || 5,
        ...kb.parameters,
      };

      // Make the API request
      const response = await axios.post(kb.endpoint, requestParams, {
        headers,
      });

      // Transform the response to QueryResult format
      const results: QueryResult[] = Array.isArray(response.data.results)
        ? response.data.results.map((item: any) => ({
            source: kb.name,
            content: item.content || item.text || item.data || "",
            metadata: {
              ...item.metadata,
              id: item.id,
              url: item.url,
              knowledgeBaseId: kb.id,
            },
            relevanceScore: item.score || item.relevance || 0,
            timestamp: item.timestamp || new Date().toISOString(),
          }))
        : [];

      // Cache the results
      this.addToCache(cacheKey, results);

      return results;
    } catch (error) {
      logger.error(`Error querying API knowledge base ${kb.id}`, error);
      return [];
    }
  }

  /**
   * Query a database-based knowledge base
   */
  private async queryDatabaseKnowledgeBase(
    kb: KnowledgeBaseConfig,
    params: KnowledgeBaseQuery,
  ): Promise<QueryResult[]> {
    try {
      if (!kb.connectionString) {
        throw new Error(
          "Connection string is required for database knowledge base",
        );
      }

      // Check cache first
      const cacheKey = `db-${kb.id}-${params.query}`;
      const cachedResult = this.getFromCache(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      // Use the API to query the database based on the connection string
      if (kb.connectionString) {
        try {
          // Extract table name from parameters
          const tableName = kb.parameters?.table || "documents";
          const searchColumn = kb.parameters?.searchColumn || "content";

          // Use the API to query the database
          const response = await api.post<any[]>(
            `/knowledge-bases/query-database`,
            {
              connectionString: kb.connectionString,
              tableName,
              searchColumn,
              query: params.query,
              limit: params.limit || 5,
            },
          );

          if (!response.success) {
            throw new Error(
              response.error?.message || "Failed to query database",
            );
          }

          const data = response.data || [];

          if (data && data.length > 0) {
            const results: QueryResult[] = data.map((item) => ({
              source: `${kb.name} (${tableName})`,
              content:
                item[searchColumn] ||
                item.content ||
                item.text ||
                JSON.stringify(item),
              metadata: {
                ...item,
                table: tableName,
                knowledgeBaseId: kb.id,
              },
              relevanceScore: 0.9, // We don't have actual relevance scores from simple queries
              timestamp: item.created_at || new Date().toISOString(),
            }));

            // Cache the results
            this.addToCache(cacheKey, results);
            return results;
          }
        } catch (dbError) {
          logger.error(`Error querying MySQL database: ${dbError}`);
          // Fall through to return empty results
        }
      }

      logger.warn(
        `Database connection not implemented for: ${kb.connectionString}`,
      );
      return [];
    } catch (error) {
      logger.error(`Error querying database knowledge base ${kb.id}`, error);
      return [];
    }
  }

  /**
   * Query a CMS-based knowledge base
   */
  private async queryCmsKnowledgeBase(
    kb: KnowledgeBaseConfig,
    params: KnowledgeBaseQuery,
  ): Promise<QueryResult[]> {
    try {
      // Check cache first
      const cacheKey = `cms-${kb.id}-${params.query}`;
      const cachedResult = this.getFromCache(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      if (!kb.endpoint) {
        throw new Error("API endpoint is required for CMS knowledge base");
      }

      // Prepare request headers
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (kb.apiKey) {
        // Different CMS systems use different authentication methods
        if (kb.parameters?.authType === "bearer") {
          headers["Authorization"] = `Bearer ${kb.apiKey}`;
        } else if (kb.parameters?.authType === "apikey") {
          headers["X-API-Key"] = kb.apiKey;
        } else {
          // Default to bearer token
          headers["Authorization"] = `Bearer ${kb.apiKey}`;
        }
      }

      // Prepare request parameters based on CMS type
      let requestParams: any = {
        query: params.query,
        limit: params.limit || 5,
      };

      // Handle different CMS types (WordPress, Contentful, Strapi, etc.)
      if (kb.parameters?.cmsType === "contentful") {
        requestParams = {
          query: `{
            ${kb.parameters.contentType || "article"}Collection(where: {${kb.parameters.searchField || "content"}_contains: "${params.query}"}, limit: ${params.limit || 5}) {
              items {
                ${kb.parameters.fields || "title content sys { id }"}
              }
            }
          }`,
        };
      } else if (kb.parameters?.cmsType === "wordpress") {
        // WordPress REST API format
        const endpoint = `${kb.endpoint}/wp-json/wp/v2/${kb.parameters.contentType || "posts"}?search=${encodeURIComponent(params.query)}&per_page=${params.limit || 5}`;

        try {
          const response = await axios.get(endpoint, { headers });

          if (response.data && Array.isArray(response.data)) {
            const results: QueryResult[] = response.data.map((item: any) => ({
              source: `${kb.name} (WordPress)`,
              content:
                item.content?.rendered ||
                item.excerpt?.rendered ||
                JSON.stringify(item),
              metadata: {
                id: item.id,
                title: item.title?.rendered,
                url: item.link,
                contentType: kb.parameters?.contentType || "post",
                knowledgeBaseId: kb.id,
              },
              relevanceScore: 0.8, // WordPress doesn't provide relevance scores
              timestamp: item.modified || item.date || new Date().toISOString(),
            }));

            // Cache the results
            this.addToCache(cacheKey, results);
            return results;
          }
        } catch (wpError) {
          logger.error(`Error querying WordPress API: ${wpError}`);
          // Fall through to generic API request
        }
      }

      // Generic API request for other CMS types
      try {
        const response = await axios.post(kb.endpoint, requestParams, {
          headers,
        });

        // Transform the response to QueryResult format based on CMS type
        let results: QueryResult[] = [];

        if (kb.parameters?.cmsType === "contentful" && response.data?.data) {
          const contentType = kb.parameters.contentType || "article";
          const items =
            response.data.data[`${contentType}Collection`]?.items || [];

          results = items.map((item: any) => ({
            source: `${kb.name} (Contentful)`,
            content:
              item.content ||
              item.body ||
              item.description ||
              JSON.stringify(item),
            metadata: {
              id: item.sys?.id,
              title: item.title,
              contentType: contentType,
              knowledgeBaseId: kb.id,
            },
            relevanceScore: 0.85,
            timestamp: new Date().toISOString(),
          }));
        } else if (
          response.data?.results ||
          response.data?.items ||
          response.data?.data
        ) {
          // Generic handling for various CMS response formats
          const items =
            response.data.results ||
            response.data.items ||
            response.data.data ||
            [];

          results = items.map((item: any) => ({
            source: kb.name,
            content:
              item.content ||
              item.text ||
              item.description ||
              JSON.stringify(item),
            metadata: {
              ...item,
              knowledgeBaseId: kb.id,
            },
            relevanceScore: item.score || item.relevance || 0.8,
            timestamp: item.timestamp || item.date || new Date().toISOString(),
          }));
        }

        // Cache the results
        this.addToCache(cacheKey, results);
        return results;
      } catch (apiError) {
        logger.error(`Error querying CMS API: ${apiError}`);
        return [];
      }
    } catch (error) {
      logger.error(`Error querying CMS knowledge base ${kb.id}`, error);
      return [];
    }
  }

  /**
   * Query a vector-based knowledge base (for semantic search)
   */
  private async queryVectorKnowledgeBase(
    kb: KnowledgeBaseConfig,
    params: KnowledgeBaseQuery,
  ): Promise<QueryResult[]> {
    try {
      // Check cache first
      const cacheKey = `vector-${kb.id}-${params.query}`;
      const cachedResult = this.getFromCache(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      if (!kb.endpoint) {
        throw new Error("API endpoint is required for vector knowledge base");
      }

      // Prepare request headers
      const headers: Record<string, string> = {};
      if (kb.apiKey) {
        headers["Authorization"] = `Bearer ${kb.apiKey}`;
      }

      // Prepare request parameters
      const requestParams = {
        query: params.query,
        filters: params.filters,
        limit: params.limit || 5,
        ...kb.parameters,
      };

      // Make the API request
      const response = await axios.post(kb.endpoint, requestParams, {
        headers,
      });

      // Transform the response to QueryResult format
      const results: QueryResult[] = Array.isArray(response.data.results)
        ? response.data.results.map((item: any) => ({
            source: kb.name,
            content: item.content || item.text || "",
            metadata: {
              ...item.metadata,
              id: item.id,
              knowledgeBaseId: kb.id,
            },
            relevanceScore: item.score || 0,
            timestamp: item.timestamp || new Date().toISOString(),
          }))
        : [];

      // Cache the results
      this.addToCache(cacheKey, results);

      return results;
    } catch (error) {
      logger.error(`Error querying vector knowledge base ${kb.id}`, error);
      return [];
    }
  }

  /**
   * Query a file-based knowledge base
   */
  private async queryFileKnowledgeBase(
    kb: KnowledgeBaseConfig,
    params: KnowledgeBaseQuery,
  ): Promise<QueryResult[]> {
    try {
      // Check cache first
      const cacheKey = `file-${kb.id}-${params.query}`;
      const cachedResult = this.getFromCache(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      // In a production environment, this would connect to a file indexing service
      // or a document search API that has indexed the files

      // If the endpoint is provided, it's likely a document search API
      if (kb.endpoint) {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        if (kb.apiKey) {
          headers["Authorization"] = `Bearer ${kb.apiKey}`;
        }

        // Prepare request parameters
        const requestParams = {
          query: params.query,
          filters: params.filters,
          limit: params.limit || 5,
          ...kb.parameters,
        };

        try {
          const response = await axios.post(kb.endpoint, requestParams, {
            headers,
          });

          // Transform the response to QueryResult format
          if (
            response.data?.results ||
            response.data?.documents ||
            response.data?.files
          ) {
            const items =
              response.data.results ||
              response.data.documents ||
              response.data.files ||
              [];

            const results: QueryResult[] = items.map((item: any) => ({
              source: `${kb.name} (${item.fileName || item.name || "Document"})`,
              content: item.content || item.text || item.extract || "",
              metadata: {
                fileName: item.fileName || item.name,
                fileType:
                  item.fileType || item.extension || item.type || "unknown",
                fileSize: item.fileSize || item.size,
                url: item.url || item.downloadUrl,
                knowledgeBaseId: kb.id,
              },
              relevanceScore: item.score || item.relevance || 0.7,
              timestamp:
                item.timestamp ||
                item.lastModified ||
                item.created ||
                new Date().toISOString(),
            }));

            // Cache the results
            this.addToCache(cacheKey, results);
            return results;
          }
        } catch (apiError) {
          logger.error(`Error querying file search API: ${apiError}`);
          // Fall through to return empty results
        }
      }

      // If we're using file storage, we could potentially query that
      if (kb.parameters?.useFileStorage) {
        logger.info("File storage search is not yet implemented");
        // This would require a separate indexing mechanism as the file storage
        // doesn't provide content search capabilities directly
      }

      logger.warn(
        `File search not fully implemented for knowledge base: ${kb.id}`,
      );
      return [];
    } catch (error) {
      logger.error(`Error querying file knowledge base ${kb.id}`, error);
      return [];
    }
  }

  /**
   * Add data to the cache
   */
  private addToCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Get data from the cache if it's still valid
   */
  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    // Check if the cache is still valid
    if (Date.now() - cached.timestamp > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  // API layer handles all data transformation between frontend and backend

  /**
   * Sync a knowledge base to update its content
   */
  async syncKnowledgeBase(id: string): Promise<boolean> {
    try {
      const response = await api.post<{ success: boolean }>(
        `/knowledge-bases/${id}/sync`,
      );

      if (!response.success) {
        throw new Error(
          response.error?.message || `Failed to sync knowledge base ${id}`,
        );
      }

      // Clear cache entries for this knowledge base
      this.clearCacheForKnowledgeBase(id);

      return true;
    } catch (error) {
      logger.error(`Error syncing knowledge base ${id}`, error);
      return false;
    }
  }

  /**
   * Clear cache entries for a specific knowledge base
   */
  private clearCacheForKnowledgeBase(id: string): void {
    for (const [key, _] of this.cache.entries()) {
      if (key.includes(`-${id}-`)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Log a knowledge base query for analytics
   */
  async logQuery(params: {
    userId: string;
    query: string;
    contextRuleId?: string;
    knowledgeBaseIds: string[];
    results: number;
  }): Promise<void> {
    try {
      const response = await api.post<{ success: boolean }>(
        "/knowledge-bases/log-query",
        params,
      );

      if (!response.success) {
        logger.warn("Failed to log knowledge base query", response.error);
      }
    } catch (error) {
      logger.error("Error logging knowledge base query", error);
    }
  }
}

// Create a singleton instance
const knowledgeBaseService = new KnowledgeBaseService();

export default knowledgeBaseService;
