/**
 * Auth Controller
 *
 * Controller for authentication-related operations
 */

import { Request, Response } from "express";
import { UserRepository } from "../repositories/UserRepository";
import {
  UserActivityRepository,
  UserSessionRepository,
} from "../repositories/UserActivityRepository";
import { TokenService } from "../services/TokenService";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import logger from "../../src/utils/logger";
import { AuthenticatedRequest } from "../types";
import { LoginUseCase } from "../core/application/usecases/auth/LoginUseCase";

// JWT secret from environment variables
const JWT_SECRET =
  process.env.JWT_SECRET || "dev-jwt-secret-do-not-use-in-production";

// Token expiration times
const TOKEN_EXPIRY = process.env.TOKEN_EXPIRY || "24h";
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || "7d";

export class AuthController {
  private userRepository: UserRepository;
  private userActivityRepository: UserActivityRepository;
  private userSessionRepository: UserSessionRepository;
  private tokenService: TokenService;
  private loginUseCase: LoginUseCase;

  constructor() {
    this.userRepository = new UserRepository();
    this.userActivityRepository = new UserActivityRepository();
    this.userSessionRepository = new UserSessionRepository();
    this.tokenService = new TokenService();

    // Initialize LoginUseCase with dependencies
    this.loginUseCase = LoginUseCase.create(
      this.userRepository,
      this.userSessionRepository,
      this.userActivityRepository,
      this.tokenService,
    );
  }

  /**
   * Login user
   */
  login = async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: {
            code: "ERR_MISSING_CREDENTIALS",
            message: "Email and password are required",
          },
        });
      }

      // Use the LoginUseCase to handle login logic
      const result = await this.loginUseCase.execute({
        email,
        password,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"] as string,
      });

      if (!result.success) {
        // Handle error response based on error code
        const statusCode = this.getStatusCodeForError(result.error?.code);
        return res.status(statusCode).json({
          success: false,
          error: result.error,
          meta: {
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Return successful response
      return res.json({
        success: true,
        data: result.data,
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error("Error in AuthController.login:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred during login",
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }
  };

  /**
   * Register new user
   */
  register = async (req: Request, res: Response) => {
    try {
      const { email, password, name } = req.body;

      if (!email || !password || !name) {
        return res.status(400).json({
          success: false,
          error: {
            code: "ERR_MISSING_FIELDS",
            message: "Email, password, and name are required",
          },
        });
      }

      // Check if user already exists
      const existingUser = await this.userRepository.findByEmail(email);

      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: {
            code: "ERR_USER_EXISTS",
            message: "A user with this email already exists",
          },
        });
      }

      // Create user
      const user = await this.userRepository.create({
        email,
        password,
        name,
        role: "user",
        status: "active",
      });

      // Generate tokens
      const token = this.tokenService.generateAccessToken(user);
      const refreshToken = this.tokenService.generateRefreshToken(user);

      // Create session
      const sessionId = uuidv4();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

      await this.userSessionRepository.create({
        id: sessionId,
        user_id: user.id,
        token,
        refresh_token: refreshToken,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
        expires_at: expiresAt.toISOString(),
        status: "active",
      });

      // Log activity
      await this.userActivityRepository.logActivity({
        user_id: user.id,
        action: "register",
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return res.status(201).json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          },
          token,
          refreshToken,
          expiresAt: expiresAt.toISOString(),
        },
      });
    } catch (error) {
      logger.error("Error in AuthController.register:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred during registration",
        },
      });
    }
  };

  /**
   * Refresh token
   */
  refreshToken = async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          error: {
            code: "ERR_MISSING_TOKEN",
            message: "Refresh token is required",
          },
        });
      }

      // Find session by refresh token
      const session =
        await this.userSessionRepository.findByRefreshToken(refreshToken);

      if (!session || session.status !== "active") {
        return res.status(401).json({
          success: false,
          error: {
            code: "ERR_INVALID_TOKEN",
            message: "Invalid or expired refresh token",
          },
        });
      }

      // Verify refresh token
      const decoded = this.tokenService.verifyRefreshToken(refreshToken);
      if (!decoded || decoded.userId !== session.user_id) {
        // Terminate the session if token is invalid
        await this.userSessionRepository.terminateSession(session.id);

        return res.status(401).json({
          success: false,
          error: {
            code: "ERR_INVALID_TOKEN",
            message: "Invalid or expired refresh token",
          },
        });
      }

      // Get user
      const user = await this.userRepository.findById(session.user_id);

      if (!user || !user.isActive()) {
        await this.userSessionRepository.terminateSession(session.id);

        return res.status(401).json({
          success: false,
          error: {
            code: "ERR_USER_INACTIVE",
            message: "User account is not active",
          },
        });
      }

      // Generate new tokens
      const newToken = this.tokenService.generateAccessToken(user);
      const newRefreshToken = this.tokenService.generateRefreshToken(user);

      // Update session
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

      await this.userSessionRepository.update(session.id, {
        token: newToken,
        refresh_token: newRefreshToken,
        expires_at: expiresAt.toISOString(),
      });

      // Log activity
      await this.userActivityRepository.logActivity({
        user_id: user.id,
        action: "token_refresh",
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return res.json({
        success: true,
        data: {
          token: newToken,
          refreshToken: newRefreshToken,
          expiresAt: expiresAt.toISOString(),
        },
      });
    } catch (error) {
      logger.error("Error in AuthController.refreshToken:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred during token refresh",
        },
      });
    }
  };

  /**
   * Logout user
   */
  logout = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        return res.status(400).json({
          success: false,
          error: {
            code: "ERR_MISSING_TOKEN",
            message: "Authorization token is required",
          },
        });
      }

      // Extract the token
      const token = authHeader.split(" ")[1];

      if (!token) {
        return res.status(400).json({
          success: false,
          error: {
            code: "ERR_MISSING_TOKEN",
            message: "Authorization token is required",
          },
        });
      }

      // Find session by token
      const session = await this.userSessionRepository.findByToken(token);

      if (session) {
        // Terminate the session
        await this.userSessionRepository.terminateSession(session.id);

        // Log activity
        if (req.user && req.user.userId) {
          await this.userActivityRepository.logActivity({
            user_id: req.user.userId,
            action: "logout",
            ip_address: req.ip,
            user_agent: req.headers["user-agent"],
          });
        }
      }

      return res.json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error) {
      logger.error("Error in AuthController.logout:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred during logout",
        },
      });
    }
  };

  /**
   * Get current user
   */
  getCurrentUser = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user || !req.user.userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: "ERR_UNAUTHORIZED",
            message: "Not authenticated",
          },
        });
      }

      const user = await this.userRepository.findById(req.user.userId);

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
          profileImage: user.profile_image,
          lastLogin: user.last_login,
        },
      });
    } catch (error) {
      logger.error("Error in AuthController.getCurrentUser:", error);
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
   * Change password
   */
  changePassword = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user || !req.user.userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: "ERR_UNAUTHORIZED",
            message: "Not authenticated",
          },
        });
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          error: {
            code: "ERR_MISSING_FIELDS",
            message: "Current password and new password are required",
          },
        });
      }

      // Get user
      const user = await this.userRepository.findById(req.user.userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: "ERR_USER_NOT_FOUND",
            message: "User not found",
          },
        });
      }

      // Verify current password
      const isValid = await this.userRepository.verifyCredentials(
        user.email,
        currentPassword,
      );

      if (!isValid) {
        return res.status(401).json({
          success: false,
          error: {
            code: "ERR_INVALID_PASSWORD",
            message: "Current password is incorrect",
          },
        });
      }

      // Update password
      await this.userRepository.updatePassword(user.id, newPassword);

      // Log activity
      await this.userActivityRepository.logActivity({
        user_id: user.id,
        action: "password_change",
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return res.json({
        success: true,
        message: "Password changed successfully",
      });
    } catch (error) {
      logger.error("Error in AuthController.changePassword:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred while changing password",
        },
      });
    }
  };

  /**
   * Helper method to get HTTP status code based on error code
   */
  private getStatusCodeForError(errorCode?: string): number {
    if (!errorCode) return 500;

    switch (errorCode) {
      case "ERR_MISSING_CREDENTIALS":
        return 400;
      case "ERR_INVALID_CREDENTIALS":
        return 401;
      case "ERR_ACCOUNT_INACTIVE":
        return 403;
      default:
        return 500;
    }
  }
}

export default new AuthController();
