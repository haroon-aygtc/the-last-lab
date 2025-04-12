/**
 * Services Index
 *
 * This file exports all services to provide a centralized import point.
 * Import services from this file instead of directly from their individual files.
 */

// Database services
import { getMySQLClient } from "./mysqlClient.js";

// Feature services
import knowledgeBaseService from "./knowledgeBaseService.js";
import scrapingService from "./scrapingService.js";
import userService from "./userService.js";
import authService from "./authService.js";
import chatService from "./chatService.js";
import followUpConfigService from "./followUpConfigService.js";
import followUpQuestionService from "./followUpQuestionService.js";
import responseFormattingService from "./responseFormattingService.js";

// Export all services
export {
  // Database
  getMySQLClient,

  // Features
  knowledgeBaseService,
  scrapingService,
  userService,
  authService,
  chatService,
  followUpConfigService,
  followUpQuestionService,
  responseFormattingService,
};
