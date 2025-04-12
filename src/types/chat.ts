export type MessageStatus = "sending" | "sent" | "delivered" | "read" | "error";
export type UserStatus = "online" | "away" | "offline" | "busy";

export interface Message {
  id: string;
  content: string;
  sender: "user" | "assistant" | "system";
  timestamp: Date;
  status?: MessageStatus;
  isEdited?: boolean;
  attachments?: Attachment[];
  reactions?: Reaction[];
  metadata?: Record<string, any>;
  sessionId?: string;
  followUpQuestions?: string[];
}

export interface Attachment {
  id: string;
  type: "image" | "file" | "audio" | "video" | "link";
  url: string;
  name: string;
  size?: number;
  mimeType?: string;
  thumbnailUrl?: string;
  metadata?: Record<string, any>;
}

export interface Reaction {
  id: string;
  emoji: string;
  count: number;
  users: string[];
}

export interface ChatUser {
  id: string;
  name: string;
  avatar?: string;
  status: UserStatus;
  lastActive?: Date;
  isTyping?: boolean;
}

export interface ChatSession {
  id: string;
  title?: string;
  participants: ChatUser[];
  messages: Message[];
  unreadCount?: number;
  createdAt: Date;
  updatedAt: Date;
  lastMessage?: Message;
  isGroup?: boolean;
  metadata?: Record<string, any>;
}

export interface WebSocketMessage {
  type:
    | "message"
    | "typing"
    | "read"
    | "error"
    | "connection"
    | "history"
    | "history_request"
    | "user_status"
    | "reaction"
    | "message_update"
    | "message_delete"
    | "heartbeat";
  payload: any;
  timestamp: string;
  sessionId?: string;
  userId?: string;
}

export interface ChatWidgetConfig {
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  borderRadius?: number;
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  initialMessage?: string;
  placeholderText?: string;
  titleText?: string;
  subtitleText?: string;
  logoUrl?: string;
  showBranding?: boolean;
  allowAttachments?: boolean;
  allowVoice?: boolean;
  allowEmoji?: boolean;
  allowFeedback?: boolean;
  enableMarkdown?: boolean;
  theme?: "light" | "dark" | "system";
  customCSS?: string;
}

export interface FollowUpConfig {
  enabled?: boolean;
  maxQuestions?: number;
  showFollowUpAs?: "buttons" | "chips" | "list";
  autoGenerateFollowUps?: boolean;
  predefinedQuestions?: string[];
}

export interface ChatAuthConfig {
  apiKey?: string;
  userId?: string;
  userToken?: string;
  authEndpoint?: string;
  refreshTokenEndpoint?: string;
  onAuthError?: (error: Error) => void;
}

export interface ChatAPIConfig {
  baseUrl: string;
  wsUrl?: string;
  apiVersion?: string;
  headers?: Record<string, string>;
  requestTimeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}
