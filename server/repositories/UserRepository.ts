/**
 * User Repository
 *
 * Repository for user-related database operations
 * Implements the IUserRepository interface
 */

import { BaseRepository } from "./BaseRepository";
import { User as UserType } from "../types";
import { hash, compare } from "bcrypt";
import logger from "../../src/utils/logger";
import { User } from "../core/domain/entities/User";
import {
  IUserRepository,
  QueryOptions,
  QueryResult,
} from "../core/domain/repositories/IUserRepository";

export class UserRepository
  extends BaseRepository<UserType>
  implements IUserRepository
{
  constructor() {
    super("users");
  }

  /**
   * Find a user by ID
   */
  async findById(id: string): Promise<User | null> {
    try {
      const userRecord = await super.findOne(id);
      if (!userRecord) return null;

      return new User(userRecord as any);
    } catch (error) {
      logger.error("Error in UserRepository.findById:", error);
      throw error;
    }
  }

  /**
   * Find a user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    try {
      const db = await this.getDb();
      const [results] = await db.query(
        `SELECT * FROM ${this.tableName} WHERE email = ?`,
        { replacements: [email] },
      );

      if (results.length === 0) return null;

      return new User(results[0] as any);
    } catch (error) {
      logger.error("Error in UserRepository.findByEmail:", error);
      throw error;
    }
  }

  /**
   * Find all users with filtering options
   */
  async findAll(options?: QueryOptions): Promise<QueryResult<User>> {
    try {
      const result = await super.findAll(options as any);

      // Convert raw data to domain entities
      const users = result.data.map((user) => new User(user as any));

      return {
        data: users,
        total: result.total,
      };
    } catch (error) {
      logger.error("Error in UserRepository.findAll:", error);
      throw error;
    }
  }

  /**
   * Create a new user with hashed password
   */
  async create(userData: Partial<User>): Promise<User> {
    try {
      const userDataObj =
        userData instanceof User ? userData.toObject() : userData;

      if (!userDataObj.password) {
        throw new Error("Password is required");
      }

      // Hash the password
      const hashedPassword = await hash(userDataObj.password, 10);

      // Create user with hashed password
      const createdUser = await super.create({
        ...userDataObj,
        password: hashedPassword,
        role: userDataObj.role || "user",
        status: userDataObj.status || "active",
      } as any);

      return new User(createdUser as any);
    } catch (error) {
      logger.error("Error in UserRepository.create:", error);
      throw error;
    }
  }

  /**
   * Update a user
   */
  async update(id: string, userData: Partial<User>): Promise<User> {
    try {
      const userDataObj =
        userData instanceof User ? userData.toObject() : userData;
      await super.update(id, userDataObj as any);
      const updatedUser = await this.findById(id);
      if (!updatedUser) {
        throw new Error(`User with ID ${id} not found after update`);
      }
      return updatedUser;
    } catch (error) {
      logger.error("Error in UserRepository.update:", error);
      throw error;
    }
  }

  /**
   * Delete a user
   */
  async delete(id: string): Promise<boolean> {
    try {
      await super.delete(id);
      return true;
    } catch (error) {
      logger.error("Error in UserRepository.delete:", error);
      throw error;
    }
  }

  /**
   * Verify user credentials
   */
  async verifyCredentials(
    email: string,
    password: string,
  ): Promise<User | null> {
    try {
      const user = await this.findByEmail(email);

      if (!user) {
        return null;
      }

      // Check if password matches
      const isPasswordValid = await compare(password, user.password);

      return isPasswordValid ? user : null;
    } catch (error) {
      logger.error("Error in UserRepository.verifyCredentials:", error);
      throw error;
    }
  }

  /**
   * Update user password
   */
  async updatePassword(userId: string, newPassword: string): Promise<boolean> {
    try {
      // Hash the new password
      const hashedPassword = await hash(newPassword, 10);

      // Update the user's password
      await super.update(userId, { password: hashedPassword } as any);

      return true;
    } catch (error) {
      logger.error("Error in UserRepository.updatePassword:", error);
      throw error;
    }
  }

  /**
   * Update user last login timestamp
   */
  async updateLastLogin(userId: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      await super.update(userId, { last_login: now } as any);
    } catch (error) {
      logger.error("Error in UserRepository.updateLastLogin:", error);
      throw error;
    }
  }

  /**
   * Get users with role-based filtering
   */
  async getUsersByRole(
    role: string,
    options: QueryOptions = {},
  ): Promise<QueryResult<User>> {
    try {
      const result = await this.findAll({
        ...options,
        filters: { role },
      });

      return result;
    } catch (error) {
      logger.error("Error in UserRepository.getUsersByRole:", error);
      throw error;
    }
  }
}
