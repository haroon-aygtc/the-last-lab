/**
 * Widget Repository
 *
 * Repository for widget-related database operations
 */

import { BaseRepository } from "./BaseRepository";
import { Widget } from "../types";
import logger from "../../src/utils/logger";

export class WidgetRepository extends BaseRepository<Widget> {
  constructor() {
    super("widgets");
  }

  /**
   * Find widgets by user ID
   */
  async findByUserId(
    userId: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<{ data: Widget[]; total: number }> {
    try {
      return await this.findAll({
        ...options,
        filters: { user_id: userId },
      });
    } catch (error) {
      logger.error("Error in WidgetRepository.findByUserId:", error);
      throw error;
    }
  }

  /**
   * Find active widgets by user ID
   */
  async findActiveByUserId(
    userId: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<{ data: Widget[]; total: number }> {
    try {
      const db = await this.getDb();

      const { limit = 50, offset = 0 } = options;

      // Get total count
      const [countResult] = await db.query(
        `SELECT COUNT(*) as total FROM ${this.tableName} 
         WHERE user_id = ? AND status = 'active'`,
        { replacements: [userId] },
      );

      const total = countResult[0].total;

      // Get paginated data
      const [data] = await db.query(
        `SELECT * FROM ${this.tableName} 
         WHERE user_id = ? AND status = 'active' 
         ORDER BY created_at DESC 
         LIMIT ? OFFSET ?`,
        {
          replacements: [userId, limit, offset],
        },
      );

      return {
        data: data as Widget[],
        total,
      };
    } catch (error) {
      logger.error("Error in WidgetRepository.findActiveByUserId:", error);
      throw error;
    }
  }

  /**
   * Update widget status
   */
  async updateStatus(
    widgetId: string,
    status: "active" | "inactive" | "draft",
  ): Promise<Widget> {
    try {
      return await this.update(widgetId, { status });
    } catch (error) {
      logger.error("Error in WidgetRepository.updateStatus:", error);
      throw error;
    }
  }

  /**
   * Update widget configuration
   */
  async updateConfig(
    widgetId: string,
    config: Record<string, any>,
  ): Promise<Widget> {
    try {
      return await this.update(widgetId, { config });
    } catch (error) {
      logger.error("Error in WidgetRepository.updateConfig:", error);
      throw error;
    }
  }
}
