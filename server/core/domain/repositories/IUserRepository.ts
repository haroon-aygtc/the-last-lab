/**
 * User Repository Interface
 *
 * Defines the contract for user data access operations.
 * This is a port in the hexagonal architecture that will be
 * implemented by adapters in the infrastructure layer.
 */

import { User } from "../entities/User";

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: "ASC" | "DESC";
  filters?: Record<string, any>;
}

export interface QueryResult<T> {
  data: T[];
  total: number;
}

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findAll(options?: QueryOptions): Promise<QueryResult<User>>;
  getUsersByRole(
    role: string,
    options?: QueryOptions,
  ): Promise<QueryResult<User>>;
  create(userData: Partial<User>): Promise<User>;
  update(id: string, userData: Partial<User>): Promise<User>;
  delete(id: string): Promise<boolean>;
  verifyCredentials(email: string, password: string): Promise<User | null>;
  updatePassword(userId: string, newPassword: string): Promise<boolean>;
  updateLastLogin(userId: string): Promise<void>;
}
