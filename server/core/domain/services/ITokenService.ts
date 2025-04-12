/**
 * Token Service Interface
 *
 * Defines the contract for token generation and validation operations.
 * This is a port in the hexagonal architecture that will be
 * implemented by adapters in the infrastructure layer.
 */

import { User } from "../entities/User";

export interface TokenPayload {
  userId: string;
  email?: string;
  role?: string;
  [key: string]: any; // Additional claims
}

export interface ITokenService {
  generateAccessToken(user: User): string;
  generateRefreshToken(user: User): string;
  verifyAccessToken(token: string): TokenPayload | null;
  verifyRefreshToken(token: string): TokenPayload | null;
  getTokenExpiration(token: string): Date | null;
  revokeToken(token: string): Promise<boolean>;
  isTokenRevoked(token: string): Promise<boolean>;
}
