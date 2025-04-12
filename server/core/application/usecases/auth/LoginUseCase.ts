/**
 * Login Use Case
 *
 * Application layer use case for user login.
 * Implements business logic for authenticating a user.
 */

import { IUserRepository } from "../../../domain/repositories/IUserRepository";
import { IUserSessionRepository } from "../../../domain/repositories/IUserSessionRepository";
import { IUserActivityRepository } from "../../../domain/repositories/IUserActivityRepository";
import { ITokenService } from "../../../domain/services/ITokenService";
import { v4 as uuidv4 } from "uuid";
import { User } from "../../../domain/entities/User";

export interface LoginRequest {
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface LoginResponse {
  success: boolean;
  data?: {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
    };
    token: string;
    refreshToken: string;
    expiresAt: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

export class LoginUseCase {
  constructor(
    private userRepository: IUserRepository,
    private userSessionRepository: IUserSessionRepository,
    private userActivityRepository: IUserActivityRepository,
    private tokenService: ITokenService,
  ) {}

  async execute(request: LoginRequest): Promise<LoginResponse> {
    const { email, password, ipAddress, userAgent } = request;

    // Validate input
    if (!email || !password) {
      return {
        success: false,
        error: {
          code: "ERR_MISSING_CREDENTIALS",
          message: "Email and password are required",
        },
      };
    }

    try {
      // Verify credentials
      const user = await this.userRepository.verifyCredentials(email, password);

      if (!user) {
        return {
          success: false,
          error: {
            code: "ERR_INVALID_CREDENTIALS",
            message: "Invalid email or password",
          },
        };
      }

      // Check if user is active
      if (!user.isActive()) {
        return {
          success: false,
          error: {
            code: "ERR_ACCOUNT_INACTIVE",
            message: "Your account is not active",
          },
        };
      }

      // Generate tokens
      const token = this.tokenService.generateAccessToken(user);
      const refreshToken = this.tokenService.generateRefreshToken(user);

      // Update last login
      await this.userRepository.updateLastLogin(user.id);

      // Create session
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

      const sessionId = await this.userSessionRepository.create({
        id: uuidv4(),
        user_id: user.id,
        token,
        refresh_token: refreshToken,
        ip_address: ipAddress,
        user_agent: userAgent,
        expires_at: expiresAt.toISOString(),
        status: "active",
      });

      // Log activity
      await this.userActivityRepository.logActivity({
        user_id: user.id,
        action: "login",
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      return {
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
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred during login",
        },
      };
    }
  }

  // Factory method to create LoginUseCase with dependencies
  static create(
    userRepository: IUserRepository,
    userSessionRepository: IUserSessionRepository,
    userActivityRepository: IUserActivityRepository,
    tokenService: ITokenService,
  ): LoginUseCase {
    return new LoginUseCase(
      userRepository,
      userSessionRepository,
      userActivityRepository,
      tokenService,
    );
  }
}
