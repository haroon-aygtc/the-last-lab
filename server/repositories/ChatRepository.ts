/**
 * Chat Repository
 *
 * Repository for chat-related database operations
 */

import { BaseRepository } from "./BaseRepository";
import { ChatSession, ChatMessage, Attachment } from "../types";
import logger from "../../src/utils/logger";

export class ChatSessionRepository extends BaseRepository<ChatSession> {
  constructor() {
    super("chat_sessions");
  }

  /**
   * Find sessions by user ID
   */
  async findByUserId(
    userId: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<{ data: ChatSession[]; total: number }> {
    try {
      return await this.findAll({
        ...options,
        filters: { user_id: userId },
      });
    } catch (error) {
      logger.error("Error in ChatSessionRepository.findByUserId:", error);
      throw error;
    }
  }

  /**
   * Find sessions by widget ID
   */
  async findByWidgetId(
    widgetId: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<{ data: ChatSession[]; total: number }> {
    try {
      return await this.findAll({
        ...options,
        filters: { widget_id: widgetId },
      });
    } catch (error) {
      logger.error("Error in ChatSessionRepository.findByWidgetId:", error);
      throw error;
    }
  }

  /**
   * Update session status
   */
  async updateStatus(
    sessionId: string,
    status: "active" | "closed" | "archived",
  ): Promise<ChatSession> {
    try {
      return await this.update(sessionId, { status });
    } catch (error) {
      logger.error("Error in ChatSessionRepository.updateStatus:", error);
      throw error;
    }
  }
}

export class ChatMessageRepository extends BaseRepository<ChatMessage> {
  constructor() {
    super("chat_messages");
  }

  /**
   * Find messages by session ID
   */
  async findBySessionId(
    sessionId: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<{ data: ChatMessage[]; total: number }> {
    try {
      return await this.findAll({
        ...options,
        filters: { session_id: sessionId },
        orderBy: "created_at",
        orderDirection: "ASC",
      });
    } catch (error) {
      logger.error("Error in ChatMessageRepository.findBySessionId:", error);
      throw error;
    }
  }

  /**
   * Create a message with attachments
   */
  async createWithAttachments(
    messageData: Partial<ChatMessage>,
    attachments?: Partial<Attachment>[],
  ): Promise<ChatMessage> {
    const db = await this.getDb();

    try {
      // Start transaction
      await db.query("START TRANSACTION");

      // Create the message
      const message = await this.create(messageData);

      // Create attachments if any
      if (attachments && attachments.length > 0) {
        const attachmentRepository = new AttachmentRepository();

        for (const attachment of attachments) {
          await attachmentRepository.create({
            ...attachment,
            message_id: message.id,
          });
        }
      }

      // Commit transaction
      await db.query("COMMIT");

      return message;
    } catch (error) {
      // Rollback transaction on error
      await db.query("ROLLBACK");
      logger.error(
        "Error in ChatMessageRepository.createWithAttachments:",
        error,
      );
      throw error;
    }
  }

  /**
   * Update message status
   */
  async updateStatus(
    messageId: string,
    status: "sending" | "sent" | "delivered" | "read" | "error",
  ): Promise<ChatMessage> {
    try {
      return await this.update(messageId, { status });
    } catch (error) {
      logger.error("Error in ChatMessageRepository.updateStatus:", error);
      throw error;
    }
  }
}

export class AttachmentRepository extends BaseRepository<Attachment> {
  constructor() {
    super("attachments");
  }

  /**
   * Find attachments by message ID
   */
  async findByMessageId(messageId: string): Promise<Attachment[]> {
    try {
      const { data } = await this.findAll({
        filters: { message_id: messageId },
      });

      return data;
    } catch (error) {
      logger.error("Error in AttachmentRepository.findByMessageId:", error);
      throw error;
    }
  }
}
