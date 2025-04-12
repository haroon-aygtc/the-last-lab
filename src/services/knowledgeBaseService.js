import { getMySQLClient, QueryTypes } from "./mysqlClient.js";

/**
 * Knowledge Base Service
 * Handles all database operations related to the knowledge base
 */
class KnowledgeBaseService {
  /**
   * Fetch all knowledge base entries
   */
  async getAllEntries() {
    try {
      const db = await getMySQLClient();
      const entries = await db.query(
        "SELECT * FROM knowledge_base ORDER BY created_at DESC",
        {
          type: QueryTypes.SELECT,
        },
      );
      return entries;
    } catch (error) {
      console.error("Error fetching knowledge base entries:", error);
      throw new Error("Failed to fetch knowledge base entries");
    }
  }

  /**
   * Fetch a single knowledge base entry by ID
   */
  async getEntryById(id) {
    try {
      const db = await getMySQLClient();
      const entry = await db.query(
        "SELECT * FROM knowledge_base WHERE id = ?",
        {
          replacements: [id],
          type: QueryTypes.SELECT,
        },
      );

      return entry.length > 0 ? entry[0] : null;
    } catch (error) {
      console.error(`Error fetching knowledge base entry ${id}:`, error);
      throw new Error("Failed to fetch knowledge base entry");
    }
  }

  /**
   * Create a new knowledge base entry
   */
  async createEntry(entryData) {
    try {
      const { title, content, category, tags, created_by } = entryData;
      const db = await getMySQLClient();

      const result = await db.query(
        "INSERT INTO knowledge_base (title, content, category, tags, created_by) VALUES (?, ?, ?, ?, ?)",
        {
          replacements: [
            title,
            content,
            category || null,
            JSON.stringify(tags || []),
            created_by,
          ],
          type: QueryTypes.INSERT,
        },
      );

      const newEntryId = result[0];
      return this.getEntryById(newEntryId);
    } catch (error) {
      console.error("Error creating knowledge base entry:", error);
      throw new Error("Failed to create knowledge base entry");
    }
  }

  /**
   * Update an existing knowledge base entry
   */
  async updateEntry(id, entryData) {
    try {
      const { title, content, category, tags } = entryData;
      const db = await getMySQLClient();

      // Build update query dynamically
      let updateQuery = "UPDATE knowledge_base SET ";
      const updateValues = [];

      if (title) {
        updateQuery += "title = ?, ";
        updateValues.push(title);
      }

      if (content) {
        updateQuery += "content = ?, ";
        updateValues.push(content);
      }

      if (category !== undefined) {
        updateQuery += "category = ?, ";
        updateValues.push(category);
      }

      if (tags !== undefined) {
        updateQuery += "tags = ?, ";
        updateValues.push(JSON.stringify(tags));
      }

      // Add updated_at timestamp
      updateQuery += "updated_at = NOW() ";

      // Add WHERE clause
      updateQuery += "WHERE id = ?";
      updateValues.push(id);

      await db.query(updateQuery, {
        replacements: updateValues,
        type: QueryTypes.UPDATE,
      });

      return this.getEntryById(id);
    } catch (error) {
      console.error(`Error updating knowledge base entry ${id}:`, error);
      throw new Error("Failed to update knowledge base entry");
    }
  }

  /**
   * Delete a knowledge base entry
   */
  async deleteEntry(id) {
    try {
      const db = await getMySQLClient();
      await db.query("DELETE FROM knowledge_base WHERE id = ?", {
        replacements: [id],
        type: QueryTypes.DELETE,
      });
      return { success: true };
    } catch (error) {
      console.error(`Error deleting knowledge base entry ${id}:`, error);
      throw new Error("Failed to delete knowledge base entry");
    }
  }

  /**
   * Search knowledge base entries
   */
  async searchEntries(query) {
    try {
      const db = await getMySQLClient();
      const entries = await db.query(
        "SELECT * FROM knowledge_base WHERE title LIKE ? OR content LIKE ? OR category LIKE ? ORDER BY created_at DESC",
        {
          replacements: [`%${query}%`, `%${query}%`, `%${query}%`],
          type: QueryTypes.SELECT,
        },
      );
      return entries;
    } catch (error) {
      console.error("Error searching knowledge base entries:", error);
      throw new Error("Failed to search knowledge base entries");
    }
  }

  /**
   * Get knowledge base entries by category
   */
  async getEntriesByCategory(category) {
    try {
      const db = await getMySQLClient();
      const entries = await db.query(
        "SELECT * FROM knowledge_base WHERE category = ? ORDER BY created_at DESC",
        {
          replacements: [category],
          type: QueryTypes.SELECT,
        },
      );
      return entries;
    } catch (error) {
      console.error(
        `Error fetching knowledge base entries for category ${category}:`,
        error,
      );
      throw new Error("Failed to fetch knowledge base entries by category");
    }
  }
}

// Create a singleton instance
const knowledgeBaseService = new KnowledgeBaseService();

export default knowledgeBaseService;
