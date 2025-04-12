/**
 * Proxy Routes
 *
 * These routes handle proxying requests to external websites to avoid CORS issues
 * and to provide server-side rendering capabilities for the web scraping module.
 */

import express from "express";
import axios from "axios";
import { JSDOM } from "jsdom";
import puppeteer from "puppeteer";
import { rateLimit } from "express-rate-limit";

const router = express.Router();

// Rate limiting to prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests from this IP, please try again after 15 minutes",
});

/**
 * @route GET /api/proxy
 * @desc Proxy a request to an external website
 * @access Public (with rate limiting)
 */
router.get("/", limiter, async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: "URL parameter is required" });
  }

  try {
    // Validate URL
    const parsedUrl = new URL(url);

    // Block requests to local network
    const hostname = parsedUrl.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.16.") ||
      hostname.endsWith(".local")
    ) {
      return res
        .status(403)
        .json({ error: "Access to local network addresses is forbidden" });
    }

    // Make request to external site
    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      responseType: "text",
      timeout: 10000, // 10 seconds timeout
    });

    // Process HTML to make it work in an iframe
    const dom = new JSDOM(response.data);
    const document = dom.window.document;

    // Add base tag to handle relative URLs
    const baseTag = document.createElement("base");
    baseTag.href = url;
    document.head.insertBefore(baseTag, document.head.firstChild);

    // Add custom styles to make the page work better in an iframe
    const styleTag = document.createElement("style");
    styleTag.textContent = `
      .selector-highlight {
        outline: 2px solid #3b82f6 !important;
        background-color: rgba(59, 130, 246, 0.1) !important;
      }
    `;
    document.head.appendChild(styleTag);

    // Add script to handle communication with parent frame
    const scriptTag = document.createElement("script");
    scriptTag.textContent = `
      window.addEventListener('message', function(event) {
        if (event.data && event.data.type === 'SELECT_ELEMENT') {
          // Handle element selection
          console.log('Select element request received');
        }
      });
    `;
    document.body.appendChild(scriptTag);

    // Send the modified HTML
    res.setHeader("Content-Type", "text/html");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.send(dom.serialize());
  } catch (error) {
    console.error("Proxy error:", error);
    res.status(500).json({
      error: "Failed to proxy request",
      message: error.message,
      url: url,
    });
  }
});

/**
 * @route POST /api/proxy/selector
 * @desc Extract selector information using Puppeteer
 * @access Private
 */
router.post("/selector", async (req, res) => {
  const { url, xpath } = req.body;

  if (!url || !xpath) {
    return res
      .status(400)
      .json({ error: "URL and XPath parameters are required" });
  }

  let browser;
  try {
    // Launch headless browser
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    // Set viewport and user agent
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    );

    // Navigate to URL
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    // Evaluate XPath and get element info
    const elementInfo = await page.evaluate((xpath) => {
      const getElementByXPath = (xpath) => {
        return document.evaluate(
          xpath,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null,
        ).singleNodeValue;
      };

      const element = getElementByXPath(xpath);
      if (!element) return null;

      // Generate CSS selector
      const getCssSelector = (el) => {
        if (!el) return "";
        if (el.id) return `#${el.id}`;

        let path = [];
        while (el && el.nodeType === Node.ELEMENT_NODE) {
          let selector = el.nodeName.toLowerCase();
          if (el.id) {
            selector += `#${el.id}`;
            path.unshift(selector);
            break;
          } else {
            let sibling = el;
            let nth = 1;
            while ((sibling = sibling.previousElementSibling)) {
              if (sibling.nodeName.toLowerCase() === selector) nth++;
            }
            if (nth !== 1) selector += `:nth-of-type(${nth})`;
          }
          path.unshift(selector);
          el = el.parentNode;
        }
        return path.join(" > ");
      };

      return {
        selector: getCssSelector(element),
        text: element.textContent.trim(),
        html: element.innerHTML,
        tagName: element.tagName.toLowerCase(),
        attributes: Array.from(element.attributes).reduce((obj, attr) => {
          obj[attr.name] = attr.value;
          return obj;
        }, {}),
      };
    }, xpath);

    if (!elementInfo) {
      return res
        .status(404)
        .json({ error: "Element not found with the provided XPath" });
    }

    res.json(elementInfo);
  } catch (error) {
    console.error("Selector extraction error:", error);
    res
      .status(500)
      .json({
        error: "Failed to extract selector information",
        message: error.message,
      });
  } finally {
    if (browser) await browser.close();
  }
});

/**
 * @route POST /api/proxy/scrape
 * @desc Scrape data from a URL using Puppeteer
 * @access Private
 */
router.post("/scrape", async (req, res) => {
  const { url, selectors } = req.body;

  if (!url || !selectors || !Array.isArray(selectors)) {
    return res
      .status(400)
      .json({ error: "URL and selectors array are required" });
  }

  let browser;
  try {
    // Launch headless browser
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    // Set viewport and user agent
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    );

    // Navigate to URL
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    // Extract data based on selectors
    const data = {};

    for (const selector of selectors) {
      try {
        const result = await page.evaluate((sel) => {
          const elements = document.querySelectorAll(sel.selector);
          if (!elements || elements.length === 0) return null;

          switch (sel.type) {
            case "text":
              return elements[0].textContent.trim();
            case "html":
              return elements[0].innerHTML;
            case "attribute":
              return elements[0].getAttribute(sel.attribute || "");
            case "list":
              if (sel.listItemSelector) {
                const items = Array.from(
                  elements[0].querySelectorAll(sel.listItemSelector),
                );
                return items.map((item) => item.textContent.trim());
              }
              return Array.from(elements).map((el) => el.textContent.trim());
            default:
              return elements[0].textContent.trim();
          }
        }, selector);

        data[selector.id] = result;
      } catch (selectorError) {
        console.warn(`Error with selector ${selector.id}:`, selectorError);
        data[selector.id] = null;
      }
    }

    res.json({
      url,
      timestamp: new Date().toISOString(),
      data,
      success: true,
    });
  } catch (error) {
    console.error("Scraping error:", error);
    res.status(500).json({
      url,
      timestamp: new Date().toISOString(),
      data: {},
      success: false,
      error: error.message,
    });
  } finally {
    if (browser) await browser.close();
  }
});

export default router;
