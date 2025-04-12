/**
 * Scraping Controller
 *
 * This module provides controller functions for web scraping operations.
 */

import { getMySQLClient, QueryTypes } from "../utils/dbHelpers.js";
import { v4 as uuidv4 } from "uuid";
import { formatResponse } from "../utils/responseFormatter.js";
import puppeteer from "puppeteer";
import cheerio from "cheerio";

/**
 * Scrape a URL with the provided selectors
 */
export const scrapeUrl = async (req, res) => {
  try {
    const { url, selectors, options } = req.body;

    if (!url || !selectors || !Array.isArray(selectors)) {
      return res.status(400).json(
        formatResponse(null, {
          message: "URL and selectors array are required",
          code: "ERR_400",
        }),
      );
    }

    // Validate URL
    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json(
        formatResponse(null, {
          message: "Invalid URL format",
          code: "ERR_400",
        }),
      );
    }

    // Launch browser
    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
      const page = await browser.newPage();

      // Set default viewport if provided
      if (options?.viewport) {
        await page.setViewport(options.viewport);
      }

      // Set custom headers if provided
      if (options?.headers) {
        await page.setExtraHTTPHeaders(options.headers);
      }

      // Set cookies if provided
      if (options?.cookies) {
        const parsedCookies =
          typeof options.cookies === "string"
            ? JSON.parse(options.cookies)
            : options.cookies;

        await page.setCookie(...parsedCookies);
      }

      // Navigate to URL
      await page.goto(url, {
        waitUntil: "networkidle2",
        timeout: options?.timeout || 30000,
      });

      // Wait for selector if specified
      if (options?.waitForSelector) {
        await page.waitForSelector(options.waitForSelector, {
          timeout: options?.waitTimeout || 10000,
        });
      }

      // Take screenshot if requested
      let screenshot = null;
      if (options?.captureScreenshot) {
        screenshot = await page.screenshot({ encoding: "base64" });
      }

      // Get page content
      const content = await page.content();
      const $ = cheerio.load(content);

      // Extract data based on selectors
      const data = {};
      for (const selector of selectors) {
        try {
          if (selector.type === "text") {
            data[selector.name] = $(selector.selector).text().trim();
          } else if (selector.type === "html") {
            data[selector.name] = $(selector.selector).html();
          } else if (selector.type === "attribute" && selector.attribute) {
            data[selector.name] = $(selector.selector).attr(selector.attribute);
          } else if (selector.type === "list" && selector.listItemSelector) {
            const list = [];
            $(selector.selector)
              .find(selector.listItemSelector)
              .each((i, el) => {
                list.push($(el).text().trim());
              });
            data[selector.name] = list;
          }
        } catch (selectorError) {
          console.error(`Error with selector ${selector.name}:`, selectorError);
          data[selector.name] = null;
        }
      }

      // Get page metadata
      const metadata = {
        statusCode: 200, // Since we got here, assume 200
        contentType: await page.evaluate(() => document.contentType),
        responseTime: Date.now(), // Just a timestamp
        pageTitle: await page.title(),
      };

      // Log the scraping activity
      await logScrapingActivity({
        userId: req.user?.id,
        url,
        selectors: selectors.map((s) => s.name).join(","),
        success: true,
      });

      // Close browser
      await browser.close();

      return res.json(
        formatResponse({
          url,
          timestamp: new Date().toISOString(),
          data,
          success: true,
          screenshot,
          metadata,
        }),
      );
    } catch (error) {
      console.error(`Error scraping URL ${url}:`, error);
      await browser.close();

      // Log the failed scraping activity
      await logScrapingActivity({
        userId: req.user?.id,
        url,
        selectors: selectors.map((s) => s.name).join(","),
        success: false,
        error: error.message,
      });

      return res.status(500).json(
        formatResponse(null, {
          message: `Error scraping URL: ${error.message}`,
          code: "ERR_500",
        }),
      );
    }
  } catch (error) {
    console.error("Error in scrapeUrl controller:", error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};

/**
 * Fetch HTML content from a URL for preview
 */
export const fetchHtmlPreview = async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json(
        formatResponse(null, {
          message: "URL is required",
          code: "ERR_400",
        }),
      );
    }

    // Validate URL
    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json(
        formatResponse(null, {
          message: "Invalid URL format",
          code: "ERR_400",
        }),
      );
    }

    // Launch browser
    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: "networkidle2" });
      const html = await page.content();
      await browser.close();

      return res.json(formatResponse({ html }));
    } catch (error) {
      console.error(`Error fetching HTML preview for ${url}:`, error);
      await browser.close();

      return res.status(500).json(
        formatResponse(null, {
          message: `Error fetching HTML preview: ${error.message}`,
          code: "ERR_500",
        }),
      );
    }
  } catch (error) {
    console.error("Error in fetchHtmlPreview controller:", error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};

/**
 * Test a selector against a URL
 */
export const testSelector = async (req, res) => {
  try {
    const { url, selector } = req.body;

    if (!url || !selector || !selector.selector) {
      return res.status(400).json(
        formatResponse(null, {
          message: "URL and selector are required",
          code: "ERR_400",
        }),
      );
    }

    // Launch browser
    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: "networkidle2" });
      const content = await page.content();
      const $ = cheerio.load(content);

      let result;
      if (selector.type === "text") {
        result = $(selector.selector).text().trim();
      } else if (selector.type === "html") {
        result = $(selector.selector).html();
      } else if (selector.type === "attribute" && selector.attribute) {
        result = $(selector.selector).attr(selector.attribute);
      } else if (selector.type === "list" && selector.listItemSelector) {
        const list = [];
        $(selector.selector)
          .find(selector.listItemSelector)
          .each((i, el) => {
            list.push($(el).text().trim());
          });
        result = list;
      }

      await browser.close();

      return res.json(
        formatResponse({
          success: true,
          result,
        }),
      );
    } catch (error) {
      console.error(`Error testing selector for ${url}:`, error);
      await browser.close();

      return res.json(
        formatResponse({
          success: false,
          result: null,
          error: error.message,
        }),
      );
    }
  } catch (error) {
    console.error("Error in testSelector controller:", error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};

/**
 * Start a new scraping job
 */
export const startScrapingJob = async (req, res) => {
  try {
    const options = req.body;

    if (!options || !options.url) {
      return res.status(400).json(
        formatResponse(null, {
          message: "URL is required",
          code: "ERR_400",
        }),
      );
    }

    // Create a new job in the database
    const sequelize = await getMySQLClient();
    const jobId = uuidv4();
    const now = new Date().toISOString();

    await sequelize.query(
      `INSERT INTO scraping_jobs 
       (id, url, status, progress, created_at, updated_at, options) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      {
        replacements: [
          jobId,
          options.url,
          "in-progress",
          0,
          now,
          now,
          JSON.stringify(options),
        ],
        type: QueryTypes.INSERT,
      },
    );

    // Start the scraping process asynchronously
    processScrapeJob(jobId, options).catch((error) => {
      console.error(`Error processing scrape job ${jobId}:`, error);
    });

    return res.json(formatResponse({ jobId }));
  } catch (error) {
    console.error("Error starting scraping job:", error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};

/**
 * Get the status of a scraping job
 */
export const getJobStatus = async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json(
        formatResponse(null, {
          message: "Job ID is required",
          code: "ERR_400",
        }),
      );
    }

    const sequelize = await getMySQLClient();
    const [job] = await sequelize.query(
      `SELECT * FROM scraping_jobs WHERE id = ?`,
      {
        replacements: [jobId],
        type: QueryTypes.SELECT,
      },
    );

    if (!job) {
      return res.status(404).json(
        formatResponse(null, {
          message: "Scraping job not found",
          code: "ERR_404",
        }),
      );
    }

    // Parse the data and metadata JSON fields
    const result = {
      id: job.id,
      url: job.url,
      timestamp: job.created_at,
      status: job.status,
      progress: job.progress,
      error: job.error,
      data: job.data
        ? JSON.parse(job.data)
        : {
            text: [],
            images: [],
            videos: [],
            tables: [],
            lists: [],
          },
      aiAnalysis: job.ai_analysis ? JSON.parse(job.ai_analysis) : undefined,
      metadata: job.metadata
        ? JSON.parse(job.metadata)
        : {
            pageTitle: "",
            pageDescription: "",
            pageKeywords: [],
            totalElements: 0,
          },
      exportPath: job.export_path,
      exportFormat: job.export_format,
    };

    return res.json(formatResponse(result));
  } catch (error) {
    console.error("Error getting job status:", error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};

/**
 * Get all scraping jobs
 */
export const getAllJobs = async (req, res) => {
  try {
    const sequelize = await getMySQLClient();
    const jobs = await sequelize.query(
      `SELECT id, url, status, progress, created_at, updated_at, error, export_path, export_format 
       FROM scraping_jobs 
       ORDER BY created_at DESC`,
      {
        type: QueryTypes.SELECT,
      },
    );

    // Format the jobs for the response
    const formattedJobs = jobs.map((job) => ({
      id: job.id,
      url: job.url,
      timestamp: job.created_at,
      status: job.status,
      progress: job.progress,
      error: job.error,
      exportPath: job.export_path,
      exportFormat: job.export_format,
    }));

    return res.json(formatResponse(formattedJobs));
  } catch (error) {
    console.error("Error getting all jobs:", error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};

/**
 * Delete a scraping job
 */
export const deleteJob = async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json(
        formatResponse(null, {
          message: "Job ID is required",
          code: "ERR_400",
        }),
      );
    }

    const sequelize = await getMySQLClient();
    await sequelize.query(`DELETE FROM scraping_jobs WHERE id = ?`, {
      replacements: [jobId],
      type: QueryTypes.DELETE,
    });

    return res.json(formatResponse(true));
  } catch (error) {
    console.error("Error deleting job:", error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};

/**
 * Run AI analysis on scraped content
 */
export const runAIAnalysis = async (req, res) => {
  try {
    const { resultId } = req.params;
    const { options } = req.body;

    if (!resultId) {
      return res.status(400).json(
        formatResponse(null, {
          message: "Result ID is required",
          code: "ERR_400",
        }),
      );
    }

    // Get the job from the database
    const sequelize = await getMySQLClient();
    const [job] = await sequelize.query(
      `SELECT * FROM scraping_jobs WHERE id = ?`,
      {
        replacements: [resultId],
        type: QueryTypes.SELECT,
      },
    );

    if (!job) {
      return res.status(404).json(
        formatResponse(null, {
          message: "Scraping job not found",
          code: "ERR_404",
        }),
      );
    }

    if (job.status !== "completed") {
      return res.status(400).json(
        formatResponse(null, {
          message: "Cannot analyze job that is not completed",
          code: "ERR_400",
        }),
      );
    }

    // Parse the data
    const data = job.data ? JSON.parse(job.data) : null;
    if (!data || !data.text || data.text.length === 0) {
      return res.status(400).json(
        formatResponse(null, {
          message: "No text data available for analysis",
          code: "ERR_400",
        }),
      );
    }

    // Perform AI analysis (mock implementation)
    // In a real implementation, this would call an AI service
    const aiAnalysis = {
      sentiment: {
        overall: "positive",
        score: 0.75,
      },
      entities: [{ name: "Example Entity", type: "organization", count: 3 }],
      summary: "This is a summary of the scraped content.",
      keywords: ["example", "keyword", "analysis"],
      categories: ["technology", "web"],
      cleanedText: data.text.join("\n"),
    };

    // Update the job with the AI analysis
    await sequelize.query(
      `UPDATE scraping_jobs SET ai_analysis = ?, updated_at = ? WHERE id = ?`,
      {
        replacements: [
          JSON.stringify(aiAnalysis),
          new Date().toISOString(),
          resultId,
        ],
        type: QueryTypes.UPDATE,
      },
    );

    return res.json(formatResponse(aiAnalysis));
  } catch (error) {
    console.error("Error running AI analysis:", error);
    return res.status(500).json(
      formatResponse(null, {
        message: "Internal server error",
        code: "ERR_500",
      }),
    );
  }
};

// Helper functions

/**
 * Process a scraping job asynchronously
 */
async function processScrapeJob(jobId, options) {
  try {
    const sequelize = await getMySQLClient();

    // Update progress to 10%
    await updateJobProgress(jobId, 10, "Initializing scraper");

    // Launch browser
    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
      const page = await browser.newPage();

      // Configure browser based on options
      if (
        options.securityOptions?.enableProxy &&
        options.securityOptions.proxyUrl
      ) {
        // This is a simplified version - in production you'd need a more robust proxy setup
        console.log(`Using proxy: ${options.securityOptions.proxyUrl}`);
      }

      // Update progress to 20%
      await updateJobProgress(jobId, 20, "Navigating to page");

      // Navigate to URL
      await page.goto(options.url, {
        waitUntil: "networkidle2",
        timeout: 60000,
      });

      // Handle login if required
      if (options.loginRequired && options.loginCredentials) {
        await updateJobProgress(jobId, 30, "Handling login");

        await page.waitForSelector(options.loginCredentials.usernameSelector);
        await page.type(
          options.loginCredentials.usernameSelector,
          options.loginCredentials.username,
        );
        await page.type(
          options.loginCredentials.passwordSelector,
          options.loginCredentials.password,
        );
        await page.click(options.loginCredentials.submitSelector);
        await page.waitForNavigation({ waitUntil: "networkidle2" });
      }

      // Update progress to 40%
      await updateJobProgress(jobId, 40, "Extracting content");

      // Wait for dynamic content if needed
      if (options.waitForDynamicContent && options.waitTime) {
        await new Promise((resolve) => setTimeout(resolve, options.waitTime));
      }

      // Get page metadata
      const metadata = {
        pageTitle: await page.title(),
        pageDescription: await page.evaluate(() => {
          const metaDescription = document.querySelector(
            'meta[name="description"]',
          );
          return metaDescription ? metaDescription.getAttribute("content") : "";
        }),
        pageKeywords: await page.evaluate(() => {
          const metaKeywords = document.querySelector('meta[name="keywords"]');
          return metaKeywords
            ? metaKeywords
                .getAttribute("content")
                .split(",")
                .map((k) => k.trim())
            : [];
        }),
        totalElements: await page.evaluate(
          () => document.querySelectorAll("*").length,
        ),
        statusCode: 200,
        contentType: await page.evaluate(() => document.contentType),
        responseTime: Date.now(),
      };

      // Extract content based on options
      const data = {
        text: [],
        images: [],
        videos: [],
        tables: [],
        lists: [],
      };

      // Update progress to 60%
      await updateJobProgress(jobId, 60, "Processing extracted content");

      // Extract text content
      if (options.scrapeText) {
        if (options.selector) {
          // Extract text from specific selector
          data.text = await page.evaluate((selector) => {
            const elements = Array.from(document.querySelectorAll(selector));
            return elements
              .map((el) => el.textContent.trim())
              .filter((text) => text.length > 0);
          }, options.selector);
        } else if (options.scrapeFullPage) {
          // Extract text from the entire page
          const bodyText = await page.evaluate(() => document.body.innerText);
          data.text = bodyText
            .split("\n")
            .filter((line) => line.trim().length > 0);
        }
      }

      // Extract images if requested
      if (options.scrapeImages) {
        data.images = await page.evaluate(() => {
          return Array.from(document.querySelectorAll("img"))
            .map((img) => ({
              src: img.src,
              alt: img.alt,
              width: img.width,
              height: img.height,
            }))
            .filter((img) => img.src && !img.src.startsWith("data:"));
        });
      }

      // Extract videos if requested
      if (options.scrapeVideos) {
        data.videos = await page.evaluate(() => {
          return Array.from(
            document.querySelectorAll(
              'video, iframe[src*="youtube"], iframe[src*="vimeo"]',
            ),
          )
            .map((video) => ({
              src: video.src || video.querySelector("source")?.src,
              type: video.tagName.toLowerCase(),
              width: video.width,
              height: video.height,
            }))
            .filter((video) => video.src);
        });
      }

      // Handle pagination if enabled
      if (
        options.pagination?.enabled &&
        options.pagination.nextButtonSelector
      ) {
        let currentPage = 1;
        const maxPages = options.pagination.maxPages || 5;

        while (currentPage < maxPages) {
          // Check if next button exists and is visible
          const hasNextPage = await page.evaluate((selector) => {
            const nextButton = document.querySelector(selector);
            return nextButton && nextButton.offsetParent !== null;
          }, options.pagination.nextButtonSelector);

          if (!hasNextPage) break;

          // Update progress
          await updateJobProgress(
            jobId,
            60 + Math.floor((currentPage / maxPages) * 20),
            `Processing page ${currentPage + 1} of ${maxPages}`,
          );

          // Click next button and wait for navigation
          await page.click(options.pagination.nextButtonSelector);
          await page.waitForNavigation({ waitUntil: "networkidle2" });

          // Extract content from this page and add to existing data
          if (options.scrapeText) {
            if (options.selector) {
              const pageText = await page.evaluate((selector) => {
                const elements = Array.from(
                  document.querySelectorAll(selector),
                );
                return elements
                  .map((el) => el.textContent.trim())
                  .filter((text) => text.length > 0);
              }, options.selector);
              data.text = [...data.text, ...pageText];
            } else if (options.scrapeFullPage) {
              const bodyText = await page.evaluate(
                () => document.body.innerText,
              );
              const textLines = bodyText
                .split("\n")
                .filter((line) => line.trim().length > 0);
              data.text = [...data.text, ...textLines];
            }
          }

          currentPage++;
        }
      }

      // Update progress to 80%
      await updateJobProgress(jobId, 80, "Finalizing results");

      // Close browser
      await browser.close();

      // Handle export options
      let exportPath = null;
      let exportFormat = null;

      if (options.exportOptions) {
        exportFormat = options.exportOptions.format || "json";
        const filename =
          options.exportOptions.customFilename ||
          `scrape_${new Date().toISOString().replace(/[:.]/g, "-")}`;

        exportPath = `/exports/${filename}.${exportFormat}`;

        // In a real implementation, you would save the data to a file here
        console.log(
          `Would export data to ${exportPath} in ${exportFormat} format`,
        );
      }

      // Update progress to 100% and mark as completed
      await sequelize.query(
        `UPDATE scraping_jobs 
         SET status = ?, progress = ?, data = ?, metadata = ?, export_path = ?, export_format = ?, updated_at = ? 
         WHERE id = ?`,
        {
          replacements: [
            "completed",
            100,
            JSON.stringify(data),
            JSON.stringify(metadata),
            exportPath,
            exportFormat,
            new Date().toISOString(),
            jobId,
          ],
          type: QueryTypes.UPDATE,
        },
      );
    } catch (error) {
      console.error(`Error processing scrape job ${jobId}:`, error);
      await browser.close();

      // Update job with error
      await sequelize.query(
        `UPDATE scraping_jobs SET status = ?, error = ?, updated_at = ? WHERE id = ?`,
        {
          replacements: [
            "failed",
            error.message,
            new Date().toISOString(),
            jobId,
          ],
          type: QueryTypes.UPDATE,
        },
      );
    }
  } catch (error) {
    console.error(`Error in processScrapeJob for ${jobId}:`, error);

    // Update job with error
    const sequelize = await getMySQLClient();
    await sequelize.query(
      `UPDATE scraping_jobs SET status = ?, error = ?, updated_at = ? WHERE id = ?`,
      {
        replacements: [
          "failed",
          error.message,
          new Date().toISOString(),
          jobId,
        ],
        type: QueryTypes.UPDATE,
      },
    );
  }
}

/**
 * Update the progress of a scraping job
 */
async function updateJobProgress(jobId, progress, statusMessage) {
  try {
    const sequelize = await getMySQLClient();
    await sequelize.query(
      `UPDATE scraping_jobs SET progress = ?, status_message = ?, updated_at = ? WHERE id = ?`,
      {
        replacements: [
          progress,
          statusMessage,
          new Date().toISOString(),
          jobId,
        ],
        type: QueryTypes.UPDATE,
      },
    );
  } catch (error) {
    console.error(`Error updating job progress for ${jobId}:`, error);
  }
}

/**
 * Log scraping activity
 */
async function logScrapingActivity(activity) {
  try {
    const sequelize = await getMySQLClient();
    await sequelize.query(
      `INSERT INTO scraping_activity 
       (id, user_id, url, selectors, success, error, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      {
        replacements: [
          uuidv4(),
          activity.userId || null,
          activity.url,
          activity.selectors,
          activity.success,
          activity.error || null,
          new Date().toISOString(),
        ],
        type: QueryTypes.INSERT,
      },
    );
  } catch (error) {
    console.error("Error logging scraping activity:", error);
    // Don't throw - logging failures shouldn't break the application
  }
}
