/**
 * Token Service Implementation
 *
 * Implements the ITokenService interface for token generation and validation.
 */

import { User } from "../core/domain/entities/User";
import {
  ITokenService,
  TokenPayload,
} from "../core/domain/services/ITokenService";
import jwt from "jsonwebtoken";
import logger from "../../src/utils/logger";

export class TokenService implements ITokenService {
  private readonly accessTokenSecret: string;
  private readonly refreshTokenSecret: string;
  private readonly accessTokenExpiration: string;
  private readonly refreshTokenExpiration: string;
  private readonly revokedTokens: Set<string>;

  constructor() {
    // In a real application, these would be loaded from environment variables
    this.accessTokenSecret =
      process.env.JWT_ACCESS_SECRET || "access-secret-key";
    this.refreshTokenSecret =
      process.env.JWT_REFRESH_SECRET || "refresh-secret-key";
    this.accessTokenExpiration = process.env.JWT_ACCESS_EXPIRATION || "1h";
    this.refreshTokenExpiration = process.env.JWT_REFRESH_EXPIRATION || "7d";
    this.revokedTokens = new Set<string>();
  }

  generateAccessToken(user: User): string {
    try {
      const payload: TokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };

      return jwt.sign(payload, this.accessTokenSecret, {
        expiresIn: this.accessTokenExpiration,
      });
    } catch (error) {
      logger.error("Error in TokenService.generateAccessToken:", error);
      throw error;
    }
  }

  generateRefreshToken(user: User): string {
    try {
      const payload: TokenPayload = {
        userId: user.id,
      };

      return jwt.sign(payload, this.refreshTokenSecret, {
        expiresIn: this.refreshTokenExpiration,
      });
    } catch (error) {
      logger.error("Error in TokenService.generateRefreshToken:", error);
      throw error;
    }
  }

  verifyAccessToken(token: string): TokenPayload | null {
    try {
      if (this.isTokenRevoked(token)) {
        return null;
      }

      const decoded = jwt.verify(token, this.accessTokenSecret) as TokenPayload;
      return decoded;
    } catch (error) {
      logger.error("Error in TokenService.verifyAccessToken:", error);
      return null;
    }
  }

  verifyRefreshToken(token: string): TokenPayload | null {
    try {
      if (this.isTokenRevoked(token)) {
        return null;
      }

      const decoded = jwt.verify(
        token,
        this.refreshTokenSecret,
      ) as TokenPayload;
      return decoded;
    } catch (error) {
      logger.error("Error in TokenService.verifyRefreshToken:", error);
      return null;
    }
  }

  getTokenExpiration(token: string): Date | null {
    try {
      const decoded = jwt.decode(token) as { exp?: number };
      if (decoded && decoded.exp) {
        return new Date(decoded.exp * 1000);
      }
      return null;
    } catch (error) {
      logger.error("Error in TokenService.getTokenExpiration:", error);
      return null;
    }
  }

  async revokeToken(token: string): Promise<boolean> {
    try {
      this.revokedTokens.add(token);
      // In a real application, this would be stored in a database or Redis
      return true;
    } catch (error) {
      logger.error("Error in TokenService.revokeToken:", error);
      return false;
    }
  }

  async isTokenRevoked(token: string): Promise<boolean> {
    try {
      // In a real application, this would check a database or Redis
      return this.revokedTokens.has(token);
    } catch (error) {
      logger.error("Error in TokenService.isTokenRevoked:", error);
      return true; // Fail secure - if there's an error, assume the token is revoked
    }
  }
}
