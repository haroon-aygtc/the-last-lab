/**
 * API Server for handling REST API requests
 * This complements the WebSocket server for non-real-time operations
 */
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { getMySQLClient } from "./utils/dbHelpers.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Get directory path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file in the root directory
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Initialize Express app
const app = express();
const PORT = process.env.API_PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Initialize MySQL connection
let mysqlClient = null;

// Initialize MySQL connection
const initializeMySQL = async () => {
  try {
    mysqlClient = await getMySQLClient();
    console.log("MySQL connection initialized successfully");
    return true;
  } catch (error) {
    console.error("Failed to initialize MySQL connection:", error);
    return false;
  }
};

// Call the initialization function
initializeMySQL().catch((err) => {
  console.error("Error during MySQL initialization:", err);
});

// Health check endpoint
app.get("/api/health", async (req, res) => {
  let mysqlConnected = false;

  try {
    if (!mysqlClient) {
      mysqlClient = await getMySQLClient();
    }
    // Test the connection with a simple query
    await mysqlClient.query("SELECT 1");
    mysqlConnected = true;
  } catch (error) {
    console.error("MySQL connection check failed:", error);
    mysqlConnected = false;
  }

  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    mysqlConnected,
  });
});

// API Routes

// Auth API
app.post("/api/auth/register", async (req, res) => {
  try {
    if (!mysqlClient) {
      mysqlClient = await getMySQLClient();
    }

    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Check if user already exists
    const [existingUsers] = await mysqlClient.query(
      "SELECT * FROM users WHERE email = ?",
      [email],
    );

    if (existingUsers.length > 0) {
      return res
        .status(409)
        .json({ error: "User with this email already exists" });
    }

    // Hash the password
    const bcrypt = await import("bcryptjs");
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert the new user
    const [result] = await mysqlClient.query(
      "INSERT INTO users (email, password, name, role, created_at) VALUES (?, ?, ?, ?, ?)",
      [email, hashedPassword, name || email.split("@")[0], "user", new Date()],
    );

    // Get the inserted user
    const [users] = await mysqlClient.query(
      "SELECT id, email, name, role, created_at FROM users WHERE id = ?",
      [result.insertId],
    );

    const user = users[0];

    res.status(201).json({ success: true, user });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    if (!mysqlClient) {
      mysqlClient = await getMySQLClient();
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Get user from database
    const [users] = await mysqlClient.query(
      "SELECT * FROM users WHERE email = ?",
      [email],
    );

    if (users.length === 0) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const user = users[0];

    // Verify password
    const bcrypt = await import("bcryptjs");
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Generate JWT token
    const jwt = await import("jsonwebtoken");
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "24h" },
    );

    // Don't send password back to client
    delete user.password;

    res.status(200).json({
      success: true,
      user,
      session: { token },
    });
  } catch (error) {
    console.error("Error logging in user:", error);
    res.status(500).json({ error: error.message });
  }
});

// Context Rules API
app.get("/api/context-rules", async (req, res) => {
  try {
    if (!mysqlClient) {
      mysqlClient = await getMySQLClient();
    }

    const [rules] = await mysqlClient.query(
      "SELECT * FROM context_rules ORDER BY priority DESC",
    );

    res.status(200).json(rules);
  } catch (error) {
    console.error("Error fetching context rules:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/context-rules/:id", async (req, res) => {
  try {
    if (!mysqlClient) {
      mysqlClient = await getMySQLClient();
    }

    const { id } = req.params;
    const [rules] = await mysqlClient.query(
      "SELECT * FROM context_rules WHERE id = ?",
      [id],
    );

    if (rules.length === 0) {
      return res.status(404).json({ error: "Context rule not found" });
    }

    res.status(200).json(rules[0]);
  } catch (error) {
    console.error(`Error fetching context rule ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/context-rules", async (req, res) => {
  try {
    if (!mysqlClient) {
      mysqlClient = await getMySQLClient();
    }

    const { name, description, content, isActive, priority } = req.body;

    if (!name || !content) {
      return res.status(400).json({ error: "Name and content are required" });
    }

    const is_active = isActive !== undefined ? isActive : true;
    const priorityValue = priority || 0;

    const [result] = await mysqlClient.query(
      "INSERT INTO context_rules (name, description, content, is_active, priority, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [name, description, content, is_active, priorityValue, new Date()],
    );

    const [insertedRule] = await mysqlClient.query(
      "SELECT * FROM context_rules WHERE id = ?",
      [result.insertId],
    );

    res.status(201).json(insertedRule[0]);
  } catch (error) {
    console.error("Error creating context rule:", error);
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/context-rules/:id", async (req, res) => {
  try {
    if (!mysqlClient) {
      mysqlClient = await getMySQLClient();
    }

    const { id } = req.params;
    const { name, description, content, isActive, priority } = req.body;

    // Check if rule exists
    const [existingRules] = await mysqlClient.query(
      "SELECT * FROM context_rules WHERE id = ?",
      [id],
    );

    if (existingRules.length === 0) {
      return res.status(404).json({ error: "Context rule not found" });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push("name = ?");
      values.push(name);
    }

    if (description !== undefined) {
      updates.push("description = ?");
      values.push(description);
    }

    if (content !== undefined) {
      updates.push("content = ?");
      values.push(content);
    }

    if (isActive !== undefined) {
      updates.push("is_active = ?");
      values.push(isActive);
    }

    if (priority !== undefined) {
      updates.push("priority = ?");
      values.push(priority);
    }

    updates.push("updated_at = ?");
    values.push(new Date());

    // Add id as the last parameter
    values.push(id);

    // Execute update
    await mysqlClient.query(
      `UPDATE context_rules SET ${updates.join(", ")} WHERE id = ?`,
      values,
    );

    // Get updated rule
    const [updatedRules] = await mysqlClient.query(
      "SELECT * FROM context_rules WHERE id = ?",
      [id],
    );

    res.status(200).json(updatedRules[0]);
  } catch (error) {
    console.error(`Error updating context rule ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/context-rules/:id", async (req, res) => {
  try {
    if (!mysqlClient) {
      mysqlClient = await getMySQLClient();
    }

    const { id } = req.params;

    // Check if rule exists
    const [existingRules] = await mysqlClient.query(
      "SELECT * FROM context_rules WHERE id = ?",
      [id],
    );

    if (existingRules.length === 0) {
      return res.status(404).json({ error: "Context rule not found" });
    }

    // Delete the rule
    await mysqlClient.query("DELETE FROM context_rules WHERE id = ?", [id]);

    res.status(204).send();
  } catch (error) {
    console.error(`Error deleting context rule ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Widget Configuration API
app.get("/api/widget-configs", async (req, res) => {
  try {
    if (!mysqlClient) {
      mysqlClient = await getMySQLClient();
    }

    const [configs] = await mysqlClient.query("SELECT * FROM widget_configs");

    res.status(200).json(configs);
  } catch (error) {
    console.error("Error fetching widget configs:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/widget-configs/:id", async (req, res) => {
  try {
    if (!mysqlClient) {
      mysqlClient = await getMySQLClient();
    }

    const { id } = req.params;
    const [configs] = await mysqlClient.query(
      "SELECT * FROM widget_configs WHERE id = ?",
      [id],
    );

    if (configs.length === 0) {
      return res.status(404).json({ error: "Widget config not found" });
    }

    res.status(200).json(configs[0]);
  } catch (error) {
    console.error(`Error fetching widget config ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/widget-configs", async (req, res) => {
  try {
    if (!mysqlClient) {
      mysqlClient = await getMySQLClient();
    }

    const {
      name,
      primary_color,
      position,
      initial_state,
      allow_attachments,
      allow_voice,
      allow_emoji,
      context_mode,
      context_rule_id,
      welcome_message,
      placeholder_text,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    const [result] = await mysqlClient.query(
      `INSERT INTO widget_configs (
        name, 
        primary_color, 
        position, 
        initial_state, 
        allow_attachments, 
        allow_voice, 
        allow_emoji, 
        context_mode, 
        context_rule_id, 
        welcome_message, 
        placeholder_text,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        primary_color || "#3b82f6",
        position || "bottom-right",
        initial_state || "minimized",
        allow_attachments !== undefined ? allow_attachments : true,
        allow_voice !== undefined ? allow_voice : true,
        allow_emoji !== undefined ? allow_emoji : true,
        context_mode || "general",
        context_rule_id || null,
        welcome_message || "How can I help you today?",
        placeholder_text || "Type your message here...",
        new Date(),
      ],
    );

    const [insertedConfig] = await mysqlClient.query(
      "SELECT * FROM widget_configs WHERE id = ?",
      [result.insertId],
    );

    res.status(201).json(insertedConfig[0]);
  } catch (error) {
    console.error("Error creating widget config:", error);
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/widget-configs/:id", async (req, res) => {
  try {
    if (!mysqlClient) {
      mysqlClient = await getMySQLClient();
    }

    const { id } = req.params;

    // Check if config exists
    const [existingConfigs] = await mysqlClient.query(
      "SELECT * FROM widget_configs WHERE id = ?",
      [id],
    );

    if (existingConfigs.length === 0) {
      return res.status(404).json({ error: "Widget config not found" });
    }

    // Only include fields that are provided in the request
    const allowedFields = [
      "name",
      "primary_color",
      "position",
      "initial_state",
      "allow_attachments",
      "allow_voice",
      "allow_emoji",
      "context_mode",
      "context_rule_id",
      "welcome_message",
      "placeholder_text",
    ];

    // Build update query dynamically
    const updates = [];
    const values = [];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        // Convert camelCase to snake_case for database
        const dbField = field.replace(/([A-Z])/g, "_$1").toLowerCase();
        updates.push(`${dbField} = ?`);
        values.push(req.body[field]);
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    updates.push("updated_at = ?");
    values.push(new Date());

    // Add id as the last parameter
    values.push(id);

    // Execute update
    await mysqlClient.query(
      `UPDATE widget_configs SET ${updates.join(", ")} WHERE id = ?`,
      values,
    );

    // Get updated config
    const [updatedConfigs] = await mysqlClient.query(
      "SELECT * FROM widget_configs WHERE id = ?",
      [id],
    );

    res.status(200).json(updatedConfigs[0]);
  } catch (error) {
    console.error(`Error updating widget config ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/widget-configs/:id", async (req, res) => {
  try {
    if (!mysqlClient) {
      mysqlClient = await getMySQLClient();
    }

    const { id } = req.params;

    // Check if config exists
    const [existingConfigs] = await mysqlClient.query(
      "SELECT * FROM widget_configs WHERE id = ?",
      [id],
    );

    if (existingConfigs.length === 0) {
      return res.status(404).json({ error: "Widget config not found" });
    }

    // Delete the config
    await mysqlClient.query("DELETE FROM widget_configs WHERE id = ?", [id]);

    res.status(204).send();
  } catch (error) {
    console.error(`Error deleting widget config ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Chat History API
app.get("/api/chat-history", async (req, res) => {
  try {
    if (!mysqlClient) {
      mysqlClient = await getMySQLClient();
    }

    const { user_id, widget_id, limit = 50, offset = 0 } = req.query;

    // Build query dynamically
    let query = "SELECT * FROM chat_messages WHERE 1=1";
    const params = [];

    if (user_id) {
      query += " AND user_id = ?";
      params.push(user_id);
    }

    if (widget_id) {
      query += " AND widget_id = ?";
      params.push(widget_id);
    }

    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(parseInt(limit), parseInt(offset));

    const [messages] = await mysqlClient.query(query, params);

    res.status(200).json(messages);
  } catch (error) {
    console.error("Error fetching chat history:", error);
    res.status(500).json({ error: error.message });
  }
});

// Analytics API
app.get("/api/analytics/overview", async (req, res) => {
  try {
    if (!mysqlClient) {
      mysqlClient = await getMySQLClient();
    }

    // Get total messages
    const [messagesResult] = await mysqlClient.query(
      "SELECT COUNT(*) as count FROM chat_messages",
    );
    const totalMessages = messagesResult[0].count;

    // Get total users
    const [usersResult] = await mysqlClient.query(
      "SELECT COUNT(*) as count FROM users",
    );
    const totalUsers = usersResult[0].count;

    // Get total widgets
    const [widgetsResult] = await mysqlClient.query(
      "SELECT COUNT(*) as count FROM widget_configs",
    );
    const totalWidgets = widgetsResult[0].count;

    // Get messages per day for the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [messagesPerDay] = await mysqlClient.query(
      "SELECT DATE(created_at) as date, COUNT(*) as count FROM chat_messages WHERE created_at >= ? GROUP BY DATE(created_at) ORDER BY date",
      [sevenDaysAgo.toISOString()],
    );

    // Format for chart display
    const chartData = messagesPerDay.map((item) => ({
      date: item.date.toISOString().split("T")[0],
      count: item.count,
    }));

    res.status(200).json({
      totalMessages,
      totalUsers,
      totalWidgets,
      messagesPerDay: chartData,
    });
  } catch (error) {
    console.error("Error fetching analytics overview:", error);
    res.status(500).json({ error: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// Start the server
const server = app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing API server");
  server.close(() => {
    console.log("API server closed");
    process.exit(0);
  });
});

export default app;
