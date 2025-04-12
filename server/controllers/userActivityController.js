/**
 * User Activity Controller
 *
 * This module provides controller functions for user activity tracking.
 */

import { getMySQLClient, QueryTypes } from "../utils/dbHelpers.js";
import { v4 as uuidv4 } from "uuid";
import { formatResponse } from "../utils/responseFormatter.js";

/**
 * Log a user activity
 */
export const logActivity = async (req, res) => {
  try {
    const { user_id, action, ip_address, user_agent, metadata } = req.body;

    if (!user_id || !action) {
      return res.status(400).json(
        formatResponse(null, {
          message: "User ID and action are required",
          code: "ERR_400",
        }),
      );
    }

    const sequelize = await getMySQLClient();
    const id = uuidv4();
    const now = new Date().toISOString();

    await sequelize.query(
      `INSERT INTO user_activities 
       (id, user_id, action, ip_address, user_agent, metadata, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      {
        replacements: [
          id,
          user_id,
          action,
          ip_address || null,
          user_