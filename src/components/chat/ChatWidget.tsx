import React, { useState, useEffect, useRef, useCallback } from "react";
import ChatHeader from "./ChatHeader";
import ChatMessages from "./ChatMessages";
import ChatInput from "./ChatInput";
import { Button } from "@/components/ui/button";
import { MessageSquare, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { chatService } from "@/services/chatService";
import { useAuth } from "@/context/AuthContext";
import { useWebSocket } from "@/hooks/useWebSocket";
import { FollowUpConfig } from "@/components/admin/FollowUpQuestionsConfig";
import {
  Attachment,
  Message,
  MessageStatus,
  WebSocketMessage,
} from "@/types/chat";
import logger from "@/utils/logger";

interface ChatWidgetProps {
  config?: any;
  previewMode?: boolean;
  widgetId?: string;
  onClose?: () => void;
  embedded?: boolean;
  followUpConfig?: FollowUpConfig;
}

const ChatWidget: React.FC<ChatWidgetProps> = ({
  config,
  previewMode = false,
  widgetId,
  onClose,
  embedded = false,
  followUpConfig,
}) => {
  const [isOpen, setIsOpen] = useState(previewMode || false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [userTyping, setUserTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Initialize WebSocket with options
  const {
    connected,
    lastMessage,
    sendMessage: sendWsMessage,
    error: wsError,
    reconnecting: wsReconnecting,
  } = useWebSocket({
    autoReconnect: true,
    reconnectAttempts: 5,
    onMessage: handleWebSocketMessage,
    onOpen: () => {
      if (sessionId) {
        // Subscribe to session updates when WebSocket connects
        sendWsMessage({
          type: "subscribe",
          payload: { sessionId },
          timestamp: new Date().toISOString(),
        });
      }
    },
    onError: (event) => {
      logger.error("WebSocket error in ChatWidget:", event);
      toast({
        title: "Connection Error",
        description:
          "Having trouble connecting. Messages will be sent when connection is restored.",
        variant: "destructive",
      });
    },
  });

  // Default configuration
  const defaultConfig = {
    primaryColor: "#4f46e5",
    secondaryColor: "#f3f4f6",
    fontFamily: "Inter",
    borderRadius: 8,
    position: "bottom-right",
    initialMessage: "Hello! How can I help you today?",
    placeholderText: "Type your message here...",
    titleText: "Chat Support",
    subtitleText: "We typically reply within a few minutes",
    showBranding: true,
    allowAttachments: true,
    allowVoice: true,
    allowEmoji: true,
    allowFeedback: true,
    enableMarkdown: true,
  };

  // Merge provided config with defaults
  const widgetConfig = { ...defaultConfig, ...config };

  // WebSocket message handler
  function handleWebSocketMessage(wsMessage: WebSocketMessage) {
    if (!sessionId) return;

    switch (wsMessage.type) {
      case "message":
        if (wsMessage.sessionId === sessionId) {
          const messageData = wsMessage.payload;
          if (messageData.sender === "assistant") {
            setIsTyping(false);
            addMessageToState({
              id: messageData.id || Date.now().toString(),
              content: messageData.content,
              sender: "assistant",
              timestamp: new Date(wsMessage.timestamp),
              status: "delivered",
              followUpQuestions: generateFollowUpQuestions(messageData.content),
              attachments: messageData.attachments,
            });
          }
        }
        break;

      case "typing":
        if (
          wsMessage.sessionId === sessionId &&
          wsMessage.payload.userId !== user?.id
        ) {
          setIsTyping(wsMessage.payload.isTyping);
        }
        break;

      case "message_update":
        if (wsMessage.sessionId === sessionId) {
          updateMessageStatus(
            wsMessage.payload.messageId,
            wsMessage.payload.status,
          );
        }
        break;

      case "reaction":
        if (wsMessage.sessionId === sessionId) {
          updateMessageReaction(
            wsMessage.payload.messageId,
            wsMessage.payload.reaction,
          );
        }
        break;
    }
  }

  // Load widget configuration if widgetId is provided
  useEffect(() => {
    if (widgetId && !previewMode) {
      loadWidgetConfig();
    }
  }, [widgetId, previewMode]);

  const loadWidgetConfig = async () => {
    try {
      // Load widget configuration from the server
      const response = await fetch(`/api/widget/${widgetId}/config`);
      if (response.ok) {
        const data = await response.json();
        // Update the widget configuration
        // This would be handled by the parent component in a real implementation
      }
    } catch (error) {
      logger.error("Error loading widget configuration:", error);
    }
  };

  // Initialize chat session
  useEffect(() => {
    if (isOpen) {
      initChatSession();
    }
  }, [isOpen]);

  // Subscribe to session updates when sessionId changes
  useEffect(() => {
    if (connected && sessionId) {
      sendWsMessage({
        type: "subscribe",
        payload: { sessionId },
        timestamp: new Date().toISOString(),
      });

      // Cleanup: unsubscribe when component unmounts or sessionId changes
      return () => {
        sendWsMessage({
          type: "unsubscribe",
          payload: { sessionId },
          timestamp: new Date().toISOString(),
        });
      };
    }
  }, [connected, sessionId, sendWsMessage]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Handle user typing status
  useEffect(() => {
    if (connected && sessionId && userTyping) {
      sendWsMessage({
        type: "typing",
        payload: { isTyping: true, userId: user?.id },
        sessionId,
        timestamp: new Date().toISOString(),
      });

      // Automatically clear typing status after 3 seconds
      const timeout = setTimeout(() => {
        setUserTyping(false);
        sendWsMessage({
          type: "typing",
          payload: { isTyping: false, userId: user?.id },
          sessionId,
          timestamp: new Date().toISOString(),
        });
      }, 3000);

      return () => clearTimeout(timeout);
    }
  }, [connected, sessionId, userTyping, user, sendWsMessage]);

  // Handle WebSocket errors
  useEffect(() => {
    if (wsError) {
      logger.error("WebSocket error:", wsError);
    }
  }, [wsError]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const addMessageToState = useCallback((message: Message) => {
    setMessages((prev) => {
      // Check if message already exists to avoid duplicates
      const exists = prev.some((msg) => msg.id === message.id);
      if (exists) {
        return prev.map((msg) =>
          msg.id === message.id ? { ...msg, ...message } : msg,
        );
      } else {
        return [...prev, message];
      }
    });
  }, []);

  const updateMessageStatus = useCallback(
    (messageId: string, status: MessageStatus) => {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, status } : msg)),
      );
    },
    [],
  );

  const updateMessageReaction = useCallback(
    (messageId: string, reaction: string) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === messageId) {
            const reactions = msg.reactions || [];
            // Check if reaction already exists
            const existingReaction = reactions.find(
              (r) => r.emoji === reaction,
            );

            if (existingReaction) {
              // Increment count if reaction exists
              return {
                ...msg,
                reactions: reactions.map((r) =>
                  r.emoji === reaction
                    ? {
                        ...r,
                        count: r.count + 1,
                        users: [...r.users, user?.id || "anonymous"],
                      }
                    : r,
                ),
              };
            } else {
              // Add new reaction
              return {
                ...msg,
                reactions: [
                  ...reactions,
                  {
                    id: `reaction-${Date.now()}`,
                    emoji: reaction,
                    count: 1,
                    users: [user?.id || "anonymous"],
                  },
                ],
              };
            }
          }
          return msg;
        }),
      );
    },
    [user],
  );

  const initChatSession = async () => {
    try {
      // Clear any existing messages
      setMessages([]);

      // In preview mode, just add the initial message
      if (previewMode) {
        setMessages([
          {
            id: "initial",
            content: widgetConfig.initialMessage,
            sender: "assistant",
            timestamp: new Date(),
            followUpQuestions:
              followUpConfig?.predefinedQuestions?.[0]?.questions || [],
          },
        ]);
        return;
      }

      // Create or resume a chat session
      const session = await chatService.createSession(user?.id, widgetId, {
        source: embedded ? "embedded" : "widget",
      });
      setSessionId(session.id);

      // Load previous messages if any
      try {
        const history = await chatService.getSessionMessages(session.id);
        if (history.length > 0) {
          setMessages(history);
        } else {
          // Send initial message via WebSocket if connected
          if (connected) {
            sendWsMessage({
              type: "message",
              sessionId: session.id,
              payload: {
                content: widgetConfig.initialMessage,
                sender: "assistant",
              },
              timestamp: new Date().toISOString(),
            });
          }

          // Add initial message to UI immediately
          addMessageToState({
            id: `initial-${Date.now()}`,
            content: widgetConfig.initialMessage,
            sender: "assistant",
            timestamp: new Date(),
            status: "delivered",
            followUpQuestions:
              followUpConfig?.predefinedQuestions?.[0]?.questions || [],
          });
        }
      } catch (historyError) {
        logger.error("Error loading chat history:", historyError);
        // Still add initial message even if history fails
        addMessageToState({
          id: `initial-${Date.now()}`,
          content: widgetConfig.initialMessage,
          sender: "assistant",
          timestamp: new Date(),
          status: "delivered",
          followUpQuestions:
            followUpConfig?.predefinedQuestions?.[0]?.questions || [],
        });
      }
    } catch (error) {
      logger.error("Error initializing chat session:", error);
      // Even if there's an error, show the initial message in preview mode
      if (previewMode) {
        setMessages([
          {
            id: "initial",
            content: widgetConfig.initialMessage,
            sender: "assistant",
            timestamp: new Date(),
            followUpQuestions:
              followUpConfig?.predefinedQuestions?.[0]?.questions || [],
          },
        ]);
      } else {
        toast({
          title: "Error",
          description: "Failed to initialize chat. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const generateFollowUpQuestions = (content: string): string[] => {
    if (!followUpConfig?.enableFollowUpQuestions) return [];

    // If automatic generation is disabled, return predefined questions
    if (!followUpConfig.generateAutomatically) {
      // Return questions from the first predefined set or empty array
      return followUpConfig.predefinedQuestions?.[0]?.questions || [];
    }

    // Check for keyword matches in predefined question sets
    for (const set of followUpConfig.predefinedQuestions || []) {
      if (
        set.triggerKeywords &&
        set.triggerKeywords.some((keyword) =>
          content.toLowerCase().includes(keyword.toLowerCase()),
        )
      ) {
        return set.questions.slice(0, followUpConfig.maxFollowUpQuestions);
      }
    }

    // If no keyword matches, return questions from the first topic-based set or empty array
    return (
      followUpConfig.topicBasedQuestions?.[0]?.questions.slice(
        0,
        followUpConfig.maxFollowUpQuestions,
      ) || []
    );
  };

  const handleFollowUpQuestion = (question: string) => {
    handleSendMessage(question);
  };

  const handleTypingStart = () => {
    setUserTyping(true);
  };

  const handleTypingStop = () => {
    setUserTyping(false);
  };

  const handleSendMessage = async (
    content: string,
    attachments?: Attachment[],
  ) => {
    if (!content.trim() && (!attachments || attachments.length === 0)) return;
    if (!sessionId && !previewMode) {
      toast({
        title: "Error",
        description:
          "Chat session not initialized. Please refresh and try again.",
        variant: "destructive",
      });
      return;
    }

    // Create a new message object
    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      content,
      sender: "user",
      timestamp: new Date(),
      status: "sending",
      attachments,
    };

    // Add the message to the UI immediately
    addMessageToState(newMessage);

    // In preview mode, simulate a response
    if (previewMode) {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        addMessageToState({
          id: `resp-${Date.now()}`,
          content:
            "Thanks for your message! I'm here to help with any questions you might have about our products or services.",
          sender: "assistant",
          timestamp: new Date(),
          status: "delivered",
          followUpQuestions: [
            "What specific products are you interested in?",
            "Do you need help with a recent purchase?",
            "Would you like to know about our pricing plans?",
          ],
        });
      }, 1500);
      return;
    }

    try {
      // Update message status to sent
      updateMessageStatus(newMessage.id, "sent");

      // Show typing indicator
      setIsTyping(true);

      // Send the message via WebSocket if connected
      if (connected) {
        sendWsMessage({
          type: "message",
          sessionId: sessionId!,
          payload: {
            id: newMessage.id,
            content,
            sender: "user",
            attachments,
            userId: user?.id,
          },
          timestamp: new Date().toISOString(),
        });
      } else {
        // Fallback to REST API if WebSocket is not connected
        try {
          const response = await chatService.sendMessage(
            sessionId!,
            content,
            "user",
            attachments,
            { userId: user?.id },
          );

          // Update message status to delivered
          updateMessageStatus(newMessage.id, "delivered");

          // Simulate typing and response if using REST API
          setTimeout(() => {
            setIsTyping(false);
            addMessageToState({
              id: `resp-${Date.now()}`,
              content:
                "Thank you for your message. Our team will respond shortly.",
              sender: "assistant",
              timestamp: new Date(),
              status: "delivered",
              followUpQuestions: generateFollowUpQuestions(
                "Thank you for your message",
              ),
            });
          }, 1000);
        } catch (apiError) {
          throw apiError;
        }
      }
    } catch (error) {
      logger.error("Error sending message:", error);
      // Update message status to error
      updateMessageStatus(newMessage.id, "error");
      setIsTyping(false);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleMessageRead = (messageId: string) => {
    if (!sessionId || previewMode) return;

    // Update message status locally
    updateMessageStatus(messageId, "read");

    // Send read status to server
    if (connected) {
      sendWsMessage({
        type: "read",
        sessionId: sessionId,
        payload: { messageId },
        timestamp: new Date().toISOString(),
      });
    } else {
      // Fallback to REST API
      chatService.markMessageAsRead(messageId).catch((error) => {
        logger.error(`Error marking message ${messageId} as read:`, error);
      });
    }
  };

  const handleReaction = (messageId: string, reaction: string) => {
    if (!sessionId || previewMode) return;

    // Update reaction locally
    updateMessageReaction(messageId, reaction);

    // Send reaction to server
    if (connected) {
      sendWsMessage({
        type: "reaction",
        sessionId: sessionId,
        payload: { messageId, reaction, userId: user?.id },
        timestamp: new Date().toISOString(),
      });
    } else {
      // Fallback to REST API
      chatService.addReaction(messageId, reaction, user?.id).catch((error) => {
        logger.error(`Error adding reaction to message ${messageId}:`, error);
      });
    }
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  // Apply custom styles based on configuration
  const widgetStyle = {
    fontFamily: widgetConfig.fontFamily,
    "--primary-color": widgetConfig.primaryColor,
    "--secondary-color": widgetConfig.secondaryColor,
    "--border-radius": `${widgetConfig.borderRadius}px`,
  } as React.CSSProperties;

  // Position classes
  const positionClasses = {
    "bottom-right": "bottom-4 right-4",
    "bottom-left": "bottom-4 left-4",
    "top-right": "top-4 right-4",
    "top-left": "top-4 left-4",
  }[widgetConfig.position];

  // Connection status indicator
  const connectionStatus = wsReconnecting ? (
    <div className="bg-yellow-100 text-yellow-800 text-xs p-1 text-center">
      Reconnecting...
    </div>
  ) : !connected && !previewMode ? (
    <div className="bg-red-100 text-red-800 text-xs p-1 text-center">
      Offline - Messages will be sent when connection is restored
    </div>
  ) : null;

  // If embedded, render the full widget without the toggle button
  if (embedded) {
    return (
      <div
        className="chat-widget-container h-full flex flex-col overflow-hidden rounded-lg border shadow-lg bg-white"
        style={widgetStyle}
      >
        <ChatHeader
          title={widgetConfig.titleText}
          subtitle={widgetConfig.subtitleText}
          logoUrl={widgetConfig.logoUrl}
          onClose={onClose}
          primaryColor={widgetConfig.primaryColor}
          status={connected ? "online" : wsReconnecting ? "away" : "offline"}
        />
        {connectionStatus}
        <ChatMessages
          messages={messages}
          isTyping={isTyping}
          allowFeedback={widgetConfig.allowFeedback}
          messagesEndRef={messagesEndRef}
          followUpConfig={followUpConfig}
          onSelectFollowUpQuestion={handleFollowUpQuestion}
          enableMarkdown={widgetConfig.enableMarkdown}
          onMessageRead={handleMessageRead}
          onReaction={handleReaction}
        />
        <ChatInput
          onSendMessage={handleSendMessage}
          onTypingStart={handleTypingStart}
          onTypingStop={handleTypingStop}
          placeholder={widgetConfig.placeholderText}
          allowAttachments={widgetConfig.allowAttachments}
          allowVoice={widgetConfig.allowVoice}
          allowEmoji={widgetConfig.allowEmoji}
          primaryColor={widgetConfig.primaryColor}
          disabled={!connected && !previewMode && !wsReconnecting}
        />
        {widgetConfig.showBranding && (
          <div className="text-center py-2 text-xs text-gray-500">
            Powered by ChatAdmin
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`chat-widget fixed ${positionClasses} z-50`}
      style={widgetStyle}
    >
      {isOpen ? (
        <div className="chat-widget-expanded flex flex-col w-80 h-[500px] rounded-lg border shadow-lg bg-white overflow-hidden">
          <ChatHeader
            title={widgetConfig.titleText}
            subtitle={widgetConfig.subtitleText}
            logoUrl={widgetConfig.logoUrl}
            onClose={toggleChat}
            primaryColor={widgetConfig.primaryColor}
            status={connected ? "online" : wsReconnecting ? "away" : "offline"}
          />
          {connectionStatus}
          <ChatMessages
            messages={messages}
            isTyping={isTyping}
            allowFeedback={widgetConfig.allowFeedback}
            messagesEndRef={messagesEndRef}
            followUpConfig={followUpConfig}
            onSelectFollowUpQuestion={handleFollowUpQuestion}
            enableMarkdown={widgetConfig.enableMarkdown}
            onMessageRead={handleMessageRead}
            onReaction={handleReaction}
          />
          <ChatInput
            onSendMessage={handleSendMessage}
            onTypingStart={handleTypingStart}
            onTypingStop={handleTypingStop}
            placeholder={widgetConfig.placeholderText}
            allowAttachments={widgetConfig.allowAttachments}
            allowVoice={widgetConfig.allowVoice}
            allowEmoji={widgetConfig.allowEmoji}
            primaryColor={widgetConfig.primaryColor}
            disabled={!connected && !previewMode && !wsReconnecting}
          />
          {widgetConfig.showBranding && (
            <div className="text-center py-2 text-xs text-gray-500">
              Powered by ChatAdmin
            </div>
          )}
        </div>
      ) : (
        <Button
          onClick={toggleChat}
          className="chat-widget-button h-14 w-14 rounded-full shadow-lg flex items-center justify-center"
          style={{ backgroundColor: widgetConfig.primaryColor }}
        >
          <MessageSquare className="h-6 w-6 text-white" />
        </Button>
      )}
    </div>
  );
};

export default ChatWidget;
