/**
 * Context Rule Controller
 *
 * Controller for context rule-related operations
 */

import { Request, Response } from "express";
import { ContextRuleRepository } from "../repositories/ContextRuleRepository";
import { UserActivityRepository } from "../repositories/UserActivityRepository";
import logger from "../../src/utils/logger";
import { AuthenticatedRequest } from "../types";

export class ContextRuleController {
  private contextRuleRepository: ContextRuleRepository;
  private userActivityRepository: UserActivityRepository;

  constructor() {
    this.contextRuleRepository = new ContextRuleRepository();
    this.userActivityRepository = new UserActivityRepository();
  }

  /**
   * Create a new context rule
   */
  createContextRule = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, description, rules } = req.body;

      if (!req.user || !req.user.userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: "ERR_UNAUTHORIZED",
            message: "Authentication required",
          },
        });
      }

      if (!name || !rules) {
        return res.status(400).json({
          success: false,
          error: {
            code: "ERR_MISSING_FIELDS",
            message: "Name and rules are required",
          },
        });
      }

      // Create context rule
      const contextRule = await this.contextRuleRepository.create({
        user_id: req.user.userId,
        name,
        description,
        rules,
        status: "active",
      });

      // Log activity
      await this.userActivityRepository.logActivity({
        user_id: req.user.userId,
        action: "context_rule_create",
        details: { ruleId: contextRule.id, ruleName: name },
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return res.status(201).json({
        success: true,
        data: contextRule,
      });
    } catch (error) {
      logger.error("Error in ContextRuleController.createContextRule:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred while creating context rule",
        },
      });
    }
  };

  /**
   * Get all context rules for a user
   */
  getUserContextRules = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 20, status } = req.query;

      // Check if user is requesting their own context rules or is an admin
      if (req.user?.userId !== userId && req.user?.role !== "admin") {
        return res.status(403).json({
          success: false,
          error: {
            code: "ERR_FORBIDDEN",
            message: "You do not have permission to access these context rules",
          },
        });
      }

      const offset = (Number(page) - 1) * Number(limit);

      let contextRules;
      if (status === "active") {
        contextRules = await this.contextRuleRepository.findActiveByUserId(
          userId,
          {
            limit: Number(limit),
            offset,
          },
        );
      } else {
        contextRules = await this.contextRuleRepository.findByUserId(userId, {
          limit: Number(limit),
          offset,
        });
      }

      return res.json({
        success: true,
        data: contextRules.data,
        meta: {
          total: contextRules.total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(contextRules.total / Number(limit)),
        },
      });
    } catch (error) {
      logger.error(
        "Error in ContextRuleController.getUserContextRules:",
        error,
      );
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred while fetching context rules",
        },
      });
    }
  };

  /**
   * Get a context rule by ID
   */
  getContextRule = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const contextRule = await this.contextRuleRepository.findById(id);

      if (!contextRule) {
        return res.status(404).json({
          success: false,
          error: {
            code: "ERR_CONTEXT_RULE_NOT_FOUND",
            message: "Context rule not found",
          },
        });
      }

      // Check if user has access to this context rule
      if (
        req.user?.userId !== contextRule.user_id &&
        req.user?.role !== "admin"
      ) {
        return res.status(403).json({
          success: false,
          error: {
            code: "ERR_FORBIDDEN",
            message: "You do not have permission to access this context rule",
          },
        });
      }

      return res.json({
        success: true,
        data: contextRule,
      });
    } catch (error) {
      logger.error("Error in ContextRuleController.getContextRule:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred while fetching context rule",
        },
      });
    }
  };

  /**
   * Update a context rule
   */
  updateContextRule = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { name, description, rules, status } = req.body;

      // Check if context rule exists
      const contextRule = await this.contextRuleRepository.findById(id);

      if (!contextRule) {
        return res.status(404).json({
          success: false,
          error: {
            code: "ERR_CONTEXT_RULE_NOT_FOUND",
            message: "Context rule not found",
          },
        });
      }

      // Check if user has access to this context rule
      if (
        req.user?.userId !== contextRule.user_id &&
        req.user?.role !== "admin"
      ) {
        return res.status(403).json({
          success: false,
          error: {
            code: "ERR_FORBIDDEN",
            message: "You do not have permission to update this context rule",
          },
        });
      }

      // Update context rule
      const updateData: any = {};
      if (name) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (rules) updateData.rules = rules;
      if (status) updateData.status = status;

      const updatedContextRule = await this.contextRuleRepository.update(
        id,
        updateData,
      );

      // Log activity
      await this.userActivityRepository.logActivity({
        user_id: req.user?.userId as string,
        action: "context_rule_update",
        details: { ruleId: id, updates: Object.keys(updateData) },
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return res.json({
        success: true,
        data: updatedContextRule,
      });
    } catch (error) {
      logger.error("Error in ContextRuleController.updateContextRule:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred while updating context rule",
        },
      });
    }
  };

  /**
   * Delete a context rule
   */
  deleteContextRule = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      // Check if context rule exists
      const contextRule = await this.contextRuleRepository.findById(id);

      if (!contextRule) {
        return res.status(404).json({
          success: false,
          error: {
            code: "ERR_CONTEXT_RULE_NOT_FOUND",
            message: "Context rule not found",
          },
        });
      }

      // Check if user has access to this context rule
      if (
        req.user?.userId !== contextRule.user_id &&
        req.user?.role !== "admin"
      ) {
        return res.status(403).json({
          success: false,
          error: {
            code: "ERR_FORBIDDEN",
            message: "You do not have permission to delete this context rule",
          },
        });
      }

      // Delete context rule
      await this.contextRuleRepository.delete(id);

      // Log activity
      await this.userActivityRepository.logActivity({
        user_id: req.user?.userId as string,
        action: "context_rule_delete",
        details: { ruleId: id, ruleName: contextRule.name },
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return res.json({
        success: true,
        message: "Context rule deleted successfully",
      });
    } catch (error) {
      logger.error("Error in ContextRuleController.deleteContextRule:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred while deleting context rule",
        },
      });
    }
  };

  /**
   * Update context rule status
   */
  updateContextRuleStatus = async (
    req: AuthenticatedRequest,
    res: Response,
  ) => {
    try {
      const { id } = req.params;
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

      // Check if context rule exists
      const contextRule = await this.contextRuleRepository.findById(id);

      if (!contextRule) {
        return res.status(404).json({
          success: false,
          error: {
            code: "ERR_CONTEXT_RULE_NOT_FOUND",
            message: "Context rule not found",
          },
        });
      }

      // Check if user has access to this context rule
      if (
        req.user?.userId !== contextRule.user_id &&
        req.user?.role !== "admin"
      ) {
        return res.status(403).json({
          success: false,
          error: {
            code: "ERR_FORBIDDEN",
            message: "You do not have permission to update this context rule",
          },
        });
      }

      // Update context rule status
      const updatedContextRule = await this.contextRuleRepository.updateStatus(
        id,
        status,
      );

      // Log activity
      await this.userActivityRepository.logActivity({
        user_id: req.user?.userId as string,
        action: "context_rule_status_update",
        details: { ruleId: id, status },
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return res.json({
        success: true,
        data: updatedContextRule,
      });
    } catch (error) {
      logger.error(
        "Error in ContextRuleController.updateContextRuleStatus:",
        error,
      );
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred while updating context rule status",
        },
      });
    }
  };
}

export default new ContextRuleController();
