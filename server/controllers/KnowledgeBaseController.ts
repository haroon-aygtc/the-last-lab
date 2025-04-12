/**
 * Knowledge Base Controller
 *
 * Controller for knowledge base-related operations
 */

import { Request, Response } from "express";
import { KnowledgeBaseRepository } from "../repositories/KnowledgeBaseRepository";
import { UserActivityRepository } from "../repositories/UserActivityRepository";
import logger from "../../src/utils/logger";
import { AuthenticatedRequest } from "../types";

export class KnowledgeBaseController {
  private knowledgeBaseRepository: KnowledgeBaseRepository;
  private userActivityRepository: UserActivityRepository;

  constructor() {
    this.knowledgeBaseRepository = new KnowledgeBaseRepository();
    this.userActivityRepository = new UserActivityRepository();
  }

  /**
   * Create a new knowledge base
   */
  createKnowledgeBase = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, description } = req.body;

      if (!req.user || !req.user.userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: "ERR_UNAUTHORIZED",
            message: "Authentication required",
          },
        });
      }

      if (!name) {
        return res.status(400).json({
          success: false,
          error: {
            code: "ERR_MISSING_NAME",
            message: "Knowledge base name is required",
          },
        });
      }

      // Create knowledge base
      const knowledgeBase = await this.knowledgeBaseRepository.create({
        user_id: req.user.userId,
        name,
        description,
        status: "active",
      });

      // Log activity
      await this.userActivityRepository.logActivity({
        user_id: req.user.userId,
        action: "knowledge_base_create",
        details: { knowledgeBaseId: knowledgeBase.id, knowledgeBaseName: name },
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return res.status(201).json({
        success: true,
        data: knowledgeBase,
      });
    } catch (error) {
      logger.error(
        "Error in KnowledgeBaseController.createKnowledgeBase:",
        error,
      );
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred while creating knowledge base",
        },
      });
    }
  };

  /**
   * Get all knowledge bases for a user
   */
  getUserKnowledgeBases = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 20, status } = req.query;

      // Check if user is requesting their own knowledge bases or is an admin
      if (req.user?.userId !== userId && req.user?.role !== "admin") {
        return res.status(403).json({
          success: false,
          error: {
            code: "ERR_FORBIDDEN",
            message:
              "You do not have permission to access these knowledge bases",
          },
        });
      }

      const offset = (Number(page) - 1) * Number(limit);

      const knowledgeBases = await this.knowledgeBaseRepository.findByUserId(
        userId,
        {
          limit: Number(limit),
          offset,
          status: status as string,
        },
      );

      return res.json({
        success: true,
        data: knowledgeBases.data,
        meta: {
          total: knowledgeBases.total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(knowledgeBases.total / Number(limit)),
        },
      });
    } catch (error) {
      logger.error(
        "Error in KnowledgeBaseController.getUserKnowledgeBases:",
        error,
      );
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred while fetching knowledge bases",
        },
      });
    }
  };

  /**
   * Get a knowledge base by ID
   */
  getKnowledgeBase = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const knowledgeBase = await this.knowledgeBaseRepository.findById(id);

      if (!knowledgeBase) {
        return res.status(404).json({
          success: false,
          error: {
            code: "ERR_KNOWLEDGE_BASE_NOT_FOUND",
            message: "Knowledge base not found",
          },
        });
      }

      // Check if user has access to this knowledge base
      if (
        req.user?.userId !== knowledgeBase.user_id &&
        req.user?.role !== "admin"
      ) {
        return res.status(403).json({
          success: false,
          error: {
            code: "ERR_FORBIDDEN",
            message: "You do not have permission to access this knowledge base",
          },
        });
      }

      // Get documents count
      const documentsCount =
        await this.knowledgeBaseRepository.getDocumentsCount(id);

      return res.json({
        success: true,
        data: {
          ...knowledgeBase,
          documentsCount,
        },
      });
    } catch (error) {
      logger.error("Error in KnowledgeBaseController.getKnowledgeBase:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred while fetching knowledge base",
        },
      });
    }
  };

  /**
   * Update a knowledge base
   */
  updateKnowledgeBase = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { name, description, status } = req.body;

      // Check if knowledge base exists
      const knowledgeBase = await this.knowledgeBaseRepository.findById(id);

      if (!knowledgeBase) {
        return res.status(404).json({
          success: false,
          error: {
            code: "ERR_KNOWLEDGE_BASE_NOT_FOUND",
            message: "Knowledge base not found",
          },
        });
      }

      // Check if user has access to this knowledge base
      if (
        req.user?.userId !== knowledgeBase.user_id &&
        req.user?.role !== "admin"
      ) {
        return res.status(403).json({
          success: false,
          error: {
            code: "ERR_FORBIDDEN",
            message: "You do not have permission to update this knowledge base",
          },
        });
      }

      // Update knowledge base
      const updateData: any = {};
      if (name) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (status) updateData.status = status;

      const updatedKnowledgeBase = await this.knowledgeBaseRepository.update(
        id,
        updateData,
      );

      // Log activity
      await this.userActivityRepository.logActivity({
        user_id: req.user?.userId as string,
        action: "knowledge_base_update",
        details: { knowledgeBaseId: id, updates: Object.keys(updateData) },
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return res.json({
        success: true,
        data: updatedKnowledgeBase,
      });
    } catch (error) {
      logger.error(
        "Error in KnowledgeBaseController.updateKnowledgeBase:",
        error,
      );
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred while updating knowledge base",
        },
      });
    }
  };

  /**
   * Delete a knowledge base
   */
  deleteKnowledgeBase = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      // Check if knowledge base exists
      const knowledgeBase = await this.knowledgeBaseRepository.findById(id);

      if (!knowledgeBase) {
        return res.status(404).json({
          success: false,
          error: {
            code: "ERR_KNOWLEDGE_BASE_NOT_FOUND",
            message: "Knowledge base not found",
          },
        });
      }

      // Check if user has access to this knowledge base
      if (
        req.user?.userId !== knowledgeBase.user_id &&
        req.user?.role !== "admin"
      ) {
        return res.status(403).json({
          success: false,
          error: {
            code: "ERR_FORBIDDEN",
            message: "You do not have permission to delete this knowledge base",
          },
        });
      }

      // Delete knowledge base
      await this.knowledgeBaseRepository.delete(id);

      // Log activity
      await this.userActivityRepository.logActivity({
        user_id: req.user?.userId as string,
        action: "knowledge_base_delete",
        details: { knowledgeBaseId: id, knowledgeBaseName: knowledgeBase.name },
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return res.json({
        success: true,
        message: "Knowledge base deleted successfully",
      });
    } catch (error) {
      logger.error(
        "Error in KnowledgeBaseController.deleteKnowledgeBase:",
        error,
      );
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred while deleting knowledge base",
        },
      });
    }
  };

  /**
   * Add a document to a knowledge base
   */
  addDocument = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { title, content, sourceUrl, metadata } = req.body;

      if (!title || !content) {
        return res.status(400).json({
          success: false,
          error: {
            code: "ERR_MISSING_FIELDS",
            message: "Title and content are required",
          },
        });
      }

      // Check if knowledge base exists
      const knowledgeBase = await this.knowledgeBaseRepository.findById(id);

      if (!knowledgeBase) {
        return res.status(404).json({
          success: false,
          error: {
            code: "ERR_KNOWLEDGE_BASE_NOT_FOUND",
            message: "Knowledge base not found",
          },
        });
      }

      // Check if user has access to this knowledge base
      if (
        req.user?.userId !== knowledgeBase.user_id &&
        req.user?.role !== "admin"
      ) {
        return res.status(403).json({
          success: false,
          error: {
            code: "ERR_FORBIDDEN",
            message:
              "You do not have permission to add documents to this knowledge base",
          },
        });
      }

      // Add document
      const document = await this.knowledgeBaseRepository.addDocument(id, {
        title,
        content,
        source_url: sourceUrl,
        metadata,
        status: "active",
      });

      // Log activity
      await this.userActivityRepository.logActivity({
        user_id: req.user?.userId as string,
        action: "knowledge_base_document_add",
        details: {
          knowledgeBaseId: id,
          documentId: document.id,
          documentTitle: title,
        },
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return res.status(201).json({
        success: true,
        data: document,
      });
    } catch (error) {
      logger.error("Error in KnowledgeBaseController.addDocument:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred while adding document",
        },
      });
    }
  };

  /**
   * Get documents for a knowledge base
   */
  getDocuments = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { page = 1, limit = 20 } = req.query;

      // Check if knowledge base exists
      const knowledgeBase = await this.knowledgeBaseRepository.findById(id);

      if (!knowledgeBase) {
        return res.status(404).json({
          success: false,
          error: {
            code: "ERR_KNOWLEDGE_BASE_NOT_FOUND",
            message: "Knowledge base not found",
          },
        });
      }

      // Check if user has access to this knowledge base
      if (
        req.user?.userId !== knowledgeBase.user_id &&
        req.user?.role !== "admin"
      ) {
        return res.status(403).json({
          success: false,
          error: {
            code: "ERR_FORBIDDEN",
            message:
              "You do not have permission to access documents from this knowledge base",
          },
        });
      }

      const offset = (Number(page) - 1) * Number(limit);

      const documents = await this.knowledgeBaseRepository.getDocuments(id, {
        limit: Number(limit),
        offset,
      });

      return res.json({
        success: true,
        data: documents.data,
        meta: {
          total: documents.total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(documents.total / Number(limit)),
        },
      });
    } catch (error) {
      logger.error("Error in KnowledgeBaseController.getDocuments:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred while fetching documents",
        },
      });
    }
  };
}

export default new KnowledgeBaseController();
