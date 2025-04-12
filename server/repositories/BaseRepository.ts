/**
 * Base Repository
 *
 * Abstract base class for all repositories providing common database operations
 */

import { Sequelize } from "sequelize";
import { getMySQLClient } from "../utils/dbHelpers";
import { v4 as uuidv4 } from "uuid";
import logger from "../../src/utils/logger";

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: "ASC" | "DESC";
  filters?: Record<string, any>;
}

export abstract class BaseRepository<T> {
  protected tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  /**
   * Get database connection
   */
  protected async getDb(): Promise<Sequelize> {
    try {
      return await getMySQLClient();
    } catch (error) {
      logger.error(
        `Database connection error in ${this.tableName} repository:`,
        error,
      );
      throw new Error(`Failed to connect to database: ${error.message}`);
    }
  }

  /**
   * Find a record by ID
   */
  async findById(id: string): Promise<T | null> {
    try {
      const db = await this.getDb();
      const [results] = await db.query(
        `SELECT * FROM ${this.tableName} WHERE id = ?`,
        { replacements: [id] },
      );

      return results.length > 0 ? (results[0] as T) : null;
    } catch (error) {
      logger.error(`Error in ${this.tableName}.findById:`, error);
      throw error;
    }
  }

  /**
   * Find all records with pagination and filtering
   */
  async findAll(
    options: QueryOptions = {},
  ): Promise<{ data: T[]; total: number }> {
    try {
      const db = await this.getDb();
      const {
        limit = 50,
        offset = 0,
        orderBy = "created_at",
        orderDirection = "DESC",
        filters = {},
      } = options;

      // Build WHERE clause from filters
      const whereConditions: string[] = [];
      const replacements: any[] = [];

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          whereConditions.push(`${key} = ?`);
          replacements.push(value);
        }
      });

      const whereClause =
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(" AND ")}`
          : "";

      // Get total count for pagination
      const [countResult] = await db.query(
        `SELECT COUNT(*) as total FROM ${this.tableName} ${whereClause}`,
        { replacements },
      );

      const total = countResult[0].total;

      // Get paginated data
      const [data] = await db.query(
        `SELECT * FROM ${this.tableName} 
         ${whereClause} 
         ORDER BY ${orderBy} ${orderDirection} 
         LIMIT ? OFFSET ?`,
        {
          replacements: [...replacements, limit, offset],
        },
      );

      return {
        data: data as T[],
        total,
      };
    } catch (error) {
      logger.error(`Error in ${this.tableName}.findAll:`, error);
      throw error;
    }
  }

  /**
   * Create a new record
   */
  async create(data: Partial<T>): Promise<T> {
    try {
      const db = await this.getDb();
      const now = new Date().toISOString();

      // Add id, created_at, and updated_at if not provided
      const entityData = {
        id: uuidv4(),
        created_at: now,
        updated_at: now,
        ...data,
      };

      // Build query dynamically based on data properties
      const columns = Object.keys(entityData).join(", ");
      const placeholders = Object.keys(entityData)
        .map(() => "?")
        .join(", ");
      const values = Object.values(entityData);

      await db.query(
        `INSERT INTO ${this.tableName} (${columns}) VALUES (${placeholders})`,
        { replacements: values },
      );

      return entityData as T;
    } catch (error) {
      logger.error(`Error in ${this.tableName}.create:`, error);
      throw error;
    }
  }

  /**
   * Update a record
   */
  async update(id: string, data: Partial<T>): Promise<T> {
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

      const values = [...Object.values(updateData), id];

      await db.query(`UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`, {
        replacements: values,
      });

      // Fetch and return the updated record
      return (await this.findById(id)) as T;
    } catch (error) {
      logger.error(`Error in ${this.tableName}.update:`, error);
      throw error;
    }
  }

  /**
   * Delete a record
   */
  async delete(id: string): Promise<boolean> {
    try {
      const db = await this.getDb();

      const [result] = await db.query(
        `DELETE FROM ${this.tableName} WHERE id = ?`,
        { replacements: [id] },
      );

      return result.affectedRows > 0;
    } catch (error) {
      logger.error(`Error in ${this.tableName}.delete:`, error);
      throw error;
    }
  }

  /**
   * Execute a custom query
   */
  async executeQuery<R>(query: string, replacements: any[] = []): Promise<R[]> {
    try {
      const db = await this.getDb();
      const [results] = await db.query(query, { replacements });
      return results as R[];
    } catch (error) {
      logger.error(`Error in ${this.tableName}.executeQuery:`, error);
      throw error;
    }
  }
}
