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

  // Feature flags
  ENABLE_MOCK_API: process.env.VITE_ENABLE_MOCK_API === "true",
  ENABLE_ANALYTICS: process.env.VITE_ENABLE_ANALYTICS === "true",
};
