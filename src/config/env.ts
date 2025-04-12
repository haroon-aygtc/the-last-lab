/**
 * Environment Configuration
 *
 * This file provides a centralized way to access environment variables
 * with default values for development.
 */

// Default API base URL for development
const DEFAULT_API_BASE_URL = "/api";

export const env = {
  // API configuration
  API_BASE_URL: process.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL,

  // Environment mode
  NODE_ENV: process.env.NODE_ENV || "development",
  DEV: process.env.NODE_ENV !== "production",
  PROD: process.env.NODE_ENV === "production",

  // Supabase configuration (already available in environment)
  SUPABASE_URL: process.env.VITE_SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,

  // Authentication configuration
  AUTH_TOKEN_EXPIRY: process.env.VITE_AUTH_TOKEN_EXPIRY || "24h",
  AUTH_REFRESH_TOKEN_EXPIRY: process.env.VITE_AUTH_REFRESH_TOKEN_EXPIRY || "7d",

  // WebSocket configuration
  WS_URL:
    process.env.VITE_WS_URL ||
    (typeof window !== "undefined"
      ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`
      : ""),

  // Feature flags
  ENABLE_MOCK_API: process.env.VITE_ENABLE_MOCK_API === "true",
  ENABLE_ANALYTICS: process.env.VITE_ENABLE_ANALYTICS === "true",
  ENABLE_WEBSOCKETS: process.env.VITE_ENABLE_WEBSOCKETS !== "false",
};
