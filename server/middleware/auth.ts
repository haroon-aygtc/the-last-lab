/**
 * Authentication Middleware
 *
 * This module provides middleware functions for authenticating and authorizing API requests.
 */

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AuthenticatedRequest } from "../types";
import logger from "../../src/utils/logger";

// JWT secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET;

// Ensure JWT_SECRET is set in production
if (!JWT_SECRET && process.env.NODE_ENV === "production") {
  logger.error(
    "ERROR: JWT_SECRET environment variable is not set in production mode!",
  );
  process.exit(1); // Exit the application if JWT_SECRET is not set in production
}

// Fallback for development only
const DEV_JWT_SECRET = "dev-jwt-secret-do-not-use-in-production";
const ACTIVE_JWT_SECRET = JWT_SECRET || DEV_JWT_SECRET;

/**
 * Middleware to authenticate JWT tokens
 */
export const authenticateJWT = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void => {
  // Get the token from the Authorization header
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({
      success: false,
      error: {
        code: "ERR_UNAUTHORIZED",
        message: "No authorization token provided",
      },
    });
    return;
  }

  // Extract the token (Bearer <token>)
  const token = authHeader.split(" ")[1];

  if (!token) {
    res.status(401).json({
      success: false,
      error: {
        code: "ERR_UNAUTHORIZED",
        message: "Invalid authorization format",
      },
    });
    return;
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, ACTIVE_JWT_SECRET) as {
      userId: string;
      email: string;
      role: string;
    };
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      res.status(401).json({
        success: false,
        error: {
          code: "ERR_TOKEN_EXPIRED",
          message: "Token has expired",
        },
      });
    } else {
      logger.error("JWT verification error:", error);
      res.status(403).json({
        success: false,
        error: {
          code: "ERR_FORBIDDEN",
          message: "Invalid or malformed token",
        },
      });
    }
  }
};

/**
 * Middleware to check user roles
 */
export const checkAuth = (roles: string[] = []) => {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): void => {
    // First authenticate the JWT
    authenticateJWT(req, res, () => {
      // If no roles are specified or user's role is in the allowed roles
      if (roles.length === 0 || (req.user && roles.includes(req.user.role))) {
        next();
      } else {
        res.status(403).json({
          success: false,
          error: {
            code: "ERR_FORBIDDEN",
            message: "Access forbidden: insufficient permissions",
          },
        });
      }
    });
  };
};

/**
 * Middleware to check if user is an admin
 */
export const isAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void => {
  // First authenticate the JWT
  authenticateJWT(req, res, () => {
    // Check if user is an admin
    if (req.user && req.user.role === "admin") {
      next();
    } else {
      res.status(403).json({
        success: false,
        error: {
          code: "ERR_FORBIDDEN",
          message: "Admin access required",
        },
      });
    }
  });
};

/**
 * Generate a JWT token for a user
 */
export const generateToken = (user: {
  id: string;
  email: string;
  role: string;
}): string => {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    ACTIVE_JWT_SECRET,
    { expiresIn: process.env.TOKEN_EXPIRY || "24h" },
  );
};

/**
 * Generate a refresh token for a user
 */
export const generateRefreshToken = (user: { id: string }): string => {
  return jwt.sign(
    { userId: user.id, tokenType: "refresh" },
    ACTIVE_JWT_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "7d" },
  );
};

/**
 * Verify a refresh token
 */
export const verifyRefreshToken = (
  token: string,
): { userId: string; tokenType: string } => {
  try {
    const decoded = jwt.verify(token, ACTIVE_JWT_SECRET) as {
      userId: string;
      tokenType: string;
    };
    if (decoded.tokenType !== "refresh") {
      throw new Error("Invalid token type");
    }
    return decoded;
  } catch (error) {
    logger.error("Refresh token verification error:", error);
    throw error;
  }
};
