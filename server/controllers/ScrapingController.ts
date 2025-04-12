/**
 * Scraping Controller
 *
 * Controller for web scraping operations
 */

import { Request, Response } from "express";
import { ScrapingRepository } from "../repositories/ScrapingRepository";
import { UserActivityRepository } from "../repositories/UserActivityRepository";
import logger from "../../src/utils/logger";
import { AuthenticatedRequest } from "../types";

export class ScrapingController {
  private scrapingRepository: ScrapingRepository;
  private userActivityRepository: UserActivityRepository;

  constructor() {
    this.scrapingRepository = new ScrapingRepository();
    this.userActivityRepository = new UserActivityRepository();
  }

  /**
   * Create a new scraping project
   */
  createProject = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, description, config } = req.body;

      if (!req.user || !req.user.userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: "ERR_UNAUTHORIZED",
            message: "Authentication required",
          },
        });
      }

      if (!name) {
        return res.status(400).json({
          success: false,
          error: {
            code: "ERR_MISSING_NAME",
            message: "Project name is required",
          },
        });
      }

      // Create project
      const project = await this.scrapingRepository.createProject({
        user_id: req.user.userId,
        name,
        description,
        config: config || {},
        status: "active",
      });

      // Log activity
      await this.userActivityRepository.logActivity({
        user_id: req.user.userId,
        action: "scraping_project_create",
        details: { projectId: project.id, projectName: name },
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return res.status(201).json({
        success: true,
        data: project,
      });
    } catch (error) {
      logger.error("Error in ScrapingController.createProject:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred while creating scraping project",
        },
      });
    }
  };

  /**
   * Get all scraping projects for a user
   */
  getUserProjects = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 20, status } = req.query;

      // Check if user is requesting their own projects or is an admin
      if (req.user?.userId !== userId && req.user?.role !== "admin") {
        return res.status(403).json({
          success: false,
          error: {
            code: "ERR_FORBIDDEN",
            message: "You do not have permission to access these projects",
          },
        });
      }

      const offset = (Number(page) - 1) * Number(limit);

      const projects = await this.scrapingRepository.findByUserId(userId, {
        limit: Number(limit),
        offset,
        status: status as string,
      });

      return res.json({
        success: true,
        data: projects.data,
        meta: {
          total: projects.total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(projects.total / Number(limit)),
        },
      });
    } catch (error) {
      logger.error("Error in ScrapingController.getUserProjects:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred while fetching scraping projects",
        },
      });
    }
  };

  /**
   * Get a scraping project by ID
   */
  getProject = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const project = await this.scrapingRepository.findById(id);

      if (!project) {
        return res.status(404).json({
          success: false,
          error: {
            code: "ERR_PROJECT_NOT_FOUND",
            message: "Scraping project not found",
          },
        });
      }

      // Check if user has access to this project
      if (req.user?.userId !== project.user_id && req.user?.role !== "admin") {
        return res.status(403).json({
          success: false,
          error: {
            code: "ERR_FORBIDDEN",
            message: "You do not have permission to access this project",
          },
        });
      }

      return res.json({
        success: true,
        data: project,
      });
    } catch (error) {
      logger.error("Error in ScrapingController.getProject:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred while fetching scraping project",
        },
      });
    }
  };

  /**
   * Update a scraping project
   */
  updateProject = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { name, description, config, status } = req.body;

      // Check if project exists
      const project = await this.scrapingRepository.findById(id);

      if (!project) {
        return res.status(404).json({
          success: false,
          error: {
            code: "ERR_PROJECT_NOT_FOUND",
            message: "Scraping project not found",
          },
        });
      }

      // Check if user has access to this project
      if (req.user?.userId !== project.user_id && req.user?.role !== "admin") {
        return res.status(403).json({
          success: false,
          error: {
            code: "ERR_FORBIDDEN",
            message: "You do not have permission to update this project",
          },
        });
      }

      // Update project
      const updateData: any = {};
      if (name) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (config) updateData.config = config;
      if (status) updateData.status = status;

      const updatedProject = await this.scrapingRepository.update(
        id,
        updateData,
      );

      // Log activity
      await this.userActivityRepository.logActivity({
        user_id: req.user?.userId as string,
        action: "scraping_project_update",
        details: { projectId: id, updates: Object.keys(updateData) },
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return res.json({
        success: true,
        data: updatedProject,
      });
    } catch (error) {
      logger.error("Error in ScrapingController.updateProject:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred while updating scraping project",
        },
      });
    }
  };

  /**
   * Delete a scraping project
   */
  deleteProject = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      // Check if project exists
      const project = await this.scrapingRepository.findById(id);

      if (!project) {
        return res.status(404).json({
          success: false,
          error: {
            code: "ERR_PROJECT_NOT_FOUND",
            message: "Scraping project not found",
          },
        });
      }

      // Check if user has access to this project
      if (req.user?.userId !== project.user_id && req.user?.role !== "admin") {
        return res.status(403).json({
          success: false,
          error: {
            code: "ERR_FORBIDDEN",
            message: "You do not have permission to delete this project",
          },
        });
      }

      // Delete project
      await this.scrapingRepository.delete(id);

      // Log activity
      await this.userActivityRepository.logActivity({
        user_id: req.user?.userId as string,
        action: "scraping_project_delete",
        details: { projectId: id, projectName: project.name },
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return res.json({
        success: true,
        message: "Scraping project deleted successfully",
      });
    } catch (error) {
      logger.error("Error in ScrapingController.deleteProject:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred while deleting scraping project",
        },
      });
    }
  };

  /**
   * Run a scraping job
   */
  runScrapingJob = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { projectId } = req.params;
      const { urls, options } = req.body;

      if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: "ERR_MISSING_URLS",
            message: "At least one URL is required",
          },
        });
      }

      // Check if project exists
      const project = await this.scrapingRepository.findById(projectId);

      if (!project) {
        return res.status(404).json({
          success: false,
          error: {
            code: "ERR_PROJECT_NOT_FOUND",
            message: "Scraping project not found",
          },
        });
      }

      // Check if user has access to this project
      if (req.user?.userId !== project.user_id && req.user?.role !== "admin") {
        return res.status(403).json({
          success: false,
          error: {
            code: "ERR_FORBIDDEN",
            message: "You do not have permission to run jobs for this project",
          },
        });
      }

      // Create and run job
      const job = await this.scrapingRepository.createJob({
        project_id: projectId,
        urls,
        options: options || {},
        status: "pending",
      });

      // Start the job asynchronously
      this.scrapingRepository.startJob(job.id).catch((error) => {
        logger.error(`Error running scraping job ${job.id}:`, error);
      });

      // Log activity
      await this.userActivityRepository.logActivity({
        user_id: req.user?.userId as string,
        action: "scraping_job_create",
        details: { projectId, jobId: job.id, urlCount: urls.length },
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return res.status(201).json({
        success: true,
        data: {
          job,
          message: "Scraping job started successfully",
        },
      });
    } catch (error) {
      logger.error("Error in ScrapingController.runScrapingJob:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred while running scraping job",
        },
      });
    }
  };

  /**
   * Get jobs for a project
   */
  getProjectJobs = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { projectId } = req.params;
      const { page = 1, limit = 20, status } = req.query;

      // Check if project exists
      const project = await this.scrapingRepository.findById(projectId);

      if (!project) {
        return res.status(404).json({
          success: false,
          error: {
            code: "ERR_PROJECT_NOT_FOUND",
            message: "Scraping project not found",
          },
        });
      }

      // Check if user has access to this project
      if (req.user?.userId !== project.user_id && req.user?.role !== "admin") {
        return res.status(403).json({
          success: false,
          error: {
            code: "ERR_FORBIDDEN",
            message:
              "You do not have permission to access jobs for this project",
          },
        });
      }

      const offset = (Number(page) - 1) * Number(limit);

      const jobs = await this.scrapingRepository.getJobsByProjectId(projectId, {
        limit: Number(limit),
        offset,
        status: status as string,
      });

      return res.json({
        success: true,
        data: jobs.data,
        meta: {
          total: jobs.total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(jobs.total / Number(limit)),
        },
      });
    } catch (error) {
      logger.error("Error in ScrapingController.getProjectJobs:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred while fetching scraping jobs",
        },
      });
    }
  };

  /**
   * Get job details
   */
  getJobDetails = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { jobId } = req.params;

      const job = await this.scrapingRepository.getJobById(jobId);

      if (!job) {
        return res.status(404).json({
          success: false,
          error: {
            code: "ERR_JOB_NOT_FOUND",
            message: "Scraping job not found",
          },
        });
      }

      // Get project to check permissions
      const project = await this.scrapingRepository.findById(job.project_id);

      if (!project) {
        return res.status(404).json({
          success: false,
          error: {
            code: "ERR_PROJECT_NOT_FOUND",
            message: "Scraping project not found",
          },
        });
      }

      // Check if user has access to this project
      if (req.user?.userId !== project.user_id && req.user?.role !== "admin") {
        return res.status(403).json({
          success: false,
          error: {
            code: "ERR_FORBIDDEN",
            message: "You do not have permission to access this job",
          },
        });
      }

      // Get job results
      const results = await this.scrapingRepository.getJobResults(jobId);

      return res.json({
        success: true,
        data: {
          job,
          results,
        },
      });
    } catch (error) {
      logger.error("Error in ScrapingController.getJobDetails:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred while fetching job details",
        },
      });
    }
  };

  /**
   * Cancel a job
   */
  cancelJob = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { jobId } = req.params;

      const job = await this.scrapingRepository.getJobById(jobId);

      if (!job) {
        return res.status(404).json({
          success: false,
          error: {
            code: "ERR_JOB_NOT_FOUND",
            message: "Scraping job not found",
          },
        });
      }

      // Get project to check permissions
      const project = await this.scrapingRepository.findById(job.project_id);

      if (!project) {
        return res.status(404).json({
          success: false,
          error: {
            code: "ERR_PROJECT_NOT_FOUND",
            message: "Scraping project not found",
          },
        });
      }

      // Check if user has access to this project
      if (req.user?.userId !== project.user_id && req.user?.role !== "admin") {
        return res.status(403).json({
          success: false,
          error: {
            code: "ERR_FORBIDDEN",
            message: "You do not have permission to cancel this job",
          },
        });
      }

      // Check if job can be cancelled
      if (job.status !== "pending" && job.status !== "running") {
        return res.status(400).json({
          success: false,
          error: {
            code: "ERR_INVALID_JOB_STATUS",
            message: "Only pending or running jobs can be cancelled",
          },
        });
      }

      // Cancel job
      await this.scrapingRepository.updateJobStatus(jobId, "cancelled");

      // Log activity
      await this.userActivityRepository.logActivity({
        user_id: req.user?.userId as string,
        action: "scraping_job_cancel",
        details: { projectId: project.id, jobId },
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });

      return res.json({
        success: true,
        message: "Scraping job cancelled successfully",
      });
    } catch (error) {
      logger.error("Error in ScrapingController.cancelJob:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred while cancelling job",
        },
      });
    }
  };

  /**
   * Export job results
   */
  exportJobResults = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { jobId } = req.params;
      const { format = "json" } = req.query;

      const job = await this.scrapingRepository.getJobById(jobId);

      if (!job) {
        return res.status(404).json({
          success: false,
          error: {
            code: "ERR_JOB_NOT_FOUND",
            message: "Scraping job not found",
          },
        });
      }

      // Get project to check permissions
      const project = await this.scrapingRepository.findById(job.project_id);

      if (!project) {
        return res.status(404).json({
          success: false,
          error: {
            code: "ERR_PROJECT_NOT_FOUND",
            message: "Scraping project not found",
          },
        });
      }

      // Check if user has access to this project
      if (req.user?.userId !== project.user_id && req.user?.role !== "admin") {
        return res.status(403).json({
          success: false,
          error: {
            code: "ERR_FORBIDDEN",
            message:
              "You do not have permission to export results for this job",
          },
        });
      }

      // Check if job is completed
      if (job.status !== "completed") {
        return res.status(400).json({
          success: false,
          error: {
            code: "ERR_INVALID_JOB_STATUS",
            message: "Only completed jobs can be exported",
          },
        });
      }

      // Get job results
      const results = await this.scrapingRepository.getJobResults(jobId);

      // Export based on format
      if (format === "csv") {
        const csvData =
          await this.scrapingRepository.exportResultsToCSV(results);
        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="job-${jobId}-results.csv"`,
        );
        return res.send(csvData);
      } else if (format === "excel") {
        const excelBuffer =
          await this.scrapingRepository.exportResultsToExcel(results);
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="job-${jobId}-results.xlsx"`,
        );
        return res.send(excelBuffer);
      } else {
        // Default to JSON
        // Log activity
        await this.userActivityRepository.logActivity({
          user_id: req.user?.userId as string,
          action: "scraping_job_export",
          details: { projectId: project.id, jobId, format },
          ip_address: req.ip,
          user_agent: req.headers["user-agent"],
        });

        return res.json({
          success: true,
          data: results,
        });
      }
    } catch (error) {
      logger.error("Error in ScrapingController.exportJobResults:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: "ERR_SERVER",
          message: "An error occurred while exporting job results",
        },
      });
    }
  };
}

export default new ScrapingController();
