/**
 * Context Rule Repository
 *
 * Repository for context rule-related database operations
 */

import { BaseRepository } from "./BaseRepository";
import { ContextRule } from "../types";
import logger from "../../src/utils/logger";

export class ContextRuleRepository extends BaseRepository<ContextRule> {
  constructor() {
    super("context_rules");
  }

  /**
   * Find context rules by user ID
   */
  async findByUserId(
    userId: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<{ data: ContextRule[]; total: number }> {
    try {
      return await this.findAll({
        ...options,
        filters: { user_id: userId },
      });
    } catch (error) {
      logger.error("Error in ContextRuleRepository.findByUserId:", error);
      throw error;
    }
  }

  /**
   * Find active context rules by user ID
   */
  async findActiveByUserId(
    userId: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<{ data: ContextRule[]; total: number }> {
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
        data: data as ContextRule[],
        total,
      };
    } catch (error) {
      logger.error("Error in ContextRuleRepository.findActiveByUserId:", error);
      throw error;
    }
  }

  /**
   * Update context rule status
   */
  async updateStatus(
    ruleId: string,
    status: "active" | "inactive",
  ): Promise<ContextRule> {
    try {
      return await this.update(ruleId, { status });
    } catch (error) {
      logger.error("Error in ContextRuleRepository.updateStatus:", error);
      throw error;
    }
  }
}
