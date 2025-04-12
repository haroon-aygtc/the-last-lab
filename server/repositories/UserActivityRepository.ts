/**
 * User Activity Repository
 *
 * Repository for user activity-related database operations
 * Implements the IUserActivityRepository interface from the domain layer
 */

import { BaseRepository } from "./BaseRepository";
import { UserSession } from "../types";
import logger from "../../src/utils/logger";
import {
  IUserActivityRepository,
  UserActivity,
} from "../core/domain/repositories/IUserActivityRepository";

export class UserActivityRepository
  extends BaseRepository<UserActivity>
  implements IUserActivityRepository
{
  constructor() {
    super("user_activity");
  }

  /**
   * Log user activity
   * @param activity The activity to log
   * @returns The ID of the created activity
   */
  async logActivity(activity: UserActivity): Promise<string> {
    try {
      const result = await this.create(activity);
      return result.id || "";
    } catch (error) {
      logger.error("Error in UserActivityRepository.logActivity:", error);
      throw error;
    }
  }

  /**
   * Get activities by user ID
   * @param userId The user ID to get activities for
   * @param options Optional parameters for filtering and pagination
   * @returns Object containing the activities and total count
   */
  async getActivitiesByUserId(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      startDate?: string;
      endDate?: string;
      actions?: string[];
    } = {},
  ): Promise<{ data: UserActivity[]; total: number }> {
    try {
      const db = await this.getDb();
      const { limit = 50, offset = 0, startDate, endDate, actions } = options;

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

      if (actions && actions.length > 0) {
        whereClause += " AND action IN (?)";
        replacements.push(actions);
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
      logger.error(
        "Error in UserActivityRepository.getActivitiesByUserId:",
        error,
      );
      throw error;
    }
  }

  /**
   * Get recent activities across all users
   * @param options Optional parameters for filtering and pagination
   * @returns Object containing the activities and total count
   */
  async getRecentActivities(
    options: {
      limit?: number;
      offset?: number;
      startDate?: string;
      endDate?: string;
      actions?: string[];
    } = {},
  ): Promise<{ data: UserActivity[]; total: number }> {
    try {
      const db = await this.getDb();
      const { limit = 50, offset = 0, startDate, endDate, actions } = options;

      // Build query conditions
      let whereClause = "WHERE 1=1";
      const replacements: any[] = [];

      if (startDate) {
        whereClause += " AND created_at >= ?";
        replacements.push(startDate);
      }

      if (endDate) {
        whereClause += " AND created_at <= ?";
        replacements.push(endDate);
      }

      if (actions && actions.length > 0) {
        whereClause += " AND action IN (?)";
        replacements.push(actions);
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
      logger.error(
        "Error in UserActivityRepository.getRecentActivities:",
        error,
      );
      throw error;
    }
  }

  /**
   * Delete activities older than the specified date
   * @param date The cutoff date
   * @returns The number of deleted activities
   */
  async deleteActivitiesOlderThan(date: string): Promise<number> {
    try {
      const db = await this.getDb();

      const [result] = await db.query(
        `DELETE FROM ${this.tableName} WHERE created_at < ?`,
        { replacements: [date] },
      );

      return result.affectedRows || 0;
    } catch (error) {
      logger.error(
        "Error in UserActivityRepository.deleteActivitiesOlderThan:",
        error,
      );
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
