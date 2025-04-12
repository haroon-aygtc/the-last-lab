/**
 * Server-side type definitions
 */

// User entity
export interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  role: "user" | "admin" | "moderator";
  status: "active" | "inactive" | "suspended";
  created_at: string;
  updated_at: string;
  last_login?: string;
  profile_image?: string;
  settings?: Record<string, any>;
}

// Chat session entity
export interface ChatSession {
  id: string;
  user_id?: string;
  widget_id?: string;
  status: "active" | "closed" | "archived";
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// Chat message entity
export interface ChatMessage {
  id: string;
  session_id: string;
  user_id?: string;
  content: string;
  type: "user" | "assistant" | "system";
  status?: "sending" | "sent" | "delivered" | "read" | "error";
  metadata?: Record<string, any>;
  created_at: string;
  attachments?: Attachment[];
  follow_up_questions?: string[];
}

// Attachment entity
export interface Attachment {
  id: string;
  message_id?: string;
  type: "image" | "audio" | "video" | "file" | "link";
  url: string;
  name?: string;
  size?: number;
  mime_type?: string;
  created_at: string;
}

// Widget entity
export interface Widget {
  id: string;
  user_id: string;
  name: string;
  status: "active" | "inactive" | "draft";
  config: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// Context rule entity
export interface ContextRule {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  rules: Record<string, any>;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

// User activity entity
export interface UserActivity {
  id: string;
  user_id: string;
  action: string;
  details?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

// User session entity
export interface UserSession {
  id: string;
  user_id: string;
  token: string;
  refresh_token?: string;
  ip_address?: string;
  user_agent?: string;
  expires_at: string;
  status: "active" | "expired" | "terminated";
  created_at: string;
  updated_at: string;
}

// Knowledge base entity
export interface KnowledgeBase {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  status: "active" | "inactive" | "processing";
  created_at: string;
  updated_at: string;
}

// Knowledge base document entity
export interface KnowledgeBaseDocument {
  id: string;
  knowledge_base_id: string;
  title: string;
  content: string;
  source_url?: string;
  status: "active" | "inactive" | "processing";
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// API response structure
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta?: Record<string, any>;
}

// Pagination parameters
export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: "asc" | "desc";
}

// Controller request with user
export interface AuthenticatedRequest extends Express.Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}
