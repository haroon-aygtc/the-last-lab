/**
 * User Controller
 *
 * Controller for user-related operations
 */

import { Request, Response } from "express";
import { UserRepository } from "../repositories/UserRepository";
import {
  UserActivityRepository,
  UserSessionRepository,
} from "../repositories/UserActivityRepository";
import logger from "../../src/utils/logger";
import { AuthenticatedRequest } from "../types";

export class UserController {
  private userRepository: UserRepository;
  private userActivityRepository: UserActivityRepository;
  private userSessionRepository: UserSessionRepository;

  constructor() {
    this.userRepository = new UserRepository();
    this.userActivityRepository = new UserActivityRepository();
    this.userSessionRepository = new UserSessionRepository();
  }

  /**
   * Get all users (admin only)
   */
  getAllUsers = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { page = 1, limit = 20, role } = req.query;
      const offset = (Number(page) - 1) * Number(limit);

      let users;

      if (role) {
        users = await this.userRepository.getUsersByRole(role as string, {
          limit: Number(limit),
          offset,
        });
      } else {
        users = await this.userRepository.findAll({
          limit: Number(limit),
          offset,
        });
      }

      return res.json({
        success: true,
        data: users.data.map((user) => ({
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
          createdAt: user.created_at,
          lastLogin: user.last_login,
        })),
        meta: {
          total: users.total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(users.total / Number(limit)),
        },
      });
    } catch (error) {
      logger.error("Error in UserController.getAllUsers:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred while fetching users",
        },
      });
    }
  };

  /**
   * Get user by ID
   */
  getUserById = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      // Check if user is requesting their own data or is an admin
      if (req.user?.userId !== id && req.user?.role !== "admin") {
        return res.status(403).json({
          success: false,
          error: {
            code: "ERR_FORBIDDEN",
            message: "You do not have permission to access this resource",
          },
        });
      }

      const user = await this.userRepository.findById(id);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: "ERR_USER_NOT_FOUND",
            message: "User not found",
          },
        });
      }

      return res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
          profileImage: user.profile_image,
          createdAt: user.created_at,
          lastLogin: user.last_login,
          settings: user.settings,
        },
      });
    } catch (error) {
      logger.error("Error in UserController.getUserById:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred while fetching user data",
        },
      });
    }
  };

  /**
   * Update user
   */
  updateUser = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { name, email, status, role, profileImage, settings } = req.body;

      // Check if user is updating their own data or is an admin
      const isOwnProfile = req.user?.userId === id;
      const isAdmin = req.user?.role === "admin";

      if (!isOwnProfile && !isAdmin) {
        return res.status(403).json({
          success: false,
          error: {
            code: "ERR_FORBIDDEN",
            message: "You do not have permission to update this user",
          },
        });
      }

      // Get current user data
      const currentUser = await this.userRepository.findById(id);

      if (!currentUser) {
        return res.status(404).json({
          success: false,
          error: {
            code: "ERR_USER_NOT_FOUND",
            message: "User not found",
          },
        });
      }

      // Prepare update data
      const updateData: any = {};

      // Regular users can only update their name, profile image, and settings
      if (name) updateData.name = name;
      if (profileImage) updateData.profile_image = profileImage;
      if (settings) updateData.settings = settings;

      // Only admins can update email, status, and role
      if (isAdmin) {
        if (email && email !== currentUser.email) {
          // Check if email is already in use
          const existingUser = await this.userRepository.findByEmail(email);

          if (existingUser && existingUser.id !== id) {
            return res.status(409).json({
              success: false,
              error: {
                code: "ERR_EMAIL_EXISTS",
                message: "Email is already in use",
              },
            });
          }

          updateData.email = email;
        }

        if (status) updateData.status = status;
        if (role) updateData.role = role;
      }

      // Update user
      const updatedUser = await this.userRepository.update(id, updateData);

      // Log activity
      await this.userActivityRepository.logActivity({
        user_id: req.user?.userId as string,
        action: "user_update",
        details: { targetUserId: id },
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return res.json({
        success: true,
        data: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          role: updatedUser.role,
          status: updatedUser.status,
          profileImage: updatedUser.profile_image,
          settings: updatedUser.settings,
        },
      });
    } catch (error) {
      logger.error("Error in UserController.updateUser:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred while updating user data",
        },
      });
    }
  };

  /**
   * Delete user (admin only)
   */
  deleteUser = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      // Only admins can delete users
      if (req.user?.role !== "admin") {
        return res.status(403).json({
          success: false,
          error: {
            code: "ERR_FORBIDDEN",
            message: "You do not have permission to delete users",
          },
        });
      }

      // Check if user exists
      const user = await this.userRepository.findById(id);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: "ERR_USER_NOT_FOUND",
            message: "User not found",
          },
        });
      }

      // Delete user
      await this.userRepository.delete(id);

      // Log activity
      await this.userActivityRepository.logActivity({
        user_id: req.user.userId as string,
        action: "user_delete",
        details: { targetUserId: id },
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return res.json({
        success: true,
        message: "User deleted successfully",
      });
    } catch (error) {
      logger.error("Error in UserController.deleteUser:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred while deleting user",
        },
      });
    }
  };

  /**
   * Get user activity
   */
  getUserActivity = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { page = 1, limit = 20, startDate, endDate, action } = req.query;

      // Check if user is requesting their own data or is an admin
      if (req.user?.userId !== id && req.user?.role !== "admin") {
        return res.status(403).json({
          success: false,
          error: {
            code: "ERR_FORBIDDEN",
            message: "You do not have permission to access this resource",
          },
        });
      }

      const offset = (Number(page) - 1) * Number(limit);

      const activities = await this.userActivityRepository.findByUserId(id, {
        limit: Number(limit),
        offset,
        startDate: startDate as string,
        endDate: endDate as string,
        action: action as string,
      });

      return res.json({
        success: true,
        data: activities.data,
        meta: {
          total: activities.total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(activities.total / Number(limit)),
        },
      });
    } catch (error) {
      logger.error("Error in UserController.getUserActivity:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred while fetching user activity",
        },
      });
    }
  };

  /**
   * Get user sessions
   */
  getUserSessions = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      // Check if user is requesting their own data or is an admin
      if (req.user?.userId !== id && req.user?.role !== "admin") {
        return res.status(403).json({
          success: false,
          error: {
            code: "ERR_FORBIDDEN",
            message: "You do not have permission to access this resource",
          },
        });
      }

      const sessions = await this.userSessionRepository.findActiveByUserId(id);

      return res.json({
        success: true,
        data: sessions.map((session) => ({
          id: session.id,
          ipAddress: session.ip_address,
          userAgent: session.user_agent,
          createdAt: session.created_at,
          expiresAt: session.expires_at,
          status: session.status,
        })),
      });
    } catch (error) {
      logger.error("Error in UserController.getUserSessions:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred while fetching user sessions",
        },
      });
    }
  };

  /**
   * Terminate session
   */
  terminateSession = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { sessionId } = req.params;

      // Get session
      const db = await this.userSessionRepository.getDb();
      const [sessions] = await db.query(
        "SELECT * FROM user_sessions WHERE id = ?",
        { replacements: [sessionId] },
      );

      if (sessions.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            code: "ERR_SESSION_NOT_FOUND",
            message: "Session not found",
          },
        });
      }

      const session = sessions[0];

      // Check if user is terminating their own session or is an admin
      if (req.user?.userId !== session.user_id && req.user?.role !== "admin") {
        return res.status(403).json({
          success: false,
          error: {
            code: "ERR_FORBIDDEN",
            message: "You do not have permission to terminate this session",
          },
        });
      }

      // Terminate session
      await this.userSessionRepository.terminateSession(sessionId);

      // Log activity
      await this.userActivityRepository.logActivity({
        user_id: req.user?.userId as string,
        action: "session_terminate",
        details: { sessionId },
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return res.json({
        success: true,
        message: "Session terminated successfully",
      });
    } catch (error) {
      logger.error("Error in UserController.terminateSession:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred while terminating session",
        },
      });
    }
  };

  /**
   * Terminate all sessions except current
   */
  terminateAllSessions = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { currentSessionId } = req.body;

      // Check if user is terminating their own sessions or is an admin
      if (req.user?.userId !== id && req.user?.role !== "admin") {
        return res.status(403).json({
          success: false,
          error: {
            code: "ERR_FORBIDDEN",
            message: "You do not have permission to terminate these sessions",
          },
        });
      }

      // Terminate all sessions except current
      const terminatedCount =
        await this.userSessionRepository.terminateAllExcept(
          id,
          currentSessionId,
        );

      // Log activity
      await this.userActivityRepository.logActivity({
        user_id: req.user?.userId as string,
        action: "sessions_terminate_all",
        details: { userId: id, exceptSessionId: currentSessionId },
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return res.json({
        success: true,
        message: `${terminatedCount} sessions terminated successfully`,
      });
    } catch (error) {
      logger.error("Error in UserController.terminateAllSessions:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred while terminating sessions",
        },
      });
    }
  };
}

export default new UserController();
