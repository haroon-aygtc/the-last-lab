/**
 * Chat Controller
 *
 * Controller for chat-related operations
 */

import { Request, Response } from "express";
import {
  ChatSessionRepository,
  ChatMessageRepository,
  AttachmentRepository,
} from "../repositories/ChatRepository";
import { UserActivityRepository } from "../repositories/UserActivityRepository";
import logger from "../../src/utils/logger";
import { AuthenticatedRequest } from "../types";
import { v4 as uuidv4 } from "uuid";

export class ChatController {
  private chatSessionRepository: ChatSessionRepository;
  private chatMessageRepository: ChatMessageRepository;
  private attachmentRepository: AttachmentRepository;
  private userActivityRepository: UserActivityRepository;

  constructor() {
    this.chatSessionRepository = new ChatSessionRepository();
    this.chatMessageRepository = new ChatMessageRepository();
    this.attachmentRepository = new AttachmentRepository();
    this.userActivityRepository = new UserActivityRepository();
  }

  /**
   * Create a new chat session
   */
  createSession = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { widgetId, metadata } = req.body;
      const userId = req.user?.userId;

      // Create session
      const session = await this.chatSessionRepository.create({
        user_id: userId,
        widget_id: widgetId,
        status: "active",
        metadata,
      });

      // Log activity if authenticated
      if (userId) {
        await this.userActivityRepository.logActivity({
          user_id: userId,
          action: "chat_session_create",
          details: { sessionId: session.id, widgetId },
          ip_address: req.ip,
          user_agent: req.headers["user-agent"],
        });
      }

      return res.status(201).json({
        success: true,
        data: session,
      });
    } catch (error) {
      logger.error("Error in ChatController.createSession:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred while creating chat session",
        },
      });
    }
  };

  /**
   * Get a chat session by ID
   */
  getSession = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const session = await this.chatSessionRepository.findById(id);

      if (!session) {
        return res.status(404).json({
          success: false,
          error: {
            code: "ERR_SESSION_NOT_FOUND",
            message: "Chat session not found",
          },
        });
      }

      // Check if user has access to this session
      if (
        session.user_id &&
        req.user?.userId !== session.user_id &&
        req.user?.role !== "admin"
      ) {
        return res.status(403).json({
          success: false,
          error: {
            code: "ERR_FORBIDDEN",
            message: "You do not have permission to access this session",
          },
        });
      }

      return res.json({
        success: true,
        data: session,
      });
    } catch (error) {
      logger.error("Error in ChatController.getSession:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred while fetching chat session",
        },
      });
    }
  };

  /**
   * Get chat sessions by user ID
   */
  getSessionsByUser = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 20 } = req.query;

      // Check if user is requesting their own sessions or is an admin
      if (req.user?.userId !== userId && req.user?.role !== "admin") {
        return res.status(403).json({
          success: false,
          error: {
            code: "ERR_FORBIDDEN",
            message: "You do not have permission to access these sessions",
          },
        });
      }

      const offset = (Number(page) - 1) * Number(limit);

      const sessions = await this.chatSessionRepository.findByUserId(userId, {
        limit: Number(limit),
        offset,
      });

      return res.json({
        success: true,
        data: {
          sessions: sessions.data,
          total: sessions.total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(sessions.total / Number(limit)),
        },
      });
    } catch (error) {
      logger.error("Error in ChatController.getSessionsByUser:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred while fetching chat sessions",
        },
      });
    }
  };

  /**
   * Get chat sessions by widget ID
   */
  getSessionsByWidget = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { widgetId } = req.params;
      const { page = 1, limit = 20 } = req.query;

      // TODO: Check if user has access to this widget

      const offset = (Number(page) - 1) * Number(limit);

      const sessions = await this.chatSessionRepository.findByWidgetId(
        widgetId,
        {
          limit: Number(limit),
          offset,
        },
      );

      return res.json({
        success: true,
        data: {
          sessions: sessions.data,
          total: sessions.total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(sessions.total / Number(limit)),
        },
      });
    } catch (error) {
      logger.error("Error in ChatController.getSessionsByWidget:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred while fetching chat sessions",
        },
      });
    }
  };

  /**
   * Update a chat session
   */
  updateSession = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { status, metadata } = req.body;

      // Check if session exists
      const session = await this.chatSessionRepository.findById(id);

      if (!session) {
        return res.status(404).json({
          success: false,
          error: {
            code: "ERR_SESSION_NOT_FOUND",
            message: "Chat session not found",
          },
        });
      }

      // Check if user has access to this session
      if (
        session.user_id &&
        req.user?.userId !== session.user_id &&
        req.user?.role !== "admin"
      ) {
        return res.status(403).json({
          success: false,
          error: {
            code: "ERR_FORBIDDEN",
            message: "You do not have permission to update this session",
          },
        });
      }

      // Update session
      const updateData: any = {};
      if (status) updateData.status = status;
      if (metadata) updateData.metadata = metadata;

      const updatedSession = await this.chatSessionRepository.update(
        id,
        updateData,
      );

      // Log activity if authenticated
      if (req.user?.userId) {
        await this.userActivityRepository.logActivity({
          user_id: req.user.userId,
          action: "chat_session_update",
          details: { sessionId: id, status },
          ip_address: req.ip,
          user_agent: req.headers["user-agent"],
        });
      }

      return res.json({
        success: true,
        data: updatedSession,
      });
    } catch (error) {
      logger.error("Error in ChatController.updateSession:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred while updating chat session",
        },
      });
    }
  };

  /**
   * Delete a chat session
   */
  deleteSession = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      // Check if session exists
      const session = await this.chatSessionRepository.findById(id);

      if (!session) {
        return res.status(404).json({
          success: false,
          error: {
            code: "ERR_SESSION_NOT_FOUND",
            message: "Chat session not found",
          },
        });
      }

      // Check if user has access to this session
      if (
        session.user_id &&
        req.user?.userId !== session.user_id &&
        req.user?.role !== "admin"
      ) {
        return res.status(403).json({
          success: false,
          error: {
            code: "ERR_FORBIDDEN",
            message: "You do not have permission to delete this session",
          },
        });
      }

      // Delete session
      await this.chatSessionRepository.delete(id);

      // Log activity if authenticated
      if (req.user?.userId) {
        await this.userActivityRepository.logActivity({
          user_id: req.user.userId,
          action: "chat_session_delete",
          details: { sessionId: id },
          ip_address: req.ip,
          user_agent: req.headers["user-agent"],
        });
      }

      return res.json({
        success: true,
        message: "Chat session deleted successfully",
      });
    } catch (error) {
      logger.error("Error in ChatController.deleteSession:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred while deleting chat session",
        },
      });
    }
  };

  /**
   * Send a message
   */
  sendMessage = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { sessionId, content, type, metadata, attachments } = req.body;
      const userId = req.user?.userId;

      // Check if session exists
      const session = await this.chatSessionRepository.findById(sessionId);

      if (!session) {
        return res.status(404).json({
          success: false,
          error: {
            code: "ERR_SESSION_NOT_FOUND",
            message: "Chat session not found",
          },
        });
      }

      // Check if user has access to this session if it belongs to a user
      if (
        session.user_id &&
        userId &&
        session.user_id !== userId &&
        req.user?.role !== "admin"
      ) {
        return res.status(403).json({
          success: false,
          error: {
            code: "ERR_FORBIDDEN",
            message:
              "You do not have permission to send messages to this session",
          },
        });
      }

      // Create message
      const message = await this.chatMessageRepository.createWithAttachments(
        {
          session_id: sessionId,
          user_id: userId,
          content,
          type: type || "user",
          metadata,
          status: "sent",
        },
        attachments,
      );

      // Log activity if authenticated
      if (userId) {
        await this.userActivityRepository.logActivity({
          user_id: userId,
          action: "chat_message_send",
          details: { sessionId, messageId: message.id },
          ip_address: req.ip,
          user_agent: req.headers["user-agent"],
        });
      }

      return res.status(201).json({
        success: true,
        data: message,
      });
    } catch (error) {
      logger.error("Error in ChatController.sendMessage:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred while sending message",
        },
      });
    }
  };

  /**
   * Get messages for a session
   */
  getSessionMessages = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { page = 1, limit = 50 } = req.query;

      // Check if session exists
      const session = await this.chatSessionRepository.findById(sessionId);

      if (!session) {
        return res.status(404).json({
          success: false,
          error: {
            code: "ERR_SESSION_NOT_FOUND",
            message: "Chat session not found",
          },
        });
      }

      // Check if user has access to this session if it belongs to a user
      if (
        session.user_id &&
        req.user?.userId !== session.user_id &&
        req.user?.role !== "admin"
      ) {
        return res.status(403).json({
          success: false,
          error: {
            code: "ERR_FORBIDDEN",
            message:
              "You do not have permission to access messages from this session",
          },
        });
      }

      const offset = (Number(page) - 1) * Number(limit);

      const messages = await this.chatMessageRepository.findBySessionId(
        sessionId,
        {
          limit: Number(limit),
          offset,
        },
      );

      // Get attachments for each message
      const messagesWithAttachments = await Promise.all(
        messages.data.map(async (message) => {
          const attachments = await this.attachmentRepository.findByMessageId(
            message.id,
          );
          return { ...message, attachments };
        }),
      );

      return res.json({
        success: true,
        data: {
          messages: messagesWithAttachments,
          total: messages.total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(messages.total / Number(limit)),
        },
      });
    } catch (error) {
      logger.error("Error in ChatController.getSessionMessages:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred while fetching messages",
        },
      });
    }
  };

  /**
   * Update message status
   */
  updateMessageStatus = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { messageId } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({
          success: false,
          error: {
            code: "ERR_MISSING_STATUS",
            message: "Status is required",
          },
        });
      }

      // Check if message exists
      const message = await this.chatMessageRepository.findById(messageId);

      if (!message) {
        return res.status(404).json({
          success: false,
          error: {
            code: "ERR_MESSAGE_NOT_FOUND",
            message: "Message not found",
          },
        });
      }

      // Get session to check permissions
      const session = await this.chatSessionRepository.findById(
        message.session_id,
      );

      if (!session) {
        return res.status(404).json({
          success: false,
          error: {
            code: "ERR_SESSION_NOT_FOUND",
            message: "Chat session not found",
          },
        });
      }

      // Check if user has access to this session if it belongs to a user
      if (
        session.user_id &&
        req.user?.userId !== session.user_id &&
        req.user?.role !== "admin"
      ) {
        return res.status(403).json({
          success: false,
          error: {
            code: "ERR_FORBIDDEN",
            message: "You do not have permission to update this message",
          },
        });
      }

      // Update message status
      const updatedMessage = await this.chatMessageRepository.updateStatus(
        messageId,
        status,
      );

      return res.json({
        success: true,
        data: updatedMessage,
      });
    } catch (error) {
      logger.error("Error in ChatController.updateMessageStatus:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred while updating message status",
        },
      });
    }
  };
}

export default new ChatController();
