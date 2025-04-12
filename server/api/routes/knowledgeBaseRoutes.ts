/**
 * Knowledge Base Routes
 *
 * This module defines the API routes for knowledge base management.
 */

import express from "express";
import { authenticateJWT, checkAuth } from "../middleware/auth";
import KnowledgeBaseController from "../../controllers/KnowledgeBaseController";

const router = express.Router();

/**
 * @route POST /api/knowledge-bases
 * @desc Create a new knowledge base
 * @access Private
 */
router.post("/", authenticateJWT, KnowledgeBaseController.createKnowledgeBase);

/**
 * @route GET /api/knowledge-bases/user/:userId
 * @desc Get all knowledge bases for a user
 * @access Private
 */
router.get(
  "/user/:userId",
  authenticateJWT,
  KnowledgeBaseController.getUserKnowledgeBases,
);

/**
 * @route GET /api/knowledge-bases/:id
 * @desc Get a knowledge base by ID
 * @access Private
 */
router.get("/:id", authenticateJWT, KnowledgeBaseController.getKnowledgeBase);

/**
 * @route PUT /api/knowledge-bases/:id
 * @desc Update a knowledge base
 * @access Private
 */
router.put(
  "/:id",
  authenticateJWT,
  KnowledgeBaseController.updateKnowledgeBase,
);

/**
 * @route DELETE /api/knowledge-bases/:id
 * @desc Delete a knowledge base
 * @access Private
 */
router.delete(
  "/:id",
  authenticateJWT,
  KnowledgeBaseController.deleteKnowledgeBase,
);

/**
 * @route POST /api/knowledge-bases/:id/documents
 * @desc Add a document to a knowledge base
 * @access Private
 */
router.post(
  "/:id/documents",
  authenticateJWT,
  KnowledgeBaseController.addDocument,
);

/**
 * @route GET /api/knowledge-bases/:id/documents
 * @desc Get documents for a knowledge base
 * @access Private
 */
router.get(
  "/:id/documents",
  authenticateJWT,
  KnowledgeBaseController.getDocuments,
);

export default router;
