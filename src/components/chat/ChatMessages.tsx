import React, { useRef, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThumbsUp, ThumbsDown, CheckCheck, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import FormattedMessage from "./FormattedMessage";
import FollowUpQuestions from "./FollowUpQuestions";
import { FollowUpConfig } from "@/components/admin/FollowUpQuestionsConfig";
import TypingIndicator from "./TypingIndicator";
import { Message, Attachment } from "@/types/chat";

interface ChatMessagesProps {
  messages: Message[];
  isTyping: boolean;
  allowFeedback?: boolean;
  messagesEndRef?: React.RefObject<HTMLDivElement>;
  enableMarkdown?: boolean;
  followUpConfig?: FollowUpConfig;
  onSelectFollowUpQuestion?: (question: string) => void;
  onMessageRead?: (messageId: string) => void;
  onReaction?: (messageId: string, reaction: string) => void;
}

const ChatMessages: React.FC<ChatMessagesProps> = ({
  messages,
  isTyping,
  allowFeedback = true,
  messagesEndRef,
  enableMarkdown = false,
  followUpConfig,
  onSelectFollowUpQuestion,
  onMessageRead,
  onReaction,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Mark messages as read when they become visible
  useEffect(() => {
    if (!onMessageRead) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const messageId = entry.target.getAttribute("data-message-id");
            if (messageId) {
              onMessageRead(messageId);
            }
          }
        });
      },
      { threshold: 0.5 },
    );

    const messageElements = document.querySelectorAll(".message-item");
    messageElements.forEach((el) => observer.observe(el));

    return () => {
      messageElements.forEach((el) => observer.unobserve(el));
    };
  }, [messages, onMessageRead]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const handleFeedback = (messageId: string, isPositive: boolean) => {
    if (onReaction) {
      onReaction(messageId, isPositive ? "thumbs_up" : "thumbs_down");
    } else {
      console.log(
        `Feedback for message ${messageId}: ${isPositive ? "👍" : "👎"}`,
      );
    }
  };

  const renderAttachment = (attachment: Attachment) => {
    switch (attachment.type) {
      case "image":
        return (
          <div className="mt-2 rounded overflow-hidden max-w-xs">
            <img
              src={attachment.url}
              alt={attachment.name}
              className="w-full h-auto object-cover"
            />
            <div className="text-xs text-gray-500 mt-1">{attachment.name}</div>
          </div>
        );
      case "audio":
        return (
          <div className="mt-2">
            <audio src={attachment.url} controls className="w-full max-w-xs" />
            <div className="text-xs text-gray-500 mt-1">{attachment.name}</div>
          </div>
        );
      case "video":
        return (
          <div className="mt-2">
            <video src={attachment.url} controls className="w-full max-w-xs" />
            <div className="text-xs text-gray-500 mt-1">{attachment.name}</div>
          </div>
        );
      case "file":
        return (
          <div className="mt-2 flex items-center gap-2 p-2 bg-gray-100 rounded">
            <a
              href={attachment.url}
              download={attachment.name}
              className="text-blue-600 text-sm hover:underline"
            >
              {attachment.name}
            </a>
            {attachment.size && (
              <span className="text-xs text-gray-500">
                ({Math.round(attachment.size / 1024)} KB)
              </span>
            )}
          </div>
        );
      case "link":
        return (
          <div className="mt-2">
            <a
              href={attachment.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {attachment.name || attachment.url}
            </a>
          </div>
        );
      default:
        return null;
    }
  };

  const getStatusIndicator = (status?: string) => {
    switch (status) {
      case "sent":
        return <Clock className="h-3 w-3 text-gray-400" />;
      case "delivered":
        return <CheckCheck className="h-3 w-3 text-gray-400" />;
      case "read":
        return <CheckCheck className="h-3 w-3 text-blue-500" />;
      case "error":
        return <span className="text-xs text-red-500">Failed</span>;
      default:
        return <Clock className="h-3 w-3 text-gray-400" />;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={containerRef}>
      {messages &&
        messages.length > 0 &&
        messages.map((message) => (
          <div
            key={message.id}
            className={`message-item flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
            data-message-id={message.id}
          >
            <div
              className={`flex max-w-[80%] ${message.sender === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              <Avatar className="h-8 w-8 mt-1">
                {message.sender === "user" ? (
                  <>
                    <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=user" />
                    <AvatarFallback>U</AvatarFallback>
                  </>
                ) : (
                  <>
                    <AvatarImage src="https://api.dicebear.com/7.x/bottts/svg?seed=assistant" />
                    <AvatarFallback>AI</AvatarFallback>
                  </>
                )}
              </Avatar>

              <div
                className={`mx-2 ${message.sender === "user" ? "items-end" : "items-start"} flex flex-col`}
              >
                <div
                  className={`rounded-lg p-3 ${message.sender === "user" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"} ${message.status === "error" ? "border border-red-500" : ""}`}
                  style={{
                    backgroundColor:
                      message.sender === "user"
                        ? "var(--primary-color, #4f46e5)"
                        : "var(--secondary-color, #f3f4f6)",
                    color:
                      message.sender === "user"
                        ? "white"
                        : "var(--text-color, #374151)",
                    borderRadius: "var(--border-radius, 8px)",
                  }}
                >
                  {enableMarkdown ? (
                    <FormattedMessage
                      content={message.content}
                      enableMarkdown={enableMarkdown}
                    />
                  ) : (
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  )}

                  {message.attachments && message.attachments.length > 0 && (
                    <div className="space-y-2">
                      {message.attachments.map((attachment) => (
                        <div key={attachment.id}>
                          {renderAttachment(attachment)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {message.sender === "assistant" &&
                  message.followUpQuestions &&
                  message.followUpQuestions.length > 0 && (
                    <div className="mt-2">
                      <FollowUpQuestions
                        questions={message.followUpQuestions}
                        onSelectQuestion={
                          onSelectFollowUpQuestion || (() => {})
                        }
                        displayStyle={
                          followUpConfig?.showFollowUpAs || "buttons"
                        }
                      />
                    </div>
                  )}

                <div className="flex items-center mt-1 text-xs text-gray-500">
                  <span>{formatTime(message.timestamp)}</span>
                  {message.sender === "user" && message.status && (
                    <span className="ml-1">
                      {getStatusIndicator(message.status)}
                    </span>
                  )}
                  {message.isEdited && (
                    <span className="ml-1 italic">(edited)</span>
                  )}
                </div>

                {allowFeedback && message.sender === "assistant" && (
                  <div className="flex mt-1 space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleFeedback(message.id, true)}
                    >
                      <ThumbsUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleFeedback(message.id, false)}
                    >
                      <ThumbsDown className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

      {isTyping && (
        <div className="flex justify-start">
          <div className="flex max-w-[80%]">
            <Avatar className="h-8 w-8 mt-1">
              <AvatarImage src="https://api.dicebear.com/7.x/bottts/svg?seed=assistant" />
              <AvatarFallback>AI</AvatarFallback>
            </Avatar>

            <div className="mx-2 items-start flex flex-col">
              <div
                className="rounded-lg p-3 bg-secondary text-secondary-foreground"
                style={{
                  backgroundColor: "var(--secondary-color, #f3f4f6)",
                  color: "var(--text-color, #374151)",
                  borderRadius: "var(--border-radius, 8px)",
                }}
              >
                <TypingIndicator className="text-muted-foreground" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* This div is used to scroll to the bottom */}
      <div ref={messagesEndRef} />

      {/* Show empty state if no messages */}
      {(!messages || messages.length === 0) && !isTyping && (
        <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 p-4">
          <p>Starting conversation...</p>
        </div>
      )}
    </div>
  );
};

export default ChatMessages;
