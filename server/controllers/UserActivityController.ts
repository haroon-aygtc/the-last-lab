/**
 * User Activity Controller
 * 
 * Controller for user activity tracking and session management
 */

import { Request, Response } from 'express';
import { UserActivityRepository, UserSessionRepository } from '../repositories/UserActivityRepository';
import logger from '../../src/utils/logger';
import { AuthenticatedRequest } from '../types';

export class UserActivityController {
  private userActivityRepository: UserActivityRepository;
  private userSessionRepository: UserSessionRepository;
  
  constructor() {
    this.userActivityRepository = new UserActivityRepository();
    this.userSessionRepository = new UserSessionRepository();
  }
  
  /**
   * Log a user activity
   */
  logActivity = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { action, details } = req.body;
      
      if (!req.user || !req.user.userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'ERR_UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
      }
      
      if (!action) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'ERR_MISSING_ACTION',
            message: 'Action is required'
          }
        });
      }
      
      // Log activity
      const activity = await this.userActivityRepository.logActivity({
        user_id: req.user.userId,
        action,
        details,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });
      
      return res.status(201).json({
        success: true,
        data: activity
      });
    } catch (error) {
      logger.error('Error in UserActivityController.logActivity:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'ERR_SERVER',
          message: 'An error occurred while logging activity'
        }
      });
    }
  };
  
  /**
   * Get user activities
   */
  getUserActivities = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 20, startDate, endDate, action } = req.query;
      
      // Check if user is requesting their own activities or is an admin
      if (req.user?.userId !== userId && req.user?.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ERR_FORBIDDEN',
            message: 'You do not have permission to access these activities'
          }
        });
      }
      
      const offset = (Number(page) - 1) * Number(limit);
      
      const activities = await this.userActivityRepository.findByUserId(userId, {
        limit: Number(limit),
        offset,
        startDate: startDate as string,
        endDate: endDate as string,
        action: action as string
      });
      
      return res.json({
        success: true,
        data: activities.data,
        meta: {
          total: activities.total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(activities.total / Number(limit))
        }
      });
    } catch (error) {
      logger.error('Error in UserActivityController.getUserActivities:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'ERR_SERVER',
          message: 'An error occurred while fetching activities'
        }
      });
    }
  };
