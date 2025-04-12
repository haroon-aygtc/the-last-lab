/**
 * User Database Service Module
 *
 * This module provides database interaction functions for user management.
 */

import { getMySQLClient, QueryTypes } from "@/services/mysqlClient";
import User, { getSafeUser } from "@/models/User";
import UserActivity from "@/models/UserActivity";
import logger from "@/utils/logger";

/**
 * Get a user by ID from the database
 * @param userId User ID
 * @returns User object or null if not found
 */
export const getUserById = async (userId: string): Promise<User | null> => {
  try {
    const sequelize = await getMySQLClient();
    const users = await sequelize.query(
      "SELECT * FROM users WHERE id = :userId LIMIT 1",
      {
        replacements: { userId },
        type: QueryTypes.SELECT,
      },
    );

    if (!users || users.length === 0) {
      return null;
    }

    // Convert to User model instance
    const user = User.build(users[0], { isNewRecord: false });
    return user;
  } catch (error) {
    logger.error(`Error getting user by ID ${userId}`, error);
    return null;
  }
};

/**
 * Get all users from the database
 * @param limit Maximum number of users to return
 * @param offset Offset for pagination
 * @param includeInactive Include inactive users
 * @returns Array of user objects
 */
export const getAllUsers = async (
  limit: number = 50,
  offset: number = 0,
  includeInactive: boolean = false,
): Promise<User[]> => {
  try {
    const sequelize = await getMySQLClient();

    let query = "SELECT * FROM users";
    const replacements: any = {};

    if (!includeInactive) {
      query += " WHERE is_active = :isActive";
      replacements.isActive = true;
    }

    query += " ORDER BY created_at DESC LIMIT :limit OFFSET :offset";
    replacements.limit = limit;
    replacements.offset = offset;

    const users = await sequelize.query(query, {
      replacements,
      type: QueryTypes.SELECT,
    });

    // Convert to User model instances
    return users.map((user: any) => User.build(user, { isNewRecord: false }));
  } catch (error) {
    logger.error("Error getting all users", error);
    return [];
  }
};

/**
 * Update a user in the database
 * @param userId User ID
 * @param updates Updates to apply
 * @returns Updated user object or null if failed
 */
export const updateUserInDb = async (
  userId: string,
  updates: Record<string, any>,
): Promise<User | null> => {
  try {
    const sequelize = await getMySQLClient();

    // Add updated_at timestamp
    updates.updated_at = new Date().toISOString();

    // Build SET clause for SQL
    const setClause = Object.keys(updates)
      .map((key) => `${key} = :${key}`)
      .join(", ");

    // Add userId to replacements
    const replacements = { ...updates, userId };

    await sequelize.query(`UPDATE users SET ${setClause} WHERE id = :userId`, {
      replacements,
      type: QueryTypes.UPDATE,
    });

    // Get the updated user
    return getUserById(userId);
  } catch (error) {
    logger.error(`Error updating user ${userId} in database`, error);
    return null;
  }
};

/**
 * Get user activity from the database
 * @param userId User ID
 * @param limit Maximum number of activities to return
 * @param offset Offset for pagination
 * @returns Array of user activity objects
 */
export const getUserActivityFromDb = async (
  userId: string,
  limit: number = 50,
  offset: number = 0,
): Promise<UserActivity[]> => {
  try {
    const sequelize = await getMySQLClient();
    const activities = await sequelize.query(
      "SELECT * FROM user_activity WHERE user_id = :userId ORDER BY created_at DESC LIMIT :limit OFFSET :offset",
      {
        replacements: { userId, limit, offset },
        type: QueryTypes.SELECT,
      },
    );

    // Convert to UserActivity model instances
    return activities.map((activity: any) =>
      UserActivity.build(activity, { isNewRecord: false }),
    );
  } catch (error) {
    logger.error(`Error getting activity for user ${userId}`, error);
    return [];
  }
};

/**
 * Log user activity to the database
 * @param userId User ID
 * @param action Activity action
 * @param metadata Optional metadata
 * @param ipAddress Optional IP address
 * @param userAgent Optional user agent
 * @returns Success status
 */
export const logUserActivityToDb = async (
  userId: string,
  action: string,
  metadata?: Record<string, any>,
  ipAddress?: string,
  userAgent?: string,
): Promise<boolean> => {
  try {
    const sequelize = await getMySQLClient();

    await sequelize.query(
      "INSERT INTO user_activity (id, user_id, action, ip_address, user_agent, metadata, created_at) VALUES (UUID(), :userId, :action, :ipAddress, :userAgent, :metadata, :createdAt)",
      {
        replacements: {
          userId,
          action,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
          metadata: metadata ? JSON.stringify(metadata) : null,
          createdAt: new Date().toISOString(),
        },
        type: QueryTypes.INSERT,
      },
    );

    // Update last_login_at if action is login
    if (action === "login") {
      await sequelize.query(
        "UPDATE users SET last_login_at = :now WHERE id = :userId",
        {
          replacements: {
            now: new Date().toISOString(),
            userId,
          },
          type: QueryTypes.UPDATE,
        },
      );
    }

    return true;
  } catch (error) {
    logger.error(`Error logging activity for user ${userId}`, error);
    return false;
  }
};
