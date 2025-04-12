/**
 * User Session Repository Implementation
 *
 * Implements the IUserSessionRepository interface for user session data access operations.
 */

import { BaseRepository } from "./BaseRepository";
import { UserSession } from "../types";
import { IUserSessionRepository } from "../core/domain/repositories/IUserSessionRepository";
import logger from "../../src/utils/logger";

export class UserSessionRepository
  extends BaseRepository<UserSession>
  implements IUserSessionRepository
{
  constructor() {
    super("user_sessions");
  }

  /**
   * Find session by ID
   */
  async findById(id: string): Promise<UserSession | null> {
    try {
      return await this.findOne(id);
    } catch (error) {
      logger.error("Error in UserSessionRepository.findById:", error);
      throw error;
    }
  }

  /**
   * Find session by token
   */
  async findByToken(token: string): Promise<UserSession | null> {
    try {
      const db = await this.getDb();

      const [results] = await db.query(
        `SELECT * FROM ${this.tableName} WHERE token = ?`,
        { replacements: [token] },
      );

      return results.length > 0 ? (results[0] as UserSession) : null;
    } catch (error) {
      logger.error("Error in UserSessionRepository.findByToken:", error);
      throw error;
    }
  }

  /**
   * Find session by refresh token
   */
  async findByRefreshToken(refreshToken: string): Promise<UserSession | null> {
    try {
      const db = await this.getDb();

      const [results] = await db.query(
        `SELECT * FROM ${this.tableName} WHERE refresh_token = ?`,
        { replacements: [refreshToken] },
      );

      return results.length > 0 ? (results[0] as UserSession) : null;
    } catch (error) {
      logger.error("Error in UserSessionRepository.findByRefreshToken:", error);
      throw error;
    }
  }

  /**
   * Find active sessions by user ID
   */
  async findActiveSessionsByUserId(userId: string): Promise<UserSession[]> {
    try {
      const db = await this.getDb();

      const [results] = await db.query(
        `SELECT * FROM ${this.tableName} 
         WHERE user_id = ? AND status = 'active' AND expires_at > NOW() 
         ORDER BY created_at DESC`,
        { replacements: [userId] },
      );

      return results as UserSession[];
    } catch (error) {
      logger.error(
        "Error in UserSessionRepository.findActiveSessionsByUserId:",
        error,
      );
      throw error;
    }
  }

  /**
   * Create a new session
   */
  async create(sessionData: Partial<UserSession>): Promise<string> {
    try {
      const session = await super.create(sessionData);
      return session.id;
    } catch (error) {
      logger.error("Error in UserSessionRepository.create:", error);
      throw error;
    }
  }

  /**
   * Update a session
   */
  async update(
    id: string,
    sessionData: Partial<UserSession>,
  ): Promise<boolean> {
    try {
      await super.update(id, sessionData);
      return true;
    } catch (error) {
      logger.error("Error in UserSessionRepository.update:", error);
      throw error;
    }
  }

  /**
   * Terminate a session
   */
  async terminateSession(id: string): Promise<boolean> {
    try {
      await this.update(id, { status: "terminated" });
      return true;
    } catch (error) {
      logger.error("Error in UserSessionRepository.terminateSession:", error);
      throw error;
    }
  }

  /**
   * Terminate all user sessions
   */
  async terminateAllUserSessions(userId: string): Promise<boolean> {
    try {
      const db = await this.getDb();

      const query = `UPDATE ${this.tableName} 
                   SET status = 'terminated', updated_at = ? 
                   WHERE user_id = ? AND status = 'active'`;
      const replacements = [new Date().toISOString(), userId];

      await db.query(query, { replacements });

      return true;
    } catch (error) {
      logger.error(
        "Error in UserSessionRepository.terminateAllUserSessions:",
        error,
      );
      throw error;
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const db = await this.getDb();

      const query = `UPDATE ${this.tableName} 
                   SET status = 'expired', updated_at = ? 
                   WHERE status = 'active' AND expires_at < NOW()`;
      const replacements = [new Date().toISOString()];

      const [result] = await db.query(query, { replacements });

      return result.affectedRows;
    } catch (error) {
      logger.error(
        "Error in UserSessionRepository.cleanupExpiredSessions:",
        error,
      );
      throw error;
    }
  }
}
