/**
 * Widget Controller
 *
 * Controller for widget-related operations
 */

import { Request, Response } from "express";
import { WidgetRepository } from "../repositories/WidgetRepository";
import { UserActivityRepository } from "../repositories/UserActivityRepository";
import logger from "../../src/utils/logger";
import { AuthenticatedRequest } from "../types";

export class WidgetController {
  private widgetRepository: WidgetRepository;
  private userActivityRepository: UserActivityRepository;

  constructor() {
    this.widgetRepository = new WidgetRepository();
    this.userActivityRepository = new UserActivityRepository();
  }

  /**
   * Create a new widget
   */
  createWidget = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, config } = req.body;

      if (!req.user || !req.user.userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: "ERR_UNAUTHORIZED",
            message: "Authentication required",
          },
        });
      }

      if (!name) {
        return res.status(400).json({
          success: false,
          error: {
            code: "ERR_MISSING_NAME",
            message: "Widget name is required",
          },
        });
      }

      // Create widget
      const widget = await this.widgetRepository.create({
        user_id: req.user.userId,
        name,
        status: "draft",
        config: config || {},
      });

      // Log activity
      await this.userActivityRepository.logActivity({
        user_id: req.user.userId,
        action: "widget_create",
        details: { widgetId: widget.id, widgetName: name },
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return res.status(201).json({
        success: true,
        data: widget,
      });
    } catch (error) {
      logger.error("Error in WidgetController.createWidget:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred while creating widget",
        },
      });
    }
  };

  /**
   * Get all widgets for a user
   */
  getUserWidgets = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 20, status } = req.query;

      // Check if user is requesting their own widgets or is an admin
      if (req.user?.userId !== userId && req.user?.role !== "admin") {
        return res.status(403).json({
          success: false,
          error: {
            code: "ERR_FORBIDDEN",
            message: "You do not have permission to access these widgets",
          },
        });
      }

      const offset = (Number(page) - 1) * Number(limit);

      let widgets;
      if (status === "active") {
        widgets = await this.widgetRepository.findActiveByUserId(userId, {
          limit: Number(limit),
          offset,
        });
      } else {
        widgets = await this.widgetRepository.findByUserId(userId, {
          limit: Number(limit),
          offset,
        });
      }

      return res.json({
        success: true,
        data: widgets.data,
        meta: {
          total: widgets.total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(widgets.total / Number(limit)),
        },
      });
    } catch (error) {
      logger.error("Error in WidgetController.getUserWidgets:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred while fetching widgets",
        },
      });
    }
  };

  /**
   * Get a widget by ID
   */
  getWidget = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const widget = await this.widgetRepository.findById(id);

      if (!widget) {
        return res.status(404).json({
          success: false,
          error: {
            code: "ERR_WIDGET_NOT_FOUND",
            message: "Widget not found",
          },
        });
      }

      // Check if user has access to this widget
      if (req.user?.userId !== widget.user_id && req.user?.role !== "admin") {
        return res.status(403).json({
          success: false,
          error: {
            code: "ERR_FORBIDDEN",
            message: "You do not have permission to access this widget",
          },
        });
      }

      return res.json({
        success: true,
        data: widget,
      });
    } catch (error) {
      logger.error("Error in WidgetController.getWidget:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred while fetching widget",
        },
      });
    }
  };

  /**
   * Update a widget
   */
  updateWidget = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { name, status, config } = req.body;

      // Check if widget exists
      const widget = await this.widgetRepository.findById(id);

      if (!widget) {
        return res.status(404).json({
          success: false,
          error: {
            code: "ERR_WIDGET_NOT_FOUND",
            message: "Widget not found",
          },
        });
      }

      // Check if user has access to this widget
      if (req.user?.userId !== widget.user_id && req.user?.role !== "admin") {
        return res.status(403).json({
          success: false,
          error: {
            code: "ERR_FORBIDDEN",
            message: "You do not have permission to update this widget",
          },
        });
      }

      // Update widget
      const updateData: any = {};
      if (name) updateData.name = name;
      if (status) updateData.status = status;
      if (config) updateData.config = config;

      const updatedWidget = await this.widgetRepository.update(id, updateData);

      // Log activity
      await this.userActivityRepository.logActivity({
        user_id: req.user?.userId as string,
        action: "widget_update",
        details: { widgetId: id, updates: Object.keys(updateData) },
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return res.json({
        success: true,
        data: updatedWidget,
      });
    } catch (error) {
      logger.error("Error in WidgetController.updateWidget:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred while updating widget",
        },
      });
    }
  };

  /**
   * Delete a widget
   */
  deleteWidget = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      // Check if widget exists
      const widget = await this.widgetRepository.findById(id);

      if (!widget) {
        return res.status(404).json({
          success: false,
          error: {
            code: "ERR_WIDGET_NOT_FOUND",
            message: "Widget not found",
          },
        });
      }

      // Check if user has access to this widget
      if (req.user?.userId !== widget.user_id && req.user?.role !== "admin") {
        return res.status(403).json({
          success: false,
          error: {
            code: "ERR_FORBIDDEN",
            message: "You do not have permission to delete this widget",
          },
        });
      }

      // Delete widget
      await this.widgetRepository.delete(id);

      // Log activity
      await this.userActivityRepository.logActivity({
        user_id: req.user?.userId as string,
        action: "widget_delete",
        details: { widgetId: id, widgetName: widget.name },
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return res.json({
        success: true,
        message: "Widget deleted successfully",
      });
    } catch (error) {
      logger.error("Error in WidgetController.deleteWidget:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred while deleting widget",
        },
      });
    }
  };

  /**
   * Update widget status
   */
  updateWidgetStatus = async (req: AuthenticatedRequest, res: Response) => {
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

      // Check if widget exists
      const widget = await this.widgetRepository.findById(id);

      if (!widget) {
        return res.status(404).json({
          success: false,
          error: {
            code: "ERR_WIDGET_NOT_FOUND",
            message: "Widget not found",
          },
        });
      }

      // Check if user has access to this widget
      if (req.user?.userId !== widget.user_id && req.user?.role !== "admin") {
        return res.status(403).json({
          success: false,
          error: {
            code: "ERR_FORBIDDEN",
            message: "You do not have permission to update this widget",
          },
        });
      }

      // Update widget status
      const updatedWidget = await this.widgetRepository.updateStatus(
        id,
        status,
      );

      // Log activity
      await this.userActivityRepository.logActivity({
        user_id: req.user?.userId as string,
        action: "widget_status_update",
        details: { widgetId: id, status },
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return res.json({
        success: true,
        data: updatedWidget,
      });
    } catch (error) {
      logger.error("Error in WidgetController.updateWidgetStatus:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred while updating widget status",
        },
      });
    }
  };

  /**
   * Get widget embed code
   */
  getWidgetEmbedCode = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      // Check if widget exists
      const widget = await this.widgetRepository.findById(id);

      if (!widget) {
        return res.status(404).json({
          success: false,
          error: {
            code: "ERR_WIDGET_NOT_FOUND",
            message: "Widget not found",
          },
        });
      }

      // Check if user has access to this widget
      if (req.user?.userId !== widget.user_id && req.user?.role !== "admin") {
        return res.status(403).json({
          success: false,
          error: {
            code: "ERR_FORBIDDEN",
            message: "You do not have permission to access this widget",
          },
        });
      }

      // Check if widget is active
      if (widget.status !== "active") {
        return res.status(400).json({
          success: false,
          error: {
            code: "ERR_WIDGET_INACTIVE",
            message: "Widget must be active to get embed code",
          },
        });
      }

      // Generate embed code
      const scriptUrl =
        process.env.WIDGET_SCRIPT_URL || "https://cdn.example.com/widget.js";
      const embedCode = `<script src="${scriptUrl}" data-widget-id="${widget.id}"></script>`;

      return res.json({
        success: true,
        data: {
          embedCode,
          widgetId: widget.id,
        },
      });
    } catch (error) {
      logger.error("Error in WidgetController.getWidgetEmbedCode:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred while generating embed code",
        },
      });
    }
  };
}

export default new WidgetController();
