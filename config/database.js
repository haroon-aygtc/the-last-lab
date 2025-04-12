/**
 * Centralized database configuration for MySQL
 * This file exports configuration for different environments
 * All values are read from environment variables
 */
require("dotenv").config();

module.exports = {
  development: {
    username: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "chat_app_dev",
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: parseInt(process.env.MYSQL_PORT || "3306"),
    dialect: "mysql",
    dialectOptions: {
      bigNumberStrings: true,
    },
    logging: process.env.MYSQL_LOGGING === "true" ? console.log : false,
    pool: {
      max: parseInt(process.env.MYSQL_POOL_MAX || "10"),
      min: parseInt(process.env.MYSQL_POOL_MIN || "0"),
      acquire: parseInt(process.env.MYSQL_POOL_ACQUIRE || "30000"),
      idle: parseInt(process.env.MYSQL_POOL_IDLE || "10000"),
    },
  },
  test: {
    username: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_TEST_DATABASE || "chat_app_test",
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: parseInt(process.env.MYSQL_PORT || "3306"),
    dialect: "mysql",
    dialectOptions: {
      bigNumberStrings: true,
    },
    logging: false,
    pool: {
      max: parseInt(process.env.MYSQL_POOL_MAX || "10"),
      min: parseInt(process.env.MYSQL_POOL_MIN || "0"),
      acquire: parseInt(process.env.MYSQL_POOL_ACQUIRE || "30000"),
      idle: parseInt(process.env.MYSQL_POOL_IDLE || "10000"),
    },
  },
  production: {
    username: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    host: process.env.MYSQL_HOST,
    port: parseInt(process.env.MYSQL_PORT || "3306"),
    dialect: "mysql",
    dialectOptions: {
      bigNumberStrings: true,
      ssl:
        process.env.MYSQL_SSL === "true"
          ? {
              ca: process.env.MYSQL_CERT,
            }
          : false,
    },
    logging: false,
    pool: {
      max: parseInt(process.env.MYSQL_POOL_MAX || "10"),
      min: parseInt(process.env.MYSQL_POOL_MIN || "0"),
      acquire: parseInt(process.env.MYSQL_POOL_ACQUIRE || "30000"),
      idle: parseInt(process.env.MYSQL_POOL_IDLE || "10000"),
    },
  },
};
