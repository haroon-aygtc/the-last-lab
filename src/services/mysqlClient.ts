/**
 * Production-ready MySQL client implementation
 * Provides a consistent interface for database operations throughout the application
 */

import logger from "@/utils/logger";
import { env } from "@/config/env";

// Define QueryTypes for use in query operations
export const QueryTypes = {
  SELECT: "SELECT",
  INSERT: "INSERT",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
};

// Check if we're in a browser environment
const isBrowser = typeof window !== "undefined";

// Define the interface for our Sequelize client
export interface SequelizeClient {
  query: (sql: string, options: any) => Promise<any[]>;
  authenticate: () => Promise<void>;
  close: () => void;
  Op?: any;
  transaction: (options?: any) => Promise<any>;
}

// Placeholder for the Sequelize instance
let sequelizeInstance: SequelizeClient | null = null;

/**
 * Initialize the MySQL client
 * @returns Initialized Sequelize client
 */
export const initMySQL = async (): Promise<SequelizeClient> => {
  if (isBrowser) {
    throw new Error(
      "MySQL client cannot be initialized in browser environment",
    );
  }

  if (!sequelizeInstance) {
    try {
      // Dynamically import Sequelize only on the server side
      const { Sequelize, Op } = await import("sequelize");

      // Get database configuration from environment variables
      const mysqlUrl = env.MYSQL_URL;
      const mysqlHost = env.MYSQL_HOST;
      const mysqlPort = parseInt(env.MYSQL_PORT, 10);
      const mysqlUser = env.MYSQL_USER;
      const mysqlPassword = env.MYSQL_PASSWORD;
      const mysqlDatabase = env.MYSQL_DATABASE;
      const mysqlLogging = env.MYSQL_LOGGING;

      // Pool configuration
      const poolConfig = {
        max: env.MYSQL_POOL_MAX,
        min: env.MYSQL_POOL_MIN,
        acquire: env.MYSQL_POOL_ACQUIRE,
        idle: env.MYSQL_POOL_IDLE,
      };

      if (!mysqlUrl && (!mysqlHost || !mysqlUser || !mysqlDatabase)) {
        throw new Error("MySQL connection details are required");
      }

      let sequelize;

      if (mysqlUrl) {
        // Use connection URL if provided
        sequelize = new Sequelize(mysqlUrl, {
          logging: mysqlLogging ? console.log : false,
          dialect: "mysql",
          pool: poolConfig,
        });
      } else {
        // Use individual connection parameters
        sequelize = new Sequelize(mysqlDatabase, mysqlUser, mysqlPassword, {
          host: mysqlHost,
          port: mysqlPort,
          dialect: "mysql",
          logging: mysqlLogging ? console.log : false,
          pool: poolConfig,
          dialectOptions: {
            bigNumberStrings: true,
            ssl: env.MYSQL_SSL ? { ca: env.MYSQL_CERT } : undefined,
          },
        });
      }

      // Add Op to the sequelize instance
      sequelize.Op = Op;

      // Test the connection
      await sequelize.authenticate();
      logger.info("MySQL client initialized and connected successfully");

      sequelizeInstance = sequelize;
    } catch (error) {
      logger.error("Failed to initialize MySQL client", error);
      throw error;
    }
  }

  return sequelizeInstance;
};

/**
 * Get the MySQL client instance
 * @returns Sequelize client instance
 */
export const getMySQLClient = async (): Promise<SequelizeClient> => {
  if (isBrowser) {
    throw new Error("MySQL client cannot be used in browser environment");
  }

  if (!sequelizeInstance) {
    return await initMySQL();
  }
  return sequelizeInstance;
};

/**
 * Reset the MySQL client instance
 * Useful for testing or when changing connection details
 */
export const resetMySQLClient = (): void => {
  if (isBrowser) {
    return;
  }

  if (sequelizeInstance) {
    sequelizeInstance.close();
  }
  sequelizeInstance = null;
};

/**
 * Check if the MySQL client is initialized
 * @returns Boolean indicating if the client is initialized
 */
export const isMySQLInitialized = (): boolean => {
  if (isBrowser) {
    return false;
  }

  return !!sequelizeInstance;
};

/**
 * Test the MySQL connection
 * @returns Promise that resolves if connection is successful
 */
export const testConnection = async (): Promise<boolean> => {
  if (isBrowser) {
    throw new Error("MySQL connection cannot be tested in browser environment");
  }

  try {
    const client = await getMySQLClient();
    await client.authenticate();
    logger.info("MySQL connection test successful");
    return true;
  } catch (error) {
    logger.error("MySQL connection test failed", error);
    return false;
  }
};

// Export a default object with all functions
const mysql = {
  getMySQLClient,
  initMySQL,
  resetMySQLClient,
  isMySQLInitialized,
  testConnection,
  QueryTypes,
};

export default mysql;
