/**
 * Database Helper Functions
 *
 * This module provides utility functions for database operations.
 */

import { Sequelize } from "sequelize";
import mysql2 from "mysql2";
import logger from "../../src/utils/logger";

// Database connection instance
let sequelizeInstance: Sequelize | null = null;

/**
 * Get MySQL client instance
 * Creates a new connection if one doesn't exist, otherwise returns the existing connection
 */
export const getMySQLClient = async (): Promise<Sequelize> => {
  if (sequelizeInstance) {
    return sequelizeInstance;
  }

  try {
    // Get database configuration from environment variables
    const dbHost = process.env.DB_HOST || "localhost";
    const dbPort = parseInt(process.env.DB_PORT || "3306", 10);
    const dbName = process.env.DB_NAME || "chat_system";
    const dbUser = process.env.DB_USER || "root";
    const dbPassword = process.env.DB_PASSWORD || "";

    // Create a new Sequelize instance
    sequelizeInstance = new Sequelize(dbName, dbUser, dbPassword, {
      host: dbHost,
      port: dbPort,
      dialect: "mysql",
      dialectModule: mysql2,
      logging: (msg) => logger.debug(msg),
      pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
      define: {
        timestamps: false,
        underscored: true,
      },
    });

    // Test the connection
    await sequelizeInstance.authenticate();
    logger.info("Database connection has been established successfully.");

    return sequelizeInstance;
  } catch (error) {
    logger.error("Unable to connect to the database:", error);
    throw error;
  }
};

/**
 * Close database connection
 */
export const closeDbConnection = async (): Promise<void> => {
  if (sequelizeInstance) {
    try {
      await sequelizeInstance.close();
      sequelizeInstance = null;
      logger.info("Database connection closed successfully.");
    } catch (error) {
      logger.error("Error closing database connection:", error);
      throw error;
    }
  }
};

/**
 * Execute a transaction
 */
export const executeTransaction = async <T>(
  callback: (transaction: any) => Promise<T>,
): Promise<T> => {
  const sequelize = await getMySQLClient();
  const transaction = await sequelize.transaction();

  try {
    const result = await callback(transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    await transaction.rollback();
    logger.error("Transaction rolled back:", error);
    throw error;
  }
};

/**
 * Execute a raw SQL query
 */
export const executeQuery = async <T>(
  sql: string,
  replacements: any[] = [],
): Promise<T[]> => {
  try {
    const sequelize = await getMySQLClient();
    const [results] = await sequelize.query(sql, { replacements });
    return results as T[];
  } catch (error) {
    logger.error("Error executing query:", error);
    throw error;
  }
};
