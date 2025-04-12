/**
 * MySQL Client
 *
 * This file provides a singleton instance of the Sequelize client for MySQL.
 * It handles connection pooling and reconnection automatically.
 */

// Import Sequelize using named imports instead of default import
import { Sequelize, DataTypes, QueryTypes } from "sequelize";
import dbConfig from "../config/database.js";
import logger from "../utils/logger";

let sequelizeInstance = null;

/**
 * Get a MySQL client instance
 * @returns {Promise<Sequelize>} A Sequelize instance
 */
export const getMySQLClient = async () => {
  if (sequelizeInstance) {
    return sequelizeInstance;
  }

  try {
    // Get the current environment
    const env = process.env.NODE_ENV || "development";
    const config = dbConfig[env];

    if (!config) {
      throw new Error(
        `Database configuration for environment '${env}' not found`,
      );
    }

    // Create a new Sequelize instance
    sequelizeInstance = new Sequelize(
      config.database,
      config.username,
      config.password,
      {
        host: config.host,
        port: config.port,
        dialect: "mysql",
        logging: config.logging ? (msg) => logger.debug(msg) : false,
        pool: config.pool,
        dialectOptions: config.dialectOptions,
        define: {
          timestamps: true,
          underscored: true,
          createdAt: "created_at",
          updatedAt: "updated_at",
        },
        retry: {
          max: 5,
          match: [
            /SequelizeConnectionError/,
            /SequelizeConnectionRefusedError/,
            /SequelizeHostNotFoundError/,
            /SequelizeHostNotReachableError/,
            /SequelizeInvalidConnectionError/,
            /SequelizeConnectionTimedOutError/,
          ],
        },
      },
    );

    // Test the connection
    await sequelizeInstance.authenticate();
    logger.info("MySQL connection has been established successfully.");

    return sequelizeInstance;
  } catch (error) {
    logger.error("Unable to connect to the MySQL database:", error);
    throw error;
  }
};

/**
 * Close the MySQL connection
 */
export const closeMySQLConnection = async () => {
  if (sequelizeInstance) {
    await sequelizeInstance.close();
    sequelizeInstance = null;
    logger.info("MySQL connection closed.");
  }
};

/**
 * Execute a raw SQL query
 * @param {string} sql - The SQL query to execute
 * @param {Object} options - Query options
 * @returns {Promise<any>} Query results
 */
export const executeRawQuery = async (sql, options = {}) => {
  const sequelize = await getMySQLClient();
  try {
    return await sequelize.query(sql, {
      type: options.type || QueryTypes.SELECT,
      replacements: options.replacements || {},
      ...options,
    });
  } catch (error) {
    logger.error(`Error executing raw query: ${sql}`, error);
    throw error;
  }
};

// Export Sequelize types for convenience
export { DataTypes, QueryTypes };

// Export default for compatibility
export default getMySQLClient;
