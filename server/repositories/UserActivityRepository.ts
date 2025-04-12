/**
 * User Activity Repository
 *
 * Repository for user activity-related database operations
 */

import { BaseRepository } from "./BaseRepository";
import { UserActivity, UserSession } from "../types";
import logger from "../../src/utils/logger";

export class UserActivityRepository extends BaseRepository<UserActivity> {
  constructor() {
    super("user_activity");
  }

  /**
   * Find activities by user ID
   */
  async findByUserId(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      startDate?: string;
      endDate?: string;
      action?: string;
    } = {},
  ): Promise<{ data: UserActivity[]; total: number }> {
    try {
      const db = await this.getDb();
      const { limit = 50, offset = 0, startDate, endDate, action } = options;

      // Build query conditions
      let whereClause = "WHERE user_id = ?";
      const replacements: any[] = [userId];

      if (startDate) {
        whereClause += " AND created_at >= ?";
        replacements.push(startDate);
      }

      if (endDate) {
        whereClause += " AND created_at <= ?";
        replacements.push(endDate);
      }

      if (action) {
        whereClause += " AND action = ?";
        replacements.push(action);
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
        data: data as UserActivity[],
        total,
      };
    } catch (error) {
      logger.error("Error in UserActivityRepository.findByUserId:", error);
      throw error;
    }
  }

  /**
   * Log user activity
   */
  async logActivity(activity: Partial<UserActivity>): Promise<UserActivity> {
    try {
      return await this.create(activity);
    } catch (error) {
      logger.error("Error in UserActivityRepository.logActivity:", error);
      throw error;
    }
  }
}

export class UserSessionRepository extends BaseRepository<UserSession> {
  constructor() {
    super("user_sessions");
  }

  /**
   * Find active sessions by user ID
   */
  async findActiveByUserId(userId: string): Promise<UserSession[]> {
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
      logger.error("Error in UserSessionRepository.findActiveByUserId:", error);
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
   * Terminate a session
   */
  async terminateSession(sessionId: string): Promise<boolean> {
    try {
      await this.update(sessionId, { status: "terminated" });
      return true;
    } catch (error) {
      logger.error("Error in UserSessionRepository.terminateSession:", error);
      throw error;
    }
  }

  /**
   * Terminate all sessions for a user except the current one
   */
  async terminateAllExcept(
    userId: string,
    currentSessionId?: string,
  ): Promise<number> {
    try {
      const db = await this.getDb();

      let query = `UPDATE ${this.tableName} 
                   SET status = 'terminated', updated_at = ? 
                   WHERE user_id = ? AND status = 'active'`;
      const replacements: any[] = [new Date().toISOString(), userId];

      if (currentSessionId) {
        query += ` AND id != ?`;
        replacements.push(currentSessionId);
      }

      const [result] = await db.query(query, { replacements });

      return result.affectedRows;
    } catch (error) {
      logger.error("Error in UserSessionRepository.terminateAllExcept:", error);
      throw error;
    }
  }
}
