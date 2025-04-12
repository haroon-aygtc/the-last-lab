-- Complete MySQL Schema Migration
-- This script creates all necessary tables for the chat application

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255),
  role ENUM('user', 'admin', 'moderator') NOT NULL DEFAULT 'user',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  avatar_url VARCHAR(1024),
  last_login_at DATETIME,
  reset_token VARCHAR(100),
  reset_token_expires DATETIME,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verification_token VARCHAR(100),
  verification_token_expires DATETIME,
  failed_login_attempts INT NOT NULL DEFAULT 0,
  account_locked_until DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX users_email_idx (email),
  INDEX users_reset_token_idx (reset_token),
  INDEX users_verification_token_idx (verification_token)
);

-- User Sessions Table
CREATE TABLE IF NOT EXISTS user_sessions (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  device_info JSON,
  ip_address VARCHAR(45),
  location VARCHAR(255),
  last_active_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX user_sessions_user_id_idx (user_id)
);

-- User Activity Table
CREATE TABLE IF NOT EXISTS user_activity (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  action VARCHAR(100) NOT NULL,
  ip_address VARCHAR(45),
  user_agent VARCHAR(255),
  metadata JSON,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX user_activity_user_id_idx (user_id),
  INDEX user_activity_action_idx (action),
  INDEX user_activity_created_at_idx (created_at)
);

-- User Activity Logs Table (more detailed than user_activity)
CREATE TABLE IF NOT EXISTS user_activity_logs (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  activity_type VARCHAR(50) NOT NULL,
  description TEXT,
  ip_address VARCHAR(45),
  user_agent VARCHAR(255),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata JSON,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX user_activity_logs_user_id_idx (user_id),
  INDEX user_activity_logs_activity_type_idx (activity_type),
  INDEX user_activity_logs_created_at_idx (created_at)
);

-- Context Rules Table
CREATE TABLE IF NOT EXISTS context_rules (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  priority INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX context_rules_priority_idx (priority),
  INDEX context_rules_is_active_idx (is_active)
);

-- Widget Configs Table
CREATE TABLE IF NOT EXISTS widget_configs (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  primary_color VARCHAR(20) DEFAULT '#3b82f6',
  position ENUM('bottom-right', 'bottom-left', 'top-right', 'top-left') DEFAULT 'bottom-right',
  initial_state ENUM('minimized', 'expanded') DEFAULT 'minimized',
  allow_attachments BOOLEAN DEFAULT TRUE,
  allow_voice BOOLEAN DEFAULT TRUE,
  allow_emoji BOOLEAN DEFAULT TRUE,
  context_mode ENUM('general', 'restricted', 'custom') DEFAULT 'general',
  context_rule_id VARCHAR(36),
  welcome_message TEXT DEFAULT 'How can I help you today?',
  placeholder_text VARCHAR(255) DEFAULT 'Type your message here...',
  initially_open BOOLEAN DEFAULT FALSE,
  context_name VARCHAR(100) DEFAULT 'Website Assistance',
  title VARCHAR(100) DEFAULT 'Chat Widget',
  show_on_mobile BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (context_rule_id) REFERENCES context_rules(id) ON DELETE SET NULL,
  INDEX widget_configs_is_active_idx (is_active),
  INDEX widget_configs_is_default_idx (is_default)
);

-- Chat Sessions Table
CREATE TABLE IF NOT EXISTS chat_sessions (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36),
  widget_id VARCHAR(36),
  visitor_id VARCHAR(100),
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at DATETIME,
  last_message_at DATETIME,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSON,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (widget_id) REFERENCES widget_configs(id) ON DELETE SET NULL,
  INDEX chat_sessions_user_id_idx (user_id),
  INDEX chat_sessions_widget_id_idx (widget_id),
  INDEX chat_sessions_visitor_id_idx (visitor_id),
  INDEX chat_sessions_is_active_idx (is_active),
  INDEX chat_sessions_last_message_at_idx (last_message_at)
);

-- Chat Messages Table
CREATE TABLE IF NOT EXISTS chat_messages (
  id VARCHAR(36) PRIMARY KEY,
  session_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36),
  widget_id VARCHAR(36),
  content TEXT NOT NULL,
  role ENUM('user', 'assistant', 'system') NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata JSON,
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (widget_id) REFERENCES widget_configs(id) ON DELETE SET NULL,
  INDEX chat_messages_session_id_idx (session_id),
  INDEX chat_messages_user_id_idx (user_id),
  INDEX chat_messages_widget_id_idx (widget_id),
  INDEX chat_messages_created_at_idx (created_at)
);

-- Prompt Templates Table
CREATE TABLE IF NOT EXISTS prompt_templates (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  template TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX prompt_templates_is_active_idx (is_active)
);

-- AI Response Cache Table
CREATE TABLE IF NOT EXISTS ai_response_cache (
  id VARCHAR(36) PRIMARY KEY,
  prompt TEXT NOT NULL,
  prompt_hash VARCHAR(64) NOT NULL,
  response TEXT NOT NULL,
  model_used VARCHAR(50) NOT NULL DEFAULT 'default',
  metadata JSON,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  expires_at DATETIME,
  INDEX ai_response_cache_prompt_hash_idx (prompt_hash),
  INDEX ai_response_cache_model_used_idx (model_used),
  INDEX ai_response_cache_expires_at_idx (expires_at)
);

-- Knowledge Base Table
CREATE TABLE IF NOT EXISTS knowledge_base (
  id VARCHAR(36) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  source_url VARCHAR(1024),
  category VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX knowledge_base_category_idx (category),
  INDEX knowledge_base_is_active_idx (is_active),
  FULLTEXT INDEX knowledge_base_content_idx (content)
);

-- Knowledge Base Query Logs Table
CREATE TABLE IF NOT EXISTS knowledge_base_query_logs (
  id VARCHAR(36) PRIMARY KEY,
  query TEXT NOT NULL,
  results_count INT NOT NULL DEFAULT 0,
  user_id VARCHAR(36),
  session_id VARCHAR(36),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE SET NULL,
  INDEX knowledge_base_query_logs_user_id_idx (user_id),
  INDEX knowledge_base_query_logs_session_id_idx (session_id),
  INDEX knowledge_base_query_logs_created_at_idx (created_at)
);

-- AI Interaction Logs Table
CREATE TABLE IF NOT EXISTS ai_interaction_logs (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36),
  session_id VARCHAR(36),
  prompt TEXT NOT NULL,
  response TEXT NOT NULL,
  model_used VARCHAR(50) NOT NULL,
  tokens_used INT,
  processing_time INT, -- in milliseconds
  feedback VARCHAR(20),
  feedback_details TEXT,
  context_used TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata JSON,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE SET NULL,
  INDEX ai_interaction_logs_user_id_idx (user_id),
  INDEX ai_interaction_logs_session_id_idx (session_id),
  INDEX ai_interaction_logs_model_used_idx (model_used),
  INDEX ai_interaction_logs_created_at_idx (created_at),
  INDEX ai_interaction_logs_feedback_idx (feedback)
);

-- Follow-up Configurations Table
CREATE TABLE IF NOT EXISTS follow_up_configs (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_style ENUM('buttons', 'chips', 'list') DEFAULT 'buttons',
  max_questions INT NOT NULL DEFAULT 3,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX follow_up_configs_is_active_idx (is_active)
);

-- Predefined Questions Table
CREATE TABLE IF NOT EXISTS predefined_questions (
  id VARCHAR(36) PRIMARY KEY,
  config_id VARCHAR(36) NOT NULL,
  question VARCHAR(255) NOT NULL,
  `order` INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (config_id) REFERENCES follow_up_configs(id) ON DELETE CASCADE,
  INDEX predefined_questions_config_id_idx (config_id),
  INDEX predefined_questions_order_idx (`order`)
);

-- Topic-based Questions Table
CREATE TABLE IF NOT EXISTS topic_based_questions (
  id VARCHAR(36) PRIMARY KEY,
  config_id VARCHAR(36) NOT NULL,
  topic VARCHAR(100) NOT NULL,
  questions JSON NOT NULL, -- Array of questions
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (config_id) REFERENCES follow_up_configs(id) ON DELETE CASCADE,
  INDEX topic_based_questions_config_id_idx (config_id),
  INDEX topic_based_questions_topic_idx (topic)
);

-- Response Formatting Configurations Table
CREATE TABLE IF NOT EXISTS response_formatting_configs (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  enable_markdown BOOLEAN NOT NULL DEFAULT TRUE,
  enable_code_highlighting BOOLEAN NOT NULL DEFAULT TRUE,
  enable_link_previews BOOLEAN NOT NULL DEFAULT FALSE,
  enable_math_rendering BOOLEAN NOT NULL DEFAULT FALSE,
  enable_table_formatting BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX response_formatting_configs_is_active_idx (is_active)
);

-- Response Templates Table
CREATE TABLE IF NOT EXISTS response_templates (
  id VARCHAR(36) PRIMARY KEY,
  config_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  template TEXT NOT NULL,
  description TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (config_id) REFERENCES response_formatting_configs(id) ON DELETE CASCADE,
  INDEX response_templates_config_id_idx (config_id)
);

-- Flagged Content Table (for moderation)
CREATE TABLE IF NOT EXISTS flagged_content (
  id VARCHAR(36) PRIMARY KEY,
  content_id VARCHAR(36) NOT NULL,
  content_type VARCHAR(50) NOT NULL, -- e.g., 'message', 'user_input'
  reason TEXT NOT NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  reviewer_id VARCHAR(36),
  reviewed_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX flagged_content_status_idx (status),
  INDEX flagged_content_content_id_idx (content_id),
  INDEX flagged_content_content_type_idx (content_type)
);

-- Moderation Rules Table
CREATE TABLE IF NOT EXISTS moderation_rules (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  pattern VARCHAR(255) NOT NULL, -- Regex pattern or keyword
  action ENUM('flag', 'block', 'replace') NOT NULL DEFAULT 'flag',
  priority INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX moderation_rules_priority_idx (priority),
  INDEX moderation_rules_is_active_idx (is_active)
);

-- API Keys Table
CREATE TABLE IF NOT EXISTS api_keys (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  api_key VARCHAR(100) NOT NULL,
  permissions JSON NOT NULL, -- Array of permissions
  last_used_at DATETIME,
  expires_at DATETIME,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX api_keys_user_id_idx (user_id),
  INDEX api_keys_api_key_idx (api_key),
  INDEX api_keys_is_active_idx (is_active)
);

-- API Key Permissions Table
CREATE TABLE IF NOT EXISTS api_key_permissions (
  id VARCHAR(36) PRIMARY KEY,
  api_key_id VARCHAR(36) NOT NULL,
  resource VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE,
  INDEX api_key_permissions_api_key_id_idx (api_key_id),
  UNIQUE KEY api_key_permissions_unique_idx (api_key_id, resource, action)
);

-- System Settings Table
CREATE TABLE IF NOT EXISTS system_settings (
  id VARCHAR(36) PRIMARY KEY,
  category VARCHAR(50) NOT NULL,
  settings JSON NOT NULL,
  environment VARCHAR(20) NOT NULL DEFAULT 'production',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY system_settings_category_environment_idx (category, environment)
);

-- Analytics Data Table
CREATE TABLE IF NOT EXISTS analytics_data (
  id VARCHAR(36) PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  event_data JSON NOT NULL,
  user_id VARCHAR(36),
  session_id VARCHAR(36),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE SET NULL,
  INDEX analytics_data_event_type_idx (event_type),
  INDEX analytics_data_user_id_idx (user_id),
  INDEX analytics_data_session_id_idx (session_id),
  INDEX analytics_data_created_at_idx (created_at)
);

-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX notifications_user_id_idx (user_id),
  INDEX notifications_is_read_idx (is_read),
  INDEX notifications_created_at_idx (created_at)
);

-- Notification Preferences Table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  push_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  in_app_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  chat_activity BOOLEAN NOT NULL DEFAULT TRUE,
  system_updates BOOLEAN NOT NULL DEFAULT TRUE,
  marketing_communications BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX notification_preferences_user_id_idx (user_id)
);

-- Create initial admin user if not exists
INSERT INTO users (id, email, full_name, password_hash, role, is_active, email_verified, created_at, updated_at)
SELECT UUID(), 'admin@example.com', 'System Administrator', '$2a$12$K8HGT9VgfXvs1o0Wn3Z3WeSFE.DtN5AZUvFrX5yA6326.WOQ9cAUm', 'admin', TRUE, TRUE, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@example.com');

-- Create default widget configuration if not exists
INSERT INTO widget_configs (id, name, primary_color, position, initial_state, is_active, is_default, created_at, updated_at)
SELECT UUID(), 'Default Widget', '#3b82f6', 'bottom-right', 'minimized', TRUE, TRUE, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM widget_configs WHERE is_default = TRUE);

-- Create default context rule if not exists
INSERT INTO context_rules (id, name, description, content, is_active, priority, created_at, updated_at)
SELECT UUID(), 'General Assistance', 'Default context rule for general assistance', 'You are a helpful assistant that provides information and assistance on a wide range of topics.', TRUE, 100, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM context_rules WHERE name = 'General Assistance');
