/**
 * API Middleware
 *
 * This module provides a centralized API client for making HTTP requests
 * with consistent error handling, authentication, and response formatting.
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { env } from "@/config/env";
import logger from "@/utils/logger";

// Define response structure for consistent API responses
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    [key: string]: any;
  };
}

// Create axios instance with default configuration
const axiosInstance: AxiosInstance = axios.create({
  baseURL: env.API_BASE_URL,
  timeout: 30000, // 30 seconds
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Add request interceptor for authentication
axiosInstance.interceptors.request.use(
  (config) => {
    // Get token from localStorage or other storage mechanism
    const token =
      typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;

    // If token exists, add it to the request headers
    if (token) {
      config.headers = config.headers || {};
      config.headers["Authorization"] = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    logger.error("API request error:", error);
    return Promise.reject(error);
  },
);

// Add response interceptor for consistent error handling
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    // If the response already has our expected structure, return it directly
    if (response.data && response.data.success !== undefined) {
      return response.data;
    }

    // Otherwise, format the response to match our expected structure
    return {
      success: true,
      data: response.data,
      meta: {
        timestamp: new Date().toISOString(),
        status: response.status,
        statusText: response.statusText,
      },
    };
  },
  (error) => {
    logger.error("API response error:", error);

    // Format error response
    const errorResponse: ApiResponse = {
      success: false,
      error: {
        code: "ERR_REQUEST_FAILED",
        message: "Request failed",
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    };

    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      errorResponse.error = {
        code: `ERR_${error.response.status}`,
        message:
          error.response.data?.message || error.message || "Request failed",
        details: error.response.data,
      };
      errorResponse.meta = {
        ...errorResponse.meta,
        status: error.response.status,
        statusText: error.response.statusText,
      };
    } else if (error.request) {
      // The request was made but no response was received
      errorResponse.error = {
        code: "ERR_NO_RESPONSE",
        message: "No response received from server",
        details: error.request,
      };
    } else {
      // Something happened in setting up the request that triggered an Error
      errorResponse.error = {
        code: "ERR_REQUEST_SETUP",
        message: error.message || "Error setting up request",
      };
    }

    return errorResponse;
  },
);

// API client with typed methods
export const api = {
  /**
   * Make a GET request
   */
  async get<T = any>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<ApiResponse<T>> {
    try {
      return await axiosInstance.get<T, ApiResponse<T>>(url, config);
    } catch (error) {
      return error as ApiResponse<T>;
    }
  },

  /**
   * Make a POST request
   */
  async post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<ApiResponse<T>> {
    try {
      return await axiosInstance.post<T, ApiResponse<T>>(url, data, config);
    } catch (error) {
      return error as ApiResponse<T>;
    }
  },

  /**
   * Make a PUT request
   */
  async put<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<ApiResponse<T>> {
    try {
      return await axiosInstance.put<T, ApiResponse<T>>(url, data, config);
    } catch (error) {
      return error as ApiResponse<T>;
    }
  },

  /**
   * Make a PATCH request
   */
  async patch<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<ApiResponse<T>> {
    try {
      return await axiosInstance.patch<T, ApiResponse<T>>(url, data, config);
    } catch (error) {
      return error as ApiResponse<T>;
    }
  },

  /**
   * Make a DELETE request
   */
  async delete<T = any>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<ApiResponse<T>> {
    try {
      return await axiosInstance.delete<T, ApiResponse<T>>(url, config);
    } catch (error) {
      return error as ApiResponse<T>;
    }
  },

  /**
   * Set the authorization token for all future requests
   */
  setAuthToken(token: string | null): void {
    if (token) {
      axiosInstance.defaults.headers.common["Authorization"] =
        `Bearer ${token}`;
      if (typeof window !== "undefined") {
        localStorage.setItem("auth_token", token);
      }
    } else {
      delete axiosInstance.defaults.headers.common["Authorization"];
      if (typeof window !== "undefined") {
        localStorage.removeItem("auth_token");
      }
    }
  },

  /**
   * Clear the authorization token
   */
  clearAuthToken(): void {
    delete axiosInstance.defaults.headers.common["Authorization"];
    if (typeof window !== "undefined") {
      localStorage.removeItem("auth_token");
    }
  },
};

// Export the axios instance for advanced use cases
export { axiosInstance };
