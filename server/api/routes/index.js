/**
 * API Routes Index
 *
 * This file exports all API route modules and configures the API router.
 */

/**
 * API Routes Index
 *
 * This file exports all API route modules and configures the API router.
 */

import express from "express";
import authRoutes from "./authRoutes.js";
import chatRoutes from "./chatRoutes.js";
import contextRuleRoutes from "./contextRuleRoutes.js";
import knowledgeBaseRoutes from "./knowledgeBaseRoutes.js";
import userRoutes from "./userRoutes.js";
import widgetRoutes from "./widgetRoutes.js";
import aiRoutes from "./aiRoutes.js";
import responseFormattingRoutes from "./responseFormattingRoutes.js";
import moderationRoutes from "./moderationRoutes.js";
import notificationRoutes from "./notificationRoutes.js";
import userActivityRoutes from "./userActivityRoutes.js";
import followUpQuestionRoutes from "./followUpQuestionRoutes.js";
import scrapingRoutes from "./scrapingRoutes.js";
import { authenticateJWT } from "../middleware/auth.js";
import rateLimit from "express-rate-limit";

const router = express.Router();

// Configure rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    success: false,
    error: {
      code: "ERR_RATE_LIMIT",
      message: "Too many requests, please try again later.",
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  },
});

// Apply rate limiting to all routes
router.use(apiLimiter);

// Health check endpoint (no auth required)
router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
});

// Public routes (no auth required)
router.use("/auth", authRoutes);

// Protected routes (auth required)
router.use("/chat", authenticateJWT, chatRoutes);
router.use("/context-rules", authenticateJWT, contextRuleRoutes);
router.use("/knowledge-base", authenticateJWT, knowledgeBaseRoutes);
router.use("/users", authenticateJWT, userRoutes);
router.use("/widget-configs", authenticateJWT, widgetRoutes);
router.use("/ai", authenticateJWT, aiRoutes);
router.use("/response-formatting", authenticateJWT, responseFormattingRoutes);
router.use("/moderation", authenticateJWT, moderationRoutes);
router.use("/notifications", authenticateJWT, notificationRoutes);
router.use("/users", userActivityRoutes);
router.use("/follow-up-questions", authenticateJWT, followUpQuestionRoutes);
router.use("/scraping", authenticateJWT, scrapingRoutes);

// 404 handler for API routes
router.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: "ERR_NOT_FOUND",
      message: `API endpoint not found: ${req.method} ${req.originalUrl}`,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
});

export default router;
