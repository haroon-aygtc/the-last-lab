/**
 * Knowledge Base Repository
 *
 * Repository for knowledge base-related database operations
 */

import { BaseRepository } from "./BaseRepository";
import { KnowledgeBase, KnowledgeBaseDocument } from "../types";
import logger from "../../src/utils/logger";

export class KnowledgeBaseRepository extends BaseRepository<KnowledgeBase> {
  constructor() {
    super("knowledge_bases");
  }

  /**
   * Find knowledge bases by user ID
   */
  async findByUserId(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      status?: string;
    } = {},
  ): Promise<{ data: KnowledgeBase[]; total: number }> {
    try {
      const db = await this.getDb();
      const { limit = 50, offset = 0, status } = options;

      // Build query conditions
      let whereClause = "WHERE user_id = ?";
      const replacements: any[] = [userId];

      if (status) {
        whereClause += " AND status = ?";
        replacements.push(status);
      }

      // Get total count
      const [countResult] = await db.query(
        `SELECT COUNT(*) as total FROM ${this.tableName} ${whereClause}`,
        { replacements },
      );

      const total = countResult[0].total;

      // Get paginated data
      const [data] = await db.query(
        `SELECT * FROM ${this.tableName} 
         ${whereClause} 
         ORDER BY created_at DESC 
         LIMIT ? OFFSET ?`,
        {
          replacements: [...replacements, limit, offset],
        },
      );

      return {
        data: data as KnowledgeBase[],
        total,
      };
    } catch (error) {
      logger.error("Error in KnowledgeBaseRepository.findByUserId:", error);
      throw error;
    }
  }

  /**
   * Get documents count for a knowledge base
   */
  async getDocumentsCount(knowledgeBaseId: string): Promise<number> {
    try {
      const db = await this.getDb();

      const [result] = await db.query(
        `SELECT COUNT(*) as count FROM knowledge_base_documents 
         WHERE knowledge_base_id = ?`,
        { replacements: [knowledgeBaseId] },
      );

      return result[0].count;
    } catch (error) {
      logger.error(
        "Error in KnowledgeBaseRepository.getDocumentsCount:",
        error,
      );
      throw error;
    }
  }

  /**
   * Add a document to a knowledge base
   */
  async addDocument(
    knowledgeBaseId: string,
    document: Partial<KnowledgeBaseDocument>,
  ): Promise<KnowledgeBaseDocument> {
    try {
      const db = await this.getDb();
      const now = new Date().toISOString();

      // Add id, knowledge_base_id, created_at, and updated_at if not provided
      const documentData = {
        id: document.id || this.generateId(),
        knowledge_base_id: knowledgeBaseId,
        created_at: now,
        updated_at: now,
        ...document,
      };

      // Build query dynamically based on data properties
      const columns = Object.keys(documentData).join(", ");
      const placeholders = Object.keys(documentData)
        .map(() => "?")
        .join(", ");
      const values = Object.values(documentData);

      await db.query(
        `INSERT INTO knowledge_base_documents (${columns}) VALUES (${placeholders})`,
        { replacements: values },
      );

      return documentData as KnowledgeBaseDocument;
    } catch (error) {
      logger.error("Error in KnowledgeBaseRepository.addDocument:", error);
      throw error;
    }
  }

  /**
   * Get documents for a knowledge base
   */
  async getDocuments(
    knowledgeBaseId: string,
    options: {
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ data: KnowledgeBaseDocument[]; total: number }> {
    try {
      const db = await this.getDb();
      const { limit = 50, offset = 0 } = options;

      // Get total count
      const [countResult] = await db.query(
        `SELECT COUNT(*) as total FROM knowledge_base_documents 
         WHERE knowledge_base_id = ?`,
        { replacements: [knowledgeBaseId] },
      );

      const total = countResult[0].total;

      // Get paginated data
      const [data] = await db.query(
        `SELECT * FROM knowledge_base_documents 
         WHERE knowledge_base_id = ? 
         ORDER BY created_at DESC 
         LIMIT ? OFFSET ?`,
        {
          replacements: [knowledgeBaseId, limit, offset],
        },
      );

      return {
        data: data as KnowledgeBaseDocument[],
        total,
      };
    } catch (error) {
      logger.error("Error in KnowledgeBaseRepository.getDocuments:", error);
      throw error;
    }
  }

  /**
   * Get a document by ID
   */
  async getDocumentById(
    documentId: string,
  ): Promise<KnowledgeBaseDocument | null> {
    try {
      const db = await this.getDb();

      const [results] = await db.query(
        `SELECT * FROM knowledge_base_documents WHERE id = ?`,
        { replacements: [documentId] },
      );

      return results.length > 0 ? (results[0] as KnowledgeBaseDocument) : null;
    } catch (error) {
      logger.error("Error in KnowledgeBaseRepository.getDocumentById:", error);
      throw error;
    }
  }

  /**
   * Update a document
   */
  async updateDocument(
    documentId: string,
    data: Partial<KnowledgeBaseDocument>,
  ): Promise<KnowledgeBaseDocument> {
    try {
      const db = await this.getDb();
      const now = new Date().toISOString();

      // Add updated_at if not provided
      const updateData = {
        ...data,
        updated_at: now,
      };

      // Build SET clause dynamically
      const setClause = Object.keys(updateData)
        .map((key) => `${key} = ?`)
        .join(", ");

      const values = [...Object.values(updateData), documentId];

      await db.query(
        `UPDATE knowledge_base_documents SET ${setClause} WHERE id = ?`,
        { replacements: values },
      );

      // Fetch and return the updated document
      const updatedDocument = await this.getDocumentById(documentId);

      if (!updatedDocument) {
        throw new Error(
          `Document with ID ${documentId} not found after update`,
        );
      }

      return updatedDocument;
    } catch (error) {
      logger.error("Error in KnowledgeBaseRepository.updateDocument:", error);
      throw error;
    }
  }

  /**
   * Delete a document
   */
  async deleteDocument(documentId: string): Promise<boolean> {
    try {
      const db = await this.getDb();

      const [result] = await db.query(
        `DELETE FROM knowledge_base_documents WHERE id = ?`,
        { replacements: [documentId] },
      );

      return result.affectedRows > 0;
    } catch (error) {
      logger.error("Error in KnowledgeBaseRepository.deleteDocument:", error);
      throw error;
    }
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
