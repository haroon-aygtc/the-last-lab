/**
 * User Service
 *
 * This service handles user management using the API layer
 * instead of direct database access.
 */

import logger from "@/utils/logger";
import { api } from "./api/middleware/apiMiddleware";

export interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
  isActive: boolean;
  emailVerified?: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserListResponse {
  users: User[];
  totalCount: number;
  page: number;
  pageSize: number;
}

const userService = {
  /**
   * Get all users (admin only)
   */
  getAllUsers: async (
    page: number = 1,
    pageSize: number = 20,
  ): Promise<UserListResponse> => {
    try {
      const response = await api.get<UserListResponse>("/users", {
        params: { page, pageSize },
      });

      if (!response.success) {
        throw new Error(response.error?.message || "Failed to fetch users");
      }

      return response.data || { users: [], totalCount: 0, page, pageSize };
    } catch (error) {
      logger.error("Error fetching users:", error);
      throw error;
    }
  },

  /**
   * Get a user by ID
   */
  getUserById: async (id: string): Promise<User | null> => {
    try {
      const response = await api.get<User>(`/users/${id}`);

      if (!response.success) {
        if (response.error?.code === "ERR_404") {
          return null;
        }
        throw new Error(response.error?.message || "Failed to fetch user");
      }

      return response.data || null;
    } catch (error) {
      logger.error(`Error fetching user ${id}:`, error);
      throw error;
    }
  },

  /**
   * Create a new user (admin only)
   */
  createUser: async (userData: {
    email: string;
    password: string;
    name?: string;
    role?: string;
  }): Promise<User> => {
    try {
      const response = await api.post<User>("/users", userData);

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || "Failed to create user");
      }

      return response.data;
    } catch (error) {
      logger.error("Error creating user:", error);
      throw error;
    }
  },

  /**
   * Update a user
   */
  updateUser: async (id: string, userData: Partial<User>): Promise<User> => {
    try {
      const response = await api.put<User>(`/users/${id}`, userData);

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || "Failed to update user");
      }

      return response.data;
    } catch (error) {
      logger.error(`Error updating user ${id}:`, error);
      throw error;
    }
  },

  /**
   * Delete a user (admin only)
   */
  deleteUser: async (id: string): Promise<boolean> => {
    try {
      const response = await api.delete<{ success: boolean }>(`/users/${id}`);

      if (!response.success) {
        throw new Error(response.error?.message || "Failed to delete user");
      }

      return true;
    } catch (error) {
      logger.error(`Error deleting user ${id}:`, error);
      throw error;
    }
  },

  /**
   * Change user password
   */
  changePassword: async (
    id: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<boolean> => {
    try {
      const response = await api.post<{ success: boolean }>(
        `/users/${id}/change-password`,
        {
          currentPassword,
          newPassword,
        },
      );

      if (!response.success) {
        throw new Error(response.error?.message || "Failed to change password");
      }

      return true;
    } catch (error) {
      logger.error(`Error changing password for user ${id}:`, error);
      throw error;
    }
  },

  /**
   * Reset user password (admin only)
   */
  resetPassword: async (id: string): Promise<{ temporaryPassword: string }> => {
    try {
      const response = await api.post<{ temporaryPassword: string }>(
        `/users/${id}/reset-password`,
      );

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || "Failed to reset password");
      }

      return response.data;
    } catch (error) {
      logger.error(`Error resetting password for user ${id}:`, error);
      throw error;
    }
  },

  /**
   * Activate a user
   */
  activateUser: async (id: string): Promise<User> => {
    try {
      const response = await api.post<User>(`/users/${id}/activate`);

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || "Failed to activate user");
      }

      return response.data;
    } catch (error) {
      logger.error(`Error activating user ${id}:`, error);
      throw error;
    }
  },

  /**
   * Deactivate a user
   */
  deactivateUser: async (id: string): Promise<User> => {
    try {
      const response = await api.post<User>(`/users/${id}/deactivate`);

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || "Failed to deactivate user");
      }

      return response.data;
    } catch (error) {
      logger.error(`Error deactivating user ${id}:`, error);
      throw error;
    }
  },

  /**
   * Search users
   */
  searchUsers: async (
    query: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<UserListResponse> => {
    try {
      const response = await api.get<UserListResponse>("/users/search", {
        params: { query, page, pageSize },
      });

      if (!response.success) {
        throw new Error(response.error?.message || "Failed to search users");
      }

      return response.data || { users: [], totalCount: 0, page, pageSize };
    } catch (error) {
      logger.error("Error searching users:", error);
      throw error;
    }
  },
};

export default userService;
