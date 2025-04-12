/**
 * User Session Repository Interface
 *
 * Defines the contract for user session data access operations.
 * This is a port in the hexagonal architecture that will be
 * implemented by adapters in the infrastructure layer.
 */

export interface UserSession {
  id: string;
  user_id: string;
  token: string;
  refresh_token: string;
  ip_address?: string;
  user_agent?: string;
  expires_at: string;
  status: "active" | "terminated" | "expired";
  created_at?: string;
  updated_at?: string;
}

export interface IUserSessionRepository {
  findById(id: string): Promise<UserSession | null>;
  findByToken(token: string): Promise<UserSession | null>;
  findByRefreshToken(refreshToken: string): Promise<UserSession | null>;
  findActiveSessionsByUserId(userId: string): Promise<UserSession[]>;
  create(sessionData: Partial<UserSession>): Promise<string>; // Returns session ID
  update(id: string, sessionData: Partial<UserSession>): Promise<boolean>;
  terminateSession(id: string): Promise<boolean>;
  terminateAllUserSessions(userId: string): Promise<boolean>;
  cleanupExpiredSessions(): Promise<number>; // Returns number of cleaned sessions
}
