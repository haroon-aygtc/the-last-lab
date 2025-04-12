/**
 * Scraping Repository
 *
 * Repository for scraping-related database operations
 */

import { BaseRepository } from "./BaseRepository";
import { ScrapingProject, ScrapingJob, ScrapingResult } from "../types";
import logger from "../../src/utils/logger";
import { Parser } from "json2csv";
import ExcelJS from "exceljs";

export class ScrapingRepository extends BaseRepository<ScrapingProject> {
  constructor() {
    super("scraping_projects");
  }

  /**
   * Create a new scraping project
   */
  async createProject(
    data: Partial<ScrapingProject>,
  ): Promise<ScrapingProject> {
    try {
      return await this.create(data);
    } catch (error) {
      logger.error("Error in ScrapingRepository.createProject:", error);
      throw error;
    }
  }

  /**
   * Find projects by user ID
   */
  async findByUserId(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      status?: string;
    } = {},
  ): Promise<{ data: ScrapingProject[]; total: number }> {
    try {
      const db = await this.getDb();
      const { limit = 50, offset = 0, status } = options;

      // Build query conditions
      let whereClause = "WHERE user_id = ?";
      const replacements: any[] = [userId];

      if (status) {
        whereClause += " AND status = ?";
        replacements.push(status);
      }

      // Get total count
      const [countResult] = await db.query(
        `SELECT COUNT(*) as total FROM ${this.tableName} ${whereClause}`,
        { replacements },
      );

      const total = countResult[0].total;

      // Get paginated data
      const [data] = await db.query(
        `SELECT * FROM ${this.tableName} 
         ${whereClause} 
         ORDER BY created_at DESC 
         LIMIT ? OFFSET ?`,
        {
          replacements: [...replacements, limit, offset],
        },
      );

      return {
        data: data as ScrapingProject[],
        total,
      };
    } catch (error) {
      logger.error("Error in ScrapingRepository.findByUserId:", error);
      throw error;
    }
  }

  /**
   * Create a scraping job
   */
  async createJob(data: Partial<ScrapingJob>): Promise<ScrapingJob> {
    try {
      const db = await this.getDb();
      const now = new Date().toISOString();

      // Add id, created_at, and updated_at if not provided
      const jobData = {
        id: data.id || this.generateId(),
        created_at: now,
        updated_at: now,
        ...data,
      };

      // Build query dynamically based on data properties
      const columns = Object.keys(jobData).join(", ");
      const placeholders = Object.keys(jobData)
        .map(() => "?")
        .join(", ");
      const values = Object.values(jobData);

      await db.query(
        `INSERT INTO scraping_jobs (${columns}) VALUES (${placeholders})`,
        { replacements: values },
      );

      return jobData as ScrapingJob;
    } catch (error) {
      logger.error("Error in ScrapingRepository.createJob:", error);
      throw error;
    }
  }

  /**
   * Start a scraping job
   */
  async startJob(jobId: string): Promise<void> {
    try {
      // Update job status to running
      await this.updateJobStatus(jobId, "running");

      // Get job details
      const job = await this.getJobById(jobId);

      if (!job) {
        throw new Error(`Job with ID ${jobId} not found`);
      }

      // Process each URL
      const results: ScrapingResult[] = [];

      for (const url of job.urls) {
        try {
          // Simulate scraping process
          // In a real implementation, this would use a scraping library
          const result = await this.scrapeUrl(url, job.options);
          results.push(result);
        } catch (error) {
          logger.error(`Error scraping URL ${url}:`, error);
          results.push({
            id: this.generateId(),
            job_id: jobId,
            url,
            status: "error",
            error_message: error.message,
            created_at: new Date().toISOString(),
          });
        }
      }

      // Save results
      await this.saveJobResults(results);

      // Update job status to completed
      await this.updateJobStatus(jobId, "completed");
    } catch (error) {
      logger.error("Error in ScrapingRepository.startJob:", error);
      // Update job status to failed
      await this.updateJobStatus(jobId, "failed");
      throw error;
    }
  }

  /**
   * Scrape a URL
   * This is a placeholder implementation
   */
  private async scrapeUrl(url: string, options: any): Promise<ScrapingResult> {
    // In a real implementation, this would use a scraping library like Puppeteer or Cheerio
    return {
      id: this.generateId(),
      job_id: options.job_id,
      url,
      status: "success",
      data: { title: `Scraped content from ${url}`, content: "Sample content" },
      created_at: new Date().toISOString(),
    };
  }

  /**
   * Save job results
   */
  private async saveJobResults(results: ScrapingResult[]): Promise<void> {
    try {
      const db = await this.getDb();

      for (const result of results) {
        const columns = Object.keys(result).join(", ");
        const placeholders = Object.keys(result)
          .map(() => "?")
          .join(", ");
        const values = Object.values(result);

        await db.query(
          `INSERT INTO scraping_results (${columns}) VALUES (${placeholders})`,
          { replacements: values },
        );
      }
    } catch (error) {
      logger.error("Error in ScrapingRepository.saveJobResults:", error);
      throw error;
    }
  }

  /**
   * Update job status
   */
  async updateJobStatus(jobId: string, status: string): Promise<void> {
    try {
      const db = await this.getDb();
      const now = new Date().toISOString();

      await db.query(
        `UPDATE scraping_jobs SET status = ?, updated_at = ? WHERE id = ?`,
        { replacements: [status, now, jobId] },
      );
    } catch (error) {
      logger.error("Error in ScrapingRepository.updateJobStatus:", error);
      throw error;
    }
  }

  /**
   * Get job by ID
   */
  async getJobById(jobId: string): Promise<ScrapingJob | null> {
    try {
      const db = await this.getDb();

      const [results] = await db.query(
        `SELECT * FROM scraping_jobs WHERE id = ?`,
        { replacements: [jobId] },
      );

      return results.length > 0 ? (results[0] as ScrapingJob) : null;
    } catch (error) {
      logger.error("Error in ScrapingRepository.getJobById:", error);
      throw error;
    }
  }

  /**
   * Get jobs by project ID
   */
  async getJobsByProjectId(
    projectId: string,
    options: {
      limit?: number;
      offset?: number;
      status?: string;
    } = {},
  ): Promise<{ data: ScrapingJob[]; total: number }> {
    try {
      const db = await this.getDb();
      const { limit = 50, offset = 0, status } = options;

      // Build query conditions
      let whereClause = "WHERE project_id = ?";
      const replacements: any[] = [projectId];

      if (status) {
        whereClause += " AND status = ?";
        replacements.push(status);
      }

      // Get total count
      const [countResult] = await db.query(
        `SELECT COUNT(*) as total FROM scraping_jobs ${whereClause}`,
        { replacements },
      );

      const total = countResult[0].total;

      // Get paginated data
      const [data] = await db.query(
        `SELECT * FROM scraping_jobs 
         ${whereClause} 
         ORDER BY created_at DESC 
         LIMIT ? OFFSET ?`,
        {
          replacements: [...replacements, limit, offset],
        },
      );

      return {
        data: data as ScrapingJob[],
        total,
      };
    } catch (error) {
      logger.error("Error in ScrapingRepository.getJobsByProjectId:", error);
      throw error;
    }
  }

  /**
   * Get job results
   */
  async getJobResults(jobId: string): Promise<ScrapingResult[]> {
    try {
      const db = await this.getDb();

      const [results] = await db.query(
        `SELECT * FROM scraping_results WHERE job_id = ? ORDER BY created_at ASC`,
        { replacements: [jobId] },
      );

      return results as ScrapingResult[];
    } catch (error) {
      logger.error("Error in ScrapingRepository.getJobResults:", error);
      throw error;
    }
  }

  /**
   * Export results to CSV
   */
  async exportResultsToCSV(results: ScrapingResult[]): Promise<string> {
    try {
      // Prepare data for CSV export
      const csvData = results.map((result) => {
        const data = result.data || {};
        return {
          url: result.url,
          status: result.status,
          created_at: result.created_at,
          ...data,
        };
      });

      // Generate CSV
      const parser = new Parser();
      return parser.parse(csvData);
    } catch (error) {
      logger.error("Error in ScrapingRepository.exportResultsToCSV:", error);
      throw error;
    }
  }

  /**
   * Export results to Excel
   */
  async exportResultsToExcel(results: ScrapingResult[]): Promise<Buffer> {
    try {
      // Prepare data for Excel export
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Scraping Results");

      // Add headers
      const headers = ["URL", "Status", "Created At"];

      // Add data headers from the first result with data
      const sampleResult = results.find(
        (r) => r.data && Object.keys(r.data).length > 0,
      );
      if (sampleResult && sampleResult.data) {
        headers.push(...Object.keys(sampleResult.data));
      }

      worksheet.addRow(headers);

      // Add data rows
      results.forEach((result) => {
        const row = [result.url, result.status, result.created_at];

        // Add data fields
        if (result.data) {
          headers.slice(3).forEach((header) => {
            row.push(result.data[header] || "");
          });
        }

        worksheet.addRow(row);
      });

      // Generate Excel buffer
      return await workbook.xlsx.writeBuffer();
    } catch (error) {
      logger.error("Error in ScrapingRepository.exportResultsToExcel:", error);
      throw error;
    }
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `scrape_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
