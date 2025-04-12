/**
 * User Activity Repository Interface
 *
 * Defines the contract for user activity data access operations.
 * This is a port in the hexagonal architecture that will be
 * implemented by adapters in the infrastructure layer.
 */

export interface UserActivity {
  id?: string;
  user_id: string;
  action: string;
  details?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at?: string;
}

export interface IUserActivityRepository {
  logActivity(activity: UserActivity): Promise<string>; // Returns activity ID
  getActivitiesByUserId(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      startDate?: string;
      endDate?: string;
      actions?: string[];
    },
  ): Promise<{ data: UserActivity[]; total: number }>;
  getRecentActivities(options?: {
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
    actions?: string[];
  }): Promise<{ data: UserActivity[]; total: number }>;
  deleteActivitiesOlderThan(date: string): Promise<number>; // Returns number of deleted activities
}
