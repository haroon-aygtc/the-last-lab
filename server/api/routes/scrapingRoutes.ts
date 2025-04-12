/**
 * Scraping Routes
 *
 * This module defines the API routes for web scraping operations.
 */

import express from "express";
import { authenticateJWT, checkAuth } from "../middleware/auth";
import ScrapingController from "../../controllers/ScrapingController";

const router = express.Router();

/**
 * @route POST /api/scraping/projects
 * @desc Create a new scraping project
 * @access Private
 */
router.post("/projects", authenticateJWT, ScrapingController.createProject);

/**
 * @route GET /api/scraping/projects/user/:userId
 * @desc Get all scraping projects for a user
 * @access Private
 */
router.get(
  "/projects/user/:userId",
  authenticateJWT,
  ScrapingController.getUserProjects,
);

/**
 * @route GET /api/scraping/projects/:id
 * @desc Get a scraping project by ID
 * @access Private
 */
router.get("/projects/:id", authenticateJWT, ScrapingController.getProject);

/**
 * @route PUT /api/scraping/projects/:id
 * @desc Update a scraping project
 * @access Private
 */
router.put("/projects/:id", authenticateJWT, ScrapingController.updateProject);

/**
 * @route DELETE /api/scraping/projects/:id
 * @desc Delete a scraping project
 * @access Private
 */
router.delete(
  "/projects/:id",
  authenticateJWT,
  ScrapingController.deleteProject,
);

/**
 * @route POST /api/scraping/projects/:projectId/jobs
 * @desc Run a scraping job
 * @access Private
 */
router.post(
  "/projects/:projectId/jobs",
  authenticateJWT,
  ScrapingController.runScrapingJob,
);

/**
 * @route GET /api/scraping/projects/:projectId/jobs
 * @desc Get jobs for a project
 * @access Private
 */
router.get(
  "/projects/:projectId/jobs",
  authenticateJWT,
  ScrapingController.getProjectJobs,
);

/**
 * @route GET /api/scraping/jobs/:jobId
 * @desc Get job details
 * @access Private
 */
router.get("/jobs/:jobId", authenticateJWT, ScrapingController.getJobDetails);

/**
 * @route PUT /api/scraping/jobs/:jobId/cancel
 * @desc Cancel a job
 * @access Private
 */
router.put(
  "/jobs/:jobId/cancel",
  authenticateJWT,
  ScrapingController.cancelJob,
);

/**
 * @route GET /api/scraping/jobs/:jobId/export
 * @desc Export job results
 * @access Private
 */
router.get(
  "/jobs/:jobId/export",
  authenticateJWT,
  ScrapingController.exportJobResults,
);

export default router;
